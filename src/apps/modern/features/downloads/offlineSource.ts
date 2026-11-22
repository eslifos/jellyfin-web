/**
 * Plays a download: hls.js asks for "offline://{id}/…" and this loader answers from the device, decrypting
 * each piece in memory right when it is needed. The pieces never exist unencrypted anywhere else.
 */
import Hls, { type HlsConfig, type Loader, type LoaderCallbacks, type LoaderConfiguration, type LoaderContext, type LoaderStats } from 'hls.js';

import { getDownloads } from './engine';
import { decrypt, readPiece } from './store';

const SCHEME = 'offline://';

export const offlineUrl = (id: string) => `${SCHEME}${id}/playlist.m3u8`;

const playlistFor = (id: string) => {
    const record = getDownloads()[id];
    if (!record?.segments.length) throw new Error('not downloaded');
    const target = Math.ceil(Math.max(...record.segments));
    const lines = [ '#EXTM3U', '#EXT-X-VERSION:3', `#EXT-X-TARGETDURATION:${target}`, '#EXT-X-MEDIA-SEQUENCE:0', '#EXT-X-PLAYLIST-TYPE:VOD' ];
    record.segments.forEach((duration, i) => {
        lines.push(`#EXTINF:${duration.toFixed(3)},`, `${SCHEME}${id}/piece/${i}`);
    });
    lines.push('#EXT-X-ENDLIST');
    return lines.join('\n');
};

const readOffline = async (url: string): Promise<string | ArrayBuffer> => {
    const [ id, kind, index ] = url.slice(SCHEME.length).split('/');
    if (kind === 'playlist.m3u8') return playlistFor(id);
    const piece = await readPiece(id, Number(index));
    if (!piece) throw new Error('missing piece');
    return decrypt(piece);
};

const emptyStats = () => ({
    aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 }
}) as unknown as LoaderStats;

class OfflineLoader implements Loader<LoaderContext> {
    context: LoaderContext | null = null;
    stats: LoaderStats = emptyStats();
    private stopped = false;

    destroy() {
        this.stopped = true;
        this.context = null;
    }

    abort() {
        this.stopped = true;
        this.stats.aborted = true;
    }

    load(context: LoaderContext, _config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
        this.context = context;
        this.stopped = false;
        this.stats.loading.start = performance.now();
        readOffline(context.url).then(data => {
            if (this.stopped) return;
            const now = performance.now();
            const size = typeof data === 'string' ? data.length : data.byteLength;
            this.stats.loading.first = now;
            this.stats.loading.end = now;
            this.stats.loaded = size;
            this.stats.total = size;
            callbacks.onSuccess({ url: context.url, data }, this.stats, context, null);
        }).catch((err: unknown) => {
            if (!this.stopped) callbacks.onError({ code: 404, text: String(err) }, context, null, this.stats);
        });
    }
}

/** Attaches a download to a video (or audio) element. Returns how to detach it, or null when not possible. */
export const attachOffline = (media: HTMLMediaElement, id: string, startSeconds: number) => {
    if (!Hls.isSupported()) return null;
    const hls = new Hls({
        loader: OfflineLoader as unknown as HlsConfig['loader'],
        startPosition: startSeconds,
        maxBufferLength: 30,
        enableWorker: true
    });
    hls.loadSource(offlineUrl(id));
    hls.attachMedia(media);
    return () => hls.destroy();
};
