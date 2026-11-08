import React, { type FC, useCallback, useMemo, useRef, useState } from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { LocationType } from '@jellyfin/sdk/lib/generated-client/models/location-type';
import { MetadataRefreshMode } from '@jellyfin/sdk/lib/generated-client/models/metadata-refresh-mode';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import MovieIcon from '@mui/icons-material/Movie';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SubtitlesOffIcon from '@mui/icons-material/SubtitlesOff';
import TvIcon from '@mui/icons-material/Tv';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Link } from 'react-router-dom';

import { type ProbeIssue, type ProbeReason, useLogIssues } from 'apps/dashboard/features/libraries/api/useLogIssues';
import { BACKUPS_KEY, type VobSubResult, repairVobSub, useVobSubTools } from 'apps/dashboard/features/libraries/api/vobSubRepair';
import RepairBackupsCard from 'apps/dashboard/features/libraries/components/RepairBackupsCard';
import { queryClient } from 'utils/query/queryClient';
import { Badge, StatTile } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import { relativeTime } from 'apps/dashboard/features/tasks/components/TaskCosmic';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { PageHeader, SectionCard } from '../../components/cosmic';

const VIDEO_TYPES = [ BaseItemKind.Movie, BaseItemKind.Episode, BaseItemKind.Video, BaseItemKind.MusicVideo ];
const IGNORE_KEY = 'dashboardDamagedIgnored';
/** Items added less than this ago may simply not be analyzed yet. */
const RECENT_MS = 30 * 60 * 1000;

const REASONS: Record<ProbeReason | 'unknown' | 'pending', { color: string; labelKey: string; helpKey: string; icon: React.ReactNode }> = {
    json: { color: '#ff9800', labelKey: 'HlthReasonJson', helpKey: 'HlthReasonJsonHelp', icon: <SubtitlesOffIcon /> },
    unreadable: { color: '#ef5350', labelKey: 'HlthReasonUnreadable', helpKey: 'HlthReasonUnreadableHelp', icon: <BrokenImageIcon /> },
    timeout: { color: '#ffca28', labelKey: 'HlthReasonTimeout', helpKey: 'HlthReasonTimeoutHelp', icon: <HourglassTopIcon /> },
    other: { color: '#aa5cc3', labelKey: 'HlthReasonOther', helpKey: 'HlthReasonOtherHelp', icon: <HelpOutlineIcon /> },
    unknown: { color: '#90a4ae', labelKey: 'HlthReasonUnknown', helpKey: 'HlthReasonUnknownHelp', icon: <HelpOutlineIcon /> },
    pending: { color: '#26c6da', labelKey: 'HlthReasonPending', helpKey: 'HlthReasonPendingHelp', icon: <HourglassTopIcon /> }
};

const readIgnored = (): string[] => {
    try {
        return JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]') as string[];
    } catch {
        return [];
    }
};
const writeIgnored = (ids: string[]) => {
    try {
        localStorage.setItem(IGNORE_KEY, JSON.stringify(ids));
    } catch {
        // storage blocked
    }
};

const episodeLabel = (i: BaseItemDto) => {
    if (i.Type !== BaseItemKind.Episode) return i.ProductionYear ? `${i.Name} (${i.ProductionYear})` : i.Name || '';
    const s = String(i.ParentIndexNumber ?? 0).padStart(2, '0');
    const e = String(i.IndexNumber ?? 0).padStart(2, '0');
    return `${i.SeriesName} · S${s}E${e}${i.Name ? ` · ${i.Name}` : ''}`;
};

/** Video items whose file could not be analyzed (no video width saved). */
const useDamagedItems = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'DamagedItems' ],
        queryFn: async ({ signal }) => {
            const lib = getLibraryApi(api!);
            const base = {
                recursive: true,
                includeItemTypes: VIDEO_TYPES,
                locationTypes: [ LocationType.FileSystem ],
                enableImages: false,
                enableUserData: false,
                enableTotalRecordCount: true
            };
            const [ all, healthy ] = await Promise.all([
                lib.getItems({ ...base, fields: [ ItemFields.Path, ItemFields.DateCreated ] }, { signal }),
                lib.getItems({ ...base, minWidth: 1 }, { signal })
            ]);
            const ok = new Set((healthy.data.Items || []).map(i => i.Id));
            return {
                total: all.data.TotalRecordCount ?? all.data.Items?.length ?? 0,
                damaged: (all.data.Items || []).filter(i => !ok.has(i.Id))
            };
        },
        enabled: !!api,
        staleTime: 60 * 1000
    });
};

interface RepairState { state: 'queued' | 'running' | 'done' | 'failed' | 'notneeded'; result?: VobSubResult; error?: string }

const DamagedCard: FC<{ item: BaseItemDto; issue?: ProbeIssue; ignored: boolean; onToggleIgnore: (id: string) => void; repair?: RepairState; onRepair?: (id: string) => void }> = ({ item, issue, ignored, onToggleIgnore, repair, onRepair }) => {
    const { api } = useApi();
    const [ copied, setCopied ] = useState(false);
    const recent = item.DateCreated && Date.now() - Date.parse(item.DateCreated) < RECENT_MS;
    const key = issue?.reason || (recent ? 'pending' : 'unknown');
    const reason = REASONS[key];

    const retry = useMutation({
        mutationFn: () => getLibraryApi(api!).refreshItem({
            itemId: item.Id || '',
            metadataRefreshMode: MetadataRefreshMode.FullRefresh,
            imageRefreshMode: MetadataRefreshMode.Default,
            replaceAllMetadata: false,
            replaceAllImages: false
        })
    });

    const copy = useCallback(() => {
        void navigator.clipboard?.writeText(item.Path || '').then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [ item.Path ]);
    const doRetry = useCallback(() => retry.mutate(), [ retry ]);
    const toggleIgnore = useCallback(() => onToggleIgnore(item.Id || ''), [ item.Id, onToggleIgnore ]);
    const doRepair = useCallback(() => onRepair?.(item.Id || ''), [ item.Id, onRepair ]);
    const repairBusy = repair?.state === 'running' || repair?.state === 'queued';

    return (
        <Paper elevation={0} sx={{
            position: 'relative', overflow: 'hidden', p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, borderRadius: '16px',
            border: `1px solid ${reason.color}44`, opacity: ignored ? 0.55 : 1
        }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1.25rem', right: '1.25rem', height: '2px', background: `linear-gradient(90deg, transparent, ${reason.color}, transparent)` }} />
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{
                    width: 40, height: 40, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${reason.color}1f`, border: `1px solid ${reason.color}44`, '& svg': { color: reason.color, fontSize: '1.2rem' }
                }}>
                    {item.Type === BaseItemKind.Episode ? <TvIcon /> : <MovieIcon />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', lineHeight: 1.3 }}>{episodeLabel(item)}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Badge label={globalize.translate(reason.labelKey)} color={reason.color} icon={reason.icon} />
                        {issue && <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>{relativeTime(issue.date.replace(' ', 'T').replace(/ ([+-]\d\d:\d\d)$/, '$1'))}</Typography>}
                        {ignored && <Badge label={globalize.translate('HlthIgnored')} color='#90a4ae' />}
                    </Box>
                </Box>
            </Box>

            <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>{globalize.translate(reason.helpKey)}</Typography>
            {issue?.message && key === 'other' && (
                <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#ffab91', wordBreak: 'break-word' }}>{issue.message}</Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.75, pl: 1.25, borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Tooltip title={item.Path || ''}>
                    <Typography sx={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>
                        {item.Path}
                    </Typography>
                </Tooltip>
                <Tooltip title={globalize.translate(copied ? 'LtvCopied' : 'BakCopyPath')}>
                    <IconButton size='small' onClick={copy}><ContentCopyIcon sx={{ fontSize: '0.95rem' }} /></IconButton>
                </Tooltip>
            </Box>

            {repair && repair.state !== 'queued' && (
                <Alert severity={({ running: 'info', done: 'success', notneeded: 'info', failed: 'error' } as const)[repair.state]} icon={repair.state === 'running' ? <CircularProgress size={16} /> : undefined} sx={{ py: 0, fontSize: '0.78rem' }}>
                    {repair.state === 'running' && globalize.translate('HlthRepairing')}
                    {repair.state === 'done' && globalize.translate(repair.result?.BackupPath ? 'HlthRepairedBak' : 'HlthRepaired', repair.result?.Size || '')}
                    {repair.state === 'notneeded' && globalize.translate('HlthRepairNotNeeded')}
                    {repair.state === 'failed' && <>{globalize.translate('HlthRepairFailed')} <Box component='span' sx={{ fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-word' }}>{repair.error || repair.result?.Message}</Box></>}
                </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                {onRepair && repair?.state !== 'done' && (
                    <Button size='small' variant='contained' color='warning' onClick={doRepair} disabled={repairBusy}
                        startIcon={repairBusy ? <CircularProgress size={14} color='inherit' /> : <BuildIcon />}>
                        {globalize.translate(repair?.state === 'queued' ? 'HlthInQueue' : 'HlthRepair')}
                    </Button>
                )}
                <Button size='small' variant={onRepair && repair?.state !== 'done' ? 'outlined' : 'contained'} onClick={doRetry} disabled={retry.isPending || retry.isSuccess}
                    startIcon={retry.isPending ? <CircularProgress size={14} color='inherit' /> : <RefreshIcon />}>
                    {globalize.translate(retry.isSuccess ? 'HlthQueued' : 'HlthRetry')}
                </Button>
                <Button size='small' variant='outlined' component={Link} to={`/details?id=${item.Id}`} startIcon={<OpenInNewIcon />}>{globalize.translate('HlthOpen')}</Button>
                <Box sx={{ flex: 1 }} />
                <Tooltip title={globalize.translate(ignored ? 'HlthUnignore' : 'HlthIgnore')}>
                    <IconButton size='small' onClick={toggleIgnore}>{ignored ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}</IconButton>
                </Tooltip>
            </Box>
            {retry.isError && <Typography sx={{ fontSize: '0.72rem', color: '#ef5350' }}>{globalize.translate('HlthRetryError')}</Typography>}
        </Paper>
    );
};

export const Component = () => {
    const { data, isPending, isError, refetch, isFetching } = useDamagedItems();
    const { data: logIssues, isFetching: logsFetching, refetch: refetchLogs } = useLogIssues();
    const [ ignored, setIgnored ] = useState<string[]>(readIgnored);
    const [ showIgnored, setShowIgnored ] = useState(false);
    const [ query, setQuery ] = useState('');
    const [ reasonFilter, setReasonFilter ] = useState<string>('');

    const toggleIgnore = useCallback((id: string) => {
        setIgnored(cur => {
            const next = cur.includes(id) ? cur.filter(x => x !== id) : [ ...cur, id ];
            writeIgnored(next);
            return next;
        });
    }, []);

    const rows = useMemo(() => (data?.damaged || []).map(item => {
        const issue = item.Path ? logIssues?.probe.get(item.Path) : undefined;
        const recent = item.DateCreated && Date.now() - Date.parse(item.DateCreated) < RECENT_MS;
        return { item, issue, reason: issue?.reason || (recent ? 'pending' : 'unknown') };
    }).sort((a, b) => episodeLabel(a.item).localeCompare(episodeLabel(b.item))), [ data, logIssues ]);

    const counts = useMemo(() => {
        const active = rows.filter(r => !ignored.includes(r.item.Id || ''));
        const by = (r: string) => active.filter(x => x.reason === r).length;
        return { damaged: active.length, json: by('json'), unreadable: by('unreadable'), unknown: by('unknown') + by('other') + by('timeout'), ignored: rows.length - active.length };
    }, [ ignored, rows ]);

    const visible = rows.filter(r => {
        const isIgnored = ignored.includes(r.item.Id || '');
        if (isIgnored && !showIgnored) return false;
        if (reasonFilter && r.reason !== reasonFilter) return false;
        const q = query.toLowerCase();
        return !q || `${episodeLabel(r.item)} ${r.item.Path}`.toLowerCase().includes(q);
    });



    /** Paths for the VobSub repair script: broken-track files that are not ignored. */
    const scriptPaths = useMemo(() => rows
        .filter(r => r.reason === 'json' && r.item.Path && !ignored.includes(r.item.Id || ''))
        .map(r => r.item.Path as string), [ ignored, rows ]);
    const [ listCopied, setListCopied ] = useState(false);
    const copyList = useCallback(() => {
        void navigator.clipboard?.writeText(scriptPaths.join('\n') + '\n').then(() => {
            setListCopied(true);
            setTimeout(() => setListCopied(false), 2500);
        });
    }, [ scriptPaths ]);
    const toggleReason = (r: string) => setReasonFilter(cur => (cur === r ? '' : r));

    // ── Automatic VobSub repair (runs on the server, one file at a time) ──
    const { api } = useApi();
    const { data: tools, refetch: refetchTools } = useVobSubTools();
    const canRepairOnServer = !!tools?.serverSupports && !!tools.version;
    const [ keepBackup, setKeepBackup ] = useState(true);
    const [ repairs, setRepairs ] = useState<Record<string, RepairState>>({});
    const [ bulk, setBulk ] = useState<{ done: number; total: number } | null>(null);
    const queueRef = useRef<string[]>([]);
    const workingRef = useRef(false);

    const setRepair = useCallback((id: string, s: RepairState) => setRepairs(cur => ({ ...cur, [id]: s })), []);

    const runQueue = useCallback(async () => {
        if (workingRef.current || !api) return;
        workingRef.current = true;
        while (queueRef.current.length) {
            const id = queueRef.current.shift() as string;
            setRepair(id, { state: 'running' });
            try {
                const result = await repairVobSub(api, id, keepBackup);
                const map: Record<string, RepairState['state']> = { Repaired: 'done', NotNeeded: 'notneeded', NeedsRepair: 'failed' };
                setRepair(id, { state: map[result.Status] || 'failed', result });
            } catch (err) {
                setRepair(id, { state: 'failed', error: (err as Error).message });
            }
            setBulk(b => (b ? { ...b, done: b.done + 1 } : b));
        }
        workingRef.current = false;
        void refetch();
        void queryClient.invalidateQueries({ queryKey: [ BACKUPS_KEY ] });
    }, [ api, keepBackup, refetch, setRepair ]);

    const repairOne = useCallback((id: string) => {
        if (queueRef.current.includes(id)) return;
        queueRef.current.push(id);
        setRepair(id, { state: 'queued' });
        void runQueue();
    }, [ runQueue, setRepair ]);

    const repairableIds = useMemo(() => rows
        .filter(r => r.reason === 'json' && !ignored.includes(r.item.Id || '') && repairs[r.item.Id || '']?.state !== 'done')
        .map(r => r.item.Id as string), [ ignored, repairs, rows ]);

    const repairAll = useCallback(() => {
        const ids = repairableIds.filter(id => !queueRef.current.includes(id));
        if (!ids.length) return;
        setBulk({ done: 0, total: ids.length });
        ids.forEach(id => {
            queueRef.current.push(id);
            setRepair(id, { state: 'queued' });
        });
        void runQueue();
    }, [ repairableIds, runQueue, setRepair ]);

    const stopAll = useCallback(() => {
        queueRef.current.forEach(id => setRepair(id, { state: 'failed', error: globalize.translate('HlthRepairStopped') }));
        queueRef.current = [];
    }, [ setRepair ]);

    const onRefresh = useCallback(() => {
        void refetch();
        void refetchLogs();
        void refetchTools();
    }, [ refetch, refetchLogs, refetchTools ]);

    const repairSummary = useMemo(() => {
        const values = Object.values(repairs);
        return { done: values.filter(v => v.state === 'done').length, failed: values.filter(v => v.state === 'failed').length };
    }, [ repairs ]);

    if (isPending) return <Loading />;

    const healthyPct = data?.total ? Math.round(((data.total - counts.damaged) / data.total) * 1000) / 10 : 100;
    const busy = isFetching || logsFetching;

    return (
        <Page id='libraryHealthPage' title={globalize.translate('HlthTitle')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary'>
                <PageHeader
                    title={globalize.translate('HlthTitle')}
                    subtitle={globalize.translate('HlthSubtitle')}
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
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5, mb: 2.5 }}>
                            <StatTile icon={<CheckCircleIcon />} label={globalize.translate('HlthHealthy')} value={`${healthyPct}%`} color='#4caf50' active={!reasonFilter} onClick={() => setReasonFilter('')} />
                            <StatTile icon={<BrokenImageIcon />} label={globalize.translate('HlthDamaged')} value={counts.damaged} color='#ef5350' />
                            <StatTile icon={<SubtitlesOffIcon />} label={globalize.translate('HlthReasonJson')} value={counts.json} color='#ff9800' active={reasonFilter === 'json'} onClick={() => toggleReason('json')} />
                            <StatTile icon={<BrokenImageIcon />} label={globalize.translate('HlthReasonUnreadable')} value={counts.unreadable} color='#ef5350' active={reasonFilter === 'unreadable'} onClick={() => toggleReason('unreadable')} />
                            <StatTile icon={<HelpOutlineIcon />} label={globalize.translate('HlthReasonUnknown')} value={counts.unknown} color='#90a4ae' active={reasonFilter === 'unknown'} onClick={() => toggleReason('unknown')} />
                        </Box>

                        {(repairableIds.length > 0 || bulk || repairSummary.done > 0) && (
                            <SectionCard title={globalize.translate('HlthAutoRepair')} icon={<BuildIcon />} accentColor='#ff9800' description={globalize.translate('HlthAutoRepairHelp')}>
                                {!tools ? (
                                    <CircularProgress size={20} />
                                ) : !tools.serverSupports ? (
                                    <Alert severity='info'>{globalize.translate('HlthServerOld')}</Alert>
                                ) : !tools.version ? (
                                    <Alert severity='warning'>{globalize.translate('HlthToolsMissing')}</Alert>
                                ) : (
                                    <Stack spacing={1.5}>
                                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                            {bulk && bulk.done < bulk.total ? (
                                                <Button variant='outlined' color='error' onClick={stopAll}>{globalize.translate('HlthStop')}</Button>
                                            ) : (
                                                <Button variant='contained' color='warning' startIcon={<BuildIcon />} onClick={repairAll} disabled={!repairableIds.length}>
                                                    {globalize.translate('HlthRepairAll', repairableIds.length)}
                                                </Button>
                                            )}
                                            <Box component='label' sx={{ display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>
                                                <Switch size='small' checked={keepBackup} onChange={(_, v) => setKeepBackup(v)} disabled={!!bulk && bulk.done < bulk.total} />
                                                {globalize.translate('HlthKeepBackup')}
                                            </Box>
                                            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', ml: 'auto' }}>{tools.version}</Typography>
                                        </Box>
                                        {bulk && (
                                            <Box>
                                                <LinearProgress variant='determinate' value={(bulk.done / bulk.total) * 100}
                                                    sx={{ height: 6, borderRadius: 3, background: 'rgba(255,152,0,0.15)', '& .MuiLinearProgress-bar': { background: '#ff9800', borderRadius: 3 } }} />
                                                <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.6)', mt: 0.75 }}>
                                                    {globalize.translate(bulk.done < bulk.total ? 'HlthBulkProgress' : 'HlthBulkDone', bulk.done, bulk.total, repairSummary.done, repairSummary.failed)}
                                                </Typography>
                                            </Box>
                                        )}
                                        <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate(keepBackup ? 'HlthKeepBackupHelp' : 'HlthNoBackupHelp')}</Typography>
                                    </Stack>
                                )}
                            </SectionCard>
                        )}

                        <RepairBackupsCard enabled={canRepairOnServer} />

                        {counts.damaged === 0 && !showIgnored ? (
                            <Paper elevation={0} sx={{ p: 4, mb: 2.5, textAlign: 'center', borderRadius: '16px', border: '1px solid rgba(76,175,80,0.3)' }}>
                                <CheckCircleIcon sx={{ fontSize: 48, color: '#4caf50' }} />
                                <Typography sx={{ fontWeight: 700, mt: 1 }}>{globalize.translate('HlthAllGood')}</Typography>
                                <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', mt: 0.5 }}>{globalize.translate('HlthAllGoodHelp', data?.total ?? 0)}</Typography>
                            </Paper>
                        ) : (
                            <>
                                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                                    <TextField size='small' placeholder={globalize.translate('HlthSearch')} value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 240px' }}
                                        slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment> } }} />
                                    {counts.ignored > 0 && (
                                        <Box component='label' sx={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                                            <Switch size='small' checked={showIgnored} onChange={(_, v) => setShowIgnored(v)} />
                                            {globalize.translate('HlthShowIgnored', counts.ignored)}
                                        </Box>
                                    )}
                                </Box>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: 2, mb: 2.5 }}>
                                    {visible.map(r => (
                                        <DamagedCard
                                            key={r.item.Id}
                                            item={r.item}
                                            issue={r.issue}
                                            ignored={ignored.includes(r.item.Id || '')}
                                            onToggleIgnore={toggleIgnore}
                                            repair={repairs[r.item.Id || '']}
                                            onRepair={canRepairOnServer && [ 'json', 'unknown', 'other' ].includes(r.reason) && (r.item.Path || '').toLowerCase().endsWith('.mkv') ? repairOne : undefined}
                                        />
                                    ))}
                                </Box>
                            </>
                        )}

                        <SectionCard title={globalize.translate('HlthHowToFix')} icon={<BuildIcon />} accentColor='#26c6da' description={globalize.translate('HlthHowToFixHelp')}>
                            <Stack spacing={1.5}>
                                {([ 'json', 'unreadable', 'timeout' ] as ProbeReason[]).map(r => (
                                    <Box key={r} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                                        <Box sx={{ color: REASONS[r].color, display: 'flex', mt: 0.25, '& svg': { fontSize: '1.1rem' } }}>{REASONS[r].icon}</Box>
                                        <Box>
                                            <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>{globalize.translate(REASONS[r].labelKey)}</Typography>
                                            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{globalize.translate(`HlthFix_${r}`)}</Typography>
                                        </Box>
                                    </Box>
                                ))}
                                {scriptPaths.length > 0 && !canRepairOnServer && (
                                    <Box sx={{ p: 1.5, borderRadius: '12px', background: 'rgba(255,152,0,0.07)', border: '1px solid rgba(255,152,0,0.3)' }}>
                                        <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, mb: 0.5 }}>{globalize.translate('HlthScriptTitle', scriptPaths.length)}</Typography>
                                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', mb: 1 }}>{globalize.translate('HlthScriptHelp')}</Typography>
                                        <Box component='pre' sx={{ m: 0, mb: 1, p: 1, borderRadius: '8px', background: 'rgba(0,0,0,0.35)', fontSize: '0.72rem', color: '#9be7ff', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                            {'nano ~/danados.txt   # pega la lista, guarda con Ctrl+O y sal con Ctrl+X\npython3 /mnt/respaldos/jellyfin/scripts/reparar-vobsub.py --lista ~/danados.txt\npython3 /mnt/respaldos/jellyfin/scripts/reparar-vobsub.py --lista ~/danados.txt --aplicar'}
                                        </Box>
                                        <Button size='small' variant='contained' color='warning' startIcon={<ContentCopyIcon />} onClick={copyList}>
                                            {globalize.translate(listCopied ? 'HlthListCopied' : 'HlthCopyList', scriptPaths.length)}
                                        </Button>
                                    </Box>
                                )}
                                {logIssues && (
                                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{globalize.translate('HlthLogsScanned', logIssues.scannedFiles.join(', '))}</Typography>
                                )}
                            </Stack>
                        </SectionCard>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'LibraryHealthPage';
