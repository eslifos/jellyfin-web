/**
 * Where the subtitle being loaded stands, for the menus of the player: the server is still reading it out of the
 * video file ("Preparing subtitles…"), or that failed (with a way to try again). Set by the video player, read by
 * the on-screen menus.
 */
export type SubtitleStatusState = 'idle' | 'preparing' | 'failed';

export interface SubtitleStatus {
    state: SubtitleStatusState;
    /** The subtitle stream it is about. */
    streamIndex?: number;
    /** Tries the failed subtitle again. */
    retry?: () => void;
}

let status: SubtitleStatus = { state: 'idle' };
const listeners = new Set<() => void>();

export const getSubtitleStatus = () => status;

export const setSubtitleStatus = (next: SubtitleStatus) => {
    if (next.state === status.state && next.streamIndex === status.streamIndex && next.retry === status.retry) return;
    status = next;
    listeners.forEach(listener => {
        listener();
    });
};

/** Back to nothing to say (the subtitle is ready, was turned off, or the video ended). */
export const clearSubtitleStatus = (streamIndex?: number) => {
    // A late answer for a track left behind does not clear the one now loading
    if (streamIndex !== undefined && status.streamIndex !== undefined && streamIndex !== status.streamIndex) return;
    setSubtitleStatus({ state: 'idle' });
};

export const onSubtitleStatus = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
