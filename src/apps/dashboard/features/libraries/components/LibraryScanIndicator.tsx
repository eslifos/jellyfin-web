/**
 * What the server is doing with the libraries (administrators only): a scanner button always in the bottom
 * navigation of the app. Quiet while nothing runs; lit, with a ring (and the percent when known), while a library
 * is scanned or a task runs. It opens the detail: scans in progress, the file being worked on and running tasks;
 * when nothing runs, a way to scan every library. (The dashboard shows the same thing on its own pages.)
 */
import RadarRoundedIcon from '@mui/icons-material/RadarRounded';
import React, { type FC, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { Link } from 'react-router-dom';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { TEXT_SECONDARY } from 'themes/cosmic/textColors';
import { formatNumber } from 'utils/localeNumber';

import { type LibraryScan, useLibraryScans } from '../api/useLibraryScans';
import { activityLabelKey, type LibraryActivity, useLibraryActivity } from '../api/useLibraryActivity';
import { ScanActivityList } from './LibraryScansPanel';

interface LibraryScanIndicatorProps {
    /** Narrow phones: less padding. */
    compact?: boolean;
    /**
     * TV: the remote reaches it as a fixed "Server activity" entry. Elsewhere the indicator is kept out of the focus
     * order (its label changes with what runs; the mouse and touch open it).
     */
    tvEntry?: boolean;
}

const RING = 34;
const ACCENT = '#00a4dc';

interface ScanStatus {
    busy: boolean;
    /** Average progress of the scans that report it (0-100). */
    avg: number;
    detail: string;
    /** "42 %", as the language of the app writes it, when known. */
    percent: string | null;
    summary: string;
}

/** What the server is doing, in words: the file being worked on (like Plex), else the library or task name. */
const describe = (scans: LibraryScan[], activity: LibraryActivity): ScanStatus => {
    const busy = scans.length > 0 || activity.current.length > 0 || activity.tasks.length > 0;
    if (!busy) {
        const idle = globalize.translate('LibScanIdle');
        return { busy, avg: 0, detail: idle, percent: null, summary: idle };
    }
    const known = scans.filter(s => s.progress != null);
    const avg = known.length ? known.reduce((a, s) => a + (s.progress ?? 0), 0) / known.length : 0;
    const current = activity.current[0] ?? (scans.length ? activity.log[0] : undefined);
    let scanLabel: string | undefined = activity.tasks[0]?.Name ?? undefined;
    if (scans.length === 1) scanLabel = scans[0].name;
    else if (scans.length > 1) scanLabel = globalize.translate('LibScansCount', scans.length);
    const label = current?.Title || scanLabel || globalize.translate('LibScanning');
    const heading = globalize.translate(current ? activityLabelKey(current.Kind) : 'LibScanning');
    const detail = `${heading}: ${label}`;
    const percent = avg > 0 ? formatNumber(Math.floor(avg) / 100, { style: 'percent', maximumFractionDigits: 0 }) : null;
    return { busy, avg, detail, percent, summary: percent ? globalize.translate('LibScanningPercent', percent) : detail };
};

/** "Scanning libraries", "Updating libraries" (tasks), or just "Activity" while nothing runs. */
const panelTitle = (busy: boolean, scanning: boolean) => {
    if (!busy) return 'HeaderActivity';
    return scanning ? 'LibScansTitle' : 'LibActTitle';
};

/** The scanner: quiet, or lit with its ring and percent. */
const ScannerIcon: FC<{ status: ScanStatus }> = ({ status: { busy, percent, avg } }) => (
    <Box sx={{ position: 'relative', width: RING, height: RING, display: 'grid', placeItems: 'center' }}>
        {busy && (
            <CircularProgress
                size={RING}
                thickness={3}
                variant={percent ? 'determinate' : 'indeterminate'}
                value={avg}
                sx={{ position: 'absolute', inset: 0, color: ACCENT }}
            />
        )}
        <RadarRoundedIcon sx={{
            fontSize: busy ? '1.2rem' : '1.5rem',
            filter: busy ? 'drop-shadow(0 0 6px rgba(0,164,220,0.8))' : 'none',
            transition: 'all 0.2s'
        }} />
        {percent && (
            <Typography aria-hidden='true' sx={{
                position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                px: 0.5, borderRadius: '6px', background: ACCENT, color: '#04121b',
                fontSize: '0.55rem', fontWeight: 900, lineHeight: 1.35, whiteSpace: 'nowrap'
            }}>
                {percent}
            </Typography>
        )}
    </Box>
);

/** Nothing runs: say so, with a way to scan every library. */
const IdlePanel: FC = () => {
    const { api } = useApi();
    const [ state, setState ] = useState<'idle' | 'starting' | 'started'>('idle');
    const scanAll = useCallback(async () => {
        if (!api) return;
        setState('starting');
        try {
            await getLibraryApi(api).refreshLibrary();
            setState('started');
        } catch (err) {
            console.error('[LibraryScanIndicator] could not start the scan', err);
            setState('idle');
        }
    }, [ api ]);
    const onScanAll = useCallback(() => {
        void scanAll();
    }, [ scanAll ]);

    return (
        <>
            <Typography sx={{ color: TEXT_SECONDARY, mb: 1.5 }}>
                {globalize.translate(state === 'started' ? 'LibScanStarted' : 'LibScanIdle')}
            </Typography>
            <Button variant='contained' onClick={onScanAll} disabled={state !== 'idle'} sx={{ minHeight: 44, borderRadius: '999px', fontWeight: 800 }}>
                {globalize.translate('ButtonScanAllLibraries')}
            </Button>
        </>
    );
};

const LibraryScanIndicator: FC<LibraryScanIndicatorProps> = ({ compact = false, tvEntry = false }) => {
    const { user } = useApi();
    const scans = useLibraryScans();
    const [ anchor, setAnchor ] = useState<HTMLElement | null>(null);
    const activity = useLibraryActivity(scans.length > 0);
    const onOpen = useCallback((e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget), []);
    const onClose = useCallback(() => setAnchor(null), []);

    // What the server is doing is only told to administrators
    if (!user?.Policy?.IsAdministrator) return null;

    const status = describe(scans, activity);
    const { busy, detail, percent, summary } = status;
    const statusLabel = percent ? `${summary}. ${detail}` : detail;

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
                    tabIndex={tvEntry ? 0 : -1}
                    aria-label={tvEntry ? globalize.translate('ServerActivity') : statusLabel}
                    aria-haspopup='dialog'
                    data-busy={busy ? 'true' : undefined}
                    sx={{
                        // The same height as the other buttons of the bar
                        display: 'grid', placeItems: 'center', p: compact ? '4px 5px' : '4px 9px', border: 0, borderRadius: '14px',
                        flexShrink: 0, background: busy ? 'rgba(0,164,220,0.12)' : 'transparent',
                        color: busy ? ACCENT : 'rgba(255,255,255,0.55)', cursor: 'pointer',
                        '&:hover': { background: 'rgba(0,164,220,0.12)', color: ACCENT }
                    }}
                >
                    <ScannerIcon status={status} />
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
                    <Typography sx={{ fontWeight: 800, mb: 1.5 }}>{globalize.translate(panelTitle(busy, scans.length > 0))}</Typography>
                    {busy ? (
                        <Box sx={{ maxHeight: '60vh', overflowY: 'auto', pr: 0.5 }}>
                            <ScanActivityList scans={scans} activity={activity} logRows={10} />
                        </Box>
                    ) : <IdlePanel />}
                    <Box>
                        <Button
                            component={Link}
                            to='/dashboard/libraries#activity'
                            variant='text'
                            onClick={onClose}
                            sx={{
                                mt: 1, minHeight: 44, px: 1, borderRadius: '999px', fontWeight: 700,
                                // Links of the app have a filled look; this one is secondary
                                background: 'transparent !important', color: `${ACCENT} !important`,
                                '&:hover': { background: 'rgba(0,164,220,0.12) !important' }
                            }}
                        >
                            {globalize.translate('LibScanOpenLog')}
                        </Button>
                    </Box>
                </Paper>
            </Popover>
        </>
    );
};

export default LibraryScanIndicator;
