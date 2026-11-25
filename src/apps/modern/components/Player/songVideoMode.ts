import { readPref, writePref } from 'utils/syncedPrefs';

const KEY = 'musicPreferVideos';
const listeners = new Set<() => void>();

/** Whether the user prefers the video of a song over its audio. It follows the user on all their devices. */
export const songVideoMode = {
    get: () => readPref(KEY) === 'true',
    set: (on: boolean) => {
        writePref(KEY, String(on));
        for (const listen of listeners) listen();
    },
    subscribe: (listen: () => void) => {
        listeners.add(listen);
        return () => {
            listeners.delete(listen);
        };
    }
};
