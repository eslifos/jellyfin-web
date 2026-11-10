/**
 * HomeHero — Netflix-style featured banner on top of the home screen.
 * Picks a few recently added movies/series that have a backdrop, rotates them,
 * and offers Play / Resume and More info. The floating library bar sits on top of it.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { useQuery } from '@tanstack/react-query';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { useNavigate } from 'react-router-dom';

import { TrailerDialog } from 'apps/modern/components/Trailer';
import { playbackManager } from 'components/playback/playbackmanager';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

const SLIDES = 6;
const ROTATE_MS = 9000;
const NEW_DAYS = 14;

/** Same pick for the whole day, different the next day. */
const dailyShuffle = <T,>(list: T[]) => {
    const seed = Math.floor(Date.now() / 86400000);
    return list
        .map((item, i) => ({ item, k: Math.sin(seed * 9301 + i * 49297) }))
        .sort((a, b) => a.k - b.k)
        .map(x => x.item);
};

interface HeroPick {
    ItemId: string;
    Reason: string;
    NewEpisodes: number;
    ImdbRating?: number | null;
    ImdbVotes?: number | null;
}

interface HeroData {
    items: BaseItemDto[];
    newEpisodes: Record<string, number>;
    months: number;
    imdb: Record<string, number>;
}

const normId = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

/** Window of the fallback: this year or the last 6 months, whichever goes further back. */
const windowMonths = () => Math.max(6, new Date().getMonth() + 1);

/** Community rating (TMDb/TVDB votes, 0-10) plus a bit of critic score when known. */
const popularity = (i: BaseItemDto) => (i.CommunityRating || 0) + (i.CriticRating ? i.CriticRating / 40 : 0);

const runtime =(ticks?: number | null) => {
    if (!ticks) return null;
    const min = Math.round(ticks / 600000000);
    const h = Math.floor(min / 60);
    return h ? `${h} h ${min % 60} min` : `${min} min`;
};

interface HomeHeroProps {
    /** Show these items (in this order) instead of the home picks, e.g. the top 10 of a library */
    itemIds?: string[];
    /** Inside a library page: no overlap with the header and a bit shorter */
    embedded?: boolean;
}

const HomeHero: FC<HomeHeroProps> = ({ itemIds, embedded = false }) => {
    const { api, user } = useApi();
    const navigate = useNavigate();
    const [ index, setIndex ] = useState(0);
    const [ paused, setPaused ] = useState(false);
    const [ trailerFor, setTrailerFor ] = useState<string | null>(null);

    const { data } = useQuery({
        queryKey: [ 'HomeHeroPopular', user?.Id, itemIds?.join(',') ],
        queryFn: async ({ signal }): Promise<HeroData> => {
            const lib = getLibraryApi(api!);
            const detail = {
                userId: user?.Id,
                recursive: true,
                imageTypes: [ ImageType.Backdrop ],
                hasOverview: true,
                fields: [ ItemFields.Overview, ItemFields.Genres, ItemFields.DateCreated, ItemFields.ChildCount ],
                enableImageTypes: [ ImageType.Backdrop, ImageType.Logo ],
                imageTypeLimit: 1
            };

            if (itemIds?.length) {
                const full = (await lib.getItems({ ...detail, hasOverview: undefined, ids: itemIds }, { signal })).data.Items || [];
                const byId = new Map(full.map(i => [ normId(i.Id), i ]));
                const ordered = itemIds.map(id => byId.get(normId(id))).filter((i): i is BaseItemDto => !!i);
                return { items: ordered, newEpisodes: {}, months: 1, imdb: {} };
            }

            // Server ranking: releases of this year / last 6 months by IMDb votes, TMDb popularity and rating.
            try {
                const res = await api!.axiosInstance.get<HeroPick[]>(`${api!.basePath}/Discovery/Hero`, {
                    headers: { Authorization: api!.authorizationHeader },
                    params: { limit: SLIDES + 2 },
                    signal
                });
                const picks = res.data || [];
                if (picks.length) {
                    const full = (await lib.getItems({ ...detail, hasOverview: undefined, ids: picks.map(p => p.ItemId) }, { signal })).data.Items || [];
                    const byId = new Map(full.map(i => [ normId(i.Id), i ]));
                    const order = picks.map(p => normId(p.ItemId));
                    const ranked = order.map(id => byId.get(id)).filter((i): i is BaseItemDto => !!i);
                    const top = dailyShuffle(ranked.slice(0, SLIDES + 2)).slice(0, SLIDES)
                        .sort((a, b) => order.indexOf(normId(a.Id)) - order.indexOf(normId(b.Id)));
                    const newEpisodes: Record<string, number> = {};
                    const imdb: Record<string, number> = {};
                    picks.forEach(p => {
                        const item = byId.get(normId(p.ItemId));
                        if (!item?.Id) return;
                        if (p.NewEpisodes && p.Reason !== 'Movie') newEpisodes[item.Id] = p.NewEpisodes;
                        if (p.ImdbRating) imdb[item.Id] = p.ImdbRating;
                    });
                    if (top.length) return { items: top, newEpisodes, months: windowMonths(), imdb };
                }
            } catch (err) {
                if (signal?.aborted) throw err;
                // Server without the Discovery endpoint: rank here below
            }

            // Recent = released in the window (movies) or with new episodes aired in it (series).
            // Popular = best community/critic rating. Widen the window if there are too few.
            for (const months of [ windowMonths(), 12 ]) {
                const since = new Date();
                since.setMonth(since.getMonth() - months);
                const now = new Date().toISOString();

                const [ movies, episodes ] = await Promise.all([
                    lib.getItems({ ...detail, includeItemTypes: [ BaseItemKind.Movie ], minPremiereDate: since.toISOString(), maxPremiereDate: now, limit: 300 }, { signal }),
                    lib.getItems({
                        userId: user?.Id, recursive: true, includeItemTypes: [ BaseItemKind.Episode ],
                        minPremiereDate: since.toISOString(), maxPremiereDate: now, isMissing: false,
                        enableImages: false, enableUserData: false, limit: 3000
                    }, { signal })
                ]);

                const newEpisodes: Record<string, number> = {};
                (episodes.data.Items || []).forEach(e => {
                    if (e.SeriesId && e.LocationType !== 'Virtual') newEpisodes[e.SeriesId] = (newEpisodes[e.SeriesId] || 0) + 1;
                });
                const seriesIds = Object.keys(newEpisodes).slice(0, 150);
                const series = seriesIds.length ?
                    (await lib.getItems({ ...detail, ids: seriesIds, includeItemTypes: [ BaseItemKind.Series ] }, { signal })).data.Items || [] :
                    [];

                const candidates = [ ...(movies.data.Items || []), ...series ]
                    .filter(i => (i.CommunityRating || 0) >= 6.5)
                    .sort((a, b) => popularity(b) - popularity(a));

                if (candidates.length >= SLIDES || months === 12) {
                    if (candidates.length) {
                        // Mix the top a bit each day so the banner isn't always the same order.
                        const top = dailyShuffle(candidates.slice(0, SLIDES + 2)).slice(0, SLIDES)
                            .sort((a, b) => popularity(b) - popularity(a));
                        return { items: top, newEpisodes, months, imdb: {} as Record<string, number> };
                    }
                    break;
                }
            }

            // Nothing recent and well rated: fall back to the latest additions.
            const res = await lib.getItems({
                ...detail,
                includeItemTypes: [ BaseItemKind.Movie, BaseItemKind.Series ],
                sortBy: [ ItemSortBy.DateCreated ],
                sortOrder: [ SortOrder.Descending ],
                limit: 30
            }, { signal });
            return { items: dailyShuffle(res.data.Items || []).slice(0, SLIDES), newEpisodes: {} as Record<string, number>, months: 0, imdb: {} as Record<string, number> };
        },
        enabled: !!api && !!user && (itemIds === undefined || itemIds.length > 0),
        staleTime: 30 * 60 * 1000
    });

    const items = useMemo(() => data?.items || [], [ data ]);
    const count = items.length;
    const go = useCallback((delta: number) => setIndex(i => (i + delta + count) % Math.max(1, count)), [ count ]);

    useEffect(() => {
        if (paused || count < 2 || trailerFor) return;
        const t = window.setTimeout(() => go(1), ROTATE_MS);
        return () => window.clearTimeout(t);
    }, [ index, paused, count, go, trailerFor ]);

    if (!api || !count) return null;
    const item: BaseItemDto = items[Math.min(index, count - 1)];

    const backdrop = (it: BaseItemDto) => getImageApi(api).getItemImageUrlById(it.Id!, ImageType.Backdrop, { maxWidth: 1920, tag: it.BackdropImageTags?.[0] });
    const logo = item.ImageTags?.Logo ? getImageApi(api).getItemImageUrlById(item.Id!, ImageType.Logo, { maxWidth: 600, tag: item.ImageTags.Logo }) : null;
    const isSeries = item.Type === BaseItemKind.Series;
    const isRanked = !!data?.months;
    const rank = Math.min(index, count - 1) + 1;
    const newEps = (item.Id && data?.newEpisodes[item.Id]) || 0;
    const isNewAdd = item.DateCreated && (Date.now() - new Date(item.DateCreated).getTime()) < NEW_DAYS * 86400000;
    let badge: string | null = null;
    if (isSeries && newEps) badge = globalize.translate(newEps === 1 ? 'HeroNewEpisode' : 'HeroNewEpisodes', newEps);
    else if (!isSeries && isRanked) badge = globalize.translate('HeroRecentRelease');
    else if (isNewAdd) badge = globalize.translate('HeroNew');
    const progress = item.UserData?.PlayedPercentage || 0;
    const meta = [
        item.ProductionYear,
        item.OfficialRating,
        isSeries ? (item.ChildCount ? globalize.translate(item.ChildCount === 1 ? 'HeroSeason' : 'HeroSeasons', item.ChildCount) : null) : runtime(item.RunTimeTicks),
        (item.Genres || []).slice(0, 3).join(' · ') || null
    ].filter(Boolean);

    const onPlay = () => {
        void playbackManager.play({ items: [ item ], serverId: item.ServerId });
    };
    const onInfo = () => navigate(`/details?id=${item.Id}&serverId=${item.ServerId}`);

    return (
        <Box
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            sx={{
                position: 'relative', width: '100%', overflow: 'hidden',
                height: embedded ? { xs: '50vh', md: '60vh' } : { xs: '62vh', md: '74vh' }, minHeight: { xs: 360, md: 420 }, maxHeight: 760,
                mt: embedded ? 0 : { xs: '-66px', md: '-72px' }, mb: 1
            }}
        >
            {/* Backdrops (cross-fade) */}
            {items.map((it, i) => (
                <Box key={it.Id} aria-hidden sx={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${backdrop(it)})`, backgroundSize: 'cover', backgroundPosition: 'center 20%',
                    opacity: i === index ? 1 : 0, transition: 'opacity 1.2s ease',
                    animation: i === index ? 'jfHeroZoom 14s ease-out forwards' : 'none',
                    maskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)',
                    '@keyframes jfHeroZoom': { from: { transform: 'scale(1.08)' }, to: { transform: 'scale(1)' } }
                }} />
            ))}

            {/* Readability gradients */}
            <Box aria-hidden sx={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'linear-gradient(90deg, rgba(8,8,16,0.92) 0%, rgba(8,8,16,0.6) 35%, rgba(8,8,16,0) 65%), linear-gradient(0deg, rgba(8,8,16,1) 0%, rgba(8,8,16,0) 35%), linear-gradient(180deg, rgba(8,8,16,0.55) 0%, rgba(8,8,16,0) 22%)'
            }} />

            {/* Content */}
            <Box key={item.Id} sx={{
                position: 'absolute', left: { xs: '4%', md: '3.3%' }, right: '4%', bottom: { xs: '10%', md: '14%' },
                maxWidth: { xs: '100%', md: 620 },
                animation: 'jfHeroIn 0.8s ease both',
                '@keyframes jfHeroIn': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'none' } }
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '2.5px', color: '#00a4dc', textShadow: '0 0 12px rgba(0,164,220,0.6)' }}>
                        {globalize.translate(isSeries ? 'HeroSeries' : 'HeroMovie')}
                    </Typography>
                    {badge && (
                        <Box component='span' sx={{ px: 1, py: 0.25, borderRadius: '6px', fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1px', color: '#fff', background: '#e50914' }}>
                            {badge}
                        </Box>
                    )}
                    {isRanked && (
                        <Box component='span' sx={{
                            display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: '6px',
                            fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1px', color: '#1a1300', background: '#ffca28'
                        }}>
                            {globalize.translate('HeroTopN', rank)}
                        </Box>
                    )}
                </Box>

                {logo ? (
                    <Box component='img' src={logo} alt={item.Name || ''} sx={{
                        display: 'block', maxWidth: { xs: '75%', md: '85%' }, maxHeight: { xs: 90, md: 150 }, objectFit: 'contain', objectPosition: 'left bottom',
                        filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.6))', mb: 2
                    }} />
                ) : (
                    <Typography component='h2' sx={{ fontSize: { xs: '2rem', md: '3.4rem' }, fontWeight: 900, lineHeight: 1.05, color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,0.7)', mb: 1.5 }}>
                        {item.Name}
                    </Typography>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 1.5, color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', fontWeight: 600 }}>
                    {!!(item.Id && data?.imdb[item.Id]) && (
                        <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            <Box component='span' sx={{ px: 0.6, borderRadius: '4px', fontSize: '0.72rem', fontWeight: 900, color: '#000', background: '#f5c518' }}>IMDb</Box>
                            {data.imdb[item.Id].toFixed(1)}
                        </Box>
                    )}
                    {!!item.CommunityRating && !(item.Id && data?.imdb[item.Id]) && (
                        <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: '#ffca28' }}>
                            <StarRoundedIcon sx={{ fontSize: '1.1rem' }} />{item.CommunityRating.toFixed(1)}
                        </Box>
                    )}
                    {meta.map(m => <Box component='span' key={String(m)}>{m}</Box>)}
                </Box>

                <Typography sx={{
                    display: { xs: '-webkit-box' }, WebkitLineClamp: { xs: 2, md: 3 }, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    fontSize: { xs: '0.88rem', md: '1rem' }, lineHeight: 1.55, color: 'rgba(255,255,255,0.82)', textShadow: '0 2px 8px rgba(0,0,0,0.8)', mb: 2.5
                }}>
                    {item.Overview}
                </Typography>

                {progress > 0 && progress < 100 && (
                    <Box sx={{ width: 220, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)', mb: 1.5 }}>
                        <Box sx={{ width: `${progress}%`, height: '100%', borderRadius: 2, background: '#00a4dc' }} />
                    </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                    <Button onClick={onPlay} startIcon={<PlayArrowRoundedIcon sx={{ fontSize: '1.8rem !important' }} />} sx={{
                        px: 3, py: 1.1, borderRadius: '14px', textTransform: 'none', fontSize: '1rem', fontWeight: 800,
                        color: '#fff', background: 'linear-gradient(135deg, #00a4dc 0%, #0077b6 100%)',
                        border: '1px solid rgba(120,220,255,0.45)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 22px rgba(0,164,220,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset',
                        transition: 'all 0.2s',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #14b4ec 0%, #0088cc 100%)',
                            boxShadow: '0 10px 28px rgba(0,0,0,0.5), 0 0 32px rgba(0,164,220,0.7), 0 0 0 1px rgba(255,255,255,0.12) inset',
                            transform: 'translateY(-1px)'
                        }
                    }}>
                        {globalize.translate(progress > 0 && progress < 100 ? 'HeroResume' : 'HeroPlay')}
                    </Button>
                    <Button onClick={onInfo} startIcon={<InfoOutlinedIcon />} sx={{
                        px: 3, py: 1.1, borderRadius: '14px', textTransform: 'none', fontSize: '1rem', fontWeight: 700,
                        color: 'rgba(255,255,255,0.92)', background: 'rgba(8, 10, 22, 0.62)',
                        backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                        border: '1px solid rgba(0, 164, 220, 0.3)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 16px rgba(0,164,220,0.12)',
                        transition: 'all 0.2s',
                        '& svg': { color: '#00a4dc' },
                        '&:hover': {
                            color: '#fff', background: 'rgba(0, 164, 220, 0.16)', borderColor: 'rgba(0, 164, 220, 0.6)',
                            boxShadow: '0 10px 28px rgba(0,0,0,0.5), 0 0 24px rgba(0,164,220,0.35)',
                            transform: 'translateY(-1px)'
                        }
                    }}>
                        {globalize.translate('HeroMoreInfo')}
                    </Button>
                    <Button onClick={() => setTrailerFor(item.Id || null)} startIcon={<MovieRoundedIcon />} sx={{
                        px: 2.5, py: 1.1, borderRadius: '14px', textTransform: 'none', fontSize: '1rem', fontWeight: 700,
                        color: 'rgba(255,255,255,0.92)', background: 'rgba(8, 10, 22, 0.62)',
                        backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                        border: '1px solid rgba(0, 164, 220, 0.3)', transition: 'all 0.2s',
                        '& svg': { color: '#00a4dc' },
                        '&:hover': { color: '#fff', background: 'rgba(0, 164, 220, 0.16)', borderColor: 'rgba(0, 164, 220, 0.6)', transform: 'translateY(-1px)' }
                    }}>
                        {globalize.translate('HeroTrailer')}
                    </Button>
                </Box>
            </Box>

            {/* Arrows + indicators */}
            {count > 1 && (
                <>
                    {[ -1, 1 ].map(d => (
                        <IconButton key={d} onClick={() => go(d)} aria-label={d < 0 ? 'previous' : 'next'} sx={{
                            position: 'absolute', top: '50%', [d < 0 ? 'left' : 'right']: 12, transform: 'translateY(-50%)',
                            display: { xs: 'none', md: 'flex' }, color: '#fff', opacity: paused ? 1 : 0, transition: 'all 0.3s',
                            background: 'rgba(8, 10, 22, 0.62)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                            border: '1px solid rgba(0, 164, 220, 0.3)', boxShadow: '0 0 16px rgba(0,164,220,0.15)',
                            '&:hover': { color: '#00a4dc', background: 'rgba(0,164,220,0.16)', borderColor: 'rgba(0,164,220,0.6)' }
                        }}>
                            {d < 0 ? <ChevronLeftIcon fontSize='large' /> : <ChevronRightIcon fontSize='large' />}
                        </IconButton>
                    ))}
                    <Box sx={{ position: 'absolute', right: { xs: '4%', md: '3.3%' }, bottom: { xs: '10%', md: '14%' }, display: 'flex', gap: 0.75 }}>
                        {items.map((it, i) => (
                            <Box key={it.Id} component='button' onClick={() => setIndex(i)} aria-label={it.Name || ''} sx={{
                                width: i === index ? 26 : 8, height: 8, p: 0, border: 0, borderRadius: 4, cursor: 'pointer',
                                background: i === index ? '#00a4dc' : 'rgba(255,255,255,0.35)', transition: 'all 0.3s',
                                boxShadow: i === index ? '0 0 10px rgba(0,164,220,0.7)' : 'none'
                            }} />
                        ))}
                    </Box>
                </>
            )}
            <TrailerDialog open={!!trailerFor} onClose={() => setTrailerFor(null)} source={{ itemId: trailerFor || undefined }} />
        </Box>
    );
};

export default HomeHero;
