/**
 * A piece of the app that could not be downloaded (the server was restarting or busy, or a new version was
 * installed while the page was open) is fixed by loading the page again: do it once by itself instead of
 * showing the error. A second failure within a minute shows the error, so it never reloads in a loop.
 */
const KEY = 'jfChunkReloadAt';
const WINDOW_MS = 60_000;

export const isChunkLoadError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const { name, message } = error as { name?: string, message?: string };
    return name === 'ChunkLoadError'
        || /Loading (CSS )?chunk [\w-]+ failed/i.test(message ?? '')
        || /Failed to fetch dynamically imported module/i.test(message ?? '');
};

/** Reloads the page for a chunk error, unless it already did in the last minute. Returns whether it reloads. */
export const reloadOnChunkError = (error: unknown): boolean => {
    if (!isChunkLoadError(error)) return false;

    let last = 0;
    try {
        last = Number(window.sessionStorage.getItem(KEY)) || 0;
    } catch {
        // Storage blocked: still reload once per page load
    }
    if (Date.now() - last < WINDOW_MS) return false;

    try {
        window.sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
        // ignore
    }
    window.location.reload();
    return true;
};
