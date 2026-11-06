import type { Api } from '@jellyfin/sdk';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

/** Response of the custom /Library/Stats endpoint (Jellyfin.Api LibraryStatsController). */
export interface LibraryStats {
    ItemId: string
    FileCount: number
    ItemCount: number
    MovieCount: number
    SeriesCount: number
    SeasonCount: number
    EpisodeCount: number
    AlbumCount: number
    ArtistCount: number
    SongCount: number
    MusicVideoCount: number
    BookCount: number
    PhotoCount: number
    VideoCount: number
    BoxSetCount: number
    TotalSize: number
    TotalRunTimeTicks: number
    LastScanDate?: string | null
    LastAddedDate?: string | null
    LastAddedName?: string | null
    LastAddedId?: string | null
    ComputedAt: string
}

export const QUERY_KEY = 'LibraryStats';

const fetchLibraryStats = async (api: Api, refresh: boolean, signal?: AbortSignal) => {
    const response = await api.axiosInstance.get<LibraryStats[]>(`${api.basePath}/Library/Stats`, {
        headers: { Authorization: api.authorizationHeader },
        params: refresh ? { refresh: true } : undefined,
        signal
    });
    return response.data;
};

export const useLibraryStats = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ QUERY_KEY ],
        queryFn: ({ signal }) => fetchLibraryStats(api!, false, signal),
        enabled: !!api,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: false
    });
};

/** Forces the server to recompute the statistics (skips its 5 minute cache). */
export const refreshLibraryStats = (api: Api) => fetchLibraryStats(api, true);
