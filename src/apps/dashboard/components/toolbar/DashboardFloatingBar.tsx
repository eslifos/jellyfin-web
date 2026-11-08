/**
 * DashboardFloatingBar — the floating pill at the bottom of the admin dashboard.
 *
 * Same look as the main app's FloatingNav. It replaces the old top app bar and
 * keeps all of its functions: back, help for the current page, user menu and,
 * on small screens, the button that opens the side menu. It also adds home,
 * search and cast like the main app.
 */
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import React, { type FC, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

import RemotePlayButton from 'apps/modern/components/AppToolbar/RemotePlayButton';
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

const navBtnSx = (active: boolean) => ({
    color: active ? '#00a4dc' : 'rgba(255,255,255,0.55)',
    borderRadius: '14px',
    padding: '10px 14px',
    transition: 'all 0.2s',
    background: active ? 'rgba(0,164,220,0.15)' : 'transparent',
    '&:hover': { color: '#00a4dc', background: 'rgba(0,164,220,0.12)' },
    '& svg': {
        fontSize: '1.5rem',
        filter: active ? 'drop-shadow(0 0 6px rgba(0,164,220,0.7))' : 'none',
        transition: 'filter 0.2s'
    }
});

/** Styles for third-party buttons (cast, help) so they match the pill. */
const wrappedBtnSx = {
    color: 'rgba(255,255,255,0.55)',
    borderRadius: '14px',
    display: 'flex',
    '& button, & a.MuiIconButton-root': {
        color: 'inherit !important',
        borderRadius: '14px !important',
        padding: '10px 14px !important',
        '&:hover': { color: '#00a4dc !important', background: 'rgba(0,164,220,0.12) !important' }
    },
    '& svg': { fontSize: '1.5rem !important' },
    '&:empty': { display: 'none' }
};

const Divider = () => <Box sx={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)', mx: 0.5, flexShrink: 0 }} />;

const onBack = () => {
    appRouter.back().catch(err => console.error('[DashboardFloatingBar] error going back', err));
};

const DashboardFloatingBar: FC<DashboardFloatingBarProps> = ({ navOffset, showMenuButton, isMenuOpen, onMenuClick }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useApi();
    const [ searchOpen, setSearchOpen ] = useState(false);

    const canGoBack = appRouter.canGoBack();
    const isDashboardHome = location.pathname === '/dashboard';

    const goHome = useCallback(() => navigate('/home'), [ navigate ]);
    const goDashboard = useCallback(() => navigate('/dashboard'), [ navigate ]);
    const openSearch = useCallback(() => setSearchOpen(true), []);
    const closeSearch = useCallback(() => setSearchOpen(false), []);

    return (
        <Box
            component='nav'
            aria-label={globalize.translate('TabDashboard')}
            sx={{
                position: 'fixed',
                bottom: '20px',
                left: `calc(50% + ${navOffset / 2}px)`,
                transform: 'translateX(-50%)',
                zIndex: 1100,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.75,
                maxWidth: 'calc(100vw - 24px)',
                background: 'rgba(8, 10, 22, 0.82)',
                backdropFilter: 'blur(24px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                border: '1px solid rgba(0, 164, 220, 0.2)',
                borderRadius: '50px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px rgba(0,164,220,0.1)',
                animation: 'jf-glow-pulse 4s ease-in-out infinite',
                transition: 'left 0.25s'
            }}
        >
            {/* Side menu (small screens) */}
            {showMenuButton && (
                <Tooltip title={globalize.translate(isMenuOpen ? 'MenuClose' : 'MenuOpen')} placement='top'>
                    <IconButton onClick={onMenuClick} aria-label={globalize.translate(isMenuOpen ? 'MenuClose' : 'MenuOpen')} sx={navBtnSx(isMenuOpen)}>
                        <MenuRoundedIcon />
                    </IconButton>
                </Tooltip>
            )}

            {/* Back — same behaviour as the old top bar */}
            {canGoBack && (
                <Tooltip title={globalize.translate('ButtonBack')} placement='top'>
                    <IconButton onClick={onBack} aria-label={globalize.translate('ButtonBack')} sx={navBtnSx(false)}>
                        <ArrowBackRoundedIcon />
                    </IconButton>
                </Tooltip>
            )}

            {(showMenuButton || canGoBack) && <Divider />}

            {/* Home of the main app */}
            <Tooltip title={globalize.translate('Home')} placement='top'>
                <IconButton onClick={goHome} aria-label={globalize.translate('Home')} sx={navBtnSx(false)}>
                    <HomeRoundedIcon />
                </IconButton>
            </Tooltip>

            {/* Dashboard home */}
            <Tooltip title={globalize.translate('TabDashboard')} placement='top'>
                <IconButton onClick={goDashboard} aria-label={globalize.translate('TabDashboard')} sx={navBtnSx(isDashboardHome)}>
                    <DashboardRoundedIcon />
                </IconButton>
            </Tooltip>

            {/* Search */}
            <Tooltip title={globalize.translate('Search')} placement='top'>
                <IconButton onClick={openSearch} aria-label={globalize.translate('Search')} sx={navBtnSx(searchOpen)}>
                    <SearchRoundedIcon />
                </IconButton>
            </Tooltip>

            {/* Portal: escapes the pill transform so the dialog is positioned correctly */}
            {createPortal(<SearchDialog open={searchOpen} onClose={closeSearch} />, document.body)}

            <Divider />

            {/* Help for the current page (only shown where a help link exists) */}
            <Box sx={wrappedBtnSx}>
                <HelpButton />
            </Box>

            {/* Cast */}
            <Box sx={wrappedBtnSx}>
                <RemotePlayButton />
            </Box>

            {/* User menu */}
            {user && (
                <Box sx={{
                    ...wrappedBtnSx,
                    '& button': { ...wrappedBtnSx['& button, & a.MuiIconButton-root'], padding: '6px !important' },
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
        </Box>
    );
};

export default DashboardFloatingBar;
