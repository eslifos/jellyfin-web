/**
 * Whether the app can reach the server, for the whole app:
 *  - the device says it is offline (online/offline events);
 *  - or the server stopped answering: repeated network failures or 502/503/504 from its API.
 * While it is down, the server is asked every few seconds if it is back; when it is, the app is told (to refresh
 * its data and retry what failed). Requests are watched through fetch (the classic API client) and the axios
 * instances of the SDK (watchAxios).
 */
import type { AxiosError, AxiosInstance } from 'axios';

export interface ConnectionSnapshot {
    /** The device has no network. */
    offline: boolean;
    /** The server does not answer (the device may have network). */
    serverDown: boolean;
}

interface MonitorOptions {
    /** Where the server is (origin and path), or nothing before one is chosen. */
    serverAddress: () => string | undefined;
    /** Told once when the connection comes back. */
    onRestored?: () => void;
}

/** Failures in a row before the server is considered down (one failure can be a hiccup). */
export const FAILURES_TO_REPORT = 2;
const PROBE_EVERY_MS = 5000;
const PROBE_TIMEOUT_MS = 8000;
const SERVER_FAILURE_STATUS = new Set([ 502, 503, 504 ]);

let snapshot: ConnectionSnapshot = { offline: false, serverDown: false };
let failures = 0;
let options: MonitorOptions | undefined;
let probeTimer: ReturnType<typeof setTimeout> | undefined;
let nativeFetch: typeof fetch | undefined;
const listeners = new Set<() => void>();
const restoredListeners = new Set<() => void>();

const isDown = (s: ConnectionSnapshot) => s.offline || s.serverDown;

/** An address of the server with a path after it, without doubling the slash. */
export const serverPath = (address: string, path: string) => {
    let end = address.length;
    while (end > 0 && address[end - 1] === '/') end--;
    return address.slice(0, end) + path;
};

const notify = (set: Set<() => void>) => {
    for (const listener of set) listener();
};

const setSnapshot = (next: ConnectionSnapshot) => {
    if (next.offline === snapshot.offline && next.serverDown === snapshot.serverDown) return;
    const wasDown = isDown(snapshot);
    snapshot = next;
    notify(listeners);
    if (wasDown && !isDown(next)) {
        options?.onRestored?.();
        notify(restoredListeners);
    }
    scheduleProbe();
};

export const getConnectionSnapshot = () => snapshot;

/** For useSyncExternalStore. */
export const subscribeConnection = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** Called each time the connection comes back after being down. */
export const onConnectionRestored = (listener: () => void) => {
    restoredListeners.add(listener);
    return () => {
        restoredListeners.delete(listener);
    };
};

/** An answer from the server: a gateway error counts as a failure, anything else means it is there. */
export const reportServerStatus = (status: number) => {
    if (SERVER_FAILURE_STATUS.has(status)) {
        failures++;
        if (failures >= FAILURES_TO_REPORT) setSnapshot({ ...snapshot, serverDown: true });
        return;
    }
    failures = 0;
    setSnapshot({ offline: false, serverDown: false });
};

/** A request that got no answer at all. */
export const reportNetworkFailure = () => {
    failures++;
    if (failures >= FAILURES_TO_REPORT) setSnapshot({ ...snapshot, serverDown: true });
};

const probeUrl = () => {
    const address = options?.serverAddress();
    return address ? serverPath(address, '/System/Info/Public') : undefined;
};

/** Asks the server if it is back (with the fetch of the browser: the probe itself is not counted). */
const probe = async () => {
    probeTimer = undefined;
    const url = probeUrl();
    if (!url || !isDown(snapshot) || snapshot.offline) return;
    // eslint-disable-next-line compat/compat -- every browser with fetch has it
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const response = await (nativeFetch ?? fetch)(url, { cache: 'no-store', signal: controller.signal });
        if (response.ok) {
            failures = 0;
            setSnapshot({ offline: false, serverDown: false });
            return;
        }
    } catch {
        // Still down
    } finally {
        clearTimeout(timeout);
    }
    scheduleProbe();
};

function scheduleProbe() {
    if (probeTimer || !options || !isDown(snapshot) || snapshot.offline) return;
    probeTimer = setTimeout(() => {
        void probe();
    }, PROBE_EVERY_MS);
}

const urlOf = (input: RequestInfo | URL) => {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
};

/** Requests to the server API (not the files of the app itself, which may come from the same place). */
const isServerRequest = (href: string) => {
    const address = options?.serverAddress();
    if (!address) return false;
    try {
        const url = new URL(href, document.baseURI);
        const server = new URL(address, document.baseURI);
        if (url.origin !== server.origin) return false;
        const appPath = new URL('.', document.baseURI).pathname;
        return !(appPath !== '/' && url.pathname.startsWith(appPath));
    } catch {
        return false;
    }
};

const isAbort = (error: unknown) => (error as { name?: string })?.name === 'AbortError';

const watchFetch = () => {
    if (nativeFetch) return;
    nativeFetch = window.fetch.bind(window);
    const original = nativeFetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const counted = isServerRequest(urlOf(input));
        try {
            const response = await original(input, init);
            if (counted) reportServerStatus(response.status);
            return response;
        } catch (error) {
            if (counted && !isAbort(error)) reportNetworkFailure();
            throw error;
        }
    };
};

/** Watches the requests of an SDK axios instance. */
export const watchAxios = (instance: AxiosInstance) => {
    instance.interceptors.response.use(response => {
        reportServerStatus(response.status);
        return response;
    }, (error: AxiosError) => {
        if (error?.response) reportServerStatus(error.response.status);
        else if (error?.code !== 'ERR_CANCELED') reportNetworkFailure();
        return Promise.reject(error);
    });
};

/** Starts watching (once). */
export const startConnectionMonitor = (monitorOptions: MonitorOptions) => {
    const first = !options;
    options = monitorOptions;
    if (!first) return;
    snapshot = { offline: navigator.onLine === false, serverDown: false };
    watchFetch();
    window.addEventListener('offline', () => setSnapshot({ ...snapshot, offline: true }));
    window.addEventListener('online', () => {
        setSnapshot({ ...snapshot, offline: false });
        // The network is back: ask the server right away instead of waiting
        if (snapshot.serverDown) {
            if (probeTimer) clearTimeout(probeTimer);
            void probe();
        }
    });
};

/** For tests: back to the start. */
export const resetConnectionMonitor = () => {
    if (probeTimer) clearTimeout(probeTimer);
    probeTimer = undefined;
    snapshot = { offline: false, serverDown: false };
    failures = 0;
    options = undefined;
    listeners.clear();
    restoredListeners.clear();
};
