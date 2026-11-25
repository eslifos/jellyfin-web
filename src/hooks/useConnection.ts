import { useEffect, useRef, useSyncExternalStore } from 'react';

import { getConnectionSnapshot, onConnectionRestored, subscribeConnection } from 'utils/connection/monitor';

/** Whether the device has network and the server answers (utils/connection/monitor). */
export const useConnection = () => useSyncExternalStore(subscribeConnection, getConnectionSnapshot);

/** Runs the callback each time the connection comes back (always the latest callback). */
export const useConnectionRestored = (callback: () => void) => {
    const latest = useRef(callback);
    latest.current = callback;
    useEffect(() => onConnectionRestored(() => latest.current()), []);
};
