/**
 * Genre page: everything of a genre across all the libraries (or one library with parentId), in sections:
 * the best, movies, series, one row per library, and the whole catalog with filters and sorting.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SeriesStatus } from '@jellyfin/sdk/lib/generated-client/models/series-status';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import FiberNewRoundedIcon from '@mui/icons-material/FiberNewRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import LocalMoviesRoundedIcon from '@mui/icons-material/LocalMoviesRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import React, { type FC, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import FeedCard from 'apps/modern/components/HomeFeed/FeedCard';
import { FeedSection } from 'apps/modern/components/HomeFeed/FeedRow';
import { FEED_FIELDS, ItemsSection, PanelSection, SectionRegistry, useFeedItems } from 'apps/modern/components/HomeFeed/FeedSections';
import { hashColor } from 'apps/modern/components/HomeFeed/feedUtils';
import { JumpBar } from 'apps/modern/components/HomeFeed/JumpBar';
import { libraryAccent } from 'apps/modern/components/HomeFeed/libraryAccent';
import LibraryIcon from 'apps/modern/components/LibraryIcon';
import Page from 'components/Page';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

const VIDEO_TYPES = [ BaseItemKind.Movie, BaseItemKind.Series ];
const VIDEO_LIBRARIES = new Set([ 'movies', 'tvshows', undefined, null, 'mixed', 'folders' ]);
const PAGE = 48;

type TypeFilter = 'all' | 'movies' | 'series';
type Sort = 'rating' | 'added' | 'year' | 'name';

const SORTS: Record<Sort, { by: ItemSortBy[], order: SortOrder[], label: string }> = {
    rating: { by: [ ItemSortBy.CommunityRating, ItemSortBy.SortName ], order: [ SortOrder.Descending, SortOrder.Ascending ], label: 'HfSortRating' },
    added: { by: [ ItemSortBy.DateCreated ], order: [ SortOrder.Descending ], label: 'HfSortAdded' },
    year: { by: [ ItemSortBy.ProductionYear, ItemSortBy.SortName ], order: [ SortOrder.Descending, SortOrder.Ascending ], label: 'HfSortYear' },
    name: { by: [ ItemSortBy.SortName ], order: [ SortOrder.Ascending ], label: 'HfSortName' }
};

const useCount = (genreId: string, parentId: string | undefined, type: BaseItemKind) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'GenrePage', user?.Id, genreId, parentId, 'count', type ],
        queryFn: async ({ signal }) => (await getLibraryApi(api!).getItems({
            userId: user?.Id, genreIds: [ genreId ], parentId, recursive: true, includeItemTypes: [ type ], limit: 0, enableTotalRecordCount: true
        }, { signal })).data.TotalRecordCount ?? 0,
        enabled: !!api && !!user?.Id
    });
};

/** Every title of the genre, with type filter, sorting and "load more". */
const Catalog: FC<{ genreId: string, parentId?: string }> = ({ genreId, parentId }) => {
    const { api, user } = useApi();
    const [ type, setType ] = useState<TypeFilter>('all');
    const [ sort, setSort ] = useState<Sort>('rating');
    const TYPES: Record<TypeFilter, BaseItemKind[]> = { all: VIDEO_TYPES, movies: [ BaseItemKind.Movie ], series: [ BaseItemKind.Series ] };
    const types = TYPES[type];

    const query = useInfiniteQuery({
        queryKey: [ 'GenrePage', user?.Id, genreId, parentId, 'catalog', type, sort ],
        queryFn: async ({ pageParam, signal }) => (await getLibraryApi(api!).getItems({
            userId: user?.Id, genreIds: [ genreId ], parentId, recursive: true, includeItemTypes: types,
            sortBy: SORTS[sort].by, sortOrder: SORTS[sort].order, startIndex: pageParam, limit: PAGE,
            fields: FEED_FIELDS, enableImageTypes: [ ImageType.Primary ], imageTypeLimit: 1, enableTotalRecordCount: true
        }, { signal })).data,
        initialPageParam: 0,
        getNextPageParam: (last, pages) => {
            const loaded = pages.reduce((n, p) => n + (p.Items?.length ?? 0), 0);
            return loaded < (last.TotalRecordCount ?? 0) ? loaded : undefined;
        },
        enabled: !!api && !!user?.Id
    });

    const items = query.data?.pages.flatMap(p => p.Items ?? []) ?? [];
    const total = query.data?.pages[0]?.TotalRecordCount ?? 0;
    const onType = useCallback((_: React.MouseEvent, v: TypeFilter | null) => {
        if (v) setType(v);
    }, []);
    const onSort = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSort(e.target.value as Sort), []);
    const onMore = useCallback(() => {
        void query.fetchNextPage();
    }, [ query ]);

    return (
        <FeedSection id='gp-all' title={globalize.translate('HfAllTitles')} subtitle={globalize.translate('HfTitlesCount', total)} icon={<GridViewRoundedIcon />} accent='#00a4dc' panel>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                <ToggleButtonGroup exclusive size='small' value={type} onChange={onType}>
                    <ToggleButton value='all'>{globalize.translate('HfAll')}</ToggleButton>
                    <ToggleButton value='movies'>{globalize.translate('Movies')}</ToggleButton>
                    <ToggleButton value='series'>{globalize.translate('Shows')}</ToggleButton>
                </ToggleButtonGroup>
                <TextField select size='small' value={sort} onChange={onSort} label={globalize.translate('HfSortBy')} sx={{ minWidth: 180 }}>
                    {(Object.keys(SORTS) as Sort[]).map(k => <MenuItem key={k} value={k}>{globalize.translate(SORTS[k].label)}</MenuItem>)}
                </TextField>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(auto-fill, minmax(108px, 1fr))', md: 'repeat(auto-fill, minmax(150px, 1fr))' }, gap: { xs: 1.5, md: 2 }, '& .hfCard': { width: '100% !important' } }}>
                {items.map(item => <FeedCard key={item.Id} item={item} shape='portrait' />)}
            </Box>
            {query.isFetching && <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={28} /></Box>}
            {query.hasNextPage && !query.isFetching && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Button variant='outlined' onClick={onMore} sx={{ borderRadius: '50px', fontWeight: 700 }}>{globalize.translate('HfLoadMore')}</Button>
                </Box>
            )}
        </FeedSection>
    );
};

/** Random titles of the genre in one library. */
const LibraryRow: FC<{ genreId: string, view: BaseItemDto }> = ({ genreId, view }) => {
    const { data } = useFeedItems([ 'genreLib', genreId, view.Id ], {
        genreIds: [ genreId ], parentId: view.Id, includeItemTypes: VIDEO_TYPES, sortBy: [ ItemSortBy.Random ]
    }, true, 15 * 60 * 1000);
    return (
        <ItemsSection
            id={`gp-lib-${view.Id}`}
            title={globalize.translate('HfInLibrary', view.Name ?? '')}
            icon={<LibraryIcon item={view} />}
            accent={libraryAccent(view)}
            items={data}
            shape='portrait'
            context={view.CollectionType}
        />
    );
};

const GenrePage: FC = () => {
    const { api, user } = useApi();
    const [ params ] = useSearchParams();
    const genreId = params.get('genreId') ?? '';
    const parentId = params.get('parentId') ?? undefined;
    const enabled = !!api && !!user?.Id && !!genreId;
    const { data: viewsData } = useUserViews({ userId: user?.Id });
    const [ present, setPresent ] = useState<Record<string, boolean>>({});
    const register = useCallback((id: string, has: boolean) => {
        setPresent(prev => (!!prev[id] === has ? prev : { ...prev, [id]: has }));
    }, []);

    const { data: genre } = useQuery({
        queryKey: [ 'GenrePage', user?.Id, genreId, 'item' ],
        queryFn: async ({ signal }) => (await api!.axiosInstance.get<BaseItemDto>(`${api!.basePath}/Items/${genreId}`, {
            headers: { Authorization: api!.authorizationHeader }, params: { userId: user?.Id }, signal
        })).data,
        enabled
    });

    const base = { genreIds: [ genreId ], parentId };
    const key = [ 'genre', genreId, parentId ];
    const { data: best } = useFeedItems([ ...key, 'best' ], { ...base, includeItemTypes: VIDEO_TYPES, minCommunityRating: 7, sortBy: [ ItemSortBy.CommunityRating ], sortOrder: [ SortOrder.Descending ] }, enabled);
    const { data: moviesNew } = useFeedItems([ ...key, 'moviesNew' ], { ...base, includeItemTypes: [ BaseItemKind.Movie ], sortBy: [ ItemSortBy.DateCreated ], sortOrder: [ SortOrder.Descending ] }, enabled);
    const { data: moviesRecent } = useFeedItems([ ...key, 'moviesRecent' ], { ...base, includeItemTypes: [ BaseItemKind.Movie ], sortBy: [ ItemSortBy.PremiereDate ], sortOrder: [ SortOrder.Descending ] }, enabled);
    const { data: moviesUnwatched } = useFeedItems([ ...key, 'moviesUnwatched' ], { ...base, includeItemTypes: [ BaseItemKind.Movie ], filters: [ ItemFilter.IsUnplayed ], sortBy: [ ItemSortBy.Random ] }, enabled);
    const { data: seriesNew } = useFeedItems([ ...key, 'seriesNew' ], { ...base, includeItemTypes: [ BaseItemKind.Series ], sortBy: [ ItemSortBy.DateLastContentAdded ], sortOrder: [ SortOrder.Descending ] }, enabled);
    const { data: seriesTop } = useFeedItems([ ...key, 'seriesTop' ], { ...base, includeItemTypes: [ BaseItemKind.Series ], sortBy: [ ItemSortBy.CommunityRating ], sortOrder: [ SortOrder.Descending ] }, enabled);
    const { data: seriesOn } = useFeedItems([ ...key, 'seriesOn' ], { ...base, includeItemTypes: [ BaseItemKind.Series ], seriesStatus: [ SeriesStatus.Continuing ], sortBy: [ ItemSortBy.Random ] }, enabled);
    const { data: classics } = useFeedItems([ ...key, 'classics' ], { ...base, includeItemTypes: VIDEO_TYPES, maxPremiereDate: new Date(1991, 0, 1).toISOString(), minCommunityRating: 7, sortBy: [ ItemSortBy.CommunityRating ], sortOrder: [ SortOrder.Descending ] }, enabled);
    const { data: backdrops } = useFeedItems([ ...key, 'backdrops' ], { ...base, includeItemTypes: VIDEO_TYPES, imageTypes: [ ImageType.Backdrop ], sortBy: [ ItemSortBy.Random ], limit: 6, enableImageTypes: [ ImageType.Backdrop ] }, enabled, 30 * 60 * 1000);
    const { data: movieCount } = useCount(genreId, parentId, BaseItemKind.Movie);
    const { data: seriesCount } = useCount(genreId, parentId, BaseItemKind.Series);

    const libraries = useMemo(() => (parentId ? [] : (viewsData?.Items ?? []).filter(v => VIDEO_LIBRARIES.has(v.CollectionType as string | undefined))), [ viewsData, parentId ]);
    const library = parentId ? viewsData?.Items?.find(v => v.Id === parentId) : undefined;
    const color = hashColor(genre?.Name || genreId);

    const chips = [
        [ 'gp-best', 'HfBest', '#ffca28' ],
        [ 'gp-movies', 'Movies', '#00a4dc' ],
        [ 'gp-series', 'Shows', '#aa5cc3' ],
        [ 'gp-classics', 'MoviesHomeClassics', '#bcaaa4' ],
        ...libraries.map(v => [ `gp-lib-${v.Id}`, v.Name ?? '', libraryAccent(v) ])
    ].filter(([ id ]) => present[id]).map(([ id, label, c ]) => ({ id, label: id.startsWith('gp-lib-') ? label : globalize.translate(label), color: c }));
    chips.push({ id: 'gp-all', label: globalize.translate('HfAllTitles'), color: '#00a4dc' });

    return (
        <Page id='genrePage' title={genre?.Name ?? globalize.translate('Genre')} className='mainAnimatedPage libraryPage noSecondaryNavPage'>
            <SectionRegistry.Provider value={register}>
                <Box sx={{ pb: 14 }}>
                    {/* Header: the genre name over a collage of its backdrops */}
                    <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: { xs: 220, md: 300 }, display: 'flex', alignItems: 'flex-end', mb: 1 }}>
                        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', opacity: 0.45, filter: 'saturate(1.1)' }}>
                            {api && backdrops?.map(b => (
                                <Box key={b.Id} component='img' alt='' src={getImageApi(api).getItemImageUrlById(b.Id!, ImageType.Backdrop, { maxWidth: 700, tag: b.BackdropImageTags?.[0] })}
                                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ))}
                        </Box>
                        <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, #0b0d1c 0%, rgba(11,13,28,0.6) 55%, ${color}55 100%)` }} />
                        <Box className='padded-left padded-right' sx={{ position: 'relative', pt: 10, pb: 2.5 }}>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color }}>
                                {library ? globalize.translate('HfGenreIn', library.Name ?? '') : globalize.translate('Genre')}
                            </Typography>
                            <Typography component='h1' sx={{ fontSize: { xs: '2.2rem', md: '3.4rem' }, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1px', textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
                                {genre?.Name ?? ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, mt: 1, color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.9rem' }}>
                                <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><LocalMoviesRoundedIcon sx={{ fontSize: 18 }} />{globalize.translate('HfMoviesCount', movieCount ?? 0)}</Box>
                                <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><TvRoundedIcon sx={{ fontSize: 18 }} />{globalize.translate('HfSeriesCount', seriesCount ?? 0)}</Box>
                            </Box>
                        </Box>
                    </Box>

                    <JumpBar chips={chips} />

                    <ItemsSection id='gp-best' title={globalize.translate('HfBestOf', genre?.Name ?? '')} icon={<StarRoundedIcon />} accent='#ffca28' items={best} shape='portrait' />
                    <PanelSection id='gp-movies' title={globalize.translate('Movies')} icon={<LocalMoviesRoundedIcon />} accent='#00a4dc' rows={[
                        { key: 'new', title: globalize.translate('HfRecentlyAdded'), icon: <FiberNewRoundedIcon />, items: moviesNew, shape: 'portrait' },
                        { key: 'recent', title: globalize.translate('HfNewestReleases'), icon: <StarRoundedIcon />, items: moviesRecent, shape: 'portrait' },
                        { key: 'unwatched', title: globalize.translate('HfUnwatched'), icon: <CasinoRoundedIcon />, items: moviesUnwatched, shape: 'portrait' }
                    ]} />
                    <PanelSection id='gp-series' title={globalize.translate('Shows')} icon={<TvRoundedIcon />} accent='#aa5cc3' rows={[
                        { key: 'new', title: globalize.translate('HfNewEpisodes'), icon: <FiberNewRoundedIcon />, items: seriesNew, shape: 'portrait' },
                        { key: 'top', title: globalize.translate('HfTopRatedSeries'), icon: <StarRoundedIcon />, items: seriesTop, shape: 'portrait' },
                        { key: 'on', title: globalize.translate('HfContinuing'), icon: <SensorsRoundedIcon />, items: seriesOn, shape: 'portrait' }
                    ]} />
                    {libraries.length > 1 && libraries.map(v => <LibraryRow key={v.Id} genreId={genreId} view={v} />)}
                    <ItemsSection id='gp-classics' title={globalize.translate('MoviesHomeClassics')} icon={<WorkspacePremiumRoundedIcon />} accent='#bcaaa4' items={classics} shape='portrait' min={3} />
                    {genreId && <Catalog genreId={genreId} parentId={parentId} />}
                </Box>
            </SectionRegistry.Provider>
        </Page>
    );
};

export default GenrePage;
