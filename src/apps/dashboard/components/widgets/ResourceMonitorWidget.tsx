import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import MemoryIcon from '@mui/icons-material/Memory';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import SpeedIcon from '@mui/icons-material/Speed';
import TransformIcon from '@mui/icons-material/Transform';
import React, { type FC, useEffect, useId, useMemo, useState } from 'react';

import useLiveSessions from 'apps/dashboard/features/sessions/hooks/useLiveSessions';
import { useServerResources } from 'apps/dashboard/features/resources/api/useServerResources';
import playmethodhelper from 'components/playback/playmethodhelper';
import globalize from 'lib/globalize';
import { getReadableSize } from 'utils/file';

import Widget from './Widget';

const HISTORY_LENGTH = 40;

const COLORS = {
    cpu: '#00a4dc',
    memory: '#aa5cc3',
    network: '#4caf50',
    transcode: '#ff9800'
};

const METHOD_COLORS: Record<string, string> = {
    DirectPlay: '#4caf50',
    DirectStream: '#26c6da',
    Remux: '#26c6da',
    Transcode: '#ff9800'
};

const METHOD_LABELS: Record<string, string> = {
    DirectPlay: 'DirectPlaying',
    DirectStream: 'DirectStreaming',
    Remux: 'Remuxing',
    Transcode: 'Transcoding'
};

/** Bits per second, readable (kbps / Mbps / Gbps). */
const formatBitrate = (bitsPerSecond?: number | null) => {
    if (bitsPerSecond == null) return '—';
    if (bitsPerSecond >= 1e9) return `${(bitsPerSecond / 1e9).toFixed(2)} Gbps`;
    if (bitsPerSecond >= 1e6) return `${(bitsPerSecond / 1e6).toFixed(1)} Mbps`;
    return `${Math.round(bitsPerSecond / 1e3)} kbps`;
};

const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
};

/** Tiny SVG area chart of the last values (0..max). */
const Sparkline: FC<{ values: number[]; color: string; max?: number }> = ({ values, color, max }) => {
    const id = useId().replace(/:/g, '');
    const top = Math.max(max ?? 0, ...values, 1);
    const points = values.map((v, i) => {
        const x = values.length > 1 ? (i / (HISTORY_LENGTH - 1)) * 100 : 100;
        const y = 30 - (v / top) * 28;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const offset = (HISTORY_LENGTH - values.length) / (HISTORY_LENGTH - 1) * 100;
    const shifted = points.map(p => {
        const [ x, y ] = p.split(',').map(Number);
        return `${(x + offset).toFixed(2)},${y}`;
    });

    return (
        <Box component='svg' viewBox='0 0 100 30' preserveAspectRatio='none' sx={{ width: '100%', height: 36, display: 'block' }}>
            <defs>
                <linearGradient id={`spark-${id}`} x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor={color} stopOpacity='0.35' />
                    <stop offset='100%' stopColor={color} stopOpacity='0' />
                </linearGradient>
            </defs>
            {shifted.length > 1 && (
                <>
                    <polygon points={`${shifted[0].split(',')[0]},30 ${shifted.join(' ')} 100,30`} fill={`url(#spark-${id})`} />
                    <polyline points={shifted.join(' ')} fill='none' stroke={color} strokeWidth='1.5' vectorEffect='non-scaling-stroke' strokeLinejoin='round' />
                </>
            )}
        </Box>
    );
};

interface TileProps {
    icon: React.ReactNode;
    label: string;
    color: string;
    value?: React.ReactNode;
    secondary?: React.ReactNode;
    percent?: number | null;
    history: number[];
    historyMax?: number;
}

const Tile: FC<TileProps> = ({ icon, label, color, value, secondary, percent, history, historyMax }) => (
    <Box sx={{
        p: 1.5, pb: 1, borderRadius: '14px', minWidth: 0, display: 'flex', flexDirection: 'column',
        background: `linear-gradient(160deg, ${color}12, rgba(255,255,255,0.02))`, border: `1px solid ${color}30`
    }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color, '& svg': { fontSize: '1rem' } }}>
            {icon}
            <Typography sx={{ fontSize: '0.68rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700 }}>{label}</Typography>
        </Box>
        <Typography component='div' sx={{ fontSize: '1.55rem', fontWeight: 700, color: '#fff', lineHeight: 1.25, mt: 0.5 }}>
            {value ?? <Skeleton width={60} />}
        </Typography>
        <Typography component='div' sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', minHeight: '1.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {secondary}
        </Typography>
        {percent != null && (
            <LinearProgress variant='determinate' value={Math.min(100, percent)} sx={{
                mt: 0.75, height: 5, '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${color}, ${color}aa)`, borderRadius: 4 }
            }} />
        )}
        <Box sx={{ mt: 'auto', pt: 0.75 }}>
            <Sparkline values={history} color={color} max={historyMax} />
        </Box>
    </Box>
);

export const StreamRow: FC<{ session: SessionInfoDto }> = ({ session }) => {
    const method: string = playmethodhelper.getDisplayPlayMethod(session) || 'DirectPlay';
    const color = METHOD_COLORS[method] ?? '#00a4dc';
    const item = session.NowPlayingItem;
    const title = item?.SeriesName ? `${item.SeriesName} — ${item.Name}` : item?.Name;
    const info = session.TranscodingInfo;
    const reasons = (info?.TranscodeReasons as string[] | undefined) ?? [];
    const position = session.PlayState?.PositionTicks;
    const runtime = item?.RunTimeTicks;
    const details = [
        info?.VideoCodec && info.AudioCodec ? `${info.VideoCodec.toUpperCase()} / ${info.AudioCodec.toUpperCase()}` : null,
        info?.HardwareAccelerationType && info.HardwareAccelerationType !== 'none' ? `HW: ${info.HardwareAccelerationType}` : null,
        info?.Bitrate ? formatBitrate(info.Bitrate) : null,
        info?.Framerate ? `${Math.round(info.Framerate)} fps` : null
    ].filter(Boolean).join(' · ');

    return (
        <Box sx={{ p: 1.25, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[ session.UserName, session.DeviceName, session.Client ].filter(Boolean).join(' · ')}
                        {session.PlayState?.IsPaused ? ` · ${globalize.translate('ButtonPause')}` : ''}
                    </Typography>
                </Box>
                <Box sx={{
                    px: 1, py: 0.25, borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
                    color, background: `${color}1f`, border: `1px solid ${color}55`
                }}>
                    {globalize.translate(METHOD_LABELS[method] ?? method)}
                </Box>
            </Box>
            {details && (
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>{details}</Typography>
            )}
            {method === 'Transcode' && reasons.length > 0 && (
                <Box sx={{ mt: 0.75 }}>
                    <Typography sx={{ fontSize: '0.64rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700, color: `${color}cc`, mb: 0.5 }}>
                        {globalize.translate('LabelReasonForTranscoding')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {reasons.map(reason => (
                            <Box key={reason} sx={{
                                px: 0.75, py: 0.2, borderRadius: '6px', fontSize: '0.68rem', lineHeight: 1.5,
                                color: 'rgba(255,255,255,0.85)', background: `${color}14`, border: `1px solid ${color}40`
                            }}>
                                {globalize.translate(reason)}
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}
            {position != null && runtime ? (
                <LinearProgress variant='determinate' value={(position / runtime) * 100} sx={{
                    mt: 0.75, height: 3, '& .MuiLinearProgress-bar': { background: color }
                }} />
            ) : null}
        </Box>
    );
};

const ResourceMonitorWidget = () => {
    const { data: resources, isError, dataUpdatedAt } = useServerResources();
    const { data: sessions } = useLiveSessions();

    const [ history, setHistory ] = useState<{ cpu: number[]; memory: number[]; rx: number[]; tx: number[]; transcodes: number[] }>({
        cpu: [], memory: [], rx: [], tx: [], transcodes: []
    });

    const streams = useMemo(() => (sessions ?? []).filter(s => s.NowPlayingItem), [ sessions ]);
    const transcodes = useMemo(() => streams.filter(s => playmethodhelper.getDisplayPlayMethod(s) === 'Transcode'), [ streams ]);
    const streamBitrate = useMemo(() => transcodes.reduce((sum, s) => sum + (s.TranscodingInfo?.Bitrate ?? 0), 0), [ transcodes ]);

    const memoryUsed = resources ? (resources.ContainerMemoryUsedBytes ?? resources.ProcessMemoryBytes) : undefined;
    const memoryTotal = resources ? (resources.ContainerMemoryLimitBytes ?? resources.MemoryTotalBytes ?? undefined) : undefined;
    const memoryPercent = memoryUsed != null && memoryTotal ? (memoryUsed / memoryTotal) * 100 : null;

    useEffect(() => {
        if (!resources) return;
        const push = (list: number[], value: number) => [ ...list, value ].slice(-HISTORY_LENGTH);
        setHistory(prev => ({
            cpu: push(prev.cpu, resources.CpuUsagePercent ?? resources.ProcessCpuPercent),
            memory: push(prev.memory, memoryPercent ?? 0),
            rx: push(prev.rx, (resources.NetworkReceiveBytesPerSecond ?? 0) * 8),
            tx: push(prev.tx, (resources.NetworkTransmitBytesPerSecond ?? 0) * 8),
            transcodes: push(prev.transcodes, transcodes.length)
        }));
        // Only on new samples
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ dataUpdatedAt ]);

    const cpu = resources ? (resources.CpuUsagePercent ?? resources.ProcessCpuPercent) : undefined;
    const netHistory = history.tx.map((v, i) => v + (history.rx[i] ?? 0));

    const live = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mr: 0.5 }}>
            <Box sx={{
                width: 8, height: 8, borderRadius: '50%', background: isError ? '#ef5350' : '#4caf50',
                boxShadow: `0 0 8px ${isError ? '#ef5350' : '#4caf50'}`,
                animation: isError ? 'none' : 'resourcePulse 2s ease-in-out infinite',
                '@keyframes resourcePulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.35 } }
            }} />
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1px', color: isError ? '#ef5350' : '#4caf50', textTransform: 'uppercase' }}>
                {isError ? globalize.translate('ResourceUnavailable') : globalize.translate('ResourceLive')}
            </Typography>
        </Box>
    );

    return (
        <Widget
            title={globalize.translate('ResourceMonitor')}
            icon={<MonitorHeartIcon />}
            accentColor='#00a4dc'
            headerExtra={live}
        >
            <Box sx={{ px: 1 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.25 }}>
                    <Tile
                        icon={<SpeedIcon />}
                        label={globalize.translate('ResourceCpu')}
                        color={COLORS.cpu}
                        value={cpu != null ? `${cpu.toFixed(0)}%` : undefined}
                        secondary={resources ? `Jellyfin ${resources.ProcessCpuPercent.toFixed(1)}% · ${globalize.translate('ResourceCores', resources.CpuCores)}` : null}
                        percent={cpu}
                        history={history.cpu}
                        historyMax={100}
                    />
                    <Tile
                        icon={<MemoryIcon />}
                        label={globalize.translate('ResourceMemory')}
                        color={COLORS.memory}
                        value={memoryUsed != null ? getReadableSize(memoryUsed) : undefined}
                        secondary={resources && memoryTotal ? `${globalize.translate('ResourceOf', getReadableSize(memoryTotal))} · Jellyfin ${getReadableSize(resources.ProcessMemoryBytes)}` : null}
                        percent={memoryPercent}
                        history={history.memory}
                        historyMax={100}
                    />
                    <Tile
                        icon={<NetworkCheckIcon />}
                        label={globalize.translate('ResourceNetwork')}
                        color={COLORS.network}
                        value={resources ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', fontSize: '0.95rem', lineHeight: 1.45 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <ArrowUpwardIcon sx={{ fontSize: '0.95rem', color: COLORS.network }} />
                                    {formatBitrate((resources.NetworkTransmitBytesPerSecond ?? 0) * 8)}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <ArrowDownwardIcon sx={{ fontSize: '0.95rem', color: '#26c6da' }} />
                                    {formatBitrate((resources.NetworkReceiveBytesPerSecond ?? 0) * 8)}
                                </Box>
                            </Box>
                        ) : undefined}
                        secondary={resources?.NetworkTransmitTotalBytes != null ? `↑ ${getReadableSize(resources.NetworkTransmitTotalBytes)} · ↓ ${getReadableSize(resources.NetworkReceiveTotalBytes ?? 0)}` : null}
                        history={netHistory}
                    />
                    <Tile
                        icon={<TransformIcon />}
                        label={globalize.translate('ResourceTranscodes')}
                        color={COLORS.transcode}
                        value={resources || sessions ? String(transcodes.length) : undefined}
                        secondary={`${globalize.translate('ResourceStreams', streams.length)}${streamBitrate ? ` · ${formatBitrate(streamBitrate)}` : ''}`}
                        history={history.transcodes}
                        historyMax={2}
                    />
                </Box>

                {resources && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                        {[
                            [ globalize.translate('ResourceUptime'), formatUptime(resources.UptimeSeconds) ],
                            resources.LoadAverage ? [ globalize.translate('ResourceLoad'), resources.LoadAverage.map(v => v.toFixed(2)).join(' / ') ] : null,
                            [ globalize.translate('ResourceThreads'), String(resources.ThreadCount) ],
                            [ 'FFmpeg', String(resources.FfmpegProcessCount) ],
                            [ 'Heap', getReadableSize(resources.ManagedHeapBytes) ]
                        ].filter((x): x is string[] => Boolean(x)).map(([ label, value ]) => (
                            <Box key={label} sx={{
                                px: 1.25, py: 0.5, borderRadius: '10px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(0,164,220,0.12)', color: 'rgba(255,255,255,0.5)'
                            }}>
                                {label}: <Box component='span' sx={{ color: 'rgba(255,255,255,0.88)', fontWeight: 600 }}>{value}</Box>
                            </Box>
                        ))}
                    </Box>
                )}

                <Typography sx={{ fontSize: '0.68rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,0.45)', mt: 2, mb: 1 }}>
                    {globalize.translate('ResourceActiveStreams')} ({streams.length})
                </Typography>
                {streams.length > 0 ? (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
                        {streams.map(s => <StreamRow key={s.Id} session={s} />)}
                    </Box>
                ) : (
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', pb: 0.5 }}>
                        {globalize.translate('ResourceNoStreams')}
                    </Typography>
                )}
            </Box>
        </Widget>
    );
};

export default ResourceMonitorWidget;
