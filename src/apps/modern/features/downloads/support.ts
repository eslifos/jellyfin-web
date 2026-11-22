/* eslint-disable compat/compat -- downloads are only offered where these browser features exist (support.ts) */
/**
 * Where downloads are offered: phones and tablets, on a secure connection (https), with a browser that can keep
 * encrypted files (IndexedDB) and encrypt them (Web Crypto). Elsewhere the download options are not shown.
 */
import browser from 'scripts/browser';

/** What can be downloaded (folders are expanded to their episodes or tracks). */
export const DOWNLOADABLE_TYPES = new Set([
    'Movie', 'Episode', 'Season', 'Series', 'Video', 'MusicVideo',
    'MusicAlbum', 'Audio', 'AudioBook', 'Playlist'
]);

const isMobileDevice = () => {
    const b = browser as Record<string, unknown>;
    return Boolean(b.mobile || b.ipad || b.iOS || b.android) && !b.tv;
};

const canKeepEncryptedFiles = () => typeof window !== 'undefined'
    && window.isSecureContext
    && !!window.crypto?.subtle
    && typeof indexedDB !== 'undefined';

export const downloadsAvailable = () => isMobileDevice() && canKeepEncryptedFiles();

export const canDownloadItem = (item?: { Type?: string | null } | null) => downloadsAvailable() && DOWNLOADABLE_TYPES.has(item?.Type ?? '');
/* eslint-enable compat/compat */
