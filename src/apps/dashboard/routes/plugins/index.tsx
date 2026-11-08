import React, { useCallback, useMemo, useState } from 'react';
import { PluginStatus } from '@jellyfin/sdk/lib/generated-client/models/plugin-status';
import { getPluginApi } from '@jellyfin/sdk/lib/utils/api/plugin-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExtensionIcon from '@mui/icons-material/Extension';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontIcon from '@mui/icons-material/Storefront';
import StorageIcon from '@mui/icons-material/Storage';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import { Link } from 'react-router-dom';

import { QueryKey } from 'apps/dashboard/features/plugins/api/queryKey';
import { usePluginDetails } from 'apps/dashboard/features/plugins/api/usePluginDetails';
import NoPluginResults from 'apps/dashboard/features/plugins/components/NoPluginResults';
import { StatTile, PluginTile, categoryLabel, getUpdate, toggleSx } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import { PluginCategory } from 'apps/dashboard/features/plugins/constants/pluginCategory';
import useRestartServer from 'apps/dashboard/features/system/api/useRestartServer';
import ConfirmDialog from 'components/ConfirmDialog';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import useSearchParam from 'hooks/useSearchParam';
import { useSystemInfo } from 'hooks/useSystemInfo';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader } from '../../components/cosmic';

const MAIN_CATEGORIES = Object.values(PluginCategory).filter(c => c !== PluginCategory.Other).map(c => c.toLowerCase());

/** Status filter values (the first three match the classic page). */
const STATUS = {
    All: 'All',
    Installed: 'Installed',
    Available: 'Available',
    Active: 'active',
    Disabled: 'disabled',
    Updates: 'updates',
    Restart: 'restart',
    Problems: 'problems'
} as const;

const PROBLEM_STATUSES: (PluginStatus | undefined)[] = [ PluginStatus.NotSupported, PluginStatus.Malfunctioned ];

type SortKey = 'name' | 'category' | 'status';

export const Component = () => {
    const { api } = useApi();
    const { data: pluginDetails, isError, isPending } = usePluginDetails();
    const { data: systemInfo } = useSystemInfo();
    const restartServer = useRestartServer();
    const [ category, setCategory ] = useSearchParam('category');
    const [ searchQuery, setSearchQuery ] = useSearchParam('query');
    const [ status, setStatus ] = useSearchParam('status', STATUS.Installed);
    const [ sort, setSort ] = useState<SortKey>('name');
    const [ restartOpen, setRestartOpen ] = useState(false);
    const [ updatingAll, setUpdatingAll ] = useState<{ done: number; total: number } | null>(null);
    const [ updateAllDone, setUpdateAllDone ] = useState(false);
    const [ refreshing, setRefreshing ] = useState(false);

    const serverVersion = systemInfo?.Version;

    const updates = useMemo(() => {
        const map = new Map<string, NonNullable<ReturnType<typeof getUpdate>>>();
        pluginDetails.forEach(p => {
            const u = getUpdate(p, serverVersion);
            if (u) map.set(p.id, u);
        });
        return map;
    }, [ pluginDetails, serverVersion ]);

    const counts = useMemo(() => {
        const installed = pluginDetails.filter(p => p.status);
        return {
            installed: installed.length,
            active: installed.filter(p => p.status === PluginStatus.Active).length,
            disabled: installed.filter(p => p.status === PluginStatus.Disabled).length,
            restart: installed.filter(p => p.status === PluginStatus.Restart).length,
            problems: installed.filter(p => PROBLEM_STATUSES.includes(p.status)).length,
            available: pluginDetails.length - installed.length,
            updates: updates.size
        };
    }, [ pluginDetails, updates ]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        let list = pluginDetails;

        switch (status) {
            case STATUS.Installed: list = list.filter(p => p.status); break;
            case STATUS.Available: list = list.filter(p => !p.status); break;
            case STATUS.Active: list = list.filter(p => p.status === PluginStatus.Active); break;
            case STATUS.Disabled: list = list.filter(p => p.status === PluginStatus.Disabled); break;
            case STATUS.Restart: list = list.filter(p => p.status === PluginStatus.Restart); break;
            case STATUS.Problems: list = list.filter(p => PROBLEM_STATUSES.includes(p.status)); break;
            case STATUS.Updates: list = list.filter(p => updates.has(p.id)); break;
        }

        if (category) {
            list = category === PluginCategory.Other.toLowerCase() ?
                list.filter(p => !p.category || !MAIN_CATEGORIES.includes(p.category.toLowerCase())) :
                list.filter(p => p.category?.toLowerCase() === category);
        }

        if (q) {
            list = list.filter(p => [ p.name, p.description, p.owner ].some(s => s?.toLowerCase().includes(q)));
        }

        const sorted = list.slice();
        if (sort === 'category') sorted.sort((a, b) => categoryLabel(a.category).localeCompare(categoryLabel(b.category)) || (a.name || '').localeCompare(b.name || ''));
        if (sort === 'status') sorted.sort((a, b) => (a.status || 'zz').localeCompare(b.status || 'zz') || (a.name || '').localeCompare(b.name || ''));
        return sorted;
    }, [ category, pluginDetails, searchQuery, sort, status, updates ]);

    /** Groups for the "by category" view. */
    const groups = useMemo(() => {
        if (sort !== 'category') return [ { key: '', items: filtered } ];
        const map = new Map<string, typeof filtered>();
        filtered.forEach(p => {
            const label = categoryLabel(p.category);
            map.set(label, [ ...(map.get(label) || []), p ]);
        });
        return Array.from(map, ([ key, items ]) => ({ key, items }));
    }, [ filtered, sort ]);

    const toggleStatus = useCallback((value: string) => setStatus(status === value ? STATUS.Installed : value), [ setStatus, status ]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void Promise.all([
            queryClient.invalidateQueries({ queryKey: [ QueryKey.Packages ] }),
            queryClient.invalidateQueries({ queryKey: [ QueryKey.Plugins ] }),
            queryClient.invalidateQueries({ queryKey: [ QueryKey.ConfigurationPages ] })
        ]).finally(() => setRefreshing(false));
    }, []);

    const onUpdateAll = useCallback(async () => {
        if (!api || !updates.size) return;
        const list = pluginDetails.filter(p => updates.has(p.id));
        setUpdatingAll({ done: 0, total: list.length });
        for (const [ i, p ] of list.entries()) {
            const u = updates.get(p.id);
            try {
                await getPluginApi(api).installPackage({ name: p.name || '', assemblyGuid: p.id, version: u?.version, repositoryUrl: u?.repositoryUrl });
            } catch (err) {
                console.error('[Plugins] update failed', p.name, err);
            }
            setUpdatingAll({ done: i + 1, total: list.length });
        }
        setUpdatingAll(null);
        setUpdateAllDone(true);
        void queryClient.invalidateQueries({ queryKey: [ QueryKey.Plugins ] });
    }, [ api, pluginDetails, updates ]);

    const openRestart = useCallback(() => setRestartOpen(true), []);
    const closeRestart = useCallback(() => setRestartOpen(false), []);
    const doRestart = useCallback(() => {
        setRestartOpen(false);
        restartServer.mutate();
    }, [ restartServer ]);

    const onViewAll = useCallback(() => {
        setCategory('');
        setStatus(STATUS.All);
        setSearchQuery('');
    }, [ setCategory, setSearchQuery, setStatus ]);

    if (isPending) return <Loading />;

    const mainStatus = ([ STATUS.Installed, STATUS.Available, STATUS.All ] as string[]).includes(status) ? status : null;
    const restartNeeded = counts.restart > 0 || updateAllDone;

    return (
        <Page id='pluginsPage' title={globalize.translate('TabPlugins')} className='type-interior mainAnimatedPage fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('TabPlugins')}
                    subtitle={globalize.translate('PlgSubtitle')}
                    actions={(
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button variant='outlined' size='small' onClick={onRefresh} disabled={refreshing}
                                startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}>
                                {globalize.translate('PlgRefreshCatalog')}
                            </Button>
                            <Button variant='contained' size='small' component={Link} to='/dashboard/plugins/repositories' startIcon={<StorageIcon />}>
                                {globalize.translate('ManageRepositories')}
                            </Button>
                        </Box>
                    )}
                />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('PluginsLoadError')}</Alert>
                ) : (
                    <>
                        {restartNeeded && (
                            <Alert severity='warning' sx={{ mb: 2, alignItems: 'center' }} action={(
                                <Button color='inherit' size='small' startIcon={<RestartAltIcon />} onClick={openRestart} disabled={restartServer.isPending || restartServer.isSuccess}>
                                    {globalize.translate(restartServer.isSuccess ? 'PlgRestarting' : 'PlgRestartNow')}
                                </Button>
                            )}>
                                {globalize.translate('PlgRestartNeeded', counts.restart || updates.size)}
                            </Alert>
                        )}

                        {counts.updates > 0 && !updateAllDone && (
                            <Alert severity='info' icon={<SystemUpdateAltIcon />} sx={{ mb: 2, alignItems: 'center' }} action={(
                                <Button color='inherit' size='small' onClick={onUpdateAll} disabled={!!updatingAll}
                                    startIcon={updatingAll ? <CircularProgress size={14} color='inherit' /> : <SystemUpdateAltIcon />}>
                                    {updatingAll ? `${updatingAll.done}/${updatingAll.total}` : globalize.translate('PlgUpdateAll')}
                                </Button>
                            )}>
                                {globalize.translate('PlgUpdatesAvailable', counts.updates)}
                            </Alert>
                        )}

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5, mb: 2.5 }}>
                            <StatTile icon={<ExtensionIcon />} label={globalize.translate('LabelInstalled')} value={counts.installed} color='#00a4dc' active={status === STATUS.Installed} onClick={() => setStatus(STATUS.Installed)} />
                            <StatTile icon={<CheckCircleIcon />} label={globalize.translate('PlgStatusActive')} value={counts.active} color='#4caf50' active={status === STATUS.Active} onClick={() => toggleStatus(STATUS.Active)} />
                            <StatTile icon={<BlockIcon />} label={globalize.translate('PlgStatusDisabled')} value={counts.disabled} color='#90a4ae' active={status === STATUS.Disabled} onClick={() => toggleStatus(STATUS.Disabled)} />
                            <StatTile icon={<SystemUpdateAltIcon />} label={globalize.translate('PlgUpdates')} value={counts.updates} color='#ffca28' active={status === STATUS.Updates} onClick={() => toggleStatus(STATUS.Updates)} />
                            <StatTile icon={<RestartAltIcon />} label={globalize.translate('PlgStatusRestart')} value={counts.restart} color='#ff9800' active={status === STATUS.Restart} onClick={() => toggleStatus(STATUS.Restart)} />
                            {counts.problems > 0 && (
                                <StatTile icon={<ErrorIcon />} label={globalize.translate('PlgProblems')} value={counts.problems} color='#ef5350' active={status === STATUS.Problems} onClick={() => toggleStatus(STATUS.Problems)} />
                            )}
                            <StatTile icon={<StorefrontIcon />} label={globalize.translate('LabelAvailable')} value={counts.available} color='#aa5cc3' active={status === STATUS.Available} onClick={() => setStatus(STATUS.Available)} />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2.5 }}>
                            <TextField
                                size='small'
                                placeholder={globalize.translate('PlgSearchPlaceholder')}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                sx={{ flex: '1 1 240px', minWidth: 200 }}
                                slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment> } }}
                            />
                            <ToggleButtonGroup size='small' exclusive value={mainStatus} onChange={(_, v: string | null) => v && setStatus(v)} sx={toggleSx}>
                                <ToggleButton value={STATUS.Installed}>{globalize.translate('LabelInstalled')}</ToggleButton>
                                <ToggleButton value={STATUS.Available}>{globalize.translate('LabelAvailable')}</ToggleButton>
                                <ToggleButton value={STATUS.All}>{globalize.translate('All')}</ToggleButton>
                            </ToggleButtonGroup>
                            <TextField select size='small' label={globalize.translate('PlgCategory')} value={category} onChange={e => setCategory(e.target.value)} sx={{ minWidth: 170 }}
                                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                                <MenuItem value=''>{globalize.translate('All')}</MenuItem>
                                {Object.values(PluginCategory).map(c => <MenuItem key={c} value={c.toLowerCase()}>{categoryLabel(c)}</MenuItem>)}
                            </TextField>
                            <TextField select size='small' label={globalize.translate('LabelSortBy')} value={sort} onChange={e => setSort(e.target.value as SortKey)} sx={{ minWidth: 150 }}
                                slotProps={{ inputLabel: { shrink: true } }}>
                                <MenuItem value='name'>{globalize.translate('Name')}</MenuItem>
                                <MenuItem value='category'>{globalize.translate('PlgCategory')}</MenuItem>
                                <MenuItem value='status'>{globalize.translate('LabelStatus')}</MenuItem>
                            </TextField>
                        </Box>

                        {filtered.length === 0 ? (
                            <NoPluginResults isFiltered={!!category || status !== STATUS.All || !!searchQuery} onViewAll={onViewAll} query={searchQuery} />
                        ) : groups.map(g => (
                            <Box key={g.key || 'all'} sx={{ mb: 3 }}>
                                {g.key && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#00a4dc' }}>
                                            {g.key} · {g.items.length}
                                        </Typography>
                                        <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(0,164,220,0.4), transparent)' }} />
                                    </Box>
                                )}
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 2 }}>
                                    {g.items.map(p => <PluginTile key={p.id} plugin={p} update={updates.get(p.id)} />)}
                                </Box>
                            </Box>
                        ))}
                    </>
                )}
            </Box>

            <ConfirmDialog
                open={restartOpen}
                title={globalize.translate('Restart')}
                text={globalize.translate('MessageConfirmRestart')}
                onCancel={closeRestart}
                onConfirm={doRestart}
                confirmButtonColor='warning'
                confirmButtonText={globalize.translate('Restart')}
            />
        </Page>
    );
};

Component.displayName = 'InstalledPlugins';
