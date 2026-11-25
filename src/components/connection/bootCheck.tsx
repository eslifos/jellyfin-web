/**
 * While the app starts (the logo), nothing waits forever:
 *  - ensureServerReachable: asks the server (System/Info/Public, at most 15 s). If it does not answer, the logo
 *    gives way to "Can't connect to <server>" with "Retry" and "Change server"; it keeps asking by itself and the
 *    app goes on as soon as the server answers. A device with downloads goes on anyway (to open them).
 *  - startBootWatchdog: if the app is still not drawn after 15 s for any other reason, the same message.
 */
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import appTheme from 'themes';
import { ThemeStorageManager } from 'themes/themeStorageManager';
import { serverPath } from 'utils/connection/monitor';

import ServerUnreachable from './ServerUnreachable';

export const BOOT_TIMEOUT_MS = 15_000;
const RECHECK_MS = 5000;
const OVERLAY_ID = 'jfBootProblem';

export type BootResult = 'ok' | 'changeServer';

interface Overlay {
    root: Root;
    host: HTMLElement;
}

let overlay: Overlay | undefined;

interface ShowOptions {
    serverName: string;
    checking: boolean;
    onRetry: () => void;
    onChangeServer: () => void;
}

const showProblem = (props: ShowOptions) => {
    if (!overlay) {
        const host = document.createElement('div');
        host.id = OVERLAY_ID;
        document.body.appendChild(host);
        overlay = { host, root: createRoot(host) };
    }
    overlay.root.render(
        <ThemeProvider theme={appTheme} defaultMode='dark' storageManager={ThemeStorageManager}>
            <Box sx={{ position: 'fixed', inset: 0, zIndex: 3000, overflow: 'auto', background: '#0b0d16', color: '#fff' }}>
                <ServerUnreachable {...props} />
            </Box>
        </ThemeProvider>
    );
};

export const hideBootProblem = () => {
    if (!overlay) return;
    overlay.root.unmount();
    overlay.host.remove();
    overlay = undefined;
};

/** The name of the server for the message: its saved name, else its address. */
export const serverLabel = (serverUrl?: string, savedName?: string | null) => {
    if (savedName) return savedName;
    try {
        return new URL(serverUrl ?? window.location.href).host;
    } catch {
        return serverUrl ?? window.location.host;
    }
};

/** Whether the server answers, within the time limit. */
export const isServerReachable = async (serverUrl: string, timeoutMs = BOOT_TIMEOUT_MS) => {
    // eslint-disable-next-line compat/compat -- every browser with fetch has it
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(serverPath(serverUrl, '/System/Info/Public'), { cache: 'no-store', signal: controller.signal });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
};

interface EnsureOptions {
    serverUrl?: string;
    serverName: string;
    /** The app can still be useful without the server (downloads on this device). */
    canOpenOffline: () => Promise<boolean>;
}

export const ensureServerReachable = async ({ serverUrl, serverName, canOpenOffline }: EnsureOptions): Promise<BootResult> => {
    if (!serverUrl || await isServerReachable(serverUrl)) return 'ok';
    if (await canOpenOffline()) return 'ok';

    return new Promise<BootResult>(resolve => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let done = false;

        const finish = (result: BootResult) => {
            if (done) return;
            done = true;
            if (timer) clearTimeout(timer);
            window.removeEventListener('online', recheck);
            hideBootProblem();
            resolve(result);
        };
        const render = (checking: boolean) => showProblem({
            serverName,
            checking,
            onRetry: recheck,
            onChangeServer: () => finish('changeServer')
        });

        async function check() {
            if (done) return;
            if (timer) clearTimeout(timer);
            render(true);
            if (await isServerReachable(serverUrl!)) {
                finish('ok');
                return;
            }
            if (done) return;
            render(false);
            timer = setTimeout(recheck, RECHECK_MS);
        }

        function recheck() {
            void check();
        }

        window.addEventListener('online', recheck);
        render(false);
        timer = setTimeout(recheck, RECHECK_MS);
    });
};

/**
 * After 15 s without the app drawn, says the server does not answer (with retry = load again).
 * Returns the function to call once the app is drawn.
 */
export const startBootWatchdog = (getServer: () => { serverUrl?: string, serverName: string }, prepare: () => Promise<unknown>) => {
    let cancelled = false;
    const timer = setTimeout(() => {
        const { serverName } = getServer();
        // The texts may not be loaded yet if what hangs came first
        prepare().catch(() => undefined).finally(() => {
            if (cancelled) return;
            showProblem({
                serverName,
                checking: false,
                onRetry: () => window.location.reload(),
                onChangeServer: () => {
                    window.location.hash = '#/selectserver';
                    window.location.reload();
                }
            });
        });
    }, BOOT_TIMEOUT_MS);
    return () => {
        cancelled = true;
        clearTimeout(timer);
        hideBootProblem();
    };
};
