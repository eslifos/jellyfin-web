/**
 * Small floating pill (administrators only) shown on every page while a library is being scanned.
 * Click to see each library's progress; the link opens the libraries page of the dashboard.
 */
import React, { type FC, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { Link, useLocation } from 'react-router-dom';

import globalize from 'lib/globalize';

import { useLibraryScans } from '../api/useLibraryScans';
import { ScanRow } from './LibraryScansPanel';

const LibraryScanIndicator: FC = () => {
    const scans = useLibraryScans();
    const [ anchor, setAnchor ] = useState<HTMLElement | null>(null);
    const { pathname } = useLocation();
    // The dashboard home and the libraries page show the full panel already
    if (!scans.length || pathname === '/dashboard' || pathname === '/dashboard/libraries') return null;

    const known = scans.filter(s => s.progress != null);
    const avg = known.length ? known.reduce((a, s) => a + (s.progress ?? 0), 0) / known.length : 0;
    const label = scans.length === 1 ? scans[0].name : globalize.translate('LibScansCount', scans.length);

    return (
        <>
            <Box
                component='button'
                type='button'
                onClick={(e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
                aria-label={globalize.translate('LibScansTitle')}
                sx={{
                    position: 'fixed', right: { xs: 12, md: 20 }, bottom: { xs: 84, md: 96 }, zIndex: 1300,
                    display: 'flex', alignItems: 'center', gap: 1, pl: 0.75, pr: 1.6, py: 0.6, cursor: 'pointer',
                    borderRadius: '999px', color: '#fff', font: 'inherit',
                    background: 'rgba(8,10,22,0.88)', backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(0,164,220,0.45)', boxShadow: '0 8px 28px rgba(0,0,0,0.5), 0 0 18px rgba(0,164,220,0.25)'
                }}
            >
                <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
                    <CircularProgress size={30} thickness={4.5} variant={avg > 0 ? 'determinate' : 'indeterminate'} value={avg} sx={{ color: '#00a4dc' }} />
                    {avg > 0 && <Typography sx={{ position: 'absolute', fontSize: '0.55rem', fontWeight: 800 }}>{Math.floor(avg)}</Typography>}
                </Box>
                <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#00a4dc', lineHeight: 1.2 }}>
                        {globalize.translate('LibScanning')}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 700, maxWidth: 170, lineHeight: 1.2 }}>{label}</Typography>
                </Box>
            </Box>
            <Popover
                open={!!anchor}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                slotProps={{ paper: { sx: { background: 'none', boxShadow: 'none', mt: -1 } } }}
            >
                <Paper elevation={0} sx={{ p: 2, width: 300, borderRadius: '16px', background: 'rgba(14,17,34,0.97)', border: '1px solid rgba(0,164,220,0.3)' }}>
                    <Typography sx={{ fontWeight: 800, mb: 1.5 }}>{globalize.translate('LibScansTitle')}</Typography>
                    <Box sx={{ display: 'grid', gap: 1.5 }}>
                        {scans.map(s => <ScanRow key={s.id} scan={s} />)}
                    </Box>
                    <Button component={Link} to='/dashboard/libraries' size='small' onClick={() => setAnchor(null)} sx={{ mt: 1.5 }}>
                        {globalize.translate('LibScanOpen')}
                    </Button>
                </Paper>
            </Popover>
        </>
    );
};

export default LibraryScanIndicator;
