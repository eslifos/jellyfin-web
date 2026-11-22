/**
 * Opening the app without connection to the server: if this device has downloads ready, the app goes to them
 * instead of showing the "server unavailable" page.
 */
import { readRecords } from './store';
import { downloadsAvailable } from './support';

export const hasOfflineDownloads = async () => {
    if (!downloadsAvailable()) return false;
    try {
        return (await readRecords()).some(r => r.status === 'done');
    } catch {
        return false;
    }
};
