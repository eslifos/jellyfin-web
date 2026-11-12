/**
 * Coming up — new episodes (and movies with a future release date) of the
 * library, by day, in a month calendar or a list. Uses Jellyfin's own metadata:
 * future episodes exist when the metadata provider (TVDB / TMDb) lists them.
 */
import React, { type FC, useMemo, useState } from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ViewListIcon from '@mui/icons-material/ViewList';
import { Link } from 'react-router-dom';

import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

type View = 'calendar' | 'list';
type Filter = 'all' | 'shows' | 'movies';

const VIEW_KEY = 'upcomingView';
const EP_COLOR = '#3987e5';
const MOVIE_COLOR = '#d95926';
const locale = () => globalize.getCurrentDateTimeLocale();

/** Upcoming release found on TMDb (server: /Discovery/Upcoming). */
interface UpcomingRelease {
    Kind: 'Episode' | 'Movie';
    TmdbId: number;
    Title: string;
    ReleaseDate: string;
    Overview?: string | null;
    ImageUrl?: string | null;
    SeriesId?: string | null;
    SeriesName?: string | null;
    SeasonNumber?: number | null;
    EpisodeNumber?: number | null;
    CollectionName?: string | null;
    RelatedItemId?: string | null;
}

/** Library item, or a TMDb release shown like one. */
type CalItem = BaseItemDto & { ExternalImage?: string | null; Saga?: string | null; LinkId?: string | null };

const normId = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

const fromRelease = (r: UpcomingRelease): CalItem => (r.Kind === 'Episode' ? {
    Id: `tmdb-${r.TmdbId}-${r.SeasonNumber}-${r.EpisodeNumber}`,
    Type: BaseItemKind.Episode,
    Name: r.Title,
    SeriesId: r.SeriesId,
    SeriesName: r.SeriesName,
    ParentIndexNumber: r.SeasonNumber,
    IndexNumber: r.EpisodeNumber,
    PremiereDate: r.ReleaseDate,
    LocationType: 'Virtual'
} : {
    Id: `tmdb-movie-${r.TmdbId}`,
    Type: BaseItemKind.Movie,
    Name: r.Title,
    PremiereDate: r.ReleaseDate,
    LocationType: 'Virtual',
    ExternalImage: r.ImageUrl,
    Saga: r.CollectionName,
    LinkId: r.RelatedItemId
});

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isAvailable = (i: BaseItemDto) => i.LocationType !== 'Virtual';

/** Several episodes of one series on the same day are shown as one entry. */
interface Entry {
    key: string;
    item: CalItem;
    count: number;
    lastIndex?: number | null;
    available: boolean;
}

const groupDay = (items: CalItem[]): Entry[] => {
    const map = new Map<string, Entry>();
    items.forEach(i => {
        const key = i.Type === BaseItemKind.Episode ? `s${i.SeriesId}` : `m${i.Id}`;
        const cur = map.get(key);
        if (cur) {
            cur.count++;
            cur.lastIndex = Math.max(cur.lastIndex ?? 0, i.IndexNumber ?? 0);
            cur.available = cur.available && isAvailable(i);
        } else {
            map.set(key, { key, item: i, count: 1, lastIndex: i.IndexNumber, available: isAvailable(i) });
        }
    });
    return Array.from(map.values());
};

const entryLine = (e: Entry) => {
    const i = e.item;
    if (i.Type !== BaseItemKind.Episode) return i.Saga ? globalize.translate('UpcSagaRelease', i.Saga) : globalize.translate('UpcMovieRelease');
    const ep = e.count > 1 ? `E${i.IndexNumber}–${e.lastIndex}` : `E${i.IndexNumber}`;
    const time = i.PremiereDate && !i.PremiereDate.endsWith('T00:00:00.0000000Z')
        ? ` · ${new Date(i.PremiereDate).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' })}` : '';
    return `${e.count > 1 ? `${globalize.translate('UpcEps', e.count)} ` : ''}S${i.ParentIndexNumber}·${ep}${time}`;
};

const EntryChip: FC<{ e: Entry; compact?: boolean }> = ({ e, compact }) => {
    const { api } = useApi();
    const i = e.item;
    const color = i.Type === BaseItemKind.Episode ? EP_COLOR : MOVIE_COLOR;
    const imgId = i.Type === BaseItemKind.Episode ? i.SeriesId : i.Id;
    const img = i.ExternalImage || (imgId && api && !imgId.startsWith('tmdb-') ? getImageApi(api).getItemImageUrlById(imgId, ImageType.Primary, { maxHeight: compact ? 60 : 120 }) : undefined);
    const linkId = i.Type === BaseItemKind.Episode ? (i.SeriesId || i.Id) : (i.LinkId || i.Id);
    const isNew = i.Type === BaseItemKind.Episode && i.IndexNumber === 1;

    return (
        <Box component={Link} to={`/details?id=${linkId}`} title={`${i.SeriesName || i.Name} — ${entryLine(e)}`} sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, p: compact ? 0.5 : 1, borderRadius: '8px', textDecoration: 'none', color: 'inherit', minWidth: 0,
            background: e.available ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${color}`,
            '&:hover': { background: 'rgba(255,255,255,0.08)' }
        }}>
            <Box component='img' src={img} alt='' loading='lazy' sx={{ width: compact ? 20 : 36, height: compact ? 30 : 54, objectFit: 'cover', borderRadius: '4px', flexShrink: 0, background: 'rgba(255,255,255,0.06)' }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap sx={{ fontSize: compact ? '0.68rem' : '0.86rem', fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>{i.SeriesName || i.Name}</Typography>
                <Typography noWrap sx={{ fontSize: compact ? '0.6rem' : '0.74rem', color: 'rgba(255,255,255,0.55)' }}>{entryLine(e)}</Typography>
                {!compact && i.Type === BaseItemKind.Episode && i.Name && <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>{i.Name}</Typography>}
            </Box>
            {isNew && <Box sx={{ px: 0.6, borderRadius: '6px', fontSize: '0.56rem', fontWeight: 800, color: '#fff', background: '#aa5cc3', flexShrink: 0 }}>{globalize.translate('UpcNew')}</Box>}
            {e.available && <Typography sx={{ color: '#4caf50', fontSize: compact ? '0.7rem' : '0.9rem', flexShrink: 0 }} title={globalize.translate('UpcAvailable')}>✓</Typography>}
        </Box>
    );
};

const UpcomingPage: FC = () => {
    const { api, user } = useApi();
    const [ view, setView ] = useState<View>(() => {
        try {
            return (localStorage.getItem(VIEW_KEY) as View) || 'calendar';
        } catch {
            return 'calendar';
        }
    });
    const [ filter, setFilter ] = useState<Filter>('all');
    const [ month, setMonth ] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [ expanded, setExpanded ] = useState<string | null>(null);

    // Calendar grid: Monday of the first week to Sunday of the last week of the month.
    const gridStart = useMemo(() => {
        const d = new Date(month);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d;
    }, [ month ]);
    const gridEnd = useMemo(() => {
        const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        const d = new Date(last);
        d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
        d.setHours(23, 59, 59);
        return d;
    }, [ month ]);

    // List view: from today up to 3 months ahead.
    const range = useMemo(() => {
        if (view === 'calendar') return { from: gridStart, to: gridEnd };
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        to.setMonth(to.getMonth() + 3);
        return { from, to };
    }, [ gridEnd, gridStart, view ]);

    const { data: items, isFetching } = useQuery({
        queryKey: [ 'Upcoming', user?.Id, range.from.toISOString(), range.to.toISOString() ],
        queryFn: async ({ signal }) => {
            const res = await getLibraryApi(api!).getItems({
                userId: user?.Id,
                recursive: true,
                includeItemTypes: [ BaseItemKind.Episode, BaseItemKind.Movie ],
                minPremiereDate: range.from.toISOString(),
                maxPremiereDate: range.to.toISOString(),
                sortBy: [ ItemSortBy.PremiereDate, ItemSortBy.SortName ],
                fields: [ ItemFields.PrimaryImageAspectRatio ],
                enableUserData: false,
                imageTypeLimit: 1,
                limit: 5000
            }, { signal });
            return res.data.Items || [];
        },
        enabled: !!api && !!user,
        staleTime: 5 * 60 * 1000
    });

    // Announced on TMDb but not in the library yet: next episodes of running series and future saga movies
    const { data: releases, isFetching: isFetchingTmdb } = useQuery({
        queryKey: [ 'UpcomingTmdb', user?.Id, range.from.toISOString(), range.to.toISOString() ],
        queryFn: async ({ signal }) => {
            try {
                const res = await api!.axiosInstance.get<UpcomingRelease[]>(`${api!.basePath}/Discovery/Upcoming`, {
                    headers: { Authorization: api!.authorizationHeader },
                    params: { from: range.from.toISOString(), to: range.to.toISOString() },
                    signal
                });
                return res.data || [];
            } catch {
                return [] as UpcomingRelease[]; // server without the endpoint
            }
        },
        enabled: !!api && !!user,
        staleTime: 30 * 60 * 1000
    });

    const merged = useMemo<CalItem[]>(() => {
        const library = (items || []) as CalItem[];
        const known = new Set(library
            .filter(i => i.Type === BaseItemKind.Episode)
            .map(i => `${normId(i.SeriesId)}-${i.ParentIndexNumber}-${i.IndexNumber}`));
        const extra = (releases || [])
            .filter(r => r.Kind !== 'Episode' || !known.has(`${normId(r.SeriesId)}-${r.SeasonNumber}-${r.EpisodeNumber}`))
            .map(fromRelease);
        return [ ...library, ...extra ];
    }, [ items, releases ]);

    const filtered = useMemo(() => merged.filter(i =>
        filter === 'all' || (filter === 'shows' ? i.Type === BaseItemKind.Episode : i.Type === BaseItemKind.Movie)), [ filter, merged ]);

    const byDay = useMemo(() => {
        const map = new Map<string, CalItem[]>();
        filtered.forEach(i => {
            if (!i.PremiereDate) return;
            const k = dayKey(new Date(i.PremiereDate));
            map.set(k, [ ...(map.get(k) || []), i ]);
        });
        return map;
    }, [ filtered ]);

    const counts = useMemo(() => ({
        episodes: filtered.filter(i => i.Type === BaseItemKind.Episode).length,
        movies: filtered.filter(i => i.Type === BaseItemKind.Movie).length,
        available: filtered.filter(isAvailable).length
    }), [ filtered ]);
    const isAdmin = !!user?.Policy?.IsAdministrator;

    const setViewSaved = (v: View) => {
        setView(v);
        try {
            localStorage.setItem(VIEW_KEY, v);
        } catch {
            // storage blocked
        }
    };

    const todayKey = dayKey(new Date());
    const cells: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) cells.push(new Date(d));
    const listDays = Array.from(byDay.keys()).sort();

    const chip = (label: string, color: string) => (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.4, borderRadius: '20px', fontSize: '0.74rem', fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: color }} />{label}
        </Box>
    );

    return (
        <Page id='upcomingPage' title={globalize.translate('UpcTitle')} className='mainAnimatedPage libraryPage noSecondaryNavPage'>
            <Box sx={{ px: { xs: '4%', md: '3.3%' }, pb: 14 }}>
                <Typography component='h1' sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, color: '#fff' }}>{globalize.translate('UpcTitle')}</Typography>
                <Typography sx={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.55)', mb: 2 }}>{globalize.translate('UpcSubtitle')}</Typography>

                <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                    <ToggleButtonGroup size='small' exclusive value={view} onChange={(_, v: View | null) => v && setViewSaved(v)}>
                        <ToggleButton value='list' sx={{ gap: 0.75, textTransform: 'none' }}><ViewListIcon fontSize='small' />{globalize.translate('UpcList')}</ToggleButton>
                        <ToggleButton value='calendar' sx={{ gap: 0.75, textTransform: 'none' }}><CalendarMonthIcon fontSize='small' />{globalize.translate('UpcCalendar')}</ToggleButton>
                    </ToggleButtonGroup>
                    <ToggleButtonGroup size='small' exclusive value={filter} onChange={(_, v: Filter | null) => v && setFilter(v)}>
                        <ToggleButton value='all' sx={{ textTransform: 'none' }}>{globalize.translate('All')}</ToggleButton>
                        <ToggleButton value='shows' sx={{ textTransform: 'none' }}>{globalize.translate('Shows')}</ToggleButton>
                        <ToggleButton value='movies' sx={{ textTransform: 'none' }}>{globalize.translate('Movies')}</ToggleButton>
                    </ToggleButtonGroup>
                    {(isFetching || isFetchingTmdb) && <CircularProgress size={18} />}
                    <Box sx={{ flex: 1 }} />
                    {chip(globalize.translate('UpcEpisodesN', counts.episodes), EP_COLOR)}
                    {chip(globalize.translate('UpcMoviesN', counts.movies), MOVIE_COLOR)}
                    {chip(`✓ ${globalize.translate('UpcAvailableN', counts.available)}`, '#4caf50')}
                </Box>

                {view === 'calendar' ? (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <IconButton onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label={globalize.translate('Previous')}><ChevronLeftIcon /></IconButton>
                            <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', minWidth: 200, textAlign: 'center', '&::first-letter': { textTransform: 'uppercase' } }}>
                                {month.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}
                            </Typography>
                            <IconButton onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label={globalize.translate('Next')}><ChevronRightIcon /></IconButton>
                        </Box>
                        <Paper elevation={0} sx={{ borderRadius: '16px', overflow: 'hidden', overflowX: 'auto' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', minWidth: 840 }}>
                                {cells.slice(0, 7).map(d => (
                                    <Typography key={`h${d.getDay()}`} sx={{ px: 1, py: 0.75, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        {d.toLocaleDateString(locale(), { weekday: 'short' })}
                                    </Typography>
                                ))}
                                {cells.map(d => {
                                    const k = dayKey(d);
                                    const entries = groupDay(byDay.get(k) || []);
                                    const inMonth = d.getMonth() === month.getMonth();
                                    const isToday = k === todayKey;
                                    const open = expanded === k;
                                    const shown = open ? entries : entries.slice(0, 4);
                                    return (
                                        <Box key={k} sx={{
                                            minHeight: 130, p: 0.75, borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            background: isToday ? 'rgba(0,164,220,0.08)' : inMonth ? 'transparent' : 'rgba(0,0,0,0.25)',
                                            outline: isToday ? '1px solid rgba(0,164,220,0.6)' : 'none', outlineOffset: -1
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: inMonth ? '#fff' : 'rgba(255,255,255,0.3)' }}>{d.getDate()}</Typography>
                                                {isToday && <Box sx={{ px: 0.75, borderRadius: '6px', fontSize: '0.6rem', fontWeight: 800, color: '#fff', background: '#00a4dc' }}>{globalize.translate('StsToday')}</Box>}
                                                {entries.length > 0 && <Typography sx={{ ml: 'auto', fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>{entries.length}</Typography>}
                                            </Box>
                                            <Stack spacing={0.5}>
                                                {shown.map(e => <EntryChip key={e.key} e={e} compact />)}
                                                {entries.length > 4 && (
                                                    <Typography component='button' onClick={() => setExpanded(open ? null : k)} sx={{ all: 'unset', cursor: 'pointer', fontSize: '0.66rem', color: '#00a4dc', px: 0.5 }}>
                                                        {open ? globalize.translate('UpcLess') : globalize.translate('UpcMore', entries.length - 4)}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Paper>
                    </>
                ) : listDays.length === 0 ? (
                    <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: '16px' }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>{globalize.translate('UpcNothing')}</Typography>
                    </Paper>
                ) : (
                    listDays.map(k => {
                        const d = new Date(`${k}T12:00:00`);
                        return (
                            <Box key={k} sx={{ mb: 2.5 }}>
                                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: k === todayKey ? '#00a4dc' : 'rgba(255,255,255,0.6)', mb: 1 }}>
                                    {k === todayKey ? globalize.translate('StsToday') : d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 1 }}>
                                    {groupDay(byDay.get(k) || []).map(e => <EntryChip key={e.key} e={e} />)}
                                </Box>
                            </Box>
                        );
                    })
                )}

                {isAdmin && !isFetching && !(items || []).some(i => i.Type === BaseItemKind.Episode && !isAvailable(i)) && (
                    <Paper elevation={0} sx={{ p: 2, mt: 2, borderRadius: '16px', border: '1px dashed rgba(0,164,220,0.45)', background: 'rgba(0,164,220,0.06)' }}>
                        <Typography sx={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.8)' }}>{globalize.translate('UpcEnableHint')}</Typography>
                    </Paper>
                )}
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', mt: 2 }}>{globalize.translate('UpcNote')}</Typography>
            </Box>
        </Page>
    );
};

export default UpcomingPage;
