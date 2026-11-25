/**
 * Why something could not be loaded, in the words shown to a person:
 *  - offline: the device has no network;
 *  - server: the server did not answer (off, restarting, a proxy with nothing behind: 502/503/504);
 *  - update: a piece of the app could not be downloaded while there is network (usually a new version was
 *    installed while the page was open): reloading the page fixes it;
 *  - other: anything else (a bug), shown with its details.
 */
export type LoadErrorKind = 'offline' | 'server' | 'update' | 'other';

interface ErrorLike {
    name?: string;
    message?: string;
    code?: string;
    status?: number;
    statusCode?: number;
    response?: { status?: number };
}

const NETWORK_CODES = new Set([ 'ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNREFUSED' ]);
const NETWORK_MESSAGES = /Failed to fetch|NetworkError|Network Error|Load failed|timeout/i;

export const isChunkLoadError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const { name, message } = error as ErrorLike;
    return name === 'ChunkLoadError'
        || /Loading (CSS )?chunk [\w-]+ failed/i.test(message ?? '')
        || /Failed to fetch dynamically imported module/i.test(message ?? '');
};

const statusOf = (error: ErrorLike) => error.response?.status ?? error.status ?? error.statusCode;

const isServerError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;
    const e = error as ErrorLike;
    const status = statusOf(e);
    if (typeof status === 'number') return status === 0 || status >= 500;
    return NETWORK_CODES.has(e.code ?? '') || NETWORK_MESSAGES.test(e.message ?? '');
};

export const classifyLoadError = (error: unknown, online = typeof navigator === 'undefined' || navigator.onLine !== false): LoadErrorKind => {
    if (!online) return 'offline';
    if (isChunkLoadError(error)) return 'update';
    if (isServerError(error)) return 'server';
    return 'other';
};

/**
 * Loads a piece of the app, trying once more after a short pause when it fails to download (a hiccup of the
 * network or the server). The second failure is thrown, for the error screen.
 */
export const retryImport = async <T>(load: () => Promise<T>, waitMs = 1500): Promise<T> => {
    try {
        return await load();
    } catch (error) {
        if (!isChunkLoadError(error)) throw error;
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return load();
    }
};
