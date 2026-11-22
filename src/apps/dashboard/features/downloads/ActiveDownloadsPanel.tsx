/**
 * Dashboard home: the offline downloads happening right now on phones and tablets (who, what, the step, progress,
 * speed, time left). Only shown while something downloads; it opens the full downloads monitor.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import DownloadingIcon from '@mui/icons-material/Downloading';
import React, { type FC } from 'react';
import { Link } from 'react-router-dom';

import globalize from 'lib/globalize';

import { ACTIVE, type Download, STATUS_COLORS, bytes, duration, percentOf, stepText, useDownloadMonitor } from './monitor';

/** Asked every few seconds: a download moves fast enough to be worth watching live. */
const POLL_MS = 3000;

const DownloadLine: FC<{ d: Download }> = ({ d }) => {
    const color = STATUS_COLORS[d.Status] ?? '#90a4ae';
    const percent = percentOf(d);
    const extra = [
        d.SpeedBytesPerSecond ? `${bytes(d.SpeedBytesPerSecond)}/s` : undefined,
        d.EtaSeconds != null ? globalize.translate('DlTimeLeft', duration(d.EtaSeconds)) : undefined
    ].filter(Boolean).join(' · ');
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.25 }}>
                <Typography noWrap sx={{ fontSize: '0.88rem', fontWeight: 700, flex: 1, minWidth: 0 }}>
                    {d.GroupName ? `${d.GroupName} · ${d.Name}` : d.Name}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color }}>{`${percent}%`}</Typography>
            </Box>
            <Typography noWrap sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>
                {`👤 ${d.UserName} · 📱 ${d.DeviceName} · ${stepText(d)}`}
            </Typography>
            <LinearProgress
                variant={d.Status === 'preparing' ? 'indeterminate' : 'determinate'}
                value={percent}
                sx={{ mt: 0.6, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { background: color } }}
            />
            {extra && <Typography sx={{ mt: 0.4, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{extra}</Typography>}
        </Box>
    );
};

const ActiveDownloadsPanel: FC = () => {
    const { data } = useDownloadMonitor(POLL_MS);
    const active = (data ?? []).filter(d => ACTIVE.has(d.Status));
    if (!active.length) return null;
    const speed = active.reduce((sum, d) => sum + (d.SpeedBytesPerSecond || 0), 0);

    return (
        <Paper elevation={0} sx={{ position: 'relative', overflow: 'hidden', p: 2, borderRadius: '16px', border: '1px solid rgba(170,92,195,0.35)', boxShadow: '0 0 22px rgba(170,92,195,0.12)' }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '2px', background: 'linear-gradient(90deg, transparent, #aa5cc3, #00a4dc, transparent)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <DownloadingIcon sx={{ color: '#aa5cc3' }} />
                <Typography sx={{ fontWeight: 800 }}>{globalize.translate('DlInProgress', active.length)}</Typography>
                {speed > 0 && <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>{`${bytes(speed)}/s`}</Typography>}
                <Button component={Link} to='/dashboard/downloads' size='small' sx={{ ml: 'auto' }}>{globalize.translate('DmSeeAll')}</Button>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5 }}>
                {active.map(d => <DownloadLine key={`${d.DeviceName}-${d.ItemId}`} d={d} />)}
            </Box>
        </Paper>
    );
};

export default ActiveDownloadsPanel;
