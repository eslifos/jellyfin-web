/**
 * Top 10 settings: for movies and for series, build the top 10 automatically (what people watch right now
 * on TMDb) or pick the titles by hand, searching the server's own content.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditNoteIcon from '@mui/icons-material/EditNote';
import LocalMoviesIcon from '@mui/icons-material/LocalMovies';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import TvIcon from '@mui/icons-material/Tv';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard } from '../../components/cosmic';
import { TEXT_TERTIARY } from 'themes/cosmic/textColors';

interface Top10Settings {
    MoviesManual: boolean;
    SeriesManual: boolean;
    Movies: string[];
    Series: string[];
}

interface ListState {
    manual: boolean;
    ids: string[];
}

const MAX = 10;
const normId = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

/** Loads items by id keeping the given order. */
const useItems = (ids: string[]) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'Top10Items', user?.Id, ids.join(',') ],
        queryFn: async ({ signal }) => {
            const items = (await getLibraryApi(api!).getItems({
                userId: user?.Id, ids, enableImageTypes: [ ImageType.Primary ], imageTypeLimit: 1
            }, { signal })).data.Items ?? [];
            const byId = new Map(items.map(i => [ normId(i.Id), i ]));
            return ids.map(id => byId.get(normId(id))).filter((i): i is BaseItemDto => !!i);
        },
        enabled: !!api && ids.length > 0,
        placeholderData: prev => prev
    });
};

const Poster: FC<{ item: BaseItemDto, width: number }> = ({ item, width }) => {
    const { api } = useApi();
    const src = api && item.ImageTags?.Primary ?
        getImageApi(api).getItemImageUrlById(item.Id!, ImageType.Primary, { maxWidth: width * 2, tag: item.ImageTags.Primary }) :
        undefined;
    return (
        <Box sx={{ width, flexShrink: 0, aspectRatio: '2 / 3', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            {src && <Box component='img' src={src} alt='' loading='lazy' sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </Box>
    );
};

const RankedRow: FC<{ item: BaseItemDto, index: number, count: number, onMove?: (index: number, delta: number) => void, onRemove?: (id: string) => void }> = ({ item, index, count, onMove, onRemove }) => {
    const up = useCallback(() => onMove?.(index, -1), [ onMove, index ]);
    const down = useCallback(() => onMove?.(index, 1), [ onMove, index ]);
    const remove = useCallback(() => onRemove?.(item.Id!), [ onRemove, item.Id ]);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.75, px: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ width: 30, textAlign: 'center', fontSize: '1.4rem', fontWeight: 900, color: 'transparent', WebkitTextStroke: '1.5px #00a4dc' }}>
                {index + 1}
            </Typography>
            <Poster item={item} width={38} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.Name}</Typography>
                {item.ProductionYear && <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{item.ProductionYear}</Typography>}
            </Box>
            {onMove && (
                <>
                    <IconButton size='small' onClick={up} disabled={index === 0} title={globalize.translate('Top10MoveUp')}><ArrowUpwardRoundedIcon fontSize='small' /></IconButton>
                    <IconButton size='small' onClick={down} disabled={index === count - 1} title={globalize.translate('Top10MoveDown')}><ArrowDownwardRoundedIcon fontSize='small' /></IconButton>
                </>
            )}
            {onRemove && <IconButton size='small' onClick={remove} title={globalize.translate('Top10Remove')}><CloseRoundedIcon fontSize='small' /></IconButton>}
        </Box>
    );
};

const SearchResult: FC<{ item: BaseItemDto, added: boolean, full: boolean, onAdd: (id: string) => void }> = ({ item, added, full, onAdd }) => {
    const add = useCallback(() => onAdd(item.Id!), [ onAdd, item.Id ]);
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.6, px: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Poster item={item} width={32} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.Name}</Typography>
                {item.ProductionYear && <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{item.ProductionYear}</Typography>}
            </Box>
            <Button size='small' variant={added ? 'text' : 'outlined'} startIcon={added ? undefined : <AddRoundedIcon />} disabled={added || full} onClick={add}>
                {globalize.translate(added ? 'Top10Added' : 'Top10Add')}
            </Button>
        </Box>
    );
};

const listSx = { borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' };

const Top10Editor: FC<{ series: boolean, state: ListState, autoIds: string[], onChange: (state: ListState) => void }> = ({ series, state, autoIds, onChange }) => {
    const { api, user } = useApi();
    const [ search, setSearch ] = useState('');
    const [ term, setTerm ] = useState('');

    useEffect(() => {
        const t = window.setTimeout(() => setTerm(search.trim()), 300);
        return () => window.clearTimeout(t);
    }, [ search ]);

    const { data: autoItems, isFetching: autoLoading } = useItems(autoIds);
    const { data: chosen } = useItems(state.ids);

    const { data: results, isFetching: searching } = useQuery({
        queryKey: [ 'Top10Search', user?.Id, series, term ],
        queryFn: async ({ signal }) => (await getLibraryApi(api!).getItems({
            userId: user?.Id, searchTerm: term, recursive: true,
            includeItemTypes: [ series ? BaseItemKind.Series : BaseItemKind.Movie ],
            enableImageTypes: [ ImageType.Primary ], imageTypeLimit: 1, limit: 15
        }, { signal })).data.Items ?? [],
        enabled: !!api && state.manual && term.length >= 2
    });

    const onMode = useCallback((_: React.MouseEvent, value: 'auto' | 'manual' | null) => {
        if (!value) return;
        const manual = value === 'manual';
        // Starting by hand from the current automatic list is easier than from nothing
        onChange({ manual, ids: manual && !state.ids.length ? autoIds.slice(0, MAX) : state.ids });
    }, [ onChange, state.ids, autoIds ]);

    const onAdd = useCallback((id: string) => {
        if (state.ids.length < MAX && !state.ids.some(i => normId(i) === normId(id))) onChange({ ...state, ids: [ ...state.ids, id ] });
    }, [ onChange, state ]);

    const onRemove = useCallback((id: string) => onChange({ ...state, ids: state.ids.filter(i => normId(i) !== normId(id)) }), [ onChange, state ]);

    const onMove = useCallback((index: number, delta: number) => {
        const ids = [ ...state.ids ];
        const to = index + delta;
        if (to < 0 || to >= ids.length) return;
        [ ids[index], ids[to] ] = [ ids[to], ids[index] ];
        onChange({ ...state, ids });
    }, [ onChange, state ]);

    const onSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []);
    const onClear = useCallback(() => onChange({ ...state, ids: [] }), [ onChange, state ]);

    const chosenSet = useMemo(() => new Set(state.ids.map(normId)), [ state.ids ]);
    const full = state.ids.length >= MAX;

    return (
        <Box>
            <ToggleButtonGroup exclusive size='small' value={state.manual ? 'manual' : 'auto'} onChange={onMode} sx={{ mb: 2 }}>
                <ToggleButton value='auto' sx={{ px: 2, gap: 0.75 }}><AutoAwesomeIcon fontSize='small' />{globalize.translate('Top10Auto')}</ToggleButton>
                <ToggleButton value='manual' sx={{ px: 2, gap: 0.75 }}><EditNoteIcon fontSize='small' />{globalize.translate('Top10Manual')}</ToggleButton>
            </ToggleButtonGroup>

            {!state.manual ? (
                <>
                    <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', mb: 1.5 }}>{globalize.translate('Top10AutoHelp')}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_TERTIARY, mb: 0.75 }}>
                        {globalize.translate('Top10CurrentAuto')}
                    </Typography>
                    <Box sx={listSx}>
                        {autoLoading && !autoItems?.length && <Box sx={{ p: 2 }}><CircularProgress size={20} /></Box>}
                        {!autoLoading && !autoItems?.length && <Typography sx={{ p: 2, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('Top10Empty')}</Typography>}
                        {autoItems?.map((item, i) => <RankedRow key={item.Id} item={item} index={i} count={autoItems.length} />)}
                    </Box>
                </>
            ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
                            <Typography sx={{ flex: 1, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
                                {globalize.translate('Top10YourList', state.ids.length, MAX)}
                            </Typography>
                            {state.ids.length > 0 && <Button size='small' onClick={onClear}>{globalize.translate('Top10Clear')}</Button>}
                        </Box>
                        <Box sx={listSx}>
                            {!state.ids.length && <Typography sx={{ p: 2, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('Top10ManualEmpty')}</Typography>}
                            {chosen?.map((item, i) => <RankedRow key={item.Id} item={item} index={i} count={chosen.length} onMove={onMove} onRemove={onRemove} />)}
                        </Box>
                    </Box>
                    <Box>
                        <TextField
                            fullWidth size='small' value={search} onChange={onSearch}
                            placeholder={globalize.translate(series ? 'Top10SearchSeries' : 'Top10SearchMovies')}
                            slotProps={{ input: { startAdornment: <InputAdornment position='start'>{searching ? <CircularProgress size={16} /> : <SearchIcon fontSize='small' />}</InputAdornment> } }}
                            sx={{ mb: 0.75 }}
                        />
                        {full && <Alert severity='info' sx={{ mb: 1, py: 0 }}>{globalize.translate('Top10Full')}</Alert>}
                        <Box sx={listSx}>
                            {term.length < 2 && <Typography sx={{ p: 2, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('Top10SearchHelp')}</Typography>}
                            {term.length >= 2 && !searching && !results?.length && <Typography sx={{ p: 2, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('Top10NoResults')}</Typography>}
                            {term.length >= 2 && results?.map(item => (
                                <SearchResult key={item.Id} item={item} added={chosenSet.has(normId(item.Id))} full={full} onAdd={onAdd} />
                            ))}
                        </Box>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export const Component: FC = () => {
    const { api } = useApi();
    const [ movies, setMovies ] = useState<ListState | null>(null);
    const [ series, setSeries ] = useState<ListState | null>(null);
    const [ saving, setSaving ] = useState(false);
    const [ message, setMessage ] = useState<{ ok: boolean, text: string } | null>(null);

    const { data: saved, isError } = useQuery({
        queryKey: [ 'Top10Settings' ],
        queryFn: async ({ signal }) => (await api!.axiosInstance.get<Top10Settings>(`${api!.basePath}/Discovery/Top10/Settings`, {
            headers: { Authorization: api!.authorizationHeader }, signal
        })).data,
        enabled: !!api,
        refetchOnWindowFocus: false
    });

    // The automatic lists, for the preview and to start a manual list from them
    const autoList = (isSeries: boolean) => ({
        queryKey: [ 'Top10Auto', isSeries ],
        queryFn: async ({ signal }: { signal: AbortSignal }) => (await api!.axiosInstance.get<string[]>(`${api!.basePath}/Discovery/Top10`, {
            headers: { Authorization: api!.authorizationHeader }, params: { series: isSeries, auto: true }, signal
        })).data ?? [],
        enabled: !!api,
        staleTime: 15 * 60 * 1000
    });
    const { data: autoMovies } = useQuery(autoList(false));
    const { data: autoSeries } = useQuery(autoList(true));

    useEffect(() => {
        if (!saved) return;
        setMovies({ manual: saved.MoviesManual, ids: saved.Movies ?? [] });
        setSeries({ manual: saved.SeriesManual, ids: saved.Series ?? [] });
    }, [ saved ]);

    const dirty = !!saved && !!movies && !!series && JSON.stringify([ movies, series ]) !== JSON.stringify([
        { manual: saved.MoviesManual, ids: saved.Movies ?? [] }, { manual: saved.SeriesManual, ids: saved.Series ?? [] }
    ]);

    const onSave = useCallback(async () => {
        if (!api || !movies || !series) return;
        setSaving(true);
        setMessage(null);
        try {
            await api.axiosInstance.post(`${api.basePath}/Discovery/Top10/Settings`, {
                MoviesManual: movies.manual, SeriesManual: series.manual, Movies: movies.ids, Series: series.ids
            }, { headers: { Authorization: api.authorizationHeader } });
            await queryClient.invalidateQueries({ queryKey: [ 'Top10Settings' ] });
            void queryClient.invalidateQueries({ queryKey: [ 'HomeFeed' ] });
            void queryClient.invalidateQueries({ queryKey: [ 'MoviesHomeDiscovery' ] });
            setMessage({ ok: true, text: globalize.translate('Top10Saved') });
        } catch {
            setMessage({ ok: false, text: globalize.translate('Top10SaveError') });
        } finally {
            setSaving(false);
        }
    }, [ api, movies, series ]);

    const onSaveClick = useCallback(() => {
        void onSave();
    }, [ onSave ]);
    const onCloseMessage = useCallback(() => setMessage(null), []);

    return (
        <Page id='top10SettingsPage' title={globalize.translate('Top10Title')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary'>
                <PageHeader
                    title={globalize.translate('Top10Title')}
                    subtitle={globalize.translate('Top10Subtitle')}
                    actions={(
                        <Button variant='contained' onClick={onSaveClick} disabled={!dirty || saving} startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}>
                            {globalize.translate('Save')}
                        </Button>
                    )}
                />

                {message && <Alert severity={message.ok ? 'success' : 'error'} sx={{ mb: 2 }} onClose={onCloseMessage}>{message.text}</Alert>}

                {isError && <Alert severity='error'>{globalize.translate('Top10LoadError')}</Alert>}
                {!isError && (!movies || !series) && <Loading />}
                {movies && series && (
                    <Box sx={{ display: 'grid', gap: 2.5 }}>
                        <SectionCard title={globalize.translate('Movies')} icon={<LocalMoviesIcon />} accentColor='#00a4dc'>
                            <Top10Editor series={false} state={movies} autoIds={autoMovies ?? []} onChange={setMovies} />
                        </SectionCard>
                        <SectionCard title={globalize.translate('Shows')} icon={<TvIcon />} accentColor='#aa5cc3'>
                            <Top10Editor series state={series} autoIds={autoSeries ?? []} onChange={setSeries} />
                        </SectionCard>
                        <Paper elevation={0} sx={{ p: 1.5, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('Top10Where')}</Typography>
                        </Paper>
                    </Box>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'Top10SettingsPage';
