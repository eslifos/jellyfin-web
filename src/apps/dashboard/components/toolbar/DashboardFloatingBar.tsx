/**
 * DashboardFloatingBar — the floating pill at the bottom of the admin dashboard.
 *
 * Same look as the main app's FloatingNav. It replaces the old top app bar and
 * keeps all of its functions: back, help for the current page, user menu and,
 * on small screens, the button that opens the side menu. It also adds home,
 * search and cast like the main app.
 * Like the main bar it leaves room at the end of the pages, never gets wider than the screen (on narrow phones
 * home, search, help and cast go into "More") and steps aside while scrolling down on phones and tablets.
 */
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import type { Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import React, { type FC, useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

import { HelpLinks } from 'apps/dashboard/constants/helpLinks';
import RemotePlayButton from 'apps/modern/components/AppToolbar/RemotePlayButton';
import { BarDivider, NARROW_BAR, barBtnSx, barSx } from 'apps/modern/components/FloatingNav';
import BarMoreMenu, { type MoreEntry, type MoreTool } from 'apps/modern/components/FloatingNav/BarMoreMenu';
import { hiddenBarSx, useBottomSpace, useHideOnScroll } from 'apps/modern/components/FloatingNav/bottomSpace';
import SearchDialog from 'apps/modern/components/SearchDialog';
import { appRouter } from 'components/router/appRouter';
import UserMenuButton from 'components/toolbar/UserMenuButton';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import HelpButton from './HelpButton';

interface DashboardFloatingBarProps {
    /** Width taken by the side menu, so the pill stays centered on the content. */
    navOffset: number;
    /** Shows the button that opens the side menu (small screens). */
    showMenuButton: boolean;
    isMenuOpen: boolean;
    onMenuClick: () => void;
}

/** Styles for third-party buttons (cast, help) so they match the pill. */
const wrappedBtnSx = {
    color: 'rgba(255,255,255,0.55)',
    borderRadius: '14px',
    display: 'flex',
    flexShrink: 0,
    '& button, & a.MuiIconButton-root': {
        color: 'inherit !important',
        borderRadius: '14px !important',
        padding: '10px 14px !important',
        '&:hover': { color: '#00a4dc !important', background: 'rgba(0,164,220,0.12) !important' }
    },
    '& svg': { fontSize: '1.5rem !important' },
    '&:empty': { display: 'none' }
};

const userSx = {
    ...wrappedBtnSx,
    '& button': { ...wrappedBtnSx['& button, & a.MuiIconButton-root'], padding: '6px !important' },
    '& .MuiAvatar-root': {
        width: '28px !important',
        height: '28px !important',
        border: '1.5px solid rgba(0,164,220,0.4)',
        boxShadow: '0 0 8px rgba(0,164,220,0.3)'
    }
};

const onBack = () => {
    appRouter.back().catch(err => console.error('[DashboardFloatingBar] error going back', err));
};

const DashboardFloatingBar: FC<DashboardFloatingBarProps> = ({ navOffset, showMenuButton, isMenuOpen, onMenuClick }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useApi();
    const [ searchOpen, setSearchOpen ] = useState(false);

    const barRef = useRef<HTMLElement>(null);
    const narrow = useMediaQuery(NARROW_BAR);
    const touchSized = useMediaQuery((t: Theme) => t.breakpoints.down('md'));
    const { hidden, show } = useHideOnScroll(touchSized && !searchOpen && !isMenuOpen);
    useBottomSpace('dashboard', barRef, true);

    const canGoBack = appRouter.canGoBack();
    const isDashboardHome = location.pathname === '/dashboard';

    const goHome = useCallback(() => navigate('/home'), [ navigate ]);
    const goDashboard = useCallback(() => navigate('/dashboard'), [ navigate ]);
    const openSearch = useCallback(() => setSearchOpen(true), []);
    const closeSearch = useCallback(() => setSearchOpen(false), []);

    // On narrow phones: home, search, help for this page and cast go into "More"
    const helpUrl = HelpLinks.find(({ paths }) => paths.includes(location.pathname))?.url;
    const moreEntries = useMemo<MoreEntry[]>(() => [
        { key: 'home', icon: <HomeRoundedIcon />, label: globalize.translate('Home'), onClick: goHome },
        { key: 'search', icon: <SearchRoundedIcon />, label: globalize.translate('Search'), onClick: openSearch },
        ...(helpUrl ? [ { key: 'help', icon: <HelpOutlineRoundedIcon />, label: globalize.translate('Help'), href: helpUrl } ] : [])
    ], [ goHome, helpUrl, openSearch ]);
    const moreTools = useMemo<MoreTool[]>(() => [
        { key: 'cast', label: globalize.translate('ButtonCast'), node: <RemotePlayButton /> }
    ], []);

    return (
        <Box
            ref={barRef}
            component='nav'
            data-bottom-bar=''
            aria-label={globalize.translate('TabDashboard')}
            onFocusCapture={show}
            sx={{ ...barSx, left: `calc(50% + ${navOffset / 2}px)`, ...hiddenBarSx(hidden) }}
        >
            {/* Side menu (small screens) */}
            {showMenuButton && (
                <Tooltip title={globalize.translate(isMenuOpen ? 'MenuClose' : 'MenuOpen')} placement='top'>
                    <IconButton onClick={onMenuClick} aria-label={globalize.translate(isMenuOpen ? 'MenuClose' : 'MenuOpen')} sx={barBtnSx(isMenuOpen, narrow)}>
                        <MenuRoundedIcon />
                    </IconButton>
                </Tooltip>
            )}

            {/* Back — same behaviour as the old top bar */}
            {canGoBack && (
                <Tooltip title={globalize.translate('ButtonBack')} placement='top'>
                    <IconButton onClick={onBack} aria-label={globalize.translate('ButtonBack')} sx={barBtnSx(false, narrow)}>
                        <ArrowBackRoundedIcon />
                    </IconButton>
                </Tooltip>
            )}

            {(showMenuButton || canGoBack) && <BarDivider />}

            {/* Home of the main app */}
            {!narrow && (
                <Tooltip title={globalize.translate('Home')} placement='top'>
                    <IconButton onClick={goHome} aria-label={globalize.translate('Home')} sx={barBtnSx(false, narrow)}>
                        <HomeRoundedIcon />
                    </IconButton>
                </Tooltip>
            )}

            {/* Dashboard home */}
            <Tooltip title={globalize.translate('TabDashboard')} placement='top'>
                <IconButton onClick={goDashboard} aria-label={globalize.translate('TabDashboard')} sx={barBtnSx(isDashboardHome, narrow)}>
                    <DashboardRoundedIcon />
                </IconButton>
            </Tooltip>

            {/* Search */}
            {!narrow && (
                <Tooltip title={globalize.translate('Search')} placement='top'>
                    <IconButton onClick={openSearch} aria-label={globalize.translate('Search')} sx={barBtnSx(searchOpen, narrow)}>
                        <SearchRoundedIcon />
                    </IconButton>
                </Tooltip>
            )}

            {/* Portal: escapes the pill transform so the dialog is positioned correctly */}
            {createPortal(<SearchDialog open={searchOpen} onClose={closeSearch} />, document.body)}

            {narrow ? (
                <BarMoreMenu entries={moreEntries} tools={moreTools} buttonSx={barBtnSx(false, narrow)} />
            ) : (
                <>
                    <BarDivider />

                    {/* Help for the current page (only shown where a help link exists) */}
                    <Box sx={wrappedBtnSx}>
                        <HelpButton />
                    </Box>

                    {/* Cast */}
                    <Box sx={wrappedBtnSx}>
                        <RemotePlayButton />
                    </Box>
                </>
            )}

            {/* User menu */}
            {user && (
                <Box sx={userSx}>
                    <UserMenuButton />
                </Box>
            )}
        </Box>
    );
};

export default DashboardFloatingBar;
