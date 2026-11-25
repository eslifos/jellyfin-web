import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { SyntheticEvent } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

/* Mirrors MediaBrowser.Model.PlaybackStats on the server (custom endpoints). */

export interface StatsTotals {
    Plays: number;
    WatchedSeconds: number;
    ActiveUsers: number;
    AverageSessionSeconds: number;
    CompletedPercent: number;
    TranscodePercent: number;
}

export interface StatsDay {
    Date: string;
    EpisodeSeconds: number;
    MovieSeconds: number;
    MusicSeconds?: number;
    MusicVideoSeconds?: number;
    BookSeconds?: number;
    OtherSeconds: number;
    Plays: number;
}

export interface StatsRank {
    Id?: string | null;
    Name?: string | null;
    Plays: number;
    WatchedSeconds: number;
    Users: number;
    LastPlayedUtc?: string | null;
    ImageId?: string | null;
    Subtitle?: string | null;
}

export interface StatsOverview {
    Days: number;
    Current: StatsTotals;
    Previous: StatsTotals;
    Daily: StatsDay[];
    PlaysByHour: number[];
    SecondsByWeekday: number[];
    TopUsers: StatsRank[];
    TopSeries: StatsRank[];
    TopMovies: StatsRank[];
    TopClients: StatsRank[];
    PlayMethods: StatsRank[];
    ByCategory?: StatsRank[];
    TopArtists?: StatsRank[];
    TopAlbums?: StatsRank[];
    TopSongs?: StatsRank[];
    TopMusicVideos?: StatsRank[];
    TopBooks?: StatsRank[];
}

export interface HistoryEntry {
    Id: number;
    UserId: string;
    UserName?: string | null;
    ItemId: string;
    ItemName?: string | null;
    ItemType?: string | null;
    SeriesId?: string | null;
    SeriesName?: string | null;
    ParentIndexNumber?: number | null;
    IndexNumber?: number | null;
    ProductionYear?: number | null;
    RunTimeTicks?: number | null;
    StartedUtc: string;
    StoppedUtc?: string | null;
    WatchedSeconds: number;
    PositionTicks?: number | null;
    Completed: boolean;
    Client?: string | null;
    DeviceName?: string | null;
    RemoteAddress?: string | null;
    PlayMethod?: string | null;
    TranscodeReasons?: string | null;
    VideoCodec?: string | null;
    AudioCodec?: string | null;
    Height?: number | null;
    Category?: string | null;
    AlbumId?: string | null;
    AlbumName?: string | null;
    ArtistId?: string | null;
    ArtistName?: string | null;
}

export interface HistoryPage {
    Items: HistoryEntry[];
    TotalRecordCount: number;
}

const timeZone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return undefined;
    }
};

/** Returns null when the server does not have the statistics endpoints (old image). */
export const useStatsOverview = (days: number) => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'PlaybackStatsOverview', days ],
        queryFn: async ({ signal }) => {
            try {
                const res = await api!.axiosInstance.get<StatsOverview>(`${api!.basePath}/PlaybackStats/Overview`, {
                    headers: { Authorization: api!.authorizationHeader },
                    params: { days, timeZone: timeZone() },
                    signal
                });
                return res.data;
            } catch (err) {
                if ((err as { response?: { status?: number } }).response?.status === 404) return null;
                throw err;
            }
        },
        enabled: !!api,
        placeholderData: keepPreviousData,
        refetchInterval: 60 * 1000,
        retry: false
    });
};

export interface HistoryParams {
    startIndex: number;
    limit: number;
    userId?: string;
    itemType?: string;
    searchTerm?: string;
}

export const useHistory = (params: HistoryParams) => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'PlaybackHistory', params ],
        queryFn: async ({ signal }) => {
            try {
                const res = await api!.axiosInstance.get<HistoryPage>(`${api!.basePath}/PlaybackStats/History`, {
                    headers: { Authorization: api!.authorizationHeader },
                    params: {
                        startIndex: params.startIndex,
                        limit: params.limit,
                        userId: params.userId || undefined,
                        itemType: params.itemType || undefined,
                        searchTerm: params.searchTerm || undefined
                    },
                    signal
                });
                return res.data;
            } catch (err) {
                if ((err as { response?: { status?: number } }).response?.status === 404) return null;
                throw err;
            }
        },
        enabled: !!api,
        placeholderData: keepPreviousData,
        retry: false
    });
};

/** "3d 14h", "2h 53m", "27m", "45s". */
export const formatDuration = (seconds: number) => {
    const s = Math.max(0, Math.round(seconds));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m`;
    return `${s}s`;
};

/** Series colors validated for the dark dashboard surface (CVD-safe). */
export const KIND_COLORS = {
    episode: '#3987e5',
    movie: '#d95926',
    music: '#199e70',
    musicVideo: '#c98500',
    book: '#9085e9',
    other: '#d55181'
} as const;

/** Every kind of library, always in this order so each one keeps its color. */
export const KINDS = [
    { key: 'Episode', labelKey: 'StsEpisodes', color: KIND_COLORS.episode, seconds: (d: StatsDay) => d.EpisodeSeconds },
    { key: 'Movie', labelKey: 'StsMovies', color: KIND_COLORS.movie, seconds: (d: StatsDay) => d.MovieSeconds },
    { key: 'Music', labelKey: 'StsMusic', color: KIND_COLORS.music, seconds: (d: StatsDay) => d.MusicSeconds ?? 0 },
    { key: 'MusicVideo', labelKey: 'StsMusicVideos', color: KIND_COLORS.musicVideo, seconds: (d: StatsDay) => d.MusicVideoSeconds ?? 0 },
    { key: 'Book', labelKey: 'StsBooks', color: KIND_COLORS.book, seconds: (d: StatsDay) => d.BookSeconds ?? 0 },
    { key: 'Other', labelKey: 'StsOther', color: KIND_COLORS.other, seconds: (d: StatsDay) => d.OtherSeconds }
] as const;

export const daySegments = (day: StatsDay) => KINDS.map(kind => ({
    key: kind.key,
    label: globalize.translate(kind.labelKey),
    value: kind.seconds(day),
    color: kind.color
}));

export const kindLegend = () => KINDS.map(kind => ({ key: kind.key, label: globalize.translate(kind.labelKey), color: kind.color }));

const CATEGORY_OF_TYPE: Record<string, string> = {
    Episode: 'Episode',
    Movie: 'Movie',
    Audio: 'Music',
    MusicVideo: 'MusicVideo',
    AudioBook: 'Book',
    Book: 'Book'
};

/** The kind of library of a play; plays from an older server only know their item type. */
export const entryCategory = (e: HistoryEntry) => e.Category || CATEGORY_OF_TYPE[e.ItemType || ''] || 'Other';

export const entryColor = (e: HistoryEntry) => KINDS.find(kind => kind.key === entryCategory(e))?.color ?? KIND_COLORS.other;

/** How a play is shown in any list: title, second line, picture and where it leads. */
export const entryMedia = (e: HistoryEntry) => {
    const category = entryCategory(e);
    const year = e.ProductionYear ? String(e.ProductionYear) : '';
    const parts = (...values: (string | null | undefined)[]) => values.filter(Boolean).join(' · ');
    switch (category) {
        case 'Episode':
            return {
                id: e.SeriesId || e.ItemId,
                title: e.SeriesName || e.ItemName || '',
                sub: `S${e.ParentIndexNumber ?? '?'}·E${e.IndexNumber ?? '?'} · ${e.ItemName || ''}`,
                square: false
            };
        case 'Music':
            return { id: e.AlbumId || e.ItemId, title: e.ItemName || '', sub: parts(e.ArtistName, e.AlbumName) || globalize.translate('StsMusic'), square: true };
        case 'MusicVideo':
            return { id: e.ItemId, title: e.ItemName || '', sub: parts(e.ArtistName, year) || globalize.translate('StsMusicVideos'), square: true };
        case 'Book':
            return {
                id: e.AlbumId || e.ItemId,
                title: e.AlbumName || e.ItemName || '',
                sub: parts(e.ArtistName, e.AlbumName ? e.ItemName : year) || globalize.translate('StsBooks'),
                square: true
            };
        case 'Movie':
            return { id: e.ItemId, title: e.ItemName || '', sub: year || globalize.translate('StsMovie'), square: false };
        default:
            return { id: e.ItemId, title: e.ItemName || '', sub: year || globalize.translate('StsOther'), square: false };
    }
};

/** Songs and artists often have no picture: the empty frame looks better than a broken image. */
export const hideBrokenImage = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.visibility = 'hidden';
};

export interface UserStats {
    UserId: string;
    UserName?: string | null;
    Plays: number;
    WatchedSeconds: number;
    Plays30: number;
    WatchedSeconds30: number;
    FirstPlayUtc?: string | null;
    LastPlayUtc?: string | null;
    LastPlay?: HistoryEntry | null;
    Daily30: number[];
    TopClient?: string | null;
}

/** Per user summaries; null when the server does not have the endpoint. */
export const useUserStats = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'PlaybackUserStats' ],
        queryFn: async ({ signal }) => {
            try {
                const res = await api!.axiosInstance.get<UserStats[]>(`${api!.basePath}/PlaybackStats/Users`, {
                    headers: { Authorization: api!.authorizationHeader },
                    params: { timeZone: timeZone() },
                    signal
                });
                return res.data;
            } catch (err) {
                if ((err as { response?: { status?: number } }).response?.status === 404) return null;
                throw err;
            }
        },
        enabled: !!api,
        refetchInterval: 60 * 1000,
        retry: false
    });
};

/** True for LAN / loopback addresses. */
export const isLocalAddress = (ip?: string | null) => {
    if (!ip) return false;
    const a = ip.replace(/^::ffff:/, '');
    return /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a) || a === '::1' || /^f[cd]/i.test(a) || /^fe80/i.test(a);
};
