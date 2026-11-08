import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

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
export const KIND_COLORS = { episode: '#3987e5', movie: '#d95926', other: '#199e70' } as const;

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
