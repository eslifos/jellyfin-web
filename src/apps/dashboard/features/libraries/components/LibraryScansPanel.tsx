/**
 * Libraries being scanned right now, with their progress (dashboard home and libraries page).
 */
import React, { type FC } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import SyncIcon from '@mui/icons-material/Sync';

import globalize from 'lib/globalize';

import { type LibraryScan, useLibraryScans } from '../api/useLibraryScans';
import { getLibraryAccent } from '../utils/libraryUi';

export const spinSx = { animation: 'jfScanSpin 1.4s linear infinite', '@keyframes jfScanSpin': { to: { transform: 'rotate(360deg)' } } } as const;

export const ScanRow: FC<{ scan: LibraryScan }> = ({ scan }) => {
    const accent = getLibraryAccent(scan.collectionType ?? undefined);
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{scan.name}</Typography>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: accent }}>
                    {scan.progress == null ? globalize.translate('LibScanQueued') : `${Math.floor(scan.progress)}%`}
                </Typography>
            </Box>
            <LinearProgress
                variant={scan.progress == null || scan.progress === 0 ? 'indeterminate' : 'determinate'}
                value={scan.progress ?? 0}
                sx={{ height: 6, borderRadius: 3, background: `${accent}22`, '& .MuiLinearProgress-bar': { borderRadius: 3, background: `linear-gradient(90deg, ${accent}, #aa5cc3)` } }}
            />
        </Box>
    );
};

const LibraryScansPanel: FC = () => {
    const scans = useLibraryScans();
    if (!scans.length) return null;

    return (
        <Paper elevation={0} sx={{ position: 'relative', overflow: 'hidden', p: 2, borderRadius: '16px', border: '1px solid rgba(0,164,220,0.3)', boxShadow: '0 0 22px rgba(0,164,220,0.12)' }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '2px', background: 'linear-gradient(90deg, transparent, #00a4dc, #aa5cc3, transparent)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <SyncIcon sx={{ color: '#00a4dc', ...spinSx }} />
                <Typography sx={{ fontWeight: 800 }}>{globalize.translate('LibScansTitle')}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', ml: 'auto' }}>{globalize.translate('LibScansHelp')}</Typography>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5 }}>
                {scans.map(s => <ScanRow key={s.id} scan={s} />)}
            </Box>
        </Paper>
    );
};

export default LibraryScansPanel;
