import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { ActivityLogEntry } from '@jellyfin/sdk/lib/generated-client/models/activity-log-entry';
import { ActivityLogSortBy } from '@jellyfin/sdk/lib/generated-client/models/activity-log-sort-by';
import { LogLevel } from '@jellyfin/sdk/lib/generated-client/models/log-level';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { TaskTriggerInfoType } from '@jellyfin/sdk/lib/generated-client/models/task-trigger-info-type';
import type { SystemApiGetLogEntriesRequest } from '@jellyfin/sdk/lib/generated-client/api/system-api';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import GppBadIcon from '@mui/icons-material/GppBad';
import HistoryIcon from '@mui/icons-material/History';
import LoginIcon from '@mui/icons-material/Login';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import TableRowsIcon from '@mui/icons-material/TableRows';
import TodayIcon from '@mui/icons-material/Today';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import WarningIcon from '@mui/icons-material/Warning';
import { useSearchParams } from 'react-router-dom';

import { useDeleteLogEntry } from 'apps/dashboard/features/activity/api/useDeleteLogEntry';
import { ActivityTableView, ActivityTimelineView, userName } from 'apps/dashboard/features/activity/components/ActivityViews';
import { getTypeLabel, TYPE_FILTERS } from 'apps/dashboard/features/activity/utils/activityTypes';
import { TaskCard } from 'apps/dashboard/features/playback/components/PlaybackCards';
import { useUpdateTask } from 'apps/dashboard/features/tasks/api/useUpdateTask';
import useLiveTasks from 'apps/dashboard/features/tasks/hooks/useLiveTasks';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY as CONFIG_KEY, useConfiguration } from 'hooks/useConfiguration';
import { useUsersDetails } from 'hooks/useUsers';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader } from '../../components/cosmic';

type ViewMode = 'cards' | 'table';
type Scope = 'all' | 'user' | 'system';
type Period = '24h' | '7d' | '30d' | 'all';

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 10000;
const LIVE_INTERVAL = 10000;
const HOUR_MS = 60 * 60 * 1000;
const PERIOD_HOURS: Record<Period, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30, all: 0 };
const RETENTION_OPTIONS = [ 7, 14, 30, 60, 90, 180, 365 ];
const CLEAN_TASK_KEY = 'CleanActivityLog';
/** 3:30 in ticks (100 ns). */
const CLEAN_TIME_TICKS = 3.5 * 3600 * 10_000_000;

const VIEW_KEY = 'dashboardActivityView';
const LIVE_KEY = 'dashboardActivityLive';
const SCOPE_PARAM = 'useractivity';

const readStorage = (key: string) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const writeStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // ignore storage errors
    }
};

const scopeFromParam = (param: string | null): Scope => {
    if (param === null) return 'all';
    return param === 'true' ? 'user' : 'system';
};

const since = (now: number, hours: number) => (hours ? new Date(now - hours * HOUR_MS).toISOString() : undefined);

/** Activity log query; limit 0 only returns the total count. */
const useActivityQuery = (params: SystemApiGetLogEntriesRequest, refetchInterval: number | false) => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'ActivityLogEntries', 'cosmic', params ],
        queryFn: async ({ signal }) => (await getSystemApi(api!).getLogEntries(params, { signal })).data,
        enabled: !!api,
        refetchInterval,
        placeholderData: keepPreviousData
    });
};

const StatTile: FC<{ icon: React.ReactNode; label: string; value?: number; color: string; active?: boolean; onClick?: () => void }> = ({ icon, label, value, color, active, onClick }) => (
    <Paper elevation={0} onClick={onClick} sx={{
        position: 'relative', overflow: 'hidden', p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5,
        cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        borderColor: active ? `${color}99 !important` : undefined,
        boxShadow: active ? `0 0 22px ${color}33` : 'none',
        '&:hover': onClick ? { transform: 'translateY(-2px)', borderColor: `${color}66 !important` } : {}
    }}>
        <Box sx={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <Box sx={{
            width: 42, height: 42, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: `${color}1f`, border: `1px solid ${color}44`, '& svg': { color, fontSize: '1.35rem' }
        }}>
            {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '1.45rem', fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
                {value == null ? '—' : value.toLocaleString(globalize.getCurrentDateTimeLocale())}
            </Typography>
            <Typography noWrap sx={{ fontSize: '0.7rem', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>{label}</Typography>
        </Box>
    </Paper>
);

const toggleSx = {
    '& .MuiToggleButton-root': {
        border: '1px solid rgba(0,164,220,0.2)', color: 'rgba(255,255,255,0.55)', px: 1.5, gap: 0.75, textTransform: 'none', fontSize: '0.82rem',
        '&.Mui-selected': { color: '#00a4dc', background: 'rgba(0,164,220,0.16)', borderColor: 'rgba(0,164,220,0.45)' },
        '&:hover': { background: 'rgba(0,164,220,0.1)' }
    },
    '& .MuiToggleButtonGroup-grouped:first-of-type': { borderRadius: '12px 0 0 12px' },
    '& .MuiToggleButtonGroup-grouped:last-of-type': { borderRadius: '0 12px 12px 0' }
};

const csvCell = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Retention days + automatic daily cleanup for the activity log. */
const MaintenanceCard: FC = () => {
    const { api } = useApi();
    const { data: config } = useConfiguration();
    const { data: tasks } = useLiveTasks({ isHidden: false });
    const updateTask = useUpdateTask();
    const [ retention, setRetention ] = useState<string>('');
    const [ isSaving, setIsSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);

    const current = config?.ActivityLogRetentionDays;
    useEffect(() => {
        setRetention(current == null || current < 1 ? 'never' : String(current));
    }, [ current ]);

    const task = tasks?.find(t => t.Key === CLEAN_TASK_KEY);
    const isScheduled = (task?.Triggers?.length ?? 0) > 0;

    const save = useCallback(async () => {
        if (!api) return;
        setIsSaving(true);
        try {
            const { data: fresh } = await getSystemApi(api).getConfiguration();
            fresh.ActivityLogRetentionDays = retention === 'never' ? null : parseInt(retention, 10);
            await getSystemApi(api).updateConfiguration({ serverConfiguration: fresh });
            await queryClient.invalidateQueries({ queryKey: [ CONFIG_KEY ] });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            console.error('[ActivityPage] failed saving retention', err);
        } finally {
            setIsSaving(false);
        }
    }, [ api, retention ]);

    const toggleSchedule = useCallback((_: unknown, checked: boolean) => {
        if (!task?.Id) return;
        updateTask.mutate({
            taskId: task.Id,
            taskTriggerInfo: checked ? [ { Type: TaskTriggerInfoType.DailyTrigger, TimeOfDayTicks: CLEAN_TIME_TICKS } ] : []
        }, {
            onSuccess: () => {
                void queryClient.invalidateQueries({ queryKey: [ 'Tasks' ] });
            }
        });
    }, [ task, updateTask ]);

    const changed = retention !== (current == null || current < 1 ? 'never' : String(current));

    return (
        <TaskCard
            taskKey={CLEAN_TASK_KEY}
            title={globalize.translate('ActMaintenance')}
            icon={<CleaningServicesIcon />}
            accentColor='#aa5cc3'
            description={globalize.translate('ActMaintenanceHelp')}
        >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    select
                    size='small'
                    label={globalize.translate('ActRetention')}
                    value={retention}
                    onChange={e => setRetention(e.target.value)}
                    sx={{ minWidth: 220 }}
                >
                    {RETENTION_OPTIONS.map(d => <MenuItem key={d} value={String(d)}>{globalize.translate('ActRetentionDays', d)}</MenuItem>)}
                    <MenuItem value='never'>{globalize.translate('ActRetentionNever')}</MenuItem>
                </TextField>
                <Button
                    variant='contained'
                    size='small'
                    onClick={save}
                    disabled={!changed || isSaving}
                    startIcon={isSaving ? <CircularProgress size={14} color='inherit' /> : <SaveIcon />}
                    sx={{ borderRadius: '10px' }}
                >
                    {saved ? globalize.translate('SettingsSaved') : globalize.translate('Save')}
                </Button>
                <FormControlLabel
                    sx={{ ml: { md: 'auto' } }}
                    control={<Switch checked={isScheduled} onChange={toggleSchedule} disabled={!task || updateTask.isPending || retention === 'never'} />}
                    label={<Typography sx={{ fontSize: '0.84rem' }}>{globalize.translate('ActAutoClean')}</Typography>}
                />
            </Box>
            {retention === 'never' ? (
                <Alert severity='info' sx={{ borderRadius: '12px' }}>{globalize.translate('ActRetentionNeverHelp')}</Alert>
            ) : !isScheduled && task && (
                <Alert severity='warning' sx={{ borderRadius: '12px' }}>{globalize.translate('ActNotScheduled')}</Alert>
            )}
        </TaskCard>
    );
};

export const Component = () => {
    const { api } = useApi();
    const [ searchParams, setSearchParams ] = useSearchParams();
    const { usersById: users, names: userNames, isLoading: isUsersLoading } = useUsersDetails();
    const deleteEntry = useDeleteLogEntry();

    const [ view, setView ] = useState<ViewMode>(() => (readStorage(VIEW_KEY) === 'table' ? 'table' : 'cards'));
    const [ live, setLive ] = useState(() => readStorage(LIVE_KEY) !== 'false');
    const [ scope, setScope ] = useState<Scope>(() => scopeFromParam(searchParams.get(SCOPE_PARAM)));
    const [ search, setSearch ] = useState('');
    const [ debouncedSearch, setDebouncedSearch ] = useState('');
    const [ type, setType ] = useState('');
    const [ user, setUser ] = useState('');
    const [ severity, setSeverity ] = useState<LogLevel | ''>('');
    const [ period, setPeriod ] = useState<Period>('all');
    const [ ascending, setAscending ] = useState(false);
    const [ limit, setLimit ] = useState(PAGE_SIZE);
    const [ deletingId, setDeletingId ] = useState<number | null>(null);
    const [ isExporting, setIsExporting ] = useState(false);
    /** Rounded to the minute so the query keys stay stable between renders. */
    const [ now, setNow ] = useState(() => Math.floor(Date.now() / 60000) * 60000);

    useEffect(() => {
        const id = setInterval(() => setNow(Math.floor(Date.now() / 60000) * 60000), 60000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
        return () => clearTimeout(id);
    }, [ search ]);

    // Keep ?useractivity= in sync (the alerts widget links to the system view)
    useEffect(() => {
        if (scopeFromParam(searchParams.get(SCOPE_PARAM)) === scope) return;
        const next = new URLSearchParams(searchParams);
        if (scope === 'all') next.delete(SCOPE_PARAM);
        else next.set(SCOPE_PARAM, String(scope === 'user'));
        setSearchParams(next, { replace: true });
    }, [ scope, searchParams, setSearchParams ]);

    const refetchInterval = live ? LIVE_INTERVAL : false;

    const filters = useMemo<SystemApiGetLogEntriesRequest>(() => ({
        hasUserId: scope === 'all' ? undefined : scope === 'user',
        name: debouncedSearch || undefined,
        type: type || undefined,
        username: scope !== 'system' && user ? user : undefined,
        severity: severity || undefined,
        minDate: since(now, PERIOD_HOURS[period]),
        sortBy: [ ActivityLogSortBy.DateCreated ],
        sortOrder: [ ascending ? SortOrder.Ascending : SortOrder.Descending ]
    }), [ scope, debouncedSearch, type, user, severity, period, ascending, now ]);

    // Back to the first page whenever the filters change
    const filterKey = JSON.stringify({ ...filters, minDate: period });
    useEffect(() => setLimit(PAGE_SIZE), [ filterKey ]);

    const list = useActivityQuery({ ...filters, startIndex: 0, limit }, refetchInterval);
    const total = useActivityQuery({ limit: 0 }, refetchInterval);
    const last24h = useActivityQuery({ limit: 0, minDate: since(now, 24) }, refetchInterval);
    const errors = useActivityQuery({ limit: 0, severity: LogLevel.Error }, refetchInterval);
    const warnings = useActivityQuery({ limit: 0, severity: LogLevel.Warning }, refetchInterval);
    const failedLogins = useActivityQuery({ limit: 0, type: 'AuthenticationFailed', minDate: since(now, 24 * 7) }, refetchInterval);
    const logins = useActivityQuery({ limit: 0, type: 'AuthenticationSucceeded', minDate: since(now, 24) }, refetchInterval);

    const entries = useMemo(() => list.data?.Items || [], [ list.data ]);
    const matching = list.data?.TotalRecordCount ?? 0;
    const hasFilters = !!(search || type || user || severity || period !== 'all' || scope !== 'all');

    const clearFilters = useCallback(() => {
        setSearch('');
        setType('');
        setUser('');
        setSeverity('');
        setPeriod('all');
        setScope('all');
    }, []);

    const onViewChange = useCallback((_: unknown, value: ViewMode | null) => {
        if (!value) return;
        setView(value);
        writeStorage(VIEW_KEY, value);
    }, []);

    const onScopeChange = useCallback((_: unknown, value: Scope | null) => {
        if (value) setScope(value);
    }, []);

    const onLiveChange = useCallback((_: unknown, checked: boolean) => {
        setLive(checked);
        writeStorage(LIVE_KEY, String(checked));
    }, []);

    const refresh = useCallback(() => {
        setNow(Math.floor(Date.now() / 60000) * 60000);
        void queryClient.invalidateQueries({ queryKey: [ 'ActivityLogEntries' ] });
    }, []);

    const onDelete = useCallback((entry: ActivityLogEntry) => {
        if (entry.Id == null) return;
        setDeletingId(entry.Id);
        deleteEntry.mutate(entry.Id, { onSettled: () => setDeletingId(null) });
    }, [ deleteEntry ]);

    const onFilterType = useCallback((value: string) => setType(value), []);
    const onFilterUser = useCallback((value: string) => {
        setUser(value);
        if (scope === 'system') setScope('all');
    }, [ scope ]);

    const exportCsv = useCallback(async () => {
        if (!api) return;
        setIsExporting(true);
        try {
            const { data } = await getSystemApi(api).getLogEntries({ ...filters, startIndex: 0, limit: EXPORT_LIMIT });
            const header = [ 'Date', 'Severity', 'Type', 'User', 'Name', 'ShortOverview', 'Overview', 'ItemId' ];
            const rows = (data.Items || []).map(e => [
                e.Date ? new Date(e.Date).toLocaleString(globalize.getCurrentDateTimeLocale()) : '',
                e.Severity ? globalize.translate(`LogLevel.${e.Severity}`) : '',
                getTypeLabel(e.Type),
                userName(e, users),
                e.Name, e.ShortOverview, e.Overview, e.ItemId
            ]);
            const csv = [ header, ...rows ].map(r => r.map(csvCell).join(',')).join('\r\n');
            const url = URL.createObjectURL(new Blob([ '﻿' + csv ], { type: 'text/csv;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `jellyfin-actividad-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[ActivityPage] export failed', err);
        } finally {
            setIsExporting(false);
        }
    }, [ api, filters, users ]);

    const loadMore = useCallback(() => setLimit(l => l + PAGE_SIZE), []);
    const clearSearch = useCallback(() => setSearch(''), []);

    if (isUsersLoading || (list.isPending && !list.data)) return <Loading />;

    const viewProps = { entries, users, deletingId, onDelete, onFilterType, onFilterUser };

    return (
        <Page id='serverActivityPage' title={globalize.translate('HeaderActivity')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('HeaderActivity')}
                    subtitle={globalize.translate('ActSubtitle')}
                    actions={(
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                            <Tooltip title={globalize.translate('ActLiveHelp')}>
                                <FormControlLabel
                                    sx={{ m: 0, gap: 0.5 }}
                                    control={<Switch size='small' checked={live} onChange={onLiveChange} />}
                                    label={(
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.84rem' }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: live ? '#4caf50' : 'rgba(255,255,255,0.3)', boxShadow: live ? '0 0 8px #4caf50' : 'none' }} />
                                            {globalize.translate('ActLive')}
                                        </Box>
                                    )}
                                />
                            </Tooltip>
                            <Button variant='outlined' startIcon={<RefreshIcon />} onClick={refresh} sx={{ borderRadius: '12px' }}>
                                {globalize.translate('Refresh')}
                            </Button>
                            <Button
                                variant='outlined'
                                color='secondary'
                                startIcon={isExporting ? <CircularProgress size={16} color='inherit' /> : <FileDownloadIcon />}
                                onClick={exportCsv}
                                disabled={isExporting || matching === 0}
                                sx={{ borderRadius: '12px' }}
                            >
                                {globalize.translate('ActExport')}
                            </Button>
                        </Box>
                    )}
                />

                {list.isError ? (
                    <Alert severity='error'>{globalize.translate('ActivitiesLoadError')}</Alert>
                ) : (
                    <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 2, mb: 2.5 }}>
                            <StatTile icon={<HistoryIcon />} label={globalize.translate('ActTotal')} value={total.data?.TotalRecordCount} color='#00a4dc' active={!hasFilters} onClick={clearFilters} />
                            <StatTile icon={<TodayIcon />} label={globalize.translate('ActLast24h')} value={last24h.data?.TotalRecordCount} color='#26c6da' active={period === '24h'} onClick={() => setPeriod(p => (p === '24h' ? 'all' : '24h'))} />
                            <StatTile icon={<LoginIcon />} label={globalize.translate('ActLogins24h')} value={logins.data?.TotalRecordCount} color='#4caf50' active={type === 'AuthenticationSucceeded'} onClick={() => setType(t => (t === 'AuthenticationSucceeded' ? '' : 'AuthenticationSucceeded'))} />
                            <StatTile icon={<GppBadIcon />} label={globalize.translate('ActFailedLogins7d')} value={failedLogins.data?.TotalRecordCount} color='#ff7043' active={type === 'AuthenticationFailed'} onClick={() => setType(t => (t === 'AuthenticationFailed' ? '' : 'AuthenticationFailed'))} />
                            <StatTile icon={<WarningIcon />} label={globalize.translate('ActWarnings')} value={warnings.data?.TotalRecordCount} color='#ff9800' active={severity === LogLevel.Warning} onClick={() => setSeverity(s => (s === LogLevel.Warning ? '' : LogLevel.Warning))} />
                            <StatTile icon={<ErrorIcon />} label={globalize.translate('ActErrors')} value={errors.data?.TotalRecordCount} color='#ef5350' active={severity === LogLevel.Error} onClick={() => setSeverity(s => (s === LogLevel.Error ? '' : LogLevel.Error))} />
                        </Box>

                        <Paper elevation={0} sx={{ p: 1.5, mb: 2.5, borderRadius: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                            <TextField
                                size='small'
                                placeholder={globalize.translate('ActSearch')}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                sx={{ flex: '1 1 240px' }}
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position='start'><SearchIcon sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment>,
                                        endAdornment: search ? <InputAdornment position='end'><IconButton size='small' onClick={clearSearch}><CloseIcon fontSize='small' /></IconButton></InputAdornment> : undefined
                                    }
                                }}
                            />
                            <ToggleButtonGroup exclusive size='small' value={scope} onChange={onScopeChange} sx={toggleSx}>
                                <ToggleButton value='all'>{globalize.translate('All')}</ToggleButton>
                                <ToggleButton value='user'>{globalize.translate('LabelUser')}</ToggleButton>
                                <ToggleButton value='system'>{globalize.translate('LabelSystem')}</ToggleButton>
                            </ToggleButtonGroup>
                            <TextField select size='small' value={type} onChange={e => setType(e.target.value)} sx={{ minWidth: 190 }} slotProps={{ select: { displayEmpty: true } }}>
                                <MenuItem value=''>{globalize.translate('ActAllTypes')}</MenuItem>
                                {/* A type set from a card that is not in the list still shows up */}
                                {type && !TYPE_FILTERS.some(t => t.value === type) && <MenuItem value={type}>{getTypeLabel(type)}</MenuItem>}
                                {TYPE_FILTERS.map(t => <MenuItem key={t.value} value={t.value}>{globalize.translate(t.labelKey)}</MenuItem>)}
                            </TextField>
                            {scope !== 'system' && (
                                <TextField select size='small' value={user} onChange={e => setUser(e.target.value)} sx={{ minWidth: 160 }} slotProps={{ select: { displayEmpty: true } }}>
                                    <MenuItem value=''>{globalize.translate('DevAllUsers')}</MenuItem>
                                    {userNames.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                </TextField>
                            )}
                            <TextField select size='small' value={severity} onChange={e => setSeverity(e.target.value as LogLevel | '')} sx={{ minWidth: 150 }} slotProps={{ select: { displayEmpty: true } }}>
                                <MenuItem value=''>{globalize.translate('ActAllLevels')}</MenuItem>
                                {[ LogLevel.Information, LogLevel.Warning, LogLevel.Error, LogLevel.Critical ].map(l => (
                                    <MenuItem key={l} value={l}>{globalize.translate(`LogLevel.${l}`)}</MenuItem>
                                ))}
                            </TextField>
                            <TextField select size='small' value={period} onChange={e => setPeriod(e.target.value as Period)} sx={{ minWidth: 150 }}>
                                <MenuItem value='24h'>{globalize.translate('ActPeriod24h')}</MenuItem>
                                <MenuItem value='7d'>{globalize.translate('ActPeriod7d')}</MenuItem>
                                <MenuItem value='30d'>{globalize.translate('ActPeriod30d')}</MenuItem>
                                <MenuItem value='all'>{globalize.translate('ActPeriodAll')}</MenuItem>
                            </TextField>
                            <TextField select size='small' value={ascending ? 'asc' : 'desc'} onChange={e => setAscending(e.target.value === 'asc')} sx={{ minWidth: 150 }}>
                                <MenuItem value='desc'>{globalize.translate('ActNewestFirst')}</MenuItem>
                                <MenuItem value='asc'>{globalize.translate('ActOldestFirst')}</MenuItem>
                            </TextField>
                            <ToggleButtonGroup exclusive size='small' value={view} onChange={onViewChange} sx={toggleSx}>
                                <ToggleButton value='cards'><ViewAgendaIcon fontSize='small' />{globalize.translate('DevViewCards')}</ToggleButton>
                                <ToggleButton value='table'><TableRowsIcon fontSize='small' />{globalize.translate('DevViewTable')}</ToggleButton>
                            </ToggleButtonGroup>
                        </Paper>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, minHeight: 30 }}>
                            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
                                {globalize.translate('ActShowing', entries.length.toLocaleString(), matching.toLocaleString())}
                            </Typography>
                            {list.isFetching && <CircularProgress size={14} />}
                            {hasFilters && (
                                <Button size='small' startIcon={<FilterAltOffIcon />} onClick={clearFilters} sx={{ ml: 'auto', borderRadius: '10px' }}>
                                    {globalize.translate('ActClearFilters')}
                                </Button>
                            )}
                        </Box>

                        {entries.length === 0 ? (
                            <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: '16px' }}>
                                <HistoryIcon sx={{ fontSize: 48, color: 'rgba(0,164,220,0.5)', mb: 1 }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>{globalize.translate('ActNoResults')}</Typography>
                            </Paper>
                        ) : view === 'table' ? <ActivityTableView {...viewProps} /> : <ActivityTimelineView {...viewProps} />}

                        {entries.length < matching && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
                                <Button
                                    variant='outlined'
                                    onClick={loadMore}
                                    disabled={list.isFetching}
                                    startIcon={list.isFetching ? <CircularProgress size={16} color='inherit' /> : undefined}
                                    sx={{ borderRadius: '12px', px: 4 }}
                                >
                                    {globalize.translate('ActLoadMore', Math.min(PAGE_SIZE, matching - entries.length))}
                                </Button>
                            </Box>
                        )}

                        <Box sx={{ mt: 4 }}>
                            <MaintenanceCard />
                        </Box>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'ActivityPage';
