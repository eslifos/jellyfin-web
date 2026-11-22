/**
 * Small preferences of the user (a view, an order, a range…) kept on the server with the rest of their
 * settings, so every device and app of the user shows the same.
 */
import * as userSettings from 'scripts/settings/userSettings';

export const readPref = (key: string): string | null => {
    try {
        const value = userSettings.get(key, true) as unknown;
        return typeof value === 'string' ? value : null;
    } catch {
        return null;
    }
};

export const writePref = (key: string, value: string) => {
    try {
        userSettings.set(key, value, true);
    } catch {
        // Not signed in yet: nothing to keep
    }
};
