/**
 * Shared pieces of the library start screens: the kind of a library and the genres section.
 */
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { getGenreApi } from '@jellyfin/sdk/lib/utils/api/genre-api';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import { useQuery } from '@tanstack/react-query';
import React, { type FC } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { CustomSection } from './FeedSections';
import { GenreTile } from './FeedWidgets';

export type Kind = 'movies' | 'tvshows' | 'mixed' | 'music' | 'books' | 'homevideos' | 'musicvideos';

export const STALE = 15 * 60 * 1000;

export const toKind = (collectionType?: string | null): Kind => {
    switch (collectionType) {
        case 'movies':
        case 'tvshows':
        case 'music':
        case 'books':
        case 'homevideos':
        case 'musicvideos':
            return collectionType;
        case 'photos':
            return 'homevideos';
        default:
            return 'mixed';
    }
};

const useGenres = (parentId: string, music: boolean) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'HomeFeed', user?.Id, 'libGenres', parentId, music ],
        queryFn: async ({ signal }) => {
            const params = { userId: user?.Id, parentId, sortBy: [ ItemSortBy.Random ], limit: 30, enableImageTypes: [] };
            // Scoped to a music library this returns its music genres
            return (await getGenreApi(api!).getGenres(params, { signal })).data.Items ?? [];
        },
        enabled: !!api && !!user?.Id,
        staleTime: STALE
    });
};

export const GenresSection: FC<{ parentId: string, music?: boolean }> = ({ parentId, music }) => {
    const { data: genres } = useGenres(parentId, !!music);
    return (
        <CustomSection id='lf-genres' title={globalize.translate('HfGenres')} icon={<CategoryRoundedIcon />} accent='#ff7043' present={!!genres?.length}>
            {genres?.map(g => <GenreTile key={g.Id} genre={g} parentId={parentId} />)}
        </CustomSection>
    );
};
