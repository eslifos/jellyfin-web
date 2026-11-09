/**
 * Meta universes API (custom /MetaUniverses endpoint of the Cosmic server).
 */
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

export interface UniverseDefinition {
    Id: string;
    Name: string;
    Overview?: string | null;
    Source: 'builtin' | 'auto' | 'custom';
    Hidden: boolean;
    Tags: string[];
    Studios: string[];
    TitlePatterns: string[];
    TmdbCollectionIds: string[];
    IncludeIds: string[];
    ExcludeIds: string[];
    ChronologicalOrder: string[];
    BackdropItemId?: string | null;
}

export interface UniverseSummary {
    Id: string;
    Name: string;
    Overview?: string | null;
    Source: UniverseDefinition['Source'];
    Hidden: boolean;
    MovieCount: number;
    SeriesCount: number;
    AlbumCount: number;
    CollectionCount: number;
    FirstYear?: number | null;
    LastYear?: number | null;
    BackdropItemIds: string[];
    PosterItemIds: string[];
}

export interface UniversePerson {
    Id: string;
    Name: string;
    Roles: string[];
    Appearances: number;
}

export interface UniverseDetails {
    Summary: UniverseSummary;
    Definition: UniverseDefinition;
    ReleaseOrder: string[];
    ChronologicalOrder: string[];
    HasChronology: boolean;
    MovieIds: string[];
    SeriesIds: string[];
    AlbumIds: string[];
    CollectionIds: string[];
    OtherIds: string[];
    People: UniversePerson[];
}

export const emptyDefinition = (): UniverseDefinition => ({
    Id: '', Name: '', Overview: '', Source: 'custom', Hidden: false,
    Tags: [], Studios: [], TitlePatterns: [], TmdbCollectionIds: [],
    IncludeIds: [], ExcludeIds: [], ChronologicalOrder: [], BackdropItemId: null
});

/** Ids are compared without dashes and in lower case (the server may send either form). */
export const normId = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

const url = (api: Api, path: string) => `${api.basePath}/MetaUniverses${path}`;

export const useUniverses = (includeHidden: boolean) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'MetaUniverses', user?.Id, includeHidden ],
        queryFn: async ({ signal }) => (await api!.axiosInstance.get<UniverseSummary[]>(url(api!, ''), {
            params: { includeHidden },
            headers: { Authorization: api!.authorizationHeader },
            signal
        })).data,
        enabled: !!api && !!user,
        staleTime: 5 * 60 * 1000
    });
};

export const useUniverse = (id: string | null) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'MetaUniverse', user?.Id, id ],
        queryFn: async ({ signal }) => (await api!.axiosInstance.get<UniverseDetails>(url(api!, `/${encodeURIComponent(id!)}`), {
            headers: { Authorization: api!.authorizationHeader },
            signal
        })).data,
        enabled: !!api && !!user && !!id,
        staleTime: 5 * 60 * 1000,
        retry: false
    });
};

/** Full items (images, user data, ratings) of a universe, keyed by normalised id. */
export const useUniverseItems = (ids: string[]) => {
    const { api, user } = useApi();
    const key = [ ...ids ].sort().join(',');
    return useQuery({
        queryKey: [ 'MetaUniverseItems', user?.Id, key ],
        queryFn: async ({ signal }) => {
            const map = new Map<string, BaseItemDto>();
            for (let i = 0; i < ids.length; i += 150) {
                const res = await getLibraryApi(api!).getItems({
                    userId: user?.Id,
                    ids: ids.slice(i, i + 150),
                    fields: [ ItemFields.Overview, ItemFields.PrimaryImageAspectRatio, ItemFields.ChildCount, ItemFields.Genres ],
                    enableImageTypes: [ 'Primary', 'Backdrop', 'Logo', 'Thumb' ] as never,
                    imageTypeLimit: 1
                }, { signal });
                (res.data.Items || []).forEach(it => { map.set(normId(it.Id), it); });
            }
            return map;
        },
        enabled: !!api && !!user && ids.length > 0,
        staleTime: 5 * 60 * 1000
    });
};

export const useUniverseMutations = () => {
    const { api } = useApi();
    const client = useQueryClient();
    const headers = () => ({ Authorization: api!.authorizationHeader });
    const refresh = () => client.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith('MetaUniverse') });

    const save = useMutation({
        mutationFn: async (def: UniverseDefinition) => (await api!.axiosInstance.post<UniverseDefinition>(url(api!, ''), def, { headers: headers() })).data,
        onSuccess: refresh
    });
    const remove = useMutation({
        mutationFn: async (id: string) => { await api!.axiosInstance.delete(url(api!, `/${encodeURIComponent(id)}`), { headers: headers() }); },
        onSuccess: refresh
    });
    const rebuild = useMutation({
        mutationFn: async () => { await api!.axiosInstance.post(url(api!, '/Refresh'), null, { headers: headers() }); },
        onSuccess: refresh
    });
    return { save, remove, rebuild };
};
