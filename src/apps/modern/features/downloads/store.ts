/* eslint-disable compat/compat -- downloads are only offered where these browser features exist (support.ts) */
/**
 * Where downloads live on the device: the list (records), the pieces of each title encrypted, and the covers.
 * Everything is in the app's own database (IndexedDB): it cannot be opened from a file manager, and the pieces
 * can only be read with the key of this app, which cannot leave the device.
 */
import { createStore, del, delMany, get, keys, set, setMany } from 'idb-keyval';

export type Quality = 'original' | 'high' | 'optimal' | 'saver';
export type Status = 'queued' | 'downloading' | 'paused' | 'done' | 'error';

export interface DownloadRecord {
    id: string;
    serverId: string;
    userId: string;
    name: string;
    type: string;
    mediaType: 'Video' | 'Audio';
    /** Series, album or audiobook it belongs to (to group the list). */
    groupId?: string;
    groupName?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    year?: number;
    runTimeTicks: number;
    quality: Quality;
    audioIndex?: number;
    subtitleIndex?: number;
    status: Status;
    /** Why it failed or waits: 'space', 'network', 'wifi', 'server'. */
    reason?: string;
    /** Length of each piece, in seconds (known when the download starts). */
    segments: number[];
    done: number;
    bytes: number;
    estimatedBytes: number;
    addedAt: number;
    completedAt?: number;
    positionTicks: number;
    played: boolean;
    /** The progress was sent to the server. */
    synced: boolean;
}

const meta = createStore('jf-downloads', 'records');
const pieces = createStore('jf-downloads-pieces', 'pieces');
const covers = createStore('jf-downloads-covers', 'covers');
const secrets = createStore('jf-downloads-key', 'key');

const pieceKey = (id: string, index: number) => `${id}/${index}`;

export const readRecords = async () => {
    const all = await keys<string>(meta);
    const list = await Promise.all(all.map(k => get<DownloadRecord>(k, meta)));
    return list.filter((r): r is DownloadRecord => !!r);
};

export const writeRecord = (record: DownloadRecord) => set(record.id, record, meta);

export const writePiece = (id: string, index: number, data: Uint8Array) => set(pieceKey(id, index), data, pieces);

export const readPiece = (id: string, index: number) => get<Uint8Array>(pieceKey(id, index), pieces);

export const writeCover = (id: string, blob: Blob) => set(id, blob, covers);

export const readCover = (id: string) => get<Blob>(id, covers);

/** Key of the poster of a series, album or audiobook (shown for the whole group in the downloads page). */
export const groupCoverKey = (groupId: string) => `group:${groupId}`;

export const removeCover = (id: string) => del(id, covers);

/** Removes a title: its pieces, its cover and its record. */
export const removeDownload = async (record: DownloadRecord) => {
    const total = Math.max(record.done, record.segments.length);
    const ids = Array.from({ length: total }, (_, i) => pieceKey(record.id, i));
    for (let i = 0; i < ids.length; i += 200) await delMany(ids.slice(i, i + 200), pieces);
    await del(record.id, covers);
    await del(record.id, meta);
};

/* ---------- Encryption ---------- */

let keyPromise: Promise<CryptoKey> | null = null;

/** The key of this device: created once, kept in the app's database and never exportable. */
const getKey = () => {
    keyPromise ??= (async () => {
        const saved = await get<CryptoKey>('key', secrets);
        if (saved) return saved;
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [ 'encrypt', 'decrypt' ]);
        await setMany([ [ 'key', key ] ], secrets);
        return key;
    })();
    return keyPromise;
};

export const encrypt = async (data: ArrayBuffer) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(), data);
    const out = new Uint8Array(iv.length + sealed.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(sealed), iv.length);
    return out;
};

export const decrypt = async (data: Uint8Array) => crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.slice(0, 12) },
    await getKey(),
    data.slice(12)
);

/* ---------- Space ---------- */

export interface Space {
    /** What the browser lets the app use. */
    quota: number;
    /** What the app uses now (downloads and the rest). */
    usage: number;
    /** 10% of the device, never used by downloads. */
    reserve: number;
    /** What downloads can still take. */
    available: number;
}

/**
 * Browsers give an app a share of the disk (about 60% of it) and only tell that share: the device size is
 * estimated from it, and 10% of the device is always left free.
 */
export const readSpace = async (): Promise<Space> => {
    const estimate = await navigator.storage?.estimate?.() ?? {};
    const quota = estimate.quota ?? 0;
    const usage = estimate.usage ?? 0;
    const device = quota / 0.6;
    const reserve = device * 0.1;
    return { quota, usage, reserve, available: Math.max(0, quota - usage - reserve) };
};

/** Asks the browser not to clear the downloads when the device runs short of space. */
export const keepDownloads = async () => {
    try {
        if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist();
    } catch {
        // Not supported: the downloads are kept as long as the browser allows
    }
};
/* eslint-enable compat/compat */
