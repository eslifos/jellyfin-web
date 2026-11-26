/**
 * FloatingNav — persistent bottom navigation pill for the experimental layout.
 *
 * Renders as a glassmorphism pill fixed at the bottom center of the viewport, above the iPhone home indicator.
 * Hidden on public paths (login, wizard) and on the video player route.
 * Every page leaves room at its end for it (see bottomSpace.ts). On phones it takes the width of the screen and its
 * buttons scroll sideways when they do not fit (like the bar of the libraries), the hidden side faded. On phones and
 * tablets it steps aside while scrolling down.
 * Uses `createPortal` to escape any CSS `transform` stacking context from the parent.
 */
import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import globalize from 'lib/globalize';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DownloadForOfflineRoundedIcon from '@mui/icons-material/DownloadForOfflineRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useApi } from 'hooks/useApi';
import { PUBLIC_PATHS } from 'components/router/appRouter';
import RemotePlayButton from '../AppToolbar/RemotePlayButton';
import SyncPlayButton from '../AppToolbar/SyncPlayButton';
import UserMenuButton from 'components/toolbar/UserMenuButton';
import SearchDialog from '../SearchDialog';
import LibraryScanIndicator from 'apps/dashboard/features/libraries/components/LibraryScanIndicator';
import { downloadsAvailable } from '../../features/downloads/support';
import { hiddenBarSx, useBottomSpace, useHideOnScroll } from './bottomSpace';
import ScrollRail, { narrowBarPlacement } from './ScrollRail';
import { isSettingsSubPath } from './settingsPaths';
import { installTvBottomBar } from './tvBar';
import { ambientAnimation } from 'utils/reducedMotion';

/**
 * Phones (below the "sm" breakpoint): with every button (downloads in the app, the scanner) the bar needs about
 * 520 px, more than a phone held upright has, so there it spans the screen and scrolls sideways.
 */
export const NARROW_BAR = '(max-width: 599.98px)';

export const barBtnSx = (active: boolean, narrow: boolean) => ({
    color: active ? '#00a4dc' : 'rgba(255,255,255,0.55)',
    borderRadius: '14px',
    // Narrow phones: tighter, so the tasks ring and the profile picture still fit inside the pill
    padding: narrow ? '10px 9px' : '10px 14px',
    transition: 'all 0.2s',
    position: 'relative',
    flexShrink: 0,
    background: active ? 'rgba(0,164,220,0.15)' : 'transparent',
    '&:hover': {
        color: '#00a4dc',
        background: 'rgba(0,164,220,0.12)'
    },
    '& svg': {
        fontSize: '1.5rem',
        filter: active ? 'drop-shadow(0 0 6px rgba(0,164,220,0.7))' : 'none',
        transition: 'filter 0.2s'
    }
});

/** Look of the pill shared with the dashboard bar. */
export const barSx = {
    position: 'fixed',
    bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    px: { xs: 1, sm: 1.5 },
    py: 0.75,
    maxWidth: 'calc(100vw - 16px)',
    boxSizing: 'border-box',
    background: 'rgba(8, 10, 22, 0.82)',
    backdropFilter: 'blur(24px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
    border: '1px solid rgba(0, 164, 220, 0.2)',
    borderRadius: '50px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px rgba(0,164,220,0.1)',
    ...ambientAnimation('jf-glow-pulse 4s ease-in-out infinite'),
    // With the remote or the keyboard, the button that has the focus stands out
    '& button:focus-visible, & a:focus-visible, & .Mui-focusVisible': {
        outline: '3px solid #00a4dc',
        outlineOffset: '2px',
        color: '#fff !important',
        background: 'rgba(0,164,220,0.22) !important'
    }
} as const;

export const BarDivider = () => <Box sx={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)', mx: 0.5, flexShrink: 0 }} />;

/** Styles for the buttons made elsewhere (watch together, cast) so they match the pill. */
const toolsSx = (narrow: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    color: 'rgba(255,255,255,0.55)',
    borderRadius: '14px',
    padding: '2px',
    '& button': {
        color: 'inherit !important',
        borderRadius: '14px !important',
        padding: `${narrow ? '10px 9px' : '10px 14px'} !important`,
        '&:hover': { color: '#00a4dc !important', background: 'rgba(0,164,220,0.12) !important' }
    },
    '& svg': { fontSize: '1.5rem !important' }
});

// The remote reaches the bar on the TV layout (it acts only there)
installTvBottomBar();

const FloatingNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useApi();
    const isLoggedIn = Boolean(user);
    const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
    const [ searchOpen, setSearchOpen ] = useState(false);
    const [ searchParams ] = useSearchParams();
    const showSettingsBack = isSettingsSubPath(location.pathname);
    const shown = !(isPublicPath || location.pathname === '/video' || location.pathname === '/profiles');

    const barRef = useRef<HTMLDivElement>(null);
    const narrow = useMediaQuery(NARROW_BAR);
    const touchSized = useMediaQuery((t: Theme) => t.breakpoints.down('md'));
    const { hidden, show } = useHideOnScroll(shown && touchSized && !searchOpen);
    useBottomSpace('nav', barRef, shown);

    const goToSettings = useCallback(() => {
        const userId = searchParams.get('userId');
        navigate(userId ? `/mypreferencesmenu?userId=${encodeURIComponent(userId)}` : '/mypreferencesmenu');
    }, [ navigate, searchParams ]);

    const goHome = useCallback(() => navigate('/home'), [ navigate ]);
    const goUpcoming = useCallback(() => navigate('/upcoming'), [ navigate ]);
    const goDownloads = useCallback(() => navigate('/downloads'), [ navigate ]);
    const openSearch = useCallback(() => setSearchOpen(true), []);
    const closeSearch = useCallback(() => setSearchOpen(false), []);

    const isActive = useCallback((path: string) =>
        location.pathname === path || location.pathname.startsWith(path + '/'), [ location.pathname ]);

    if (!shown) {
        return null;
    }

    // Phones: the bar takes the width of the screen and its buttons scroll sideways when they do not fit
    const barPlacement = narrow ? narrowBarPlacement(hidden) : { left: '50%' };

    return (
        <Box
            ref={barRef}
            component='nav'
            data-bottom-bar=''
            aria-label={globalize.translate('HeaderNavigation')}
            onFocusCapture={show}
            sx={[ barSx, hiddenBarSx(hidden), barPlacement ] as SxProps<Theme>}
        >
            <ScrollRail enabled={narrow}>
                {/* Back to settings menu — only on settings sub-pages */}
                {showSettingsBack && (
                    <>
                        <Tooltip title={globalize.translate('Settings')} placement='top'>
                            <IconButton
                                onClick={goToSettings}
                                aria-label={globalize.translate('ButtonBack')}
                                sx={barBtnSx(false, narrow)}
                            >
                                <ArrowBackRoundedIcon />
                            </IconButton>
                        </Tooltip>
                        <BarDivider />
                    </>
                )}

                {/* Home */}
                <Tooltip title={globalize.translate('Home')} placement='top'>
                    <IconButton onClick={goHome} aria-label={globalize.translate('Home')} aria-current={isActive('/home') ? 'page' : undefined} sx={barBtnSx(isActive('/home'), narrow)}>
                        <HomeRoundedIcon />
                    </IconButton>
                </Tooltip>

                {/* Coming up */}
                <Tooltip title={globalize.translate('UpcTitle')} placement='top'>
                    <IconButton
                        onClick={goUpcoming}
                        aria-label={globalize.translate('UpcTitle')}
                        aria-current={isActive('/upcoming') ? 'page' : undefined} sx={barBtnSx(isActive('/upcoming'), narrow)}
                    >
                        <CalendarMonthRoundedIcon />
                    </IconButton>
                </Tooltip>

                {/* Downloads (phones and tablets) */}
                {downloadsAvailable() && (
                    <Tooltip title={globalize.translate('DlPageTitle')} placement='top'>
                        <IconButton
                            onClick={goDownloads}
                            aria-label={globalize.translate('DlPageTitle')}
                            aria-current={isActive('/downloads') ? 'page' : undefined} sx={barBtnSx(isActive('/downloads'), narrow)}
                        >
                            <DownloadForOfflineRoundedIcon />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Search */}
                <Tooltip title={globalize.translate('Search')} placement='top'>
                    <IconButton onClick={openSearch} aria-label={globalize.translate('Search')} sx={barBtnSx(searchOpen, narrow)}>
                        <SearchRoundedIcon />
                    </IconButton>
                </Tooltip>

                {/* Portal — escapa el transform del FloatingNav para position:fixed correcto */}
                {createPortal(
                    <SearchDialog open={searchOpen} onClose={closeSearch} />,
                    document.body
                )}

                <BarDivider />
                {/* Watch together + cast */}
                <Box sx={toolsSx(narrow)}>
                    <SyncPlayButton />
                    <RemotePlayButton />
                </Box>

                {/* Scans and tasks (administrators): always there, lit while something runs */}
                <LibraryScanIndicator compact={narrow} />

                {/* Profile */}
                {isLoggedIn && (
                    <Box sx={{
                        flexShrink: 0,
                        color: 'rgba(255,255,255,0.55)',
                        borderRadius: '14px',
                        '& button': {
                            color: 'inherit !important',
                            borderRadius: '14px !important',
                            padding: '6px !important',
                            '&:hover': { color: '#00a4dc !important', background: 'rgba(0,164,220,0.12) !important' }
                        },
                        '& .MuiAvatar-root': {
                            width: '28px !important',
                            height: '28px !important',
                            border: '1.5px solid rgba(0,164,220,0.4)',
                            boxShadow: '0 0 8px rgba(0,164,220,0.3)'
                        }
                    }}>
                        <UserMenuButton />
                    </Box>
                )}
            </ScrollRail>
        </Box>
    );
};

export default FloatingNav;
