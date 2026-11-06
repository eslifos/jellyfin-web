import React, { type FC, useCallback, useMemo, useState } from 'react';
import type { DeviceInfoDto } from '@jellyfin/sdk/lib/generated-client/models/device-info-dto';
import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AppsIcon from '@mui/icons-material/Apps';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import CloseIcon from '@mui/icons-material/Close';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DevicesIcon from '@mui/icons-material/Devices';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SearchIcon from '@mui/icons-material/Search';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';

import { useDeleteDevice } from 'apps/dashboard/features/devices/api/useDeleteDevice';
import { useDevices } from 'apps/dashboard/features/devices/api/useDevices';
import { useUpdateDevice } from 'apps/dashboard/features/devices/api/useUpdateDevice';
import {
    DAY_MS,
    DeviceCardsView,
    deviceName,
    DeviceTableView,
    getStatus,
    INACTIVE_DAYS,
    useAppNames
} from 'apps/dashboard/features/devices/components/DeviceViews';
import { useSendMessage } from 'apps/dashboard/features/sessions/api/useSendMessage';
import useLiveSessions from 'apps/dashboard/features/sessions/hooks/useLiveSessions';
import ConfirmDialog from 'components/ConfirmDialog';
import InputDialog from 'components/InputDialog';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { useUsersDetails } from 'hooks/useUsers';
import globalize from 'lib/globalize';

import { PageHeader } from '../../components/cosmic';

type ViewMode = 'cards' | 'table';
type Filter = 'all' | 'online' | 'playing' | 'today' | 'inactive';
type Sort = 'activity' | 'name' | 'user' | 'app';

const VIEW_KEY = 'dashboardDevicesView';

const readView = (): ViewMode => {
    try {
        return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
    } catch {
        return 'cards';
    }
};

const time = (date?: string | null) => (date ? Date.parse(date) : 0);

const StatTile: FC<{ icon: React.ReactNode; label: string; value: number; color: string; active?: boolean; onClick?: () => void }> = ({ icon, label, value, color, active, onClick }) => (
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
            <Typography sx={{ fontSize: '1.45rem', fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{value}</Typography>
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

export const Component = () => {
    const { api } = useApi();
    const { data, isLoading: isDevicesLoading, isError: isDevicesError } = useDevices({});
    const { usersById: users, isLoading: isUsersLoading, isError: isUsersError } = useUsersDetails();
    const { data: liveSessions } = useLiveSessions();
    const deleteDevice = useDeleteDevice();
    const updateDevice = useUpdateDevice();
    const sendMessage = useSendMessage();

    const [ view, setView ] = useState<ViewMode>(readView);
    const [ search, setSearch ] = useState('');
    const [ filter, setFilter ] = useState<Filter>('all');
    const [ sort, setSort ] = useState<Sort>('activity');
    const [ userFilter, setUserFilter ] = useState('');
    const [ appFilter, setAppFilter ] = useState('');
    const [ deviceToDelete, setDeviceToDelete ] = useState<DeviceInfoDto | null>(null);
    const [ deviceToRename, setDeviceToRename ] = useState<DeviceInfoDto | null>(null);
    const [ messageSession, setMessageSession ] = useState<SessionInfoDto | null>(null);
    const [ bulkDelete, setBulkDelete ] = useState<'inactive' | 'all' | null>(null);

    const devices = useMemo(() => data?.Items || [], [ data ]);
    const currentDeviceId = api?.deviceInfo.id;
    const appNames = useAppNames(devices);

    /** DeviceId -> live session (only sessions active in the last minutes). */
    const sessions = useMemo(() => {
        const map: Record<string, SessionInfoDto> = {};
        for (const s of liveSessions || []) {
            if (s.DeviceId && (!map[s.DeviceId] || s.NowPlayingItem)) map[s.DeviceId] = s;
        }
        return map;
    }, [ liveSessions ]);

    const userOptions = useMemo(() => (
        Array.from(new Set(devices.map(d => d.LastUserName).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))
    ), [ devices ]);

    const stats = useMemo(() => {
        let online = 0, playing = 0, today = 0, inactive = 0;
        for (const d of devices) {
            const status = getStatus(d, d.Id ? sessions[d.Id] : undefined);
            if (status === 'playing') playing++;
            if (status === 'online' || status === 'playing') online++;
            if (status === 'inactive') inactive++;
            if (Date.now() - time(d.DateLastActivity) < DAY_MS) today++;
        }
        return { total: devices.length, online, playing, today, inactive };
    }, [ devices, sessions ]);

    const inactiveDevices = useMemo(() => devices.filter(d => d.Id !== currentDeviceId && getStatus(d, d.Id ? sessions[d.Id] : undefined) === 'inactive'), [ devices, sessions, currentDeviceId ]);

    const visibleDevices = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return devices
            .filter(d => !query || [ deviceName(d), d.Name, d.AppName, d.LastUserName ].some(v => (v || '').toLocaleLowerCase().includes(query)))
            .filter(d => !userFilter || d.LastUserName === userFilter)
            .filter(d => !appFilter || d.AppName === appFilter)
            .filter(d => {
                const status = getStatus(d, d.Id ? sessions[d.Id] : undefined);
                switch (filter) {
                    case 'online': return status === 'online' || status === 'playing';
                    case 'playing': return status === 'playing';
                    case 'today': return Date.now() - time(d.DateLastActivity) < DAY_MS;
                    case 'inactive': return status === 'inactive';
                    default: return true;
                }
            })
            .sort((a, b) => {
                switch (sort) {
                    case 'name': return deviceName(a).localeCompare(deviceName(b));
                    case 'user': return (a.LastUserName || '').localeCompare(b.LastUserName || '');
                    case 'app': return (a.AppName || '').localeCompare(b.AppName || '');
                    default: return time(b.DateLastActivity) - time(a.DateLastActivity);
                }
            });
    }, [ devices, sessions, search, filter, sort, userFilter, appFilter ]);

    const onViewChange = useCallback((_: unknown, value: ViewMode | null) => {
        if (!value) return;
        setView(value);
        try {
            localStorage.setItem(VIEW_KEY, value);
        } catch {
            // ignore storage errors
        }
    }, []);

    const toggleFilter = (value: Filter) => () => setFilter(current => (current === value ? 'all' : value));

    const onConfirmDelete = useCallback(() => {
        if (deviceToDelete?.Id) deleteDevice.mutate({ id: [ deviceToDelete.Id ] });
        setDeviceToDelete(null);
    }, [ deviceToDelete, deleteDevice ]);

    const onConfirmBulkDelete = useCallback(() => {
        const targets = bulkDelete === 'inactive' ? inactiveDevices : devices.filter(d => d.Id && d.Id !== currentDeviceId);
        setBulkDelete(null);
        Promise.all(targets.map(d => (d.Id ? deleteDevice.mutateAsync({ id: [ d.Id ] }) : Promise.resolve())))
            .catch(err => console.error('[DevicesPage] failed deleting devices', err));
    }, [ bulkDelete, inactiveDevices, devices, currentDeviceId, deleteDevice ]);

    const onRename = useCallback((newName: string) => {
        const device = deviceToRename;
        setDeviceToRename(null);
        if (!device?.Id) return;
        const trimmed = newName.trim();
        // Empty or the original name removes the custom name
        updateDevice.mutate({
            id: device.Id,
            deviceOptionsDto: { CustomName: trimmed && trimmed !== device.Name ? trimmed : undefined }
        });
    }, [ deviceToRename, updateDevice ]);

    const onSendMessage = useCallback((text: string) => {
        if (messageSession?.Id && text.trim()) {
            sendMessage.mutate({ sessionId: messageSession.Id, messageCommand: { Text: text, TimeoutMs: 5000 } });
        }
        setMessageSession(null);
    }, [ messageSession, sendMessage ]);

    const closeDelete = useCallback(() => setDeviceToDelete(null), []);
    const closeBulk = useCallback(() => setBulkDelete(null), []);
    const closeRename = useCallback(() => setDeviceToRename(null), []);
    const closeMessage = useCallback(() => setMessageSession(null), []);
    const askInactive = useCallback(() => setBulkDelete('inactive'), []);
    const askAll = useCallback(() => setBulkDelete('all'), []);
    const clearSearch = useCallback(() => setSearch(''), []);

    if (isDevicesLoading || isUsersLoading) return <Loading />;

    const viewProps = {
        devices: visibleDevices,
        sessions,
        users,
        currentDeviceId,
        onRename: setDeviceToRename,
        onDelete: setDeviceToDelete,
        onMessage: setMessageSession
    };

    return (
        <Page id='devicesPage' title={globalize.translate('HeaderDevices')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('HeaderDevices')}
                    subtitle={globalize.translate('DevSubtitle')}
                    actions={(
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                            <Button variant='outlined' color='warning' startIcon={<CleaningServicesIcon />} onClick={askInactive} disabled={inactiveDevices.length === 0} sx={{ borderRadius: '12px' }}>
                                {globalize.translate('DevDeleteInactive', inactiveDevices.length)}
                            </Button>
                            <Button variant='outlined' color='error' startIcon={<DeleteSweepIcon />} onClick={askAll} disabled={devices.length <= 1} sx={{ borderRadius: '12px' }}>
                                {globalize.translate('DeleteAll')}
                            </Button>
                        </Box>
                    )}
                />

                {isDevicesError || isUsersError ? (
                    <Alert severity='error'>{globalize.translate('DevicesLoadError')}</Alert>
                ) : (
                    <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 2, mb: 2.5 }}>
                            <StatTile icon={<DevicesIcon />} label={globalize.translate('DevTotal')} value={stats.total} color='#00a4dc' active={filter === 'all'} onClick={() => setFilter('all')} />
                            <StatTile icon={<WifiTetheringIcon />} label={globalize.translate('DevOnline')} value={stats.online} color='#4caf50' active={filter === 'online'} onClick={toggleFilter('online')} />
                            <StatTile icon={<PlayCircleIcon />} label={globalize.translate('DevPlaying')} value={stats.playing} color='#26c6da' active={filter === 'playing'} onClick={toggleFilter('playing')} />
                            <StatTile icon={<AppsIcon />} label={globalize.translate('DevActiveToday')} value={stats.today} color='#aa5cc3' active={filter === 'today'} onClick={toggleFilter('today')} />
                            <StatTile icon={<HistoryToggleOffIcon />} label={globalize.translate('DevInactive', INACTIVE_DAYS)} value={stats.inactive} color='#ff9800' active={filter === 'inactive'} onClick={toggleFilter('inactive')} />
                        </Box>

                        <Paper elevation={0} sx={{ p: 1.5, mb: 2.5, borderRadius: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                            <TextField
                                size='small'
                                placeholder={globalize.translate('DevSearch')}
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
                            <TextField select size='small' value={userFilter} onChange={e => setUserFilter(e.target.value)} sx={{ minWidth: 160 }} slotProps={{ select: { displayEmpty: true } }}>
                                <MenuItem value=''>{globalize.translate('DevAllUsers')}</MenuItem>
                                {userOptions.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                            </TextField>
                            <TextField select size='small' value={appFilter} onChange={e => setAppFilter(e.target.value)} sx={{ minWidth: 160 }} slotProps={{ select: { displayEmpty: true } }}>
                                <MenuItem value=''>{globalize.translate('DevAllApps')}</MenuItem>
                                {appNames.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                            </TextField>
                            <TextField select size='small' value={sort} onChange={e => setSort(e.target.value as Sort)} sx={{ minWidth: 170 }}>
                                <MenuItem value='activity'>{globalize.translate('DevSortActivity')}</MenuItem>
                                <MenuItem value='name'>{globalize.translate('DevSortName')}</MenuItem>
                                <MenuItem value='user'>{globalize.translate('DevSortUser')}</MenuItem>
                                <MenuItem value='app'>{globalize.translate('DevSortApp')}</MenuItem>
                            </TextField>
                            <ToggleButtonGroup exclusive size='small' value={view} onChange={onViewChange} sx={toggleSx}>
                                <ToggleButton value='cards'><ViewModuleIcon fontSize='small' />{globalize.translate('DevViewCards')}</ToggleButton>
                                <ToggleButton value='table'><TableRowsIcon fontSize='small' />{globalize.translate('DevViewTable')}</ToggleButton>
                            </ToggleButtonGroup>
                        </Paper>

                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', mb: 1.5 }}>
                            {globalize.translate('DevShowing', visibleDevices.length, devices.length)}
                        </Typography>

                        {visibleDevices.length === 0 ? (
                            <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: '16px' }}>
                                <DevicesIcon sx={{ fontSize: 48, color: 'rgba(0,164,220,0.5)', mb: 1 }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>{globalize.translate('DevNoResults')}</Typography>
                            </Paper>
                        ) : view === 'table' ? <DeviceTableView {...viewProps} /> : <DeviceCardsView {...viewProps} />}
                    </>
                )}
            </Box>

            <ConfirmDialog
                open={!!deviceToDelete}
                title={globalize.translate('HeaderDeleteDevice')}
                text={`${globalize.translate('DeleteDeviceConfirmation')}\n\n${deviceToDelete ? deviceName(deviceToDelete) : ''}`}
                onCancel={closeDelete}
                onConfirm={onConfirmDelete}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('Delete')}
            />
            <ConfirmDialog
                open={!!bulkDelete}
                title={globalize.translate('HeaderDeleteDevices')}
                text={bulkDelete === 'inactive'
                    ? globalize.translate('DevDeleteInactiveConfirm', inactiveDevices.length, INACTIVE_DAYS)
                    : globalize.translate('DeleteDevicesConfirmation')}
                onCancel={closeBulk}
                onConfirm={onConfirmBulkDelete}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('Delete')}
            />
            {deviceToRename && (
                <InputDialog
                    open
                    title={globalize.translate('DevRename')}
                    label={globalize.translate('LabelDevice')}
                    helperText={globalize.translate('DevRenameHelp', deviceToRename.Name || '')}
                    initialText={deviceName(deviceToRename)}
                    confirmButtonText={globalize.translate('Save')}
                    onClose={closeRename}
                    onConfirm={onRename}
                />
            )}
            <InputDialog
                open={!!messageSession}
                title={globalize.translate('HeaderSendMessage')}
                label={globalize.translate('LabelMessageText')}
                confirmButtonText={globalize.translate('ButtonSend')}
                onClose={closeMessage}
                onConfirm={onSendMessage}
            />
        </Page>
    );
};

Component.displayName = 'DevicesPage';
