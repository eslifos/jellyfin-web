/**
 * What a user would lose if the account is deleted: how many titles they watched or listened to and how many
 * favorites they have. Only totals are asked (limit 0), and only while the confirmation is open.
 */
import type { BaseItemDtoQueryResult } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto-query-result';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

/** What counts as "watched": things that play, not the folders that hold them. */
const PLAYABLE = [ BaseItemKind.Movie, BaseItemKind.Episode, BaseItemKind.Audio, BaseItemKind.AudioBook, BaseItemKind.MusicVideo, BaseItemKind.Video ].join(',');

export interface UserDataSummary {
    played: number;
    favorites: number;
}

export const useUserDataSummary = (userId?: string | null) => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'UserDataSummary', userId ],
        enabled: !!api && !!userId,
        staleTime: 0,
        queryFn: async ({ signal }): Promise<UserDataSummary> => {
            const count = async (filter: Record<string, string>) => {
                const res = await api!.axiosInstance.get<BaseItemDtoQueryResult>(`${api!.basePath}/Items`, {
                    headers: { Authorization: api!.authorizationHeader },
                    params: { userId, recursive: true, limit: 0, enableTotalRecordCount: true, ...filter },
                    signal
                });
                return res.data.TotalRecordCount ?? 0;
            };
            const [ played, favorites ] = await Promise.all([
                count({ isPlayed: 'true', includeItemTypes: PLAYABLE }),
                count({ isFavorite: 'true' })
            ]);
            return { played, favorites };
        }
    });
};
