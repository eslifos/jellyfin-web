import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { LogFile } from '@jellyfin/sdk/lib/generated-client/models/log-file';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArticleIcon from '@mui/icons-material/Article';
import DnsIcon from '@mui/icons-material/Dns';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import SensorsIcon from '@mui/icons-material/Sensors';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import SpeedIcon from '@mui/icons-material/Speed';
import UpdateIcon from '@mui/icons-material/Update';
import { useNavigate } from 'react-router-dom';

import { useServerLogs } from 'apps/dashboard/features/logs/api/useServerLogs';
import { LOG_KINDS, type LogKind, formatSize, logKind } from 'apps/dashboard/features/logs/utils/logTypes';
import { Badge, StatTile } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import { relativeTime } from 'apps/dashboard/features/tasks/components/TaskCosmic';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY as CONFIG_KEY, useConfiguration } from 'hooks/useConfiguration';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

type Sort = 'date' | 'size' | 'name';

const dayKey = (d?: string) => {
    if (!d) return '';
    const date = new Date(d);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return globalize.translate('ActToday');
    if (date.toDateString() === yesterday.toDateString()) return globalize.translate('Yesterday');
    return date.toLocaleDateString(globalize.getCurrentDateTimeLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
};

export const downloadLog = async (api: NonNullable<ReturnType<typeof useApi>['api']>, name: string) => {
    const res = await getSystemApi(api).getLogFile({ name });
    const data = res.data as unknown as string | object;
    const text = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    const url = URL.createObjectURL(new Blob([ text ], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
};

const LogRow: FC<{ log: LogFile; maxSize: number }> = ({ log, maxSize }) => {
    const { api } = useApi();
    const navigate = useNavigate();
    const [ downloading, setDownloading ] = useState(false);
    const kind = LOG_KINDS[logKind(log.Name)];
    const open = useCallback(() => navigate(`/dashboard/logs/${log.Name}`), [ navigate, log.Name ]);
    const download = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!api || !log.Name) return;
        setDownloading(true);
        void downloadLog(api, log.Name).finally(() => setDownloading(false));
    }, [ api, log.Name ]);
    const pct = maxSize ? Math.max(2, ((log.Size || 0) / maxSize) * 100) : 0;

    return (
        <Box onClick={open} sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, pr: 1, borderRadius: '12px', cursor: 'pointer',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.2s, border-color 0.2s',
            '&:hover': { background: `${kind.color}0f`, borderColor: `${kind.color}55` }
        }}>
            <Box sx={{
                width: 38, height: 38, borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${kind.color}1f`, border: `1px solid ${kind.color}44`, '& svg': { color: kind.color, fontSize: '1.15rem' }
            }}>
                {kind.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', overflowWrap: 'anywhere' }}>{log.Name}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Badge label={globalize.translate(kind.labelKey)} color={kind.color} />
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }} title={log.DateModified ? new Date(log.DateModified).toLocaleString() : ''}>
                        {relativeTime(log.DateModified)}
                    </Typography>
                </Box>
            </Box>
            <Box sx={{ width: { xs: 70, sm: 130 }, flexShrink: 0 }}>
                <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', textAlign: 'right', mb: 0.5 }}>{formatSize(log.Size)}</Typography>
                <Box sx={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <Box sx={{ width: `${pct}%`, height: '100%', background: kind.color, borderRadius: 2 }} />
                </Box>
            </Box>
            <Tooltip title={globalize.translate('Download')}>
                <IconButton size='small' onClick={download} disabled={downloading}>
                    {downloading ? <CircularProgress size={16} /> : <FileDownloadIcon fontSize='small' />}
                </IconButton>
            </Tooltip>
        </Box>
    );
};

export const Component = () => {
    const { api } = useApi();
    const navigate = useNavigate();
    const { isPending: logsPending, data: logs, refetch, isFetching } = useServerLogs();
    const { isPending: configPending, data: initialConfig } = useConfiguration();
    const [ slowEnabled, setSlowEnabled ] = useState(false);
    const [ slowMs, setSlowMs ] = useState('500');
    const [ saved, setSaved ] = useState(false);
    const [ query, setQuery ] = useState('');
    const [ kind, setKind ] = useState<LogKind | ''>('');
    const [ sort, setSort ] = useState<Sort>('date');

    useEffect(() => {
        if (initialConfig) {
            setSlowEnabled(!!initialConfig.EnableSlowResponseWarning);
            setSlowMs(String(initialConfig.SlowResponseThresholdMs ?? 500));
        }
    }, [ initialConfig ]);

    const save = useMutation({
        mutationFn: async () => {
            const { data: config } = await getSystemApi(api!).getConfiguration();
            config.EnableSlowResponseWarning = slowEnabled;
            config.SlowResponseThresholdMs = parseInt(slowMs, 10) || 500;
            await getSystemApi(api!).updateConfiguration({ serverConfiguration: config });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [ CONFIG_KEY ] });
            setSaved(true);
        }
    });

    const all = useMemo(() => logs || [], [ logs ]);

    const stats = useMemo(() => {
        const byKind = (k: LogKind) => all.filter(l => logKind(l.Name) === k).length;
        return {
            total: all.length,
            size: all.reduce((s, l) => s + (l.Size || 0), 0),
            server: byKind('server'),
            ffmpeg: byKind('transcode') + byKind('remux') + byKind('direct'),
            maxSize: Math.max(0, ...all.map(l => l.Size || 0))
        };
    }, [ all ]);

    const currentServerLog = useMemo(() => all
        .filter(l => logKind(l.Name) === 'server')
        .sort((a, b) => Date.parse(b.DateModified || '') - Date.parse(a.DateModified || ''))[0], [ all ]);

    const groups = useMemo(() => {
        const q = query.toLowerCase();
        const list = all
            .filter(l => (!q || (l.Name || '').toLowerCase().includes(q)) && (!kind || logKind(l.Name) === kind))
            .sort((a, b) => {
                if (sort === 'size') return (b.Size || 0) - (a.Size || 0);
                if (sort === 'name') return (a.Name || '').localeCompare(b.Name || '');
                return Date.parse(b.DateModified || '') - Date.parse(a.DateModified || '');
            });
        if (sort !== 'date') return [ { key: '', items: list } ];
        const map = new Map<string, LogFile[]>();
        list.forEach(l => {
            const k = dayKey(l.DateModified);
            map.set(k, [ ...(map.get(k) || []), l ]);
        });
        return Array.from(map, ([ key, items ]) => ({ key, items }));
    }, [ all, kind, query, sort ]);

    const onRefresh = useCallback(() => void refetch(), [ refetch ]);
    const onSave = useCallback(() => save.mutate(), [ save ]);
    const closeSaved = useCallback(() => setSaved(false), []);
    const openCurrent = useCallback((live: boolean) => {
        if (currentServerLog?.Name) navigate(`/dashboard/logs/${currentServerLog.Name}${live ? '?live=1' : ''}`);
    }, [ currentServerLog, navigate ]);

    if (logsPending || configPending) return <Loading />;

    const kindCounts = (Object.keys(LOG_KINDS) as LogKind[]).map(k => ({ k, n: all.filter(l => logKind(l.Name) === k).length })).filter(x => x.n);

    return (
        <Page id='logPage' title={globalize.translate('TabLogs')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('TabLogs')}
                    subtitle={globalize.translate('LogSubtitle')}
                    actions={(
                        <Button variant='outlined' size='small' onClick={onRefresh} disabled={isFetching} startIcon={isFetching ? <CircularProgress size={14} /> : <RefreshIcon />}>
                            {globalize.translate('Refresh')}
                        </Button>
                    )}
                />

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5, mb: 2.5 }}>
                    <StatTile icon={<ArticleIcon />} label={globalize.translate('LogFiles')} value={stats.total} color='#00a4dc' active={!kind} onClick={() => setKind('')} />
                    <StatTile icon={<SdStorageIcon />} label={globalize.translate('LogTotalSize')} value={formatSize(stats.size)} color='#aa5cc3' />
                    <StatTile icon={<DnsIcon />} label={globalize.translate('LogKindServer')} value={stats.server} color='#26c6da' active={kind === 'server'} onClick={() => setKind(k => (k === 'server' ? '' : 'server'))} />
                    <StatTile icon={<MovieFilterIcon />} label='FFmpeg' value={stats.ffmpeg} color='#ff9800' active={kind === 'transcode'} onClick={() => setKind(k => (k === 'transcode' ? '' : 'transcode'))} />
                    <StatTile icon={<UpdateIcon />} label={globalize.translate('LogLastWrite')} value={currentServerLog ? relativeTime(currentServerLog.DateModified) : '—'} color='#4caf50' />
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                    <SectionCard title={globalize.translate('LogCurrent')} icon={<SensorsIcon />} accentColor='#4caf50' description={globalize.translate('LogCurrentHelp')}>
                        {currentServerLog ? (
                            <Stack spacing={1.5}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.84rem' }}>{currentServerLog.Name}</Typography>
                                    <Badge label={formatSize(currentServerLog.Size)} color='#4caf50' />
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <Button variant='contained' size='small' startIcon={<SensorsIcon />} onClick={() => openCurrent(true)}>{globalize.translate('LogWatchLive')}</Button>
                                    <Button variant='outlined' size='small' startIcon={<ArticleIcon />} onClick={() => openCurrent(false)}>{globalize.translate('LogOpen')}</Button>
                                </Box>
                            </Stack>
                        ) : (
                            <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('LogNoServerLog')}</Typography>
                        )}
                    </SectionCard>

                    <SectionCard title={globalize.translate('LogSlowTitle')} icon={<SpeedIcon />} accentColor='#ffca28' description={globalize.translate('LogSlowHelp')}>
                        <Stack spacing={1.5}>
                            {save.isError && <Alert severity='error'>{globalize.translate('NetSaveError')}</Alert>}
                            <ToggleRow label={globalize.translate('LabelSlowResponseEnabled')} checked={slowEnabled} onChange={setSlowEnabled} color='#ffca28' />
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                <TextField type='number' size='small' label={globalize.translate('LabelSlowResponseTime')} value={slowMs} onChange={e => setSlowMs(e.target.value)} disabled={!slowEnabled}
                                    sx={{ flex: 1 }} slotProps={{ htmlInput: { min: 50, step: 50 }, input: { endAdornment: <InputAdornment position='end'>ms</InputAdornment> }, inputLabel: { shrink: true } }} />
                                <Button variant='contained' onClick={onSave} disabled={save.isPending} startIcon={save.isPending ? <CircularProgress size={14} color='inherit' /> : <SaveIcon />} sx={{ height: 40 }}>
                                    {globalize.translate('Save')}
                                </Button>
                            </Box>
                        </Stack>
                    </SectionCard>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                    <TextField size='small' placeholder={globalize.translate('LogSearch')} value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 240px' }}
                        slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment> } }} />
                    <TextField select size='small' label={globalize.translate('LogKind')} value={kind} onChange={e => setKind(e.target.value as LogKind | '')} sx={{ minWidth: 190 }}
                        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                        <MenuItem value=''>{globalize.translate('All')}</MenuItem>
                        {kindCounts.map(({ k, n }) => <MenuItem key={k} value={k}>{globalize.translate(LOG_KINDS[k].labelKey)} ({n})</MenuItem>)}
                    </TextField>
                    <TextField select size='small' label={globalize.translate('LabelSortBy')} value={sort} onChange={e => setSort(e.target.value as Sort)} sx={{ minWidth: 150 }} slotProps={{ inputLabel: { shrink: true } }}>
                        <MenuItem value='date'>{globalize.translate('LogSortDate')}</MenuItem>
                        <MenuItem value='size'>{globalize.translate('LogSortSize')}</MenuItem>
                        <MenuItem value='name'>{globalize.translate('Name')}</MenuItem>
                    </TextField>
                </Box>

                {groups.every(g => !g.items.length) ? (
                    <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: '16px' }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.55)' }}>{globalize.translate('LogNoMatch')}</Typography>
                    </Paper>
                ) : groups.map(g => (
                    <Box key={g.key || 'all'} sx={{ mb: 2.5 }}>
                        {g.key && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#00a4dc' }}>
                                    {g.key} · {g.items.length}
                                </Typography>
                                <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(0,164,220,0.4), transparent)' }} />
                            </Box>
                        )}
                        <Stack spacing={1}>
                            {g.items.map(l => <LogRow key={l.Name} log={l} maxSize={stats.maxSize} />)}
                        </Stack>
                    </Box>
                ))}
            </Box>
            <SavedSnackbar open={saved} onClose={closeSaved} />
        </Page>
    );
};

Component.displayName = 'LogsPage';
