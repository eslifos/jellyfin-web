/**
 * Theme of each library (anime / kids). Anime and Kids libraries are mixed movies and shows libraries with a
 * theme saved in their options (custom /Library/ContentThemes endpoint). Mixed libraries without a theme whose
 * name says "anime" or "kids / niños" are treated the same, so existing libraries work before their type is set.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

export type LibraryTheme = 'anime' | 'kids';

let known: Record<string, string> = {};

const normId = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

export const useLibraryThemes = () => {
    const { api, user } = useApi();
    const { data } = useQuery({
        queryKey: [ 'LibraryThemes', user?.Id ],
        queryFn: async ({ signal }) => {
            try {
                const result = (await api!.axiosInstance.get<Record<string, string>>(`${api!.basePath}/Library/ContentThemes`, {
                    headers: { Authorization: api!.authorizationHeader }, signal
                })).data ?? {};
                known = Object.fromEntries(Object.entries(result).map(([ k, v ]) => [ normId(k), v ]));
                return known;
            } catch (err) {
                if (signal?.aborted) throw err;
                return {};
            }
        },
        enabled: !!api && !!user?.Id,
        staleTime: 10 * 60 * 1000,
        retry: false
    });
    return data ?? known;
};

/** The theme of a library view (or of a library id with its name and type). */
export const themeOf = (view?: Pick<BaseItemDto, 'Id' | 'Name' | 'CollectionType'> | null, themes: Record<string, string> = known): LibraryTheme | undefined => {
    if (!view) return undefined;
    const saved = themes[normId(view.Id)];
    if (saved === 'anime' || saved === 'kids') return saved;
    const type = view.CollectionType as string | undefined | null;
    if (type && type !== 'mixed' && type !== 'unknown') return undefined;
    const name = view.Name || '';
    if (/anim[eé]/i.test(name)) return 'anime';
    if (/\b(kids?|ni[ñn][oa]s|infantil|children|peques)\b/i.test(name)) return 'kids';
    return undefined;
};

export const THEME_ACCENT: Record<LibraryTheme, string> = {
    anime: '#ff4081',
    kids: '#ffc107'
};
