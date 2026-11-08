import React, { type FC, useEffect, useMemo, useState } from 'react';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BarChartIcon from '@mui/icons-material/BarChart';
import SearchIcon from '@mui/icons-material/Search';
import { Link, useSearchParams } from 'react-router-dom';

import { Badge } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import { type HistoryEntry, KIND_COLORS, formatDuration, useHistory } from 'apps/dashboard/features/stats/api/playbackStats';
import { useUsers } from 'hooks/useUsers';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { PageHeader } from '../../components/cosmic';
import { toggleSx } from 'apps/dashboard/features/plugins/components/PluginCosmic';

const PAGE = 50;
const METHOD_COLORS: Record<string, string> = { DirectPlay: '#4caf50', DirectStream: '#26c6da', Transcode: '#ff7043' };

const title = (e: HistoryEntry) => {
    if (e.ItemType === 'Episode') {
        const s = String(e.ParentIndexNumber ?? 0).padStart(2, '0');
        const n = String(e.IndexNumber ?? 0).padStart(2, '0');
        return { main: e.SeriesName || e.ItemName || '', sub: `S${s}E${n} · ${e.ItemName || ''}` };
    }
    return { main: e.ItemName || '', sub: e.ProductionYear ? String(e.ProductionYear) : globalize.translate(e.ItemType === 'Movie' ? 'StsMovie' : 'StsOther') };
};

const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return globalize.translate('ActToday');
    if (d.toDateString() === yesterday.toDateString()) return globalize.translate('Yesterday');
    return d.toLocaleDateString(globalize.getCurrentDateTimeLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const Row: FC<{ e: HistoryEntry }> = ({ e }) => {
    const { api } = useApi();
    const t = title(e);
    const kindColor = e.ItemType === 'Episode' ? KIND_COLORS.episode : e.ItemType === 'Movie' ? KIND_COLORS.movie : KIND_COLORS.other;
    const posterId = e.ItemType === 'Episode' && e.SeriesId ? e.SeriesId : e.ItemId;
    const img = api ? getImageApi(api).getItemImageUrlById(posterId, ImageType.Primary, { maxHeight: 96 }) : undefined;
    const runtimeS = (e.RunTimeTicks || 0) / 1e7;
    const pct = runtimeS > 0 && e.PositionTicks ? Math.min(100, Math.round(((e.PositionTicks / 1e7) / runtimeS) * 100)) : null;
    const time = new Date(e.StartedUtc).toLocaleTimeString(globalize.getCurrentDateTimeLocale(), { hour: 'numeric', minute: '2-digit' });
    const end = e.StoppedUtc ? new Date(e.StoppedUtc).toLocaleTimeString(globalize.getCurrentDateTimeLocale(), { hour: 'numeric', minute: '2-digit' }) : null;
    const method = e.PlayMethod || '';
    const playing = !e.StoppedUtc;

    return (
        <Paper elevation={0} sx={{ display: 'flex', gap: 1.5, p: 1.25, borderRadius: '14px', alignItems: 'center', borderLeft: `3px solid ${kindColor}` }}>
            <Box component={Link} to={`/details?id=${posterId}`} sx={{ flexShrink: 0 }}>
                <Box component='img' src={img} alt='' loading='lazy' sx={{ width: 40, height: 60, objectFit: 'cover', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'block' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{t.main}</Typography>
                <Typography noWrap sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)' }}>{t.sub}</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {playing && <Badge label={globalize.translate('HisPlaying')} color='#4caf50' dot />}
                    {e.Completed && <Badge label={globalize.translate('HisFinished')} color='#4caf50' />}
                    {method && (
                        <Tooltip title={e.TranscodeReasons || ''}>
                            <span><Badge label={globalize.translate(`StsMethod_${method}`)} color={METHOD_COLORS[method] || '#90a4ae'} /></span>
                        </Tooltip>
                    )}
                    {e.Height ? <Badge label={`${e.Height}p`} color='#90a4ae' /> : null}
                </Box>
            </Box>
            <Box sx={{ display: { xs: 'none', sm: 'block' }, width: 170, flexShrink: 0, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{e.UserName}</Typography>
                <Typography noWrap sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{e.Client}{e.DeviceName ? ` · ${e.DeviceName}` : ''}</Typography>
                {e.RemoteAddress && <Typography noWrap sx={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{e.RemoteAddress}</Typography>}
            </Box>
            <Box sx={{ width: 120, flexShrink: 0, textAlign: 'right' }}>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 700 }}>{formatDuration(e.WatchedSeconds)}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{time}{end ? ` – ${end}` : ''}</Typography>
                {pct !== null && (
                    <Box sx={{ mt: 0.5, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} title={`${pct}%`}>
                        <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: e.Completed ? '#4caf50' : kindColor }} />
                    </Box>
                )}
            </Box>
        </Paper>
    );
};

export const Component = () => {
    const { data: users } = useUsers();
    const [ query, setQuery ] = useState('');
    const [ search, setSearch ] = useState('');
    const [ searchParams ] = useSearchParams();
    const [ userId, setUserId ] = useState(searchParams.get('userId') || '');
    const [ itemType, setItemType ] = useState('');
    const [ limit, setLimit ] = useState(PAGE);

    useEffect(() => {
        const t = setTimeout(() => setSearch(query.trim()), 350);
        return () => clearTimeout(t);
    }, [ query ]);
    useEffect(() => setLimit(PAGE), [ search, userId, itemType ]);

    const { data, isPending, isFetching, isError } = useHistory({ startIndex: 0, limit, userId, itemType, searchTerm: search });

    const groups = useMemo(() => {
        const map = new Map<string, HistoryEntry[]>();
        (data?.Items || []).forEach(e => {
            const k = dayLabel(e.StartedUtc);
            map.set(k, [ ...(map.get(k) || []), e ]);
        });
        return Array.from(map, ([ key, items ]) => ({ key, items, seconds: items.reduce((s, e) => s + e.WatchedSeconds, 0) }));
    }, [ data ]);

    if (isPending) return <Loading />;

    return (
        <Page id='historyPage' title={globalize.translate('HisTitle')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary'>
                <PageHeader
                    title={globalize.translate('HisTitle')}
                    subtitle={globalize.translate('HisSubtitle')}
                    actions={<Button size='small' variant='outlined' component={Link} to='/dashboard/stats' startIcon={<BarChartIcon />}>{globalize.translate('StsTitle')}</Button>}
                />

                {data === null ? (
                    <Alert severity='info'>{globalize.translate('StsServerOld')}</Alert>
                ) : isError ? (
                    <Alert severity='error'>{globalize.translate('StsLoadError')}</Alert>
                ) : (
                    <>
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2.5 }}>
                            <TextField size='small' placeholder={globalize.translate('HisSearch')} value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 240px' }}
                                slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment>, endAdornment: isFetching ? <CircularProgress size={14} /> : undefined } }} />
                            <TextField select size='small' label={globalize.translate('LabelUser')} value={userId} onChange={e => setUserId(e.target.value)} sx={{ minWidth: 180 }}
                                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                                <MenuItem value=''>{globalize.translate('All')}</MenuItem>
                                {(users || []).map(u => <MenuItem key={u.Id} value={u.Id || ''}>{u.Name}</MenuItem>)}
                            </TextField>
                            <ToggleButtonGroup size='small' exclusive value={itemType} onChange={(_, v: string | null) => setItemType(v ?? '')} sx={toggleSx}>
                                <ToggleButton value=''>{globalize.translate('All')}</ToggleButton>
                                <ToggleButton value='Episode'>{globalize.translate('StsEpisodes')}</ToggleButton>
                                <ToggleButton value='Movie'>{globalize.translate('StsMovies')}</ToggleButton>
                                <ToggleButton value='Other'>{globalize.translate('StsOther')}</ToggleButton>
                            </ToggleButtonGroup>
                            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', ml: 'auto' }}>{globalize.translate('HisTotal', data?.TotalRecordCount ?? 0)}</Typography>
                        </Box>

                        {!data?.Items.length ? (
                            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: '16px' }}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>{globalize.translate(search || userId || itemType ? 'HisNoMatch' : 'StsNoData')}</Typography>
                            </Paper>
                        ) : (
                            <>
                                {groups.map(g => (
                                    <Box key={g.key} sx={{ mb: 2.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
                                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#00a4dc' }}>
                                                {g.key} · {globalize.translate('StsPlaysN', g.items.length)} · {formatDuration(g.seconds)}
                                            </Typography>
                                            <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(0,164,220,0.4), transparent)' }} />
                                        </Box>
                                        <Stack spacing={1}>{g.items.map(e => <Row key={e.Id} e={e} />)}</Stack>
                                    </Box>
                                ))}
                                {data.Items.length < data.TotalRecordCount && (
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Button variant='outlined' onClick={() => setLimit(l => l + PAGE)} disabled={isFetching}
                                            startIcon={isFetching ? <CircularProgress size={14} /> : undefined}>
                                            {globalize.translate('HisLoadMore', data.TotalRecordCount - data.Items.length)}
                                        </Button>
                                    </Box>
                                )}
                            </>
                        )}
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'HistoryPage';
