import React, { type FC, useCallback, useMemo, useState } from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { LocationType } from '@jellyfin/sdk/lib/generated-client/models/location-type';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import TvIcon from '@mui/icons-material/Tv';
import { Link as RouterLink } from 'react-router-dom';

import { Badge, StatTile } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard } from '../../components/cosmic';

/** Friendly names for display order values (both TVDB season types and TMDb episode groups). */
const ORDER_KEYS: Record<string, string> = {
    '': 'EpoAired', dvd: 'EpoDvd', absolute: 'EpoAbsolute', alternate: 'EpoAlternate', altdvd: 'EpoAltDvd',
    regional: 'EpoRegional', digital: 'EpoDigital', production: 'EpoProduction', storyArc: 'EpoStoryArc',
    tv: 'EpoTv', originalAirDate: 'EpoOriginalAirDate'
};
const orderLabel = (v?: string | null) => (ORDER_KEYS[v || ''] ? globalize.translate(ORDER_KEYS[v || '']) : (v || ''));

const pad = (n?: number | null) => (n == null ? '??' : String(n).padStart(2, '0'));
const code = (season?: number | null, number?: number | null, end?: number | null) =>
    `S${pad(season)}E${pad(number)}${end && end !== number ? `-E${pad(end)}` : ''}`;

const isIdentified = (s: BaseItemDto) => Object.values(s.ProviderIds || {}).some(v => !!v);

type Filter = 'problems' | 'unidentified' | 'custom' | 'all';

interface OrderOption {
    Provider: 'Tvdb' | 'Tmdb';
    Value: string;
    Name: string;
    AlternateName?: string | null;
    SeasonCount: number;
    EpisodeCount: number;
    Matched: number;
    IsCurrent: boolean;
    SeasonEpisodeCounts?: Record<string, number>;
}

interface OrderEpisode {
    Id: string;
    Name: string;
    FileName?: string | null;
    Season?: number | null;
    Number?: number | null;
    NumberEnd?: number | null;
    HasProviderData: boolean;
    InOrder?: boolean | null;
    ExpectedName?: string | null;
    Outdated?: boolean;
    AlsoIn: string[];
    DataFrom: string[];
}

interface Analysis {
    RefreshState: 'Idle' | 'Queued' | 'Running' | 'Done' | 'Failed';
    RefreshProgress?: number | null;
    CurrentOrder: string;
    PrimarySource?: string | null;
    EffectiveSource?: string | null;
    Sources: string[];
    Orders: OrderOption[];
    Episodes: OrderEpisode[];
    Notes: string[];
}

const PROVIDER_COLORS: Record<string, string> = { Tvdb: '#6cd491', Tmdb: '#01b4e4' };
const optionKey = (o: Pick<OrderOption, 'Provider' | 'Value'>) => `${o.Provider}:${o.Value}`;
const sourceFor = (provider: string, sources: string[]) =>
    sources.find(s => s.toLowerCase().includes(provider === 'Tvdb' ? 'tvdb' : 'moviedb'));

const useOrderData = () => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'EpisodeOrderData' ],
        queryFn: async ({ signal }) => {
            const lib = getLibraryApi(api!);
            const [ series, unmatched, sources ] = await Promise.all([
                lib.getItems({
                    userId: user?.Id,
                    recursive: true,
                    includeItemTypes: [ BaseItemKind.Series ],
                    fields: [ ItemFields.ProviderIds, ItemFields.RecursiveItemCount, ItemFields.Path ],
                    // The server only counts the episodes (RecursiveItemCount) together with the user data
                    enableUserData: true,
                    imageTypeLimit: 1
                }, { signal }),
                // Episodes on disk that no metadata provider could match.
                lib.getItems({
                    userId: user?.Id,
                    recursive: true,
                    includeItemTypes: [ BaseItemKind.Episode ],
                    locationTypes: [ LocationType.FileSystem ],
                    hasTvdbId: false,
                    hasTmdbId: false,
                    hasImdbId: false,
                    enableImages: false,
                    enableUserData: false
                }, { signal }),
                api!.axiosInstance.get<Record<string, string>>(api!.getUri('/EpisodeOrder/Sources'), {
                    headers: { Authorization: api!.authorizationHeader }, signal
                }).then(r => r.data).catch(() => ({} as Record<string, string>))
            ]);
            return { series: series.data.Items || [], unmatched: unmatched.data.Items || [], sources };
        },
        enabled: !!api,
        staleTime: 60 * 1000
    });
};

const useAnalysis = (seriesId: string, enabled: boolean) => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'EpisodeOrderAnalysis', seriesId ],
        queryFn: async ({ signal }) => {
            const { data } = await api!.axiosInstance.get<Analysis>(api!.getUri(`/EpisodeOrder/${seriesId}`), {
                headers: { Authorization: api!.authorizationHeader }, signal
            });
            return data;
        },
        enabled: !!api && enabled,
        staleTime: 0,
        refetchOnMount: 'always',
        // Follow the refresh of the series while it runs
        refetchInterval: q => (q.state.data && [ 'Running', 'Queued' ].includes(q.state.data.RefreshState) ? 3000 : false)
    });
};

const EpisodeLine: FC<{ e: OrderEpisode; color: string; detail?: string }> = ({ e, color, detail }) => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', minWidth: 0 }}>
        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.76rem', color, flexShrink: 0 }}>{code(e.Season, e.Number, e.NumberEnd)}</Typography>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.75)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.FileName || e.Name}>
            {e.Name}{detail ? <Box component='span' sx={{ color: 'rgba(255,255,255,0.45)' }}> · {detail}</Box> : null}
        </Typography>
    </Box>
);

const IssueGroup: FC<{ title: string; color: string; help?: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, color, help, action, children }) => (
    <Box sx={{ p: 1.25, borderRadius: '12px', border: `1px solid ${color}33`, background: `${color}0d` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color, flex: 1 }}>{title}</Typography>
            {action}
        </Box>
        {help && <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', mb: 0.75 }}>{help}</Typography>}
        <Stack spacing={0.4} sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>{children}</Stack>
    </Box>
);

/** Orders found in TVDB / TMDb, main source, and the episodes that do not fit. */
const AnalysisPanel: FC<{ series: BaseItemDto }> = ({ series }) => {
    const { api } = useApi();
    const seriesId = series.Id || '';
    const { data, isFetching, isError, refetch } = useAnalysis(seriesId, true);
    const [ picked, setPicked ] = useState<string | null>(null);
    const [ source, setSource ] = useState<string | null>(null);

    const best = useMemo(() => {
        if (!data?.Orders.length) return null;
        return data.Orders.reduce((a, b) => (b.Matched > a.Matched || (b.Matched === a.Matched && b.IsCurrent) ? b : a));
    }, [ data ]);

    const current = data?.Orders.find(o => o.IsCurrent);
    const selected = data?.Orders.find(o => optionKey(o) === picked) || current;
    // Choosing an order of a provider makes that provider the main source (it is the one that understands the order)
    const sourceValue = source ?? (picked && selected ? (sourceFor(selected.Provider, data?.Sources || []) ?? data?.PrimarySource ?? '') : (data?.PrimarySource ?? ''));
    const changed = !!data && ((selected?.Value ?? data.CurrentOrder) !== data.CurrentOrder || sourceValue !== (data.PrimarySource ?? ''));

    // Saves order + source and refreshes the series right away on the server (it does not wait for library scans)
    const apply = useMutation({
        mutationFn: async () => {
            await api!.axiosInstance.post(api!.getUri(`/EpisodeOrder/${seriesId}/Apply`, {
                order: selected?.Value ?? data?.CurrentOrder ?? '',
                source: sourceValue || undefined
            }), null, { headers: { Authorization: api!.authorizationHeader } });
        },
        onSuccess: () => {
            setPicked(null);
            setSource(null);
            void queryClient.invalidateQueries({ queryKey: [ 'EpisodeOrderData' ] });
            void queryClient.invalidateQueries({ queryKey: [ 'EpisodeOrderAnalysis', seriesId ] });
        }
    });

    // When the refresh ends, reload the cards (names, counts) once
    const refreshState = data?.RefreshState;
    const [ lastState, setLastState ] = useState(refreshState);
    if (refreshState !== lastState) {
        setLastState(refreshState);
        if (lastState === 'Running' && (refreshState === 'Done' || refreshState === 'Failed')) {
            void queryClient.invalidateQueries({ queryKey: [ 'EpisodeOrderData' ] });
        }
    }
    const refreshing = refreshState === 'Running' || refreshState === 'Queued';

    const fixNumbers = useMutation({
        mutationFn: async () => {
            const { data: r } = await api!.axiosInstance.post<{ Fixed: number; Remaining: number }>(
                api!.getUri(`/EpisodeOrder/${seriesId}/FixNumbers`), null, { headers: { Authorization: api!.authorizationHeader } });
            return r;
        },
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: [ 'EpisodeOrderAnalysis', seriesId ] })
    });

    const recheck = useCallback(async () => {
        await api!.axiosInstance.get(api!.getUri(`/EpisodeOrder/${seriesId}`, { refresh: true }), { headers: { Authorization: api!.authorizationHeader } });
        void refetch();
    }, [ api, seriesId, refetch ]);

    if (!data) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 2 }}>
                {isError ? <Alert severity='error' sx={{ flex: 1 }}>{globalize.translate('HlthLoadError')}</Alert> : <>
                    <CircularProgress size={18} />
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>{globalize.translate('EpoAnalyzing')}</Typography>
                </>}
            </Box>
        );
    }

    const noNumber = data.Episodes.filter(e => e.Season == null || e.Number == null);
    const notInOrder = data.Episodes.filter(e => e.Season != null && e.Number != null && e.InOrder === false);
    // Files the order in use does not have: some still got data from another source (complemented), the rest have none
    const complemented = notInOrder.filter(e => e.HasProviderData);
    const missing = notInOrder.filter(e => !e.HasProviderData);
    const providerName = current?.Provider === 'Tvdb' ? 'TVDB' : 'TMDb';
    const missingDetail = (e: OrderEpisode) => {
        const parts: string[] = [];
        const inSeason = current?.SeasonEpisodeCounts?.[String(e.Season)];
        parts.push(inSeason ?
            globalize.translate('EpoSeasonHas', providerName, inSeason, e.Season) :
            globalize.translate('EpoSeasonMissing', providerName, e.Season));
        parts.push(e.AlsoIn.length ? globalize.translate('EpoAlsoIn', e.AlsoIn.join(', ')) : globalize.translate('EpoNowhere'));
        return parts.join(' · ');
    };
    const noData = data.Episodes.filter(e => !e.HasProviderData && e.Season != null && e.Number != null && e.InOrder !== false);
    const outdated = data.Episodes.filter(e => e.HasProviderData && e.Outdated);
    const libraryCount = data.Episodes.length;
    const groups = [ 'Tvdb', 'Tmdb' ].map(p => ({ provider: p, options: data.Orders.filter(o => o.Provider === p) })).filter(g => g.options.length);

    return (
        <Stack spacing={1.5} sx={{ px: 2, pb: 2, pt: 0.5 }}>
            {data.Notes.map(n => <Alert key={n} severity={n === 'TvdbNoPlugin' ? 'warning' : 'info'} sx={{ py: 0, fontSize: '0.78rem' }}>{globalize.translate(`EpoNote${n}`)}</Alert>)}

            {/* Orders */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, flex: 1 }}>{globalize.translate('EpoOrdersAvailable')}</Typography>
                    <Button size='small' onClick={recheck} disabled={isFetching} startIcon={isFetching ? <CircularProgress size={12} /> : <RefreshIcon />}>
                        {globalize.translate('EpoRecheck')}
                    </Button>
                </Box>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', mb: 1 }}>{globalize.translate('EpoOrdersHelp')}</Typography>
                {groups.length === 0 && <Typography sx={{ fontSize: '0.78rem', color: '#ffca28' }}>{globalize.translate('EpoNoOrders')}</Typography>}
                <Stack spacing={1}>
                    {groups.map(g => (
                        <Box key={g.provider}>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', color: PROVIDER_COLORS[g.provider], mb: 0.5 }}>
                                {g.provider === 'Tvdb' ? 'TVDB' : 'TMDb'}
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0.75 }}>
                                {g.options.map(o => {
                                    const isSel = selected && optionKey(selected) === optionKey(o);
                                    const pct = libraryCount ? Math.round((o.Matched / libraryCount) * 100) : 0;
                                    const color = pct >= 95 ? '#4caf50' : pct >= 60 ? '#ffca28' : '#ef5350';
                                    return (
                                        <Box key={optionKey(o)} component='button' type='button' onClick={() => setPicked(optionKey(o))}
                                            sx={{
                                                textAlign: 'left', cursor: 'pointer', p: 1, borderRadius: '10px', color: '#fff', font: 'inherit',
                                                background: isSel ? 'rgba(0,164,220,0.16)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${isSel ? '#00a4dc' : 'rgba(255,255,255,0.1)'}`
                                            }}>
                                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, flex: 1, minWidth: 0 }}>
                                                    {o.Name}{o.AlternateName ? ` · ${o.AlternateName}` : ''}
                                                </Typography>
                                                {o.IsCurrent && <Badge label={globalize.translate('EpoInUse')} color='#00a4dc' />}
                                                {best && optionKey(best) === optionKey(o) && o.Matched > 0 && <Badge label={globalize.translate('EpoRecommended')} color='#4caf50' />}
                                            </Box>
                                            <Typography sx={{ fontSize: '0.72rem', color, fontWeight: 700, mt: 0.3 }}>
                                                {globalize.translate('EpoMatched', o.Matched, libraryCount)}
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>
                                                {orderLabel(o.Value)} · {globalize.translate('EpoProviderEpisodes', o.SeasonCount, o.EpisodeCount)}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    ))}
                </Stack>
            </Box>

            {/* Main source */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField select size='small' label={globalize.translate('EpoSource')} value={sourceValue} onChange={e => setSource(e.target.value)} sx={{ minWidth: 240 }}
                    slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                    <MenuItem value=''>{data.PrimarySource || !data.EffectiveSource ? globalize.translate('EpoSourceAutoPlain') : globalize.translate('EpoSourceAuto', data.EffectiveSource)}</MenuItem>
                    {data.Sources.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <Button variant='contained' size='small' onClick={() => apply.mutate()} disabled={!changed || apply.isPending || refreshing}
                    startIcon={apply.isPending ? <CircularProgress size={14} color='inherit' /> : <SortIcon />}>
                    {globalize.translate('EpoApply')}
                </Button>
                {!changed && !refreshing && (
                    <Button size='small' onClick={() => apply.mutate()} disabled={apply.isPending} startIcon={<RefreshIcon />}>
                        {globalize.translate('EpoRefreshNow')}
                    </Button>
                )}
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', mt: '4px !important' }}>{globalize.translate('EpoSourceHelp')}</Typography>
            {refreshing && (
                <Box sx={{ p: 1.25, borderRadius: '12px', border: '1px solid rgba(0,164,220,0.35)', background: 'rgba(0,164,220,0.08)' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#00a4dc', mb: 0.75 }}>
                        {globalize.translate(refreshState === 'Queued' ? 'EpoRefreshQueued' : 'EpoRefreshing')}
                        {data.RefreshProgress ? ` · ${Math.floor(data.RefreshProgress)}%` : ''}
                    </Typography>
                    <LinearProgress variant={data.RefreshProgress ? 'determinate' : 'indeterminate'} value={data.RefreshProgress ?? 0}
                        sx={{ height: 5, borderRadius: 3, '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #00a4dc, #aa5cc3)' } }} />
                </Box>
            )}
            {refreshState === 'Done' && <Alert severity='success' sx={{ py: 0 }}>{globalize.translate('EpoRefreshDone')}</Alert>}
            {refreshState === 'Failed' && <Alert severity='error' sx={{ py: 0 }}>{globalize.translate('EpoRefreshFailed')}</Alert>}
            {apply.isError && (
                <Alert severity='error' sx={{ py: 0 }}>
                    {globalize.translate((apply.error as { response?: { status?: number } })?.response?.status === 409 ? 'EpoRefreshBusy' : 'EpoApplyError')}
                </Alert>
            )}

            {/* Episodes that do not fit */}
            {noNumber.length + notInOrder.length + noData.length + outdated.length === 0 ? (
                <Alert severity='success' sx={{ py: 0 }}>{globalize.translate('EpoNoIssues')}</Alert>
            ) : (
                <Stack spacing={1}>
                    {noNumber.length > 0 && (
                        <IssueGroup
                            title={`${globalize.translate('EpoNoNumberTitle')} (${noNumber.length})`}
                            color='#ef5350'
                            help={globalize.translate('EpoNoNumberHelp')}
                            action={(
                                <Button size='small' variant='outlined' color='error' onClick={() => fixNumbers.mutate()} disabled={fixNumbers.isPending}
                                    startIcon={fixNumbers.isPending ? <CircularProgress size={12} color='inherit' /> : <FormatListNumberedIcon />}>
                                    {globalize.translate('EpoFixNumbers')}
                                </Button>
                            )}
                        >
                            {fixNumbers.data && <Alert severity='info' sx={{ py: 0, mb: 0.5 }}>{globalize.translate('EpoFixed', fixNumbers.data.Fixed, fixNumbers.data.Remaining)}</Alert>}
                            {noNumber.map(e => <EpisodeLine key={e.Id} e={e} color='#ef5350' detail={e.FileName || undefined} />)}
                        </IssueGroup>
                    )}
                    {missing.length > 0 && (
                        <IssueGroup
                            title={`${globalize.translate('EpoNotInOrderTitle', current ? `${current.Name}` : orderLabel(data.CurrentOrder))} (${missing.length})`}
                            color='#ff9800'
                            help={globalize.translate('EpoMissingHelp')}
                        >
                            {missing.map(e => <EpisodeLine key={e.Id} e={e} color='#ff9800' detail={missingDetail(e)} />)}
                        </IssueGroup>
                    )}
                    {complemented.length > 0 && (
                        <IssueGroup title={`${globalize.translate('EpoComplementedTitle', providerName)} (${complemented.length})`} color='#4caf50' help={globalize.translate('EpoComplementedHelp', providerName)}>
                            {complemented.map(e => <EpisodeLine key={e.Id} e={e} color='#4caf50' detail={globalize.translate('EpoDataFrom', e.DataFrom.join(', '))} />)}
                        </IssueGroup>
                    )}
                    {outdated.length > 0 && (
                        <IssueGroup title={`${globalize.translate('EpoOutdatedTitle')} (${outdated.length})`} color='#26c6da' help={globalize.translate('EpoOutdatedHelp')}>
                            {outdated.map(e => <EpisodeLine key={e.Id} e={e} color='#26c6da' detail={e.ExpectedName ? globalize.translate('EpoShouldBe', e.ExpectedName) : undefined} />)}
                        </IssueGroup>
                    )}
                    {noData.length > 0 && (
                        <IssueGroup title={`${globalize.translate('EpoNoDataTitle')} (${noData.length})`} color='#ffca28'>
                            {noData.map(e => <EpisodeLine key={e.Id} e={e} color='#ffca28' detail={e.ExpectedName ? globalize.translate('EpoExpected', e.ExpectedName) : undefined} />)}
                        </IssueGroup>
                    )}
                </Stack>
            )}
        </Stack>
    );
};

interface SeriesRow {
    series: BaseItemDto;
    unmatched: number;
    identified: boolean;
    source?: string;
}

const SeriesCard: FC<{ row: SeriesRow }> = ({ row }) => {
    const { api } = useApi();
    const { series, unmatched, identified, source } = row;
    const [ open, setOpen ] = useState(false);
    const tvdbId = series.ProviderIds?.Tvdb;
    const tmdbId = series.ProviderIds?.Tmdb;
    const accent = !identified ? '#ef5350' : unmatched ? '#ff9800' : '#4caf50';
    const imageUrl = series.ImageTags?.Primary && api ? getImageApi(api).getItemImageUrlById(series.Id || '', ImageType.Primary, { maxHeight: 160, tag: series.ImageTags.Primary }) : undefined;

    const identify = useCallback(() => {
        void import('components/itemidentifier/itemidentifier').then(({ default: identifier }) =>
            identifier.show(series.Id, series.ServerId)
        ).then(() => void queryClient.invalidateQueries({ queryKey: [ 'EpisodeOrderData' ] }), () => undefined);
    }, [ series.Id, series.ServerId ]);

    return (
        <Paper elevation={0} sx={{ position: 'relative', overflow: 'hidden', borderRadius: '16px', border: `1px solid ${accent}44`, gridColumn: open ? '1 / -1' : undefined }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1.25rem', right: '1.25rem', height: '2px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
            <Box sx={{ display: 'flex', gap: 1.75, p: 2 }}>
                <Box sx={{ width: 64, height: 96, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {imageUrl ? <Box component='img' src={imageUrl} alt='' loading='lazy' sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <TvIcon sx={{ color: 'rgba(255,255,255,0.3)' }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Typography sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                        {series.Name}{series.ProductionYear ? ` (${series.ProductionYear})` : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                        {identified ? (
                            <>
                                <Badge label={`${globalize.translate('EpoCurrent')}: ${orderLabel(series.DisplayOrder)}`} color='#00a4dc' />
                                {source && <Badge label={globalize.translate('EpoSourceChip', source)} color='#aa5cc3' />}
                                {unmatched > 0 ? (
                                    <Badge label={globalize.translate('EpoProblems', unmatched)} color='#ff9800' dot />
                                ) : (
                                    <Badge label={globalize.translate('EpoAllMatched')} color='#4caf50' dot />
                                )}
                            </>
                        ) : (
                            <Badge label={globalize.translate('EpoUnidentified')} color='#ef5350' dot />
                        )}
                        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>{globalize.translate('EpoEpisodes', series.RecursiveItemCount ?? 0)}</Typography>
                    </Box>
                    {!identified && <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)' }}>{globalize.translate('EpoUnidentifiedHelp')}</Typography>}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
                        {identified ? (
                            <Button variant='contained' size='small' onClick={() => setOpen(v => !v)} startIcon={<TravelExploreIcon />}
                                endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}>
                                {globalize.translate('EpoAnalyze')}
                            </Button>
                        ) : (
                            <Button variant='contained' color='error' size='small' onClick={identify} startIcon={<HelpOutlineIcon />}>
                                {globalize.translate('EpoIdentify')}
                            </Button>
                        )}
                        {tvdbId && (
                            <Button size='small' component={Link} href={`https://thetvdb.com/dereferrer/series/${encodeURIComponent(tvdbId)}`} target='_blank' rel='noopener noreferrer' endIcon={<OpenInNewIcon sx={{ fontSize: '0.9rem !important' }} />}>
                                TVDB
                            </Button>
                        )}
                        {tmdbId && (
                            <Button size='small' component={Link} href={`https://www.themoviedb.org/tv/${encodeURIComponent(tmdbId)}`} target='_blank' rel='noopener noreferrer' endIcon={<OpenInNewIcon sx={{ fontSize: '0.9rem !important' }} />}>
                                TMDb
                            </Button>
                        )}
                        <Button size='small' component={RouterLink} to={`/details?id=${series.Id}&serverId=${series.ServerId}`}>{globalize.translate('HlthOpen')}</Button>
                    </Box>
                </Box>
            </Box>
            {identified && (
                <Collapse in={open} unmountOnExit>
                    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', pt: 1.5 }}>
                        <AnalysisPanel series={series} />
                    </Box>
                </Collapse>
            )}
        </Paper>
    );
};

export const Component = () => {
    const { data, isPending, isError, refetch, isFetching } = useOrderData();
    const [ filter, setFilter ] = useState<Filter>('problems');
    const [ query, setQuery ] = useState('');

    const rows = useMemo<SeriesRow[]>(() => {
        if (!data) return [];
        const counts = new Map<string, number>();
        data.unmatched.forEach(e => {
            if (e.SeriesId) counts.set(e.SeriesId, (counts.get(e.SeriesId) || 0) + 1);
        });
        const sources = new Map(Object.entries(data.sources).map(([ k, v ]) => [ k.replace(/-/g, '').toLowerCase(), v ]));
        return data.series.map(s => ({
            series: s,
            unmatched: counts.get(s.Id || '') || 0,
            identified: isIdentified(s),
            source: sources.get((s.Id || '').replace(/-/g, '').toLowerCase())
        })).sort((a, b) =>
            Number(a.identified) - Number(b.identified)
            || b.unmatched - a.unmatched
            || (a.series.Name || '').localeCompare(b.series.Name || ''));
    }, [ data ]);

    const counts = {
        problems: rows.filter(r => r.identified && r.unmatched > 0).length,
        unidentified: rows.filter(r => !r.identified).length,
        custom: rows.filter(r => r.series.DisplayOrder || r.source).length,
        all: rows.length
    };
    const q = query.toLowerCase();
    const visible = rows
        .filter(r => {
            if (q) return true;
            switch (filter) {
                case 'problems': return r.identified && r.unmatched > 0;
                case 'unidentified': return !r.identified;
                case 'custom': return !!(r.series.DisplayOrder || r.source);
                default: return true;
            }
        })
        .filter(r => !q || (r.series.Name || '').toLowerCase().includes(q));

    const onRefresh = useCallback(() => void refetch(), [ refetch ]);

    if (isPending) return <Loading />;

    const filters: { key: Filter; label: string; color: string }[] = [
        { key: 'problems', label: globalize.translate('EpoFilterProblems'), color: '#ff9800' },
        { key: 'unidentified', label: globalize.translate('EpoFilterUnidentified'), color: '#ef5350' },
        { key: 'custom', label: globalize.translate('EpoFilterCustom'), color: '#aa5cc3' },
        { key: 'all', label: globalize.translate('EpoFilterAll'), color: '#00a4dc' }
    ];

    return (
        <Page id='episodeOrderPage' title={globalize.translate('EpoTitle')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary'>
                <PageHeader
                    title={globalize.translate('EpoTitle')}
                    subtitle={globalize.translate('EpoSubtitle2')}
                    actions={(
                        <Button variant='outlined' size='small' onClick={onRefresh} disabled={isFetching} startIcon={isFetching ? <CircularProgress size={14} /> : <RefreshIcon />}>
                            {globalize.translate('HlthAnalyze')}
                        </Button>
                    )}
                />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('HlthLoadError')}</Alert>
                ) : (
                    <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5, mb: 2.5 }}>
                            <StatTile icon={<TvIcon />} label={globalize.translate('EpoSeries')} value={counts.all} color='#00a4dc' active={filter === 'all'} onClick={() => setFilter('all')} />
                            <StatTile icon={<LinkOffIcon />} label={globalize.translate('EpoWithProblems')} value={counts.problems} color='#ff9800' active={filter === 'problems'} onClick={() => setFilter('problems')} />
                            <StatTile icon={<HelpOutlineIcon />} label={globalize.translate('EpoFilterUnidentified')} value={counts.unidentified} color='#ef5350' active={filter === 'unidentified'} onClick={() => setFilter('unidentified')} />
                            <StatTile icon={<FormatListNumberedIcon />} label={globalize.translate('EpoFilterCustom')} value={counts.custom} color='#aa5cc3' active={filter === 'custom'} onClick={() => setFilter('custom')} />
                            <StatTile icon={<LinkOffIcon />} label={globalize.translate('EpoUnmatchedEpisodes')} value={data?.unmatched.length ?? 0} color='#ffca28' />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                            <TextField size='small' placeholder={globalize.translate('EpoSearch')} value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 240px' }}
                                slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment> } }} />
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                {filters.map(f => (
                                    <Chip key={f.key} label={`${f.label} · ${counts[f.key]}`} onClick={() => setFilter(f.key)}
                                        variant={filter === f.key ? 'filled' : 'outlined'}
                                        sx={{ fontWeight: 700, borderColor: `${f.color}66`, color: filter === f.key ? '#000' : f.color, background: filter === f.key ? f.color : 'transparent', '&:hover': { background: filter === f.key ? f.color : `${f.color}22` } }} />
                                ))}
                            </Box>
                        </Box>

                        {visible.length === 0 ? (
                            <Paper elevation={0} sx={{ p: 4, mb: 2.5, textAlign: 'center', borderRadius: '16px', border: '1px solid rgba(76,175,80,0.3)' }}>
                                <CheckCircleIcon sx={{ fontSize: 48, color: '#4caf50' }} />
                                <Typography sx={{ fontWeight: 700, mt: 1 }}>{globalize.translate(q ? 'EpoNoSearchMatch' : 'EpoAllGood')}</Typography>
                            </Paper>
                        ) : (
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))', gap: 2, mb: 2.5 }}>
                                {visible.map(r => <SeriesCard key={r.series.Id} row={r} />)}
                            </Box>
                        )}

                        <SectionCard title={globalize.translate('EpoAbout')} icon={<SortIcon />} accentColor='#26c6da' description={globalize.translate('EpoAboutHelp2')}>
                            <Stack spacing={1}>
                                {[ '', 'dvd', 'absolute', 'alternate', 'regional' ].map(v => (
                                    <Box key={v || 'aired'}>
                                        <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>{orderLabel(v)}</Typography>
                                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>{globalize.translate(`${ORDER_KEYS[v]}Help`)}</Typography>
                                    </Box>
                                ))}
                                <Alert severity='info' sx={{ fontSize: '0.8rem' }}>{globalize.translate('EpoTip2')}</Alert>
                            </Stack>
                        </SectionCard>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'EpisodeOrderPage';
