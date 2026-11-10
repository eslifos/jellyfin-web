/**
 * MoviesHomeView — start screen of a movie library: featured banner, continue watching, top 10, recently added,
 * trending, in theaters, upcoming, recommendations, recent releases, best rated, hidden gems, genres, classics,
 * sagas and favorites. The full library is in the "Movies" tab.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import type { RecommendationDto } from '@jellyfin/sdk/lib/generated-client/models/recommendation-dto';
import { RecommendationType } from '@jellyfin/sdk/lib/generated-client/models/recommendation-type';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getGenreApi } from '@jellyfin/sdk/lib/utils/api/genre-api';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import React, { type FC, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import HomeHero from 'apps/modern/components/HomeHero';
import { type ExternalMovie, ExternalMovieDialog } from 'apps/modern/components/Trailer';
import Loading from 'components/loading/LoadingComponent';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import type { ParentId } from 'types/library';

import { useMovieRecommendations } from '../hooks/api/useMovieRecommendations';
import LibraryTabsBar from './LibraryTabsBar';

interface ExternalRelease {
    Kind: string;
    TmdbId: number;
    Title: string;
    ReleaseDate: string;
    Overview?: string | null;
    ImageUrl?: string | null;
    BackdropUrl?: string | null;
    Rating?: number | null;
    RelatedItemId?: string | null;
}

interface LibraryDiscovery {
    Top10: string[];
    Trending: string[];
    TopRated: string[];
    HiddenGems: string[];
    Classics: string[];
    Upcoming: ExternalRelease[];
    NowPlaying: ExternalRelease[];
}

const FIELDS = [ ItemFields.PrimaryImageAspectRatio, ItemFields.MediaSourceCount ];
const ROW_LIMIT = 24;
/** A row is only shown with at least this many titles */
const MIN_ROW = 8;
const STALE = 15 * 60 * 1000;

const normId = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

/** Same pick for the whole day, different the next day. */
const dailyShuffle = <T,>(list: T[]) => {
    const seed = Math.floor(Date.now() / 86400000);
    return list
        .map((item, i) => ({ item, k: Math.sin(seed * 9301 + i * 49297) }))
        .sort((a, b) => a.k - b.k)
        .map(x => x.item);
};

const recommendationTitle = (r: RecommendationDto) => {
    switch (r.RecommendationType) {
        case RecommendationType.SimilarToRecentlyPlayed:
            return globalize.translate('RecommendationBecauseYouWatched', r.BaselineItemName);
        case RecommendationType.SimilarToLikedItem:
            return globalize.translate('RecommendationBecauseYouLike', r.BaselineItemName);
        case RecommendationType.HasDirectorFromRecentlyPlayed:
        case RecommendationType.HasLikedDirector:
            return globalize.translate('RecommendationDirectedBy', r.BaselineItemName);
        default:
            return globalize.translate('RecommendationStarring', r.BaselineItemName);
    }
};

const rowTitleSx = {
    fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 800, color: '#fff', mb: 1.25
};

const scrollRowSx = {
    display: 'flex', gap: { xs: 1.25, md: 2 }, overflowX: 'auto', overflowY: 'hidden', pb: 1.5, pt: 1,
    scrollSnapType: 'x proximity', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,164,220,0.6) transparent',
    '&::-webkit-scrollbar': { height: 6 },
    '&::-webkit-scrollbar-thumb': { background: 'rgba(0,164,220,0.6)', borderRadius: 3 },
    '&::-webkit-scrollbar-track': { background: 'transparent' }
};

const posterSx = {
    display: 'block', width: '100%', aspectRatio: '2 / 3', objectFit: 'cover',
    borderRadius: '12px', boxShadow: '0 8px 22px rgba(0,0,0,0.5)', transition: 'box-shadow 0.2s', background: '#111'
};

const posterCardSx = {
    flex: '0 0 auto', width: { xs: 120, md: 160 }, display: 'block', textAlign: 'center',
    scrollSnapAlign: 'start', borderRadius: '12px',
    '&:hover img': { boxShadow: '0 0 0 2px #00a4dc, 0 0 24px rgba(0,164,220,0.5)' }
};

const posterTitleSx = {
    mt: 0.75, fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
};

/** Poster row of library items, same look as the in-theaters row. */
const ItemsRow: FC<{ title: string; items?: BaseItemDto[] }> = ({ title, items }) => {
    const { api } = useApi();
    const navigate = useNavigate();
    if (!api || !items || items.length < MIN_ROW) return null;

    return (
        <Box className='padded-left padded-right' sx={{ mb: 3 }}>
            <Typography component='h2' sx={rowTitleSx}>{title}</Typography>
            <Box sx={scrollRowSx}>
                {items.map(item => {
                    const progress = item.UserData?.PlayedPercentage || 0;
                    const tag = item.ImageTags?.Primary;
                    return (
                        <ButtonBase
                            key={item.Id}
                            // eslint-disable-next-line react/jsx-no-bind
                            onClick={() => navigate(`/details?id=${item.Id}&serverId=${item.ServerId}`)}
                            title={item.Name || ''}
                            sx={posterCardSx}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <Box
                                    component='img'
                                    loading='lazy'
                                    alt={item.Name || ''}
                                    src={tag ? getImageApi(api).getItemImageUrlById(item.Id!, ImageType.Primary, { maxWidth: 320, tag }) : ''}
                                    sx={posterSx}
                                />
                                {progress > 0 && progress < 100 && (
                                    <Box sx={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }}>
                                        <Box sx={{ width: `${progress}%`, height: '100%', borderRadius: 2, background: '#00a4dc' }} />
                                    </Box>
                                )}
                            </Box>
                            <Typography sx={posterTitleSx}>{item.Name}</Typography>
                        </ButtonBase>
                    );
                })}
            </Box>
        </Box>
    );
};

/** Top 10 with big ranking numbers next to the poster. */
const Top10Row: FC<{ items: BaseItemDto[] }> = ({ items }) => {
    const { api } = useApi();
    const navigate = useNavigate();
    if (!api || !items.length) return null;

    return (
        <Box className='padded-left padded-right' sx={{ mb: 3 }}>
            <Typography component='h2' sx={rowTitleSx}>{globalize.translate('MoviesHomeTop10')}</Typography>
            <Box sx={scrollRowSx}>
                {items.map((item, i) => (
                    <ButtonBase
                        key={item.Id}
                        // eslint-disable-next-line react/jsx-no-bind
                        onClick={() => navigate(`/details?id=${item.Id}&serverId=${item.ServerId}`)}
                        title={item.Name || ''}
                        sx={{
                            flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', scrollSnapAlign: 'start',
                            borderRadius: '14px', transition: 'transform 0.2s', pt: 0.5,
                            '&:hover': { transform: 'translateY(-4px)' },
                            '&:hover img': { boxShadow: '0 0 0 2px #00a4dc, 0 0 24px rgba(0,164,220,0.5)' }
                        }}
                    >
                        <Box component='span' aria-hidden sx={{
                            fontSize: { xs: '5.5rem', md: '8.5rem' }, fontWeight: 900, lineHeight: 0.8,
                            letterSpacing: i === 9 ? '-0.6rem' : 0,
                            color: 'rgba(8,8,16,0.9)', WebkitTextStroke: '3px rgba(0,164,220,0.85)',
                            textShadow: '0 0 24px rgba(0,164,220,0.35)', mr: { xs: -1.5, md: -2.5 }, zIndex: 0
                        }}>
                            {i + 1}
                        </Box>
                        <Box
                            component='img'
                            loading='lazy'
                            alt={item.Name || ''}
                            src={getImageApi(api).getItemImageUrlById(item.Id!, ImageType.Primary, { maxWidth: 300, tag: item.ImageTags?.Primary })}
                            sx={{
                                position: 'relative', zIndex: 1, width: { xs: 110, md: 160 }, aspectRatio: '2 / 3', objectFit: 'cover',
                                borderRadius: '12px', boxShadow: '0 8px 22px rgba(0,0,0,0.5)', transition: 'box-shadow 0.2s', background: '#111'
                            }}
                        />
                    </ButtonBase>
                ))}
            </Box>
        </Box>
    );
};

/** Movies from TMDb (in theaters / upcoming): opens the movie when the library has it, otherwise its sheet with the trailer. */
const ExternalRow: FC<{ title: string; releases?: ExternalRelease[]; showDate: boolean; onOpen: (m: ExternalMovie) => void }> = ({ title, releases, showDate, onOpen }) => {
    const navigate = useNavigate();
    const { __legacyApiClient__ } = useApi();
    if (!releases || releases.length < MIN_ROW) return null;

    const dateText = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

    return (
        <Box className='padded-left padded-right' sx={{ mb: 3 }}>
            <Typography component='h2' sx={rowTitleSx}>{title}</Typography>
            <Box sx={scrollRowSx}>
                {releases.map(r => {
                    const owned = !!r.RelatedItemId;
                    const open = () => {
                        if (owned) {
                            navigate(`/details?id=${r.RelatedItemId}&serverId=${__legacyApiClient__?.serverId()}`);
                        } else {
                            onOpen(r);
                        }
                    };
                    return (
                        <ButtonBase
                            key={r.TmdbId}
                            // eslint-disable-next-line react/jsx-no-bind
                            onClick={open}
                            title={r.Overview || r.Title}
                            sx={posterCardSx}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <Box component='img' loading='lazy' src={r.ImageUrl || ''} alt={r.Title} sx={{
                                    display: 'block', width: '100%', aspectRatio: '2 / 3', objectFit: 'cover',
                                    borderRadius: '12px', boxShadow: '0 8px 22px rgba(0,0,0,0.5)', transition: 'box-shadow 0.2s', background: '#111'
                                }} />
                                {showDate && (
                                    <Box component='span' sx={{
                                        position: 'absolute', left: 8, top: 8, px: 1, py: 0.25, borderRadius: '6px',
                                        fontSize: '0.72rem', fontWeight: 800, color: '#fff', background: 'rgba(229,9,20,0.92)'
                                    }}>
                                        {dateText(r.ReleaseDate)}
                                    </Box>
                                )}
                                {owned && (
                                    <Box component='span' sx={{
                                        position: 'absolute', left: 8, bottom: 8, px: 1, py: 0.25, borderRadius: '6px',
                                        fontSize: '0.68rem', fontWeight: 800, color: '#fff', background: 'rgba(0,164,220,0.92)'
                                    }}>
                                        {globalize.translate('MoviesHomeInLibrary')}
                                    </Box>
                                )}
                            </Box>
                            <Typography sx={{
                                mt: 0.75, fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {r.Title}
                            </Typography>
                        </ButtonBase>
                    );
                })}
            </Box>
        </Box>
    );
};

const MoviesHomeView: FC<{ parentId: ParentId }> = ({ parentId }) => {
    const { api, user } = useApi();
    const enabled = !!api && !!user?.Id && !!parentId;
    const [ external, setExternal ] = useState<ExternalMovie | null>(null);
    const base = useMemo(() => ({
        userId: user?.Id,
        parentId: parentId || undefined,
        recursive: true,
        includeItemTypes: [ BaseItemKind.Movie ],
        fields: FIELDS,
        enableImageTypes: [ ImageType.Primary, ImageType.Backdrop, ImageType.Thumb ],
        imageTypeLimit: 1
    }), [ user?.Id, parentId ]);

    // Server rows (TMDb / IMDb)
    const { data: discovery, isPending: discoveryPending } = useQuery({
        queryKey: [ 'MoviesHomeDiscovery', user?.Id, parentId ],
        queryFn: async ({ signal }) => {
            try {
                const res = await api!.axiosInstance.get<LibraryDiscovery>(`${api!.basePath}/Discovery/Library/${parentId}`, {
                    headers: { Authorization: api!.authorizationHeader },
                    signal
                });
                return res.data;
            } catch (err) {
                if (signal?.aborted) throw err;
                return null;
            }
        },
        enabled,
        staleTime: STALE
    });

    // All the ids of the server rows in one request
    const allIds = useMemo(() => {
        if (!discovery) return [];
        return Array.from(new Set([
            ...discovery.Top10, ...discovery.Trending, ...discovery.TopRated, ...discovery.HiddenGems, ...discovery.Classics
        ]));
    }, [ discovery ]);

    const { data: byId } = useQuery({
        queryKey: [ 'MoviesHomeItems', user?.Id, parentId, allIds.join(',') ],
        queryFn: async ({ signal }) => {
            const map = new Map<string, BaseItemDto>();
            for (let i = 0; i < allIds.length; i += 100) {
                const res = await getLibraryApi(api!).getItems({ ...base, ids: allIds.slice(i, i + 100) }, { signal });
                for (const item of res.data.Items || []) map.set(normId(item.Id), item);
            }
            return map;
        },
        enabled: enabled && allIds.length > 0,
        staleTime: STALE
    });

    const pick = (ids?: string[]) => (ids || []).map(id => byId?.get(normId(id))).filter((i): i is BaseItemDto => !!i);

    const { data: resume } = useQuery({
        queryKey: [ 'MoviesHomeResume', user?.Id, parentId ],
        queryFn: async ({ signal }) => (await getLibraryApi(api!).getResumeItems({
            userId: user?.Id, parentId: parentId || undefined, includeItemTypes: [ BaseItemKind.Movie ],
            fields: FIELDS, enableImageTypes: [ ImageType.Primary, ImageType.Backdrop, ImageType.Thumb ], imageTypeLimit: 1, limit: ROW_LIMIT
        }, { signal })).data.Items || [],
        enabled
    });

    const { data: latest } = useQuery({
        queryKey: [ 'MoviesHomeLatest', user?.Id, parentId ],
        queryFn: async ({ signal }) => (await getLibraryApi(api!).getLatestMedia({
            userId: user?.Id, parentId: parentId || undefined, includeItemTypes: [ BaseItemKind.Movie ],
            fields: FIELDS, enableImageTypes: [ ImageType.Primary, ImageType.Backdrop, ImageType.Thumb ], imageTypeLimit: 1, limit: ROW_LIMIT
        }, { signal })).data,
        enabled,
        staleTime: 5 * 60 * 1000
    });

    const { data: releases } = useQuery({
        queryKey: [ 'MoviesHomeReleases', user?.Id, parentId ],
        queryFn: async ({ signal }) => {
            const since = new Date();
            since.setFullYear(since.getFullYear() - 1);
            return (await getLibraryApi(api!).getItems({
                ...base, minPremiereDate: since.toISOString(), maxPremiereDate: new Date().toISOString(),
                sortBy: [ ItemSortBy.PremiereDate ], sortOrder: [ SortOrder.Descending ], limit: ROW_LIMIT
            }, { signal })).data.Items || [];
        },
        enabled,
        staleTime: STALE
    });

    const { data: favorites } = useQuery({
        queryKey: [ 'MoviesHomeFavorites', user?.Id, parentId ],
        queryFn: async ({ signal }) => (await getLibraryApi(api!).getItems({
            ...base, isFavorite: true, sortBy: [ ItemSortBy.DateCreated ], sortOrder: [ SortOrder.Descending ], limit: ROW_LIMIT
        }, { signal })).data.Items || [],
        enabled
    });

    const { data: sagas } = useQuery({
        queryKey: [ 'MoviesHomeSagas', user?.Id ],
        queryFn: async ({ signal }) => dailyShuffle((await getLibraryApi(api!).getItems({
            userId: user?.Id, recursive: true, includeItemTypes: [ BaseItemKind.BoxSet ], fields: FIELDS,
            enableImageTypes: [ ImageType.Primary ], imageTypeLimit: 1, limit: 200
        }, { signal })).data.Items || []).slice(0, ROW_LIMIT),
        enabled,
        staleTime: STALE
    });

    // Three of the biggest genres, a different set each day
    const { data: genreRows } = useQuery({
        queryKey: [ 'MoviesHomeGenres', user?.Id, parentId ],
        queryFn: async ({ signal }) => {
            const genres = (await getGenreApi(api!).getGenres({
                userId: user?.Id, parentId: parentId || undefined, includeItemTypes: [ BaseItemKind.Movie ],
                fields: [ ItemFields.ItemCounts ], enableImageTypes: [], limit: 60
            }, { signal })).data.Items || [];
            const big = genres
                .filter(g => (g.MovieCount ?? g.ChildCount ?? 0) >= 12)
                .sort((a, b) => (b.MovieCount ?? b.ChildCount ?? 0) - (a.MovieCount ?? a.ChildCount ?? 0))
                .slice(0, 10);
            const chosen = dailyShuffle(big.length ? big : genres).slice(0, 3);
            return Promise.all(chosen.map(async g => ({
                genre: g,
                items: (await getLibraryApi(api!).getItems({
                    ...base, genreIds: [ g.Id! ], sortBy: [ ItemSortBy.Random ], limit: ROW_LIMIT
                }, { signal })).data.Items || []
            })));
        },
        enabled,
        staleTime: STALE
    });

    const { data: recommendations } = useMovieRecommendations({
        parentId: parentId || undefined,
        fields: FIELDS,
        categoryLimit: 2,
        itemLimit: 20
    }, enabled);

    if (discoveryPending && !latest) return <Loading />;

    // Always 10: if the server sends fewer, complete with trending and best rated titles
    const top10 = Array.from(new Map(
        [ ...pick(discovery?.Top10), ...pick(discovery?.Trending), ...pick(discovery?.TopRated) ].map(i => [ i.Id, i ])
    ).values()).slice(0, 10);
    const heroIds = top10.map(i => i.Id!).filter(Boolean);

    return (
        <Box className='padded-bottom-page' sx={{ '& .verticalSection': { mb: 1 } }}>
            <LibraryTabsBar floating />
            {heroIds.length > 0 && <HomeHero itemIds={heroIds} />}

            <ItemsRow title={globalize.translate('HeaderContinueWatching')} items={resume} />
            <Top10Row items={top10} />
            <ItemsRow title={globalize.translate('MoviesHomeRecentlyAdded')} items={latest} />
            <ItemsRow title={globalize.translate('MoviesHomeTrending')} items={pick(discovery?.Trending)} />
            <ExternalRow title={globalize.translate('MoviesHomeNowPlaying')} releases={discovery?.NowPlaying} showDate={false} onOpen={setExternal} />
            <ExternalRow title={globalize.translate('MoviesHomeUpcoming')} releases={discovery?.Upcoming} showDate onOpen={setExternal} />
            <ExternalMovieDialog movie={external} parentId={parentId} onClose={() => setExternal(null)} />

            {recommendations?.map((r, i) => (
                <ItemsRow
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${r.CategoryId}-${i}`}
                    title={recommendationTitle(r)}
                    items={r.Items || []}
                />
            ))}

            <ItemsRow title={globalize.translate('MoviesHomeRecentReleases')} items={releases} />
            <ItemsRow title={globalize.translate('MoviesHomeTopRated')} items={pick(discovery?.TopRated)} />
            <ItemsRow title={globalize.translate('MoviesHomeHiddenGems')} items={pick(discovery?.HiddenGems)} />

            {genreRows?.map(({ genre, items }) => (
                <ItemsRow key={genre.Id} title={genre.Name || ''} items={items} />
            ))}

            <ItemsRow title={globalize.translate('MoviesHomeClassics')} items={pick(discovery?.Classics)} />
            <ItemsRow title={globalize.translate('MoviesHomeSagas')} items={sagas} />
            <ItemsRow title={globalize.translate('MoviesHomeFavorites')} items={favorites} />
        </Box>
    );
};

export default MoviesHomeView;
