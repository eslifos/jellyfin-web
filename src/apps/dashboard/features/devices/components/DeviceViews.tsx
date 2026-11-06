import React, { type FC, useCallback, useMemo } from 'react';
import type { DeviceInfoDto } from '@jellyfin/sdk/lib/generated-client/models/device-info-dto';
import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { PlaystateCommand } from '@jellyfin/sdk/lib/generated-client/models/playstate-command';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChatIcon from '@mui/icons-material/Chat';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

import UserAvatarButton from 'apps/dashboard/components/UserAvatarButton';
import { useSendPlayStateCommand } from 'apps/dashboard/features/sessions/api/usePlayPauseSession';
import playmethodhelper from 'components/playback/playmethodhelper';
import globalize from 'lib/globalize';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';
import { getDeviceIcon } from 'utils/image';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const INACTIVE_DAYS = 30;

const ONLINE_COLOR = '#4caf50';
const PLAYING_COLOR = '#00a4dc';
const INACTIVE_COLOR = '#ff9800';

const METHOD_LABELS: Record<string, string> = {
    Transcode: 'Transcoding',
    DirectStream: 'DirectStreaming',
    Remux: 'Remuxing',
    DirectPlay: 'DirectPlaying'
};

export type DeviceStatus = 'playing' | 'online' | 'idle' | 'inactive';

export const getStatus = (device: DeviceInfoDto, session?: SessionInfoDto): DeviceStatus => {
    if (session?.NowPlayingItem) return 'playing';
    if (session) return 'online';
    const last = device.DateLastActivity ? Date.parse(device.DateLastActivity) : 0;
    return Date.now() - last > INACTIVE_DAYS * DAY_MS ? 'inactive' : 'idle';
};

export const deviceName = (d: DeviceInfoDto) => d.CustomName || d.Name || '';

const relative = (date?: string | null) => (date ? formatDistanceToNow(new Date(date), getLocaleWithSuffix()) : globalize.translate('Never'));
const fullDate = (date?: string | null) => (date ? new Date(date).toLocaleString(globalize.getCurrentDateTimeLocale(), { dateStyle: 'long', timeStyle: 'short' }) : '');

/** Strips the port from "1.2.3.4:5678" / "[::1]:80". */
const getIp = (session?: SessionInfoDto) => {
    const ep = session?.RemoteEndPoint;
    if (!ep) return '';
    if (ep.startsWith('[')) return ep.slice(1, ep.indexOf(']'));
    return ep.split(':').length === 2 ? ep.split(':')[0] : ep;
};

const StatusBadge: FC<{ status: DeviceStatus }> = ({ status }) => {
    const map = {
        playing: { color: PLAYING_COLOR, label: globalize.translate('DevPlaying') },
        online: { color: ONLINE_COLOR, label: globalize.translate('DevOnline') },
        idle: { color: 'rgba(255,255,255,0.45)', label: globalize.translate('DevOffline') },
        inactive: { color: INACTIVE_COLOR, label: globalize.translate('DevInactive', INACTIVE_DAYS) }
    }[status];

    return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.25, borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap', color: map.color, background: `${map.color}1a`, border: `1px solid ${map.color}44` }}>
            <Box sx={{
                width: 7, height: 7, borderRadius: '50%', background: map.color,
                boxShadow: status === 'online' || status === 'playing' ? `0 0 8px ${map.color}` : 'none'
            }} />
            {map.label}
        </Box>
    );
};

export interface DeviceActions {
    onRename: (device: DeviceInfoDto) => void;
    onDelete: (device: DeviceInfoDto) => void;
    onMessage: (session: SessionInfoDto) => void;
}

interface DeviceViewProps extends DeviceActions {
    devices: DeviceInfoDto[];
    sessions: Record<string, SessionInfoDto>;
    users: Record<string, UserDto>;
    currentDeviceId?: string;
}

const NowPlaying: FC<{ session: SessionInfoDto }> = ({ session }) => {
    const sendCommand = useSendPlayStateCommand();
    const item = session.NowPlayingItem;
    const method = playmethodhelper.getDisplayPlayMethod(session) || 'DirectPlay';
    const position = session.PlayState?.PositionTicks ?? 0;
    const runtime = item?.RunTimeTicks ?? 0;
    const canControl = session.SupportsRemoteControl;

    const playPause = useCallback(() => {
        if (session.Id) sendCommand.mutate({ sessionId: session.Id, command: PlaystateCommand.PlayPause });
    }, [ session.Id, sendCommand ]);
    const stop = useCallback(() => {
        if (session.Id) sendCommand.mutate({ sessionId: session.Id, command: PlaystateCommand.Stop });
    }, [ session.Id, sendCommand ]);

    return (
        <Box sx={{ p: 1.25, borderRadius: '12px', background: `${PLAYING_COLOR}10`, border: `1px solid ${PLAYING_COLOR}30` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>
                        {item?.SeriesName ? `${item.SeriesName} — ${item.Name}` : item?.Name}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                        {globalize.translate(METHOD_LABELS[method] ?? method)}
                        {session.PlayState?.IsPaused ? ` · ${globalize.translate('ButtonPause')}` : ''}
                    </Typography>
                </Box>
                {canControl && (
                    <>
                        <IconButton size='small' onClick={playPause} sx={{ color: PLAYING_COLOR }}>
                            {session.PlayState?.IsPaused ? <PlayArrowIcon fontSize='small' /> : <PauseIcon fontSize='small' />}
                        </IconButton>
                        <IconButton size='small' onClick={stop} sx={{ color: '#ef5350' }}>
                            <StopIcon fontSize='small' />
                        </IconButton>
                    </>
                )}
            </Box>
            {runtime > 0 && (
                <LinearProgress variant='determinate' value={(position / runtime) * 100} sx={{ mt: 0.75, height: 3, '& .MuiLinearProgress-bar': { background: PLAYING_COLOR } }} />
            )}
        </Box>
    );
};

const DeviceIcon: FC<{ device: DeviceInfoDto; size?: number }> = ({ device, size = 44 }) => (
    <Box sx={{
        width: size, height: size, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)'
    }}>
        <img src={getDeviceIcon(device)} alt='' style={{ maxWidth: size * 0.62, maxHeight: size * 0.62 }} />
    </Box>
);

const InfoRow: FC<{ label: string; children: React.ReactNode; tooltip?: string }> = ({ label, children, tooltip }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{label}</Typography>
        <Tooltip title={tooltip || ''} disableHoverListener={!tooltip} placement='top'>
            <Box sx={{ ml: 'auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {children}
            </Box>
        </Tooltip>
    </Box>
);

const ActionButtons: FC<{ device: DeviceInfoDto; session?: SessionInfoDto; isCurrent: boolean } & DeviceActions> = ({ device, session, isCurrent, onRename, onDelete, onMessage }) => (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title={globalize.translate('DevRename')}>
            <IconButton size='small' onClick={() => onRename(device)} sx={{ color: 'rgba(255,255,255,0.65)' }}><EditIcon fontSize='small' /></IconButton>
        </Tooltip>
        {session?.SupportsRemoteControl && (
            <Tooltip title={globalize.translate('HeaderSendMessage')}>
                <IconButton size='small' onClick={() => onMessage(session)} sx={{ color: '#aa5cc3' }}><ChatIcon fontSize='small' /></IconButton>
            </Tooltip>
        )}
        <Tooltip title={isCurrent ? globalize.translate('DevCannotDeleteCurrent') : globalize.translate('Delete')}>
            <span>
                <IconButton size='small' disabled={isCurrent} onClick={() => onDelete(device)} sx={{ color: '#ef5350' }}><DeleteIcon fontSize='small' /></IconButton>
            </span>
        </Tooltip>
    </Box>
);

export const DeviceCardsView: FC<DeviceViewProps> = ({ devices, sessions, users, currentDeviceId, ...actions }) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 2 }}>
        {devices.map(device => {
            const session = device.Id ? sessions[device.Id] : undefined;
            const status = getStatus(device, session);
            const isCurrent = !!device.Id && device.Id === currentDeviceId;
            const user = device.LastUserId ? users[device.LastUserId] : undefined;
            const accent = status === 'playing' ? PLAYING_COLOR : status === 'online' ? ONLINE_COLOR : status === 'inactive' ? INACTIVE_COLOR : '#90a4ae';
            const mediaTypes = (device.Capabilities?.PlayableMediaTypes || []) as string[];
            const ip = getIp(session);

            return (
                <Paper key={device.Id} elevation={0} sx={{
                    position: 'relative', overflow: 'hidden', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5,
                    borderRadius: '16px', border: `1px solid ${accent}33`,
                    boxShadow: `0 8px 28px rgba(0,0,0,0.3), 0 0 18px ${accent}10`,
                    transition: 'transform 0.2s, border-color 0.2s', '&:hover': { transform: 'translateY(-2px)', borderColor: `${accent}77` }
                }}>
                    <Box sx={{ position: 'absolute', top: 0, left: '1.25rem', right: '1.25rem', height: '2px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                        <DeviceIcon device={device} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: '0.98rem', fontWeight: 700, color: '#fff' }}>{deviceName(device)}</Typography>
                            <Typography noWrap sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>
                                {[ device.AppName, device.AppVersion ].filter(Boolean).join(' ')}
                                {device.CustomName && device.Name && device.CustomName !== device.Name ? ` · ${device.Name}` : ''}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        <StatusBadge status={status} />
                        {isCurrent && <Chip size='small' label={globalize.translate('DevThisDevice')} sx={{ height: 22, fontSize: '0.66rem', fontWeight: 700, color: '#00a4dc', background: 'rgba(0,164,220,0.12)', border: '1px solid rgba(0,164,220,0.4)' }} />}
                    </Box>

                    {session?.NowPlayingItem && <NowPlaying session={session} />}

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: 1.25, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <InfoRow label={globalize.translate('LabelUser')}>
                            {user && <UserAvatarButton user={user} sx={{ '& .MuiAvatar-root': { width: 22, height: 22, fontSize: '0.7rem' } }} />}
                            {device.LastUserName || '—'}
                        </InfoRow>
                        <InfoRow label={globalize.translate('LastActive')} tooltip={fullDate(device.DateLastActivity)}>
                            {status === 'playing' || status === 'online' ? globalize.translate('DevNow') : relative(device.DateLastActivity)}
                        </InfoRow>
                        {ip && (
                            <InfoRow label={globalize.translate('DevIpAddress')}>
                                <span style={{ fontFamily: 'monospace' }}>{ip}</span>
                            </InfoRow>
                        )}
                        {mediaTypes.length > 0 && (
                            <InfoRow label={globalize.translate('DevPlays')}>
                                {mediaTypes.map(t => globalize.translate(t === 'Video' ? 'HeaderVideos' : t === 'Audio' ? 'Audio' : t)).join(', ')}
                            </InfoRow>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 'auto' }}>
                        <ActionButtons device={device} session={session} isCurrent={isCurrent} {...actions} />
                    </Box>
                </Paper>
            );
        })}
    </Box>
);

export const DeviceTableView: FC<DeviceViewProps> = ({ devices, sessions, users, currentDeviceId, ...actions }) => {
    const headSx = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.08)' };
    const cellSx = { borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.84rem' };

    return (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '16px' }}>
            <Table size='small'>
                <TableHead>
                    <TableRow>
                        <TableCell sx={headSx}>{globalize.translate('LabelDevice')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('DevStatus')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('LabelAppName')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('LabelUser')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('LastActive')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('DevIpAddress')}</TableCell>
                        <TableCell sx={headSx} align='right' />
                    </TableRow>
                </TableHead>
                <TableBody>
                    {devices.map(device => {
                        const session = device.Id ? sessions[device.Id] : undefined;
                        const status = getStatus(device, session);
                        const isCurrent = !!device.Id && device.Id === currentDeviceId;
                        const user = device.LastUserId ? users[device.LastUserId] : undefined;
                        return (
                            <TableRow key={device.Id} hover>
                                <TableCell sx={cellSx}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                                        <DeviceIcon device={device} size={32} />
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 600 }}>{deviceName(device)}</Typography>
                                            {isCurrent && <Typography sx={{ fontSize: '0.66rem', color: '#00a4dc' }}>{globalize.translate('DevThisDevice')}</Typography>}
                                        </Box>
                                    </Box>
                                </TableCell>
                                <TableCell sx={cellSx}><StatusBadge status={status} /></TableCell>
                                <TableCell sx={cellSx}>{[ device.AppName, device.AppVersion ].filter(Boolean).join(' ')}</TableCell>
                                <TableCell sx={cellSx}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {user && <UserAvatarButton user={user} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.75rem' } }} />}
                                        {device.LastUserName}
                                    </Box>
                                </TableCell>
                                <TableCell sx={cellSx}>
                                    <Tooltip title={fullDate(device.DateLastActivity)}>
                                        <span>{status === 'playing' || status === 'online' ? globalize.translate('DevNow') : relative(device.DateLastActivity)}</span>
                                    </Tooltip>
                                </TableCell>
                                <TableCell sx={{ ...cellSx, fontFamily: 'monospace', fontSize: '0.78rem' }}>{getIp(session) || '—'}</TableCell>
                                <TableCell sx={cellSx} align='right'>
                                    <ActionButtons device={device} session={session} isCurrent={isCurrent} {...actions} />
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

/** Distinct apps used by the devices, for the filter menu. */
export const useAppNames = (devices: DeviceInfoDto[]) => useMemo(() => (
    Array.from(new Set(devices.map(d => d.AppName).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))
), [ devices ]);

