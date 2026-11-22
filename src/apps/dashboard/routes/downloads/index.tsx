/**
 * Dashboard: the encrypted offline downloads of every phone and tablet, live. For each one: who and on which
 * device, what, in which quality, the step it is in (the server preparing it, downloading piece N of M, waiting
 * for Wi-Fi, paused, interrupted…), size, speed, time left, and what the server's conversion is doing.
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React, { type FC } from 'react';

import Page from 'components/Page';
import globalize from 'lib/globalize';

import { PageHeader } from '../../components/cosmic';
import { ACTIVE, type Download, STATUS_COLORS, type Transcode, ago, bytes, duration, percentOf, stepText, time, useDownloadMonitor } from '../../features/downloads/monitor';

const Detail: FC<{ label: string, value: React.ReactNode }> = ({ label, value }) => (
    <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 700 }}>{value}</Typography>
    </Box>
);

const ServerWork: FC<{ t: Transcode }> = ({ t }) => {
    const parts = [
        t.CompletionPercentage != null ? globalize.translate('DmServerConverted', Math.round(t.CompletionPercentage)) : undefined,
        t.Framerate ? `${Math.round(t.Framerate)} fps` : undefined,
        t.BitRate ? `${(t.BitRate / 1_000_000).toFixed(1)} Mbps` : undefined,
        t.BytesTranscoded ? bytes(t.BytesTranscoded) : undefined
    ].filter(Boolean);
    const source = [ t.SourceVideo, t.SourceAudio ].filter(Boolean).join(' · ');
    return (
        <Box sx={{ mt: 1.5, p: 1.25, borderRadius: '12px', background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.25)' }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffb547' }}>⚙ {globalize.translate('DmServerWork')}</Typography>
            <Typography sx={{ fontSize: '0.85rem' }}>{parts.join(' · ')}</Typography>
            {source && <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{globalize.translate('DmSource', source)}</Typography>}
            {t.CompletionPercentage != null && <LinearProgress variant='determinate' value={Math.min(100, t.CompletionPercentage)} sx={{ mt: 0.75, height: 4, borderRadius: 2, '& .MuiLinearProgress-bar': { background: '#ffb547' } }} />}
        </Box>
    );
};

const DownloadCard: FC<{ d: Download }> = ({ d }) => {
    const color = STATUS_COLORS[d.Status] ?? '#90a4ae';
    const percent = percentOf(d);
    const active = ACTIVE.has(d.Status);
    const size = d.Status === 'done' ? bytes(d.Bytes) : `${bytes(d.Bytes)} / ~${bytes(Math.max(d.EstimatedBytes, d.Bytes))}`;
    return (
        <Paper sx={{ p: 2, borderRadius: '16px', borderLeft: `4px solid ${color}`, background: 'rgba(255,255,255,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.02rem' }} noWrap>{d.GroupName ? `${d.GroupName} · ${d.Name}` : d.Name}</Typography>
                    <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                        👤 {d.UserName} · 📱 {d.DeviceName}{d.Client ? ` (${d.Client})` : ''}
                    </Typography>
                </Box>
                {d.Quality && <Chip size='small' label={globalize.translate(`DlQuality${d.Quality.charAt(0).toUpperCase()}${d.Quality.slice(1)}`)} />}
                <Chip size='small' label={globalize.translate(`DmStatus_${d.Status}`)} sx={{ background: `${color}33`, color, fontWeight: 800 }} />
            </Box>

            <Typography sx={{ mt: 1.25, fontSize: '0.9rem', fontWeight: 700 }}>{stepText(d)}</Typography>
            <LinearProgress
                variant={d.Status === 'preparing' ? 'indeterminate' : 'determinate'}
                value={percent}
                sx={{ mt: 0.75, height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { background: color } }}
            />

            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' }, gap: 1.5 }}>
                <Detail label={globalize.translate('DmProgress')} value={`${percent}%`} />
                <Detail label={globalize.translate('DmSize')} value={size} />
                <Detail label={globalize.translate('DmSpeed')} value={active && d.SpeedBytesPerSecond ? `${bytes(d.SpeedBytesPerSecond)}/s` : '—'} />
                <Detail label={globalize.translate('DmTimeLeft')} value={active ? duration(d.EtaSeconds) : '—'} />
                <Detail label={globalize.translate('DmStarted')} value={`${time(d.StartedAt)} · ${globalize.translate('DmLastSignal', ago(d.UpdatedAt))}`} />
            </Box>

            {d.Transcode && <ServerWork t={d.Transcode} />}
        </Paper>
    );
};

const Tile: FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => (
    <Paper sx={{ p: 1.75, borderRadius: '14px', background: `${color}14`, border: `1px solid ${color}40` }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color, textTransform: 'uppercase' }}>{label}</Typography>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 900 }}>{value}</Typography>
    </Paper>
);

export const Component = () => {
    // Live: every two seconds
    const { data } = useDownloadMonitor(2000);

    const list = data ?? [];
    const active = list.filter(d => ACTIVE.has(d.Status));
    const rest = list.filter(d => !ACTIVE.has(d.Status));
    const speed = active.reduce((sum, d) => sum + (d.SpeedBytesPerSecond || 0), 0);
    const doneToday = list.filter(d => d.Status === 'done').length;
    const transferred = list.reduce((sum, d) => sum + d.Bytes, 0);

    return (
        <Page id='downloadMonitorPage' title={globalize.translate('DmTitle')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary'>
                <PageHeader title={globalize.translate('DmTitle')} subtitle={globalize.translate('DmSubtitle')} />

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 3 }}>
                    <Tile label={globalize.translate('DmActive')} value={String(active.length)} color='#00a4dc' />
                    <Tile label={globalize.translate('DmSpeedTotal')} value={speed ? `${bytes(speed)}/s` : '—'} color='#aa5cc3' />
                    <Tile label={globalize.translate('DmDoneToday')} value={String(doneToday)} color='#2ec4b6' />
                    <Tile label={globalize.translate('DmTransferred')} value={bytes(transferred)} color='#ffb547' />
                </Box>

                <Typography component='h2' sx={{ fontSize: '1.2rem', fontWeight: 900, mb: 1.25 }}>{globalize.translate('DmNow', active.length)}</Typography>
                {active.length === 0 && <Typography sx={{ color: 'text.secondary', mb: 3 }}>{globalize.translate('DmNothing')}</Typography>}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                    {active.map(d => <DownloadCard key={`${d.DeviceName}-${d.ItemId}`} d={d} />)}
                </Box>

                {rest.length > 0 && (
                    <>
                        <Typography component='h2' sx={{ fontSize: '1.2rem', fontWeight: 900, mb: 1.25 }}>{globalize.translate('DmRecent')}</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {rest.map(d => <DownloadCard key={`${d.DeviceName}-${d.ItemId}`} d={d} />)}
                        </Box>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'DownloadMonitorPage';
