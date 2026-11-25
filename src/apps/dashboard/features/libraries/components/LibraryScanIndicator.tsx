/**
 * What the server is doing with the libraries (administrators only): scans in progress, the file being worked
 * on and running tasks. A small ring inside the bottom navigation of the app that opens the detail (the dashboard
 * shows the same thing on its own pages, so it has no indicator).
 */
import React, { type FC, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { Link } from 'react-router-dom';

import globalize from 'lib/globalize';
import { formatNumber } from 'utils/localeNumber';

import { useLibraryScans } from '../api/useLibraryScans';
import { activityLabelKey, useLibraryActivity } from '../api/useLibraryActivity';
import { ScanActivityList } from './LibraryScansPanel';

const LibraryScanIndicator: FC = () => {
    const scans = useLibraryScans();
    const [ anchor, setAnchor ] = useState<HTMLElement | null>(null);
    const activity = useLibraryActivity(scans.length > 0);
    const onOpen = useCallback((e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget), []);
    const onClose = useCallback(() => setAnchor(null), []);
    // Shown while anything runs
    if (!scans.length && !activity.current.length && !activity.tasks.length) return null;

    const known = scans.filter(s => s.progress != null);
    const avg = known.length ? known.reduce((a, s) => a + (s.progress ?? 0), 0) / known.length : 0;
    // Like Plex: the file being worked on right now, else the latest step, else the library or task name
    const current = activity.current[0] ?? (scans.length ? activity.log[0] : undefined);
    let scanLabel: string | undefined = activity.tasks[0]?.Name ?? undefined;
    if (scans.length === 1) scanLabel = scans[0].name;
    else if (scans.length > 1) scanLabel = globalize.translate('LibScansCount', scans.length);
    const label = current?.Title || scanLabel || globalize.translate('LibScanning');
    const heading = current ? globalize.translate(activityLabelKey(current.Kind)) : globalize.translate('LibScanning');
    const detail = `${heading}: ${label}`;
    // "42 %" / "42%", as the language of the app writes it
    const percent = avg > 0 ? formatNumber(Math.floor(avg) / 100, { style: 'percent', maximumFractionDigits: 0 }) : null;
    const summary = percent ? globalize.translate('LibScanningPercent', percent) : detail;

    return (
        <>
            <Tooltip
                placement='top'
                title={percent ? (
                    <>
                        <Box component='span' sx={{ display: 'block', fontWeight: 700 }}>{summary}</Box>
                        <Box component='span' sx={{ display: 'block', opacity: 0.75 }}>{detail}</Box>
                    </>
                ) : detail}
            >
                <Box
                    component='button'
                    type='button'
                    onClick={onOpen}
                    aria-label={percent ? `${summary}. ${detail}` : detail}
                    sx={{
                        // 30 px ring + padding: the same height as the other buttons of the bar
                        display: 'grid', placeItems: 'center', p: '5px 10px', border: 0, borderRadius: '14px',
                        background: 'transparent', color: '#fff', cursor: 'pointer',
                        '&:hover': { background: 'rgba(0,164,220,0.12)' }
                    }}
                >
                    <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
                        <CircularProgress size={30} thickness={4} variant={percent ? 'determinate' : 'indeterminate'} value={avg} sx={{ color: '#00a4dc' }} />
                        {percent && (
                            <Typography aria-hidden='true' sx={{ position: 'absolute', fontSize: '0.47rem', fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap', lineHeight: 1 }}>
                                {percent}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Tooltip>
            <Popover
                open={!!anchor}
                anchorEl={anchor}
                onClose={onClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                slotProps={{ paper: { sx: { background: 'none', boxShadow: 'none', mt: -1 } } }}
            >
                <Paper elevation={0} sx={{ p: 2, width: 'min(420px, 92vw)', borderRadius: '16px', background: 'rgba(14,17,34,0.97)', border: '1px solid rgba(0,164,220,0.3)' }}>
                    <Typography sx={{ fontWeight: 800, mb: 1.5 }}>{globalize.translate(scans.length ? 'LibScansTitle' : 'LibActTitle')}</Typography>
                    <Box sx={{ maxHeight: '60vh', overflowY: 'auto', pr: 0.5 }}>
                        <ScanActivityList scans={scans} activity={activity} logRows={10} />
                    </Box>
                    <Button component={Link} to='/dashboard/libraries#activity' size='small' onClick={onClose} sx={{ mt: 1.5 }}>
                        {globalize.translate('LibScanOpenLog')}
                    </Button>
                </Paper>
            </Popover>
        </>
    );
};

export default LibraryScanIndicator;
