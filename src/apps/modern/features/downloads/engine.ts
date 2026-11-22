/* eslint-disable compat/compat -- downloads are only offered where these browser features exist (support.ts) */
/**
 * The download queue. Each title is asked to the server as HLS (H.264/AAC in the chosen quality), and every
 * piece is encrypted as soon as it arrives and kept in the app's database. Downloads can be paused, resumed
 * (also after closing the app), retried, and wait for Wi-Fi when the user wants it.
 */
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

import { ServerConnections } from 'lib/jellyfin-apiclient';

import { QUALITY_PRESETS, readDownloadSettings } from './settings';
import { type DownloadRecord, type Quality, encrypt, keepDownloads, groupCoverKey, readCover, readRecords, readSpace, removeCover, removeDownload, writeCover, writePiece, writeRecord } from './store';

type Listener = () => void;

const listeners = new Set<Listener>();
let records: Record<string, DownloadRecord> = {};
let loading: Promise<void> | null = null;
const running = new Map<string, AbortController>();
let wakeLock: { release: () => Promise<void> } | null = null;

const emit = () => {
    for (const listener of listeners) listener();
};

export const subscribeDownloads = (listener: Listener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const getDownloads = () => records;

const update = (id: string, change: Partial<DownloadRecord>, persist = true) => {
    const current = records[id];
    if (!current) return;
    const next = { ...current, ...change };
    records = { ...records, [id]: next };
    emit();
    if (persist) void writeRecord(next);
};

/** Loads the list saved on the device and carries on with what was pending. */
export const loadDownloads = () => {
    loading ??= (async () => {
        const list = await readRecords();
        // What was downloading when the app closed goes back to the queue
        const restart = (r: DownloadRecord): DownloadRecord => (r.status === 'downloading' ? { ...r, status: 'queued' } : r);
        records = Object.fromEntries(list.map(r => [ r.id, restart(r) ]));
        emit();
        window.addEventListener('online', () => {
            pump();
            void syncProgress();
        });
        const connection = (navigator as unknown as { connection?: EventTarget }).connection;
        connection?.addEventListener?.('change', pump);
        pump();
        void syncProgress();
    })();
    return loading;
};

/* ---------- Server ---------- */

const apiFor = (serverId: string): Api | undefined => ServerConnections.getApi(serverId) as Api | undefined;

const deviceIdFor = (serverId: string) => {
    const client = ServerConnections.getApiClient(serverId) as unknown as { deviceId?: () => string } | undefined;
    return client?.deviceId?.() ?? 'jellyfin-web';
};

const headers = (api: Api) => ({ Authorization: api.authorizationHeader });

const withKey = (url: string, api: Api) => {
    if (/[?&]api_key=/i.test(url)) return url;
    const join = url.includes('?') ? '&' : '?';
    return `${url}${join}api_key=${api.accessToken}`;
};

const SUBTITLE_FORMATS = [ 'vtt', 'srt', 'subrip', 'ass', 'ssa', 'pgssub', 'dvdsub', 'dvbsub', 'sub', 'smi', 'ttml' ];

/** A device profile that only accepts HLS with H.264 and AAC, so the pieces play on any phone. */
const profileFor = (quality: Quality, audioOnly: boolean) => {
    const preset = QUALITY_PRESETS[quality];
    const bitrate = audioOnly ? preset.audioBitrate : preset.videoBitrate + preset.audioBitrate;
    return {
        MaxStreamingBitrate: bitrate,
        MaxStaticBitrate: bitrate,
        MusicStreamingTranscodingBitrate: preset.audioBitrate,
        DirectPlayProfiles: [],
        TranscodingProfiles: [
            { Container: 'ts', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac', Protocol: 'hls', Context: 'Streaming', MaxAudioChannels: '2', MinSegments: 1, BreakOnNonKeyFrames: false },
            { Container: 'ts', Type: 'Audio', AudioCodec: 'aac', Protocol: 'hls', Context: 'Streaming', MaxAudioChannels: '2', BreakOnNonKeyFrames: false }
        ],
        CodecProfiles: [
            { Type: 'Video', Codec: 'h264', Conditions: [ { Condition: 'LessThanEqual', Property: 'Width', Value: String(preset.maxWidth), IsRequired: false } ] }
        ],
        // Subtitles are drawn into the picture: the download plays the same everywhere
        SubtitleProfiles: SUBTITLE_FORMATS.map(Format => ({ Format, Method: 'Encode' }))
    };
};

interface Prepared {
    urls: string[];
    durations: number[];
    playSessionId?: string;
}

const readPlaylist = (text: string, base: string) => {
    const urls: string[] = [];
    const durations: number[] = [];
    let duration: number | null = null;
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (line.startsWith('#EXTINF:')) {
            duration = parseFloat(line.slice(8));
        } else if (line && !line.startsWith('#')) {
            urls.push(new URL(line, base).toString());
            durations.push(duration ?? 6);
            duration = null;
        }
    }
    return { urls, durations };
};

/** Asks the server to prepare the title in the chosen quality and lists its pieces. */
const prepare = async (record: DownloadRecord, signal: AbortSignal): Promise<Prepared> => {
    const api = apiFor(record.serverId);
    if (!api) throw new Error('server');
    const audioOnly = record.mediaType === 'Audio';
    const { data: info } = await api.axiosInstance.post<{ MediaSources?: { Id?: string, TranscodingUrl?: string }[], PlaySessionId?: string }>(
        `${api.basePath}/Items/${record.id}/PlaybackInfo`,
        {
            UserId: record.userId,
            DeviceProfile: profileFor(record.quality, audioOnly),
            MaxStreamingBitrate: profileFor(record.quality, audioOnly).MaxStreamingBitrate,
            StartTimeTicks: 0,
            AudioStreamIndex: record.audioIndex,
            SubtitleStreamIndex: record.subtitleIndex ?? -1,
            EnableDirectPlay: false,
            EnableDirectStream: false,
            EnableTranscoding: true,
            AllowVideoStreamCopy: record.quality === 'original',
            AllowAudioStreamCopy: record.quality === 'original',
            AutoOpenLiveStream: false
        },
        { headers: headers(api), signal }
    );
    const source = info.MediaSources?.find(s => s.TranscodingUrl);
    if (!source?.TranscodingUrl) throw new Error('server');

    const masterUrl = withKey(`${api.basePath}${source.TranscodingUrl}`, api);
    const master = await (await fetch(masterUrl, { headers: headers(api), signal })).text();
    const variant = master.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));
    const playlistUrl = variant ? withKey(new URL(variant, masterUrl).toString(), api) : masterUrl;
    const playlist = variant ? await (await fetch(playlistUrl, { headers: headers(api), signal })).text() : master;
    const { urls, durations } = readPlaylist(playlist, playlistUrl);
    if (!urls.length) throw new Error('server');
    return { urls: urls.map(u => withKey(u, api)), durations, playSessionId: info.PlaySessionId };
};

/** Tells the server it can stop preparing the title. */
const stopEncoding = (serverId: string, playSessionId?: string) => {
    const api = apiFor(serverId);
    if (!api || !playSessionId) return;
    void api.axiosInstance.delete(`${api.basePath}/Videos/ActiveEncodings`, {
        headers: headers(api),
        params: { deviceId: deviceIdFor(serverId), playSessionId }
    }).catch(() => undefined);
};

/* ---------- Progress for the screens and the dashboard ---------- */

interface Live {
    speed: number;
    eta?: number;
    at: number;
    playSessionId?: string;
}

const live = new Map<string, Live>();
const lastReport = new Map<string, { at: number, status: string }>();
const REPORT_EVERY_MS = 3000;

/** Speed (bytes per second) and time left (seconds) of a download in progress. */
export const getLive = (id: string): Live | undefined => live.get(id);

const measure = (id: string, addedBytes: number) => {
    const record = records[id];
    const now = performance.now();
    const previous = live.get(id);
    const seconds = previous ? (now - previous.at) / 1000 : 0;
    const instant = seconds > 0 ? addedBytes / seconds : 0;
    // Smoothed so the number does not jump with every piece
    const speed = previous?.speed ? (previous.speed * 0.7) + (instant * 0.3) : instant;
    const total = Math.max(record.estimatedBytes, record.bytes);
    const left = record.segments.length ? (record.segments.length - record.done) / record.segments.length : 1;
    const eta = speed > 0 ? (total * left) / speed : undefined;
    live.set(id, { ...previous, speed, eta, at: now });
};

/** Tells the server how a download goes (shown in the dashboard). Sent every few seconds and on every change. */
const report = (id: string, status?: string, removed?: DownloadRecord) => {
    const record = removed ?? records[id];
    if (!record) return;
    const state = status ?? record.status;
    const now = Date.now();
    const last = lastReport.get(id);
    if (last && last.status === state && now - last.at < REPORT_EVERY_MS) return;
    lastReport.set(id, { at: now, status: state });
    const api = apiFor(record.serverId);
    if (!api || !navigator.onLine) return;
    const info = live.get(id);
    void api.axiosInstance.post(`${api.basePath}/Downloads/Progress`, {
        ItemId: record.id,
        Name: record.name,
        GroupName: record.groupName,
        Type: record.type,
        Quality: record.quality,
        Status: state,
        Reason: record.reason,
        Done: record.done,
        Total: record.segments.length,
        Bytes: record.bytes,
        EstimatedBytes: record.estimatedBytes,
        SpeedBytesPerSecond: state === 'downloading' ? Math.round(info?.speed ?? 0) : 0,
        EtaSeconds: state === 'downloading' ? info?.eta : undefined,
        PlaySessionId: info?.playSessionId
    }, { headers: headers(api) }).catch(() => undefined);
};

/* ---------- Queue ---------- */

const onCellular = () => (navigator as unknown as { connection?: { type?: string } }).connection?.type === 'cellular';

const keepAwake = async (on: boolean) => {
    try {
        if (on && !wakeLock && readDownloadSettings().keepAwake) {
            wakeLock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null;
        } else if (!on && wakeLock) {
            await wakeLock.release();
            wakeLock = null;
        }
    } catch {
        wakeLock = null;
    }
};

const fetchPiece = async (url: string, api: Api, signal: AbortSignal) => {
    for (let attempt = 0; ; attempt++) {
        try {
            const response = await fetch(url, { headers: headers(api), signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.arrayBuffer();
        } catch (err) {
            if (signal.aborted || attempt >= 4) throw err;
            await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
        }
    }
};

const isQuotaError = (err: unknown) => err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');

const run = async (id: string) => {
    const controller = new AbortController();
    running.set(id, controller);
    const { signal } = controller;
    let playSessionId: string | undefined;
    const serverId = records[id]?.serverId ?? '';
    try {
        update(id, { status: 'downloading', reason: undefined });
        live.set(id, { speed: 0, at: performance.now() });
        report(id, 'preparing');
        const record = records[id];
        const api = apiFor(record.serverId);
        if (!api) throw new Error('server');
        const prepared = await prepare(record, signal);
        playSessionId = prepared.playSessionId;
        live.set(id, { speed: 0, at: performance.now(), playSessionId });
        update(id, { segments: prepared.durations });
        report(id, 'downloading');

        for (let index = records[id].done; index < prepared.urls.length; index++) {
            if (readDownloadSettings().wifiOnly && onCellular()) {
                update(id, { status: 'queued', reason: 'wifi' });
                report(id);
                return;
            }
            const data = await fetchPiece(prepared.urls[index], api, signal);
            await writePiece(id, index, await encrypt(data));
            const current = records[id];
            // The list on the device is saved every few pieces (the progress is shown live)
            update(id, { done: index + 1, bytes: current.bytes + data.byteLength }, index % 5 === 4);
            measure(id, data.byteLength);
            report(id);
        }
        update(id, { status: 'done', completedAt: Date.now(), reason: undefined });
        report(id);
        // The downloads screen is kept on the device, so it opens without connection
        void import('../../routes/downloads');
    } catch (err) {
        if (signal.aborted) return;
        let reason = navigator.onLine ? 'server' : 'network';
        if (isQuotaError(err)) reason = 'space';
        update(id, { status: reason === 'network' ? 'queued' : 'error', reason });
        report(id);
    } finally {
        live.delete(id);
        stopEncoding(serverId, playSessionId);
        running.delete(id);
        if (records[id]) void writeRecord(records[id]);
        pump();
    }
};

/** Starts what is waiting, as many at a time as the user chose. */
function pump() {
    const settings = readDownloadSettings();
    const waiting = Object.values(records)
        .filter(r => r.status === 'queued' && !running.has(r.id))
        .sort((a, b) => a.addedAt - b.addedAt);
    const canStart = navigator.onLine && !(settings.wifiOnly && onCellular());
    for (const record of waiting) {
        if (!canStart || running.size >= settings.parallel) break;
        void run(record.id);
    }
    void keepAwake(running.size > 0);
}

/* ---------- What the screens use ---------- */

export interface DownloadOptions {
    quality: Quality;
    audioIndex?: number;
    subtitleIndex?: number;
}

/** Bytes a title will take in a quality (the original quality keeps the bitrate of the file). */
export const estimateBytes = (item: BaseItemDto, quality: Quality) => {
    const preset = QUALITY_PRESETS[quality];
    const seconds = (item.RunTimeTicks ?? 0) / 10_000_000;
    const isAudio = item.MediaType === 'Audio';
    const source = item.MediaSources?.[0]?.Bitrate ?? 0;
    let bitrate = isAudio ? preset.audioBitrate : preset.videoBitrate + preset.audioBitrate;
    if (source > 0) bitrate = Math.min(bitrate, source);
    return Math.round((bitrate / 8) * seconds * 1.04);
};

const recordFor = (item: BaseItemDto, serverId: string, userId: string, options: DownloadOptions): DownloadRecord => ({
    id: item.Id ?? '',
    serverId,
    userId,
    name: item.Name ?? '',
    type: item.Type ?? '',
    mediaType: item.MediaType === 'Audio' ? 'Audio' : 'Video',
    groupId: item.SeriesId ?? item.AlbumId ?? undefined,
    groupName: item.SeriesName ?? item.Album ?? undefined,
    seasonNumber: item.ParentIndexNumber ?? undefined,
    episodeNumber: item.IndexNumber ?? undefined,
    year: item.ProductionYear ?? undefined,
    runTimeTicks: item.RunTimeTicks ?? 0,
    quality: options.quality,
    audioIndex: options.audioIndex,
    subtitleIndex: options.subtitleIndex,
    status: 'queued',
    segments: [],
    done: 0,
    bytes: 0,
    estimatedBytes: estimateBytes(item, options.quality),
    addedAt: Date.now(),
    positionTicks: item.UserData?.PlaybackPositionTicks ?? 0,
    played: item.UserData?.Played ?? false,
    synced: true
});

const fetchCover = async (api: Api, imageId: string, key: string) => {
    try {
        const response = await fetch(`${api.basePath}/Items/${imageId}/Images/Primary?maxWidth=480&quality=85`, { headers: headers(api) });
        if (response.ok) await writeCover(key, await response.blob());
    } catch {
        // No cover: the list shows an icon
    }
};

const saveCover = async (item: BaseItemDto, api: Api) => {
    const imageId = item.ImageTags?.Primary ? item.Id : item.AlbumId ?? item.SeriesId ?? item.Id;
    await fetchCover(api, imageId ?? '', item.Id ?? '');
    // The poster of the series or album, once, for its card in the downloads page
    const groupId = item.SeriesId ?? item.AlbumId;
    if (groupId && !(await readCover(groupCoverKey(groupId)))) await fetchCover(api, groupId, groupCoverKey(groupId));
};

/** Adds titles to the queue (already downloaded or waiting ones are left as they are). */
export const enqueue = async (items: BaseItemDto[], serverId: string, userId: string, options: DownloadOptions) => {
    await loadDownloads();
    await keepDownloads();
    const api = apiFor(serverId);
    for (const item of items) {
        if (!item.Id || records[item.Id]) continue;
        const record = recordFor(item, serverId, userId, options);
        records = { ...records, [record.id]: record };
        await writeRecord(record);
        if (api) void saveCover(item, api);
    }
    emit();
    pump();
};

export const pauseDownload = (id: string) => {
    running.get(id)?.abort();
    update(id, { status: 'paused' });
    report(id);
};

export const resumeDownload = (id: string) => {
    update(id, { status: 'queued', reason: undefined });
    report(id);
    pump();
};

export const removeFromDevice = async (id: string) => {
    running.get(id)?.abort();
    const record = records[id];
    if (!record) return;
    const rest = { ...records };
    delete rest[id];
    records = rest;
    emit();
    report(id, 'removed', record);
    await removeDownload(record);
    // The last one of a series or album takes its poster with it
    if (record.groupId && !Object.values(records).some(r => r.groupId === record.groupId)) await removeCover(groupCoverKey(record.groupId));
    pump();
};

/** Saves where the user is in a download, and sends it to the server when there is connection. */
export const saveProgress = (id: string, positionTicks: number, played: boolean) => {
    update(id, { positionTicks, played, synced: false });
    void syncProgress();
};

let syncing = false;

/** Progress made without connection is sent to the server as soon as there is connection again. */
export async function syncProgress() {
    if (syncing || !navigator.onLine) return;
    syncing = true;
    try {
        for (const record of Object.values(records).filter(r => !r.synced)) {
            const api = apiFor(record.serverId);
            if (!api) continue;
            try {
                await api.axiosInstance.post(`${api.basePath}/UserItems/${record.id}/UserData`, {
                    PlaybackPositionTicks: record.played ? 0 : record.positionTicks,
                    Played: record.played,
                    LastPlayedDate: new Date().toISOString()
                }, { headers: headers(api), params: { userId: record.userId } });
                update(record.id, { synced: true });
            } catch {
                // Tried again next time
            }
        }
    } finally {
        syncing = false;
    }
}

export { readSpace };
/* eslint-enable compat/compat */
