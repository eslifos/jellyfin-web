/**
 * What the home screen shows when there is nothing to watch yet:
 *  - a scan in progress (administrators, who can see it): its progress, and that the content will show up;
 *  - no library: administrators can add one, everyone else is told who can;
 *  - libraries without content: administrators go to their libraries, everyone else is told who can help;
 *  - the server still preparing the home screen: the usual notice.
 * The scan progress is the dashboard's (useLibraryScans / ScanRow).
 */
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import React, { type FC, type ReactNode, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { useLibraryActivity } from 'apps/dashboard/features/libraries/api/useLibraryActivity';
import { useLibraryScans } from 'apps/dashboard/features/libraries/api/useLibraryScans';
import { ActivityRow, BUSY_SPIN, ScanRow, spinSx } from 'apps/dashboard/features/libraries/components/LibraryScansPanel';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { TEXT_SECONDARY } from 'themes/cosmic/textColors';
import { queryClient } from 'utils/query/queryClient';

/** While a scan runs, the home screen is asked again this often, so what is found shows up. */
const REFRESH_WHILE_SCANNING = 30 * 1000;
/** Files being read shown under the scans. */
const ACTIVITY_ROWS = 3;

interface HomeEmptyStateProps {
    /** The user can see at least one library. */
    hasLibraries: boolean;
    /** The server has prepared the home screen (HomeFeed). */
    ready: boolean;
}

const Panel: FC<{ icon: ReactNode, title: string, text: string, children?: ReactNode }> = ({ icon, title, text, children }) => (
    <Box
        component='section'
        aria-live='polite'
        sx={{
            mx: 'var(--qh-gutter, 4%)', my: 3, p: { xs: 2.5, sm: 3.5 }, maxWidth: 720,
            borderRadius: '20px', border: '1px solid rgba(0,164,220,0.22)',
            background: 'linear-gradient(160deg, rgba(0,164,220,0.08), rgba(170,92,195,0.06))',
            boxShadow: '0 0 28px rgba(0,164,220,0.08)'
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{
                width: 44, height: 44, flexShrink: 0, borderRadius: '14px', display: 'grid', placeItems: 'center',
                color: '#00a4dc', background: 'rgba(0,164,220,0.14)', border: '1px solid rgba(0,164,220,0.3)'
            }}>
                {icon}
            </Box>
            <Typography component='h2' sx={{ fontSize: { xs: '1.15rem', sm: '1.35rem' }, fontWeight: 800, lineHeight: 1.25 }}>{title}</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.95rem', color: TEXT_SECONDARY, lineHeight: 1.55 }}>{text}</Typography>
        {children}
    </Box>
);

const buttonSx = {
    mt: 2.5, minHeight: 44, px: 2.5, borderRadius: '12px', fontWeight: 700, textTransform: 'none',
    background: 'linear-gradient(135deg, #00a4dc, #0077b6)'
} as const;

const HomeEmptyState: FC<HomeEmptyStateProps> = ({ hasLibraries, ready }) => {
    const { user } = useApi();
    const isAdmin = !!user?.Policy?.IsAdministrator;
    // Only administrators get the scans from the server (empty for everyone else)
    const scans = useLibraryScans();
    const activity = useLibraryActivity(scans.length > 0);
    const scanning = scans.length > 0;

    useEffect(() => {
        if (!scanning) return;
        const timer = setInterval(() => {
            void queryClient.invalidateQueries({ queryKey: [ 'QuickHome', user?.Id ] });
        }, REFRESH_WHILE_SCANNING);
        return () => clearInterval(timer);
    }, [ scanning, user?.Id ]);

    if (scanning) {
        return (
            <Panel
                icon={<SyncRoundedIcon className={BUSY_SPIN} sx={spinSx} />}
                title={globalize.translate('QhEmptyScanTitle')}
                text={globalize.translate('QhEmptyScanText')}
            >
                <Box sx={{ display: 'grid', gap: 1.75, mt: 2.5 }}>
                    {scans.map(scan => <ScanRow key={scan.id} scan={scan} />)}
                    {activity.current.length > 0 && (
                        <Box sx={{ display: 'grid', gap: 0.9, pl: 1.25, borderLeft: '2px solid rgba(255,255,255,0.08)' }}>
                            {activity.current.slice(0, ACTIVITY_ROWS).map(a => <ActivityRow key={`${a.ItemId ?? a.Title}-${a.Kind}`} item={a} />)}
                        </Box>
                    )}
                </Box>
            </Panel>
        );
    }

    // The server is still preparing the home screen: its usual notice
    if (!ready) return <p className='qh-preparing'>{globalize.translate('QhPreparing')}</p>;

    if (!isAdmin) {
        return <Panel icon={<MovieFilterRoundedIcon />} title={globalize.translate('QhEmptyTitle')} text={globalize.translate('QhEmptyAskAdmin')} />;
    }

    return hasLibraries ? (
        <Panel icon={<MovieFilterRoundedIcon />} title={globalize.translate('QhEmptyTitle')} text={globalize.translate('QhEmptyLibrariesText')}>
            <Button component={RouterLink} to='/dashboard/libraries' variant='contained' endIcon={<ArrowForwardRoundedIcon />} sx={buttonSx}>
                {globalize.translate('QhOpenLibraries')}
            </Button>
        </Panel>
    ) : (
        <Panel icon={<MovieFilterRoundedIcon />} title={globalize.translate('QhEmptyTitle')} text={globalize.translate('QhEmptyAddText')}>
            <Button component={RouterLink} to='/dashboard/libraries?add=1' variant='contained' startIcon={<AddRoundedIcon />} sx={buttonSx}>
                {globalize.translate('QhAddLibrary')}
            </Button>
        </Panel>
    );
};

export default HomeEmptyState;
