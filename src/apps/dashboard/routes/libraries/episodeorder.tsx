import React, { type FC, useCallback, useMemo, useState } from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { LocationType } from '@jellyfin/sdk/lib/generated-client/models/location-type';
import { MetadataRefreshMode } from '@jellyfin/sdk/lib/generated-client/models/metadata-refresh-mode';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getItemUpdateApi } from '@jellyfin/sdk/lib/utils/api/item-update-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import TvIcon from '@mui/icons-material/Tv';
import { Link as RouterLink } from 'react-router-dom';

import { type TvdbMiss, useLogIssues } from 'apps/dashboard/features/libraries/api/useLogIssues';
import { Badge, StatTile } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard } from '../../components/cosmic';

/** TVDB episode orders supported by the TVDB plugin ('' = aired / default). */
const ORDERS: { value: string; labelKey: string; helpKey: string }[] = [
    { value: '', labelKey: 'EpoAired', helpKey: 'EpoAiredHelp' },
    { value: 'dvd', labelKey: 'EpoDvd', helpKey: 'EpoDvdHelp' },
    { value: 'absolute', labelKey: 'EpoAbsolute', helpKey: 'EpoAbsoluteHelp' },
    { value: 'alternate', labelKey: 'EpoAlternate', helpKey: 'EpoAlternateHelp' },
    { value: 'altdvd', labelKey: 'EpoAltDvd', helpKey: 'EpoAltDvdHelp' },
    { value: 'regional', labelKey: 'EpoRegional', helpKey: 'EpoRegionalHelp' },
    { value: 'digital', labelKey: 'EpoDigital', helpKey: 'EpoDigitalHelp' },
    { value: 'production', labelKey: 'EpoProduction', helpKey: 'EpoProductionHelp' },
    { value: 'storyArc', labelKey: 'EpoStoryArc', helpKey: 'EpoStoryArcHelp' },
    { value: 'tv', labelKey: 'EpoTv', helpKey: 'EpoTvHelp' },
    { value: 'originalAirDate', labelKey: 'EpoOriginalAirDate', helpKey: 'EpoOriginalAirDateHelp' }
];

const orderLabel = (v?: string | null) => globalize.translate(ORDERS.find(o => o.value === (v || ''))?.labelKey || 'EpoAired');

const epCode = (e: BaseItemDto) => `S${String(e.ParentIndexNumber ?? 0).padStart(2, '0')}E${String(e.IndexNumber ?? 0).padStart(2, '0')}`;

interface SeriesRow {
    series: BaseItemDto;
    unmatched: BaseItemDto[];
    misses: TvdbMiss[];
}

const useOrderData = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'EpisodeOrderData' ],
        queryFn: async ({ signal }) => {
            const lib = getLibraryApi(api!);
            const [ series, unmatched ] = await Promise.all([
                lib.getItems({
                    recursive: true,
                    includeItemTypes: [ BaseItemKind.Series ],
                    fields: [ ItemFields.ProviderIds, ItemFields.RecursiveItemCount, ItemFields.Path ],
                    enableUserData: false,
                    imageTypeLimit: 1
                }, { signal }),
                // Episodes on disk that no metadata provider could match.
                lib.getItems({
                    recursive: true,
                    includeItemTypes: [ BaseItemKind.Episode ],
                    locationTypes: [ LocationType.FileSystem ],
                    hasTvdbId: false,
                    hasTmdbId: false,
                    hasImdbId: false,
                    fields: [ ItemFields.Path ],
                    enableImages: false,
                    enableUserData: false
                }, { signal })
            ]);
            return { series: series.data.Items || [], unmatched: unmatched.data.Items || [] };
        },
        enabled: !!api,
        staleTime: 60 * 1000
    });
};

const SeriesCard: FC<{ row: SeriesRow }> = ({ row }) => {
    const { api } = useApi();
    const { series, unmatched, misses } = row;
    const [ order, setOrder ] = useState(series.DisplayOrder || '');
    const [ open, setOpen ] = useState(false);
    const tvdbId = series.ProviderIds?.Tvdb;
    const problems = unmatched.length + misses.length;
    const accent = problems ? '#ff9800' : '#4caf50';
    const changed = order !== (series.DisplayOrder || '');
    const imageUrl = series.ImageTags?.Primary && api ? getImageApi(api).getItemImageUrlById(series.Id || '', ImageType.Primary, { maxHeight: 160, tag: series.ImageTags.Primary }) : undefined;

    const apply = useMutation({
        mutationFn: async () => {
            const lib = getLibraryApi(api!);
            const { data: full } = await lib.getItem({ itemId: series.Id || '' });
            await getItemUpdateApi(api!).updateItem({ itemId: series.Id || '', baseItemDto: { ...full, DisplayOrder: order } });
            await lib.refreshItem({
                itemId: series.Id || '',
                metadataRefreshMode: MetadataRefreshMode.FullRefresh,
                imageRefreshMode: MetadataRefreshMode.Default,
                replaceAllMetadata: true,
                replaceAllImages: false
            });
        },
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: [ 'EpisodeOrderData' ] })
    });

    const toggle = useCallback(() => setOpen(v => !v), []);
    const doApply = useCallback(() => apply.mutate(), [ apply ]);
    const help = ORDERS.find(o => o.value === order)?.helpKey;

    return (
        <Paper elevation={0} sx={{ position: 'relative', overflow: 'hidden', borderRadius: '16px', border: `1px solid ${accent}44` }}>
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
                        <Badge label={`${globalize.translate('EpoCurrent')}: ${orderLabel(series.DisplayOrder)}`} color='#00a4dc' />
                        {problems > 0 ? (
                            <Badge label={globalize.translate('EpoProblems', problems)} color='#ff9800' dot />
                        ) : (
                            <Badge label={globalize.translate('EpoAllMatched')} color='#4caf50' dot />
                        )}
                        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>{globalize.translate('EpoEpisodes', series.RecursiveItemCount ?? 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
                        <TextField select size='small' label={globalize.translate('EpoOrder')} value={order} onChange={e => setOrder(e.target.value)} sx={{ minWidth: 190 }}
                            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                            {ORDERS.map(o => <MenuItem key={o.value || 'aired'} value={o.value}>{globalize.translate(o.labelKey)}</MenuItem>)}
                        </TextField>
                        <Button variant='contained' size='small' onClick={doApply} disabled={!changed || apply.isPending}
                            startIcon={apply.isPending ? <CircularProgress size={14} color='inherit' /> : <SortIcon />}>
                            {globalize.translate('EpoApply')}
                        </Button>
                        {tvdbId && (
                            <Button size='small' component={Link} href={`https://thetvdb.com/dereferrer/series/${tvdbId}`} target='_blank' rel='noopener noreferrer' endIcon={<OpenInNewIcon sx={{ fontSize: '0.9rem !important' }} />}>
                                TVDB
                            </Button>
                        )}
                        <Button size='small' component={RouterLink} to={`/details?id=${series.Id}`}>{globalize.translate('HlthOpen')}</Button>
                    </Box>
                    {help && changed && <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)' }}>{globalize.translate(help)}</Typography>}
                    {apply.isSuccess && <Alert severity='success' sx={{ py: 0 }}>{globalize.translate('EpoApplied')}</Alert>}
                    {apply.isError && <Alert severity='error' sx={{ py: 0 }}>{globalize.translate('EpoApplyError')}</Alert>}
                    {!tvdbId && <Typography sx={{ fontSize: '0.72rem', color: '#ffca28' }}>{globalize.translate('EpoNoTvdb')}</Typography>}
                </Box>
            </Box>

            {problems > 0 && (
                <>
                    <Box onClick={toggle} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.06)', '&:hover': { background: 'rgba(255,255,255,0.03)' } }}>
                        <LinkOffIcon sx={{ fontSize: '1rem', color: '#ff9800' }} />
                        <Typography sx={{ fontSize: '0.78rem', flex: 1 }}>{globalize.translate('EpoSeeEpisodes')}</Typography>
                        <ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'rgba(255,255,255,0.5)' }} />
                    </Box>
                    <Collapse in={open}>
                        <Stack spacing={0.5} sx={{ px: 2, pb: 1.5 }}>
                            {unmatched.map(e => (
                                <Box key={e.Id} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#ff9800', flexShrink: 0 }}>{epCode(e)}</Typography>
                                    <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)' }}>{e.Name} · {globalize.translate('EpoNoMatch')}</Typography>
                                </Box>
                            ))}
                            {misses.map(m => (
                                <Box key={`${m.episode}-${m.date}`} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#ffca28', flexShrink: 0 }}>{m.episode}</Typography>
                                    <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)' }}>{m.name} · {globalize.translate('EpoNotInTvdb')}</Typography>
                                </Box>
                            ))}
                        </Stack>
                    </Collapse>
                </>
            )}
        </Paper>
    );
};

export const Component = () => {
    const { data, isPending, isError, refetch, isFetching } = useOrderData();
    const { data: logIssues, refetch: refetchLogs, isFetching: logsFetching } = useLogIssues();
    const [ showAll, setShowAll ] = useState(false);
    const [ query, setQuery ] = useState('');

    const rows = useMemo<SeriesRow[]>(() => {
        if (!data) return [];
        const bySeries = new Map<string, BaseItemDto[]>();
        data.unmatched.forEach(e => {
            if (e.SeriesId) bySeries.set(e.SeriesId, [ ...(bySeries.get(e.SeriesId) || []), e ]);
        });
        return data.series.map(s => {
            const tvdb = s.ProviderIds?.Tvdb;
            // Keep one miss per episode code.
            const misses = Array.from(new Map((logIssues?.tvdb || []).filter(m => tvdb && m.tvdbId === tvdb).map(m => [ m.episode, m ])).values());
            return { series: s, unmatched: (bySeries.get(s.Id || '') || []).sort((a, b) => epCode(a).localeCompare(epCode(b))), misses };
        }).sort((a, b) => (b.unmatched.length + b.misses.length) - (a.unmatched.length + a.misses.length) || (a.series.Name || '').localeCompare(b.series.Name || ''));
    }, [ data, logIssues ]);

    const withProblems = rows.filter(r => r.unmatched.length + r.misses.length > 0);
    const custom = rows.filter(r => r.series.DisplayOrder).length;
    const q = query.toLowerCase();
    const visible = (showAll || q ? rows : withProblems).filter(r => !q || (r.series.Name || '').toLowerCase().includes(q));

    const onRefresh = useCallback(() => {
        void refetch();
        void refetchLogs();
    }, [ refetch, refetchLogs ]);

    if (isPending) return <Loading />;
    const busy = isFetching || logsFetching;

    return (
        <Page id='episodeOrderPage' title={globalize.translate('EpoTitle')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary'>
                <PageHeader
                    title={globalize.translate('EpoTitle')}
                    subtitle={globalize.translate('EpoSubtitle')}
                    actions={(
                        <Button variant='outlined' size='small' onClick={onRefresh} disabled={busy} startIcon={busy ? <CircularProgress size={14} /> : <RefreshIcon />}>
                            {globalize.translate('HlthAnalyze')}
                        </Button>
                    )}
                />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('HlthLoadError')}</Alert>
                ) : (
                    <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5, mb: 2.5 }}>
                            <StatTile icon={<TvIcon />} label={globalize.translate('EpoSeries')} value={rows.length} color='#00a4dc' active={showAll} onClick={() => setShowAll(true)} />
                            <StatTile icon={<LinkOffIcon />} label={globalize.translate('EpoWithProblems')} value={withProblems.length} color='#ff9800' active={!showAll} onClick={() => setShowAll(false)} />
                            <StatTile icon={<LinkOffIcon />} label={globalize.translate('EpoUnmatchedEpisodes')} value={data?.unmatched.length ?? 0} color='#ef5350' />
                            <StatTile icon={<FormatListNumberedIcon />} label={globalize.translate('EpoCustomOrder')} value={custom} color='#aa5cc3' />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                            <TextField size='small' placeholder={globalize.translate('EpoSearch')} value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 240px' }}
                                slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment> } }} />
                            <Box component='label' sx={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                                <Switch size='small' checked={showAll} onChange={(_, v) => setShowAll(v)} />
                                {globalize.translate('EpoShowAll')}
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

                        <SectionCard title={globalize.translate('EpoAbout')} icon={<SortIcon />} accentColor='#26c6da' description={globalize.translate('EpoAboutHelp')}>
                            <Stack spacing={1}>
                                {ORDERS.slice(0, 5).map(o => (
                                    <Box key={o.value || 'aired'}>
                                        <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>{globalize.translate(o.labelKey)}</Typography>
                                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>{globalize.translate(o.helpKey)}</Typography>
                                    </Box>
                                ))}
                                <Alert severity='info' sx={{ fontSize: '0.8rem' }}>{globalize.translate('EpoTip')}</Alert>
                            </Stack>
                        </SectionCard>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'EpisodeOrderPage';
