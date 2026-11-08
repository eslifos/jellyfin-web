/**
 * FloatingNav — persistent bottom navigation pill for the experimental layout.
 *
 * Renders as a glassmorphism pill fixed at the bottom center of the viewport.
 * Hidden on public paths (login, wizard) and on the video player route.
 * Uses `createPortal` to escape any CSS `transform` stacking context from the parent.
 */
import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import globalize from 'lib/globalize';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useApi } from 'hooks/useApi';
import { PUBLIC_PATHS } from 'components/router/appRouter';
import RemotePlayButton from '../AppToolbar/RemotePlayButton';
import UserMenuButton from 'components/toolbar/UserMenuButton';
import SearchDialog from '../SearchDialog';
import { isSettingsSubPath } from './settingsPaths';

interface NavItem {
    icon: React.ReactNode;
    label: string;
    path?: string;
    onClick?: () => void;
    hideWhenPublic?: boolean;
    custom?: React.ReactNode;
}

const FloatingNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useApi();
    const isLoggedIn = Boolean(user);
    const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
    const [ searchOpen, setSearchOpen ] = useState(false);
    const [ searchParams ] = useSearchParams();
    const showSettingsBack = isSettingsSubPath(location.pathname);

    const goToSettings = useCallback(() => {
        const userId = searchParams.get('userId');
        navigate(userId ? `/mypreferencesmenu?userId=${encodeURIComponent(userId)}` : '/mypreferencesmenu');
    }, [ navigate, searchParams ]);

    if (isPublicPath || location.pathname === '/video' || location.pathname === '/profiles') {
        return null;
    }

    const isActive = (path: string) =>
        location.pathname === path || location.pathname.startsWith(path + '/');

    const navBtnSx = (active: boolean) => ({
        color: active ? '#00a4dc' : 'rgba(255,255,255,0.55)',
        borderRadius: '14px',
        padding: '10px 14px',
        transition: 'all 0.2s',
        position: 'relative',
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

    return (
        <Box
            sx={{
                position: 'fixed',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1100,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.75,
                background: 'rgba(8, 10, 22, 0.82)',
                backdropFilter: 'blur(24px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                border: '1px solid rgba(0, 164, 220, 0.2)',
                borderRadius: '50px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px rgba(0,164,220,0.1)',
                animation: 'jf-glow-pulse 4s ease-in-out infinite'
            }}
        >
            {/* Back to settings menu — only on settings sub-pages */}
            {showSettingsBack && (
                <>
                    <Tooltip title={globalize.translate('Settings')} placement='top'>
                        <IconButton
                            onClick={goToSettings}
                            aria-label={globalize.translate('ButtonBack')}
                            sx={navBtnSx(false)}
                        >
                            <ArrowBackRoundedIcon />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)', mx: 0.5 }} />
                </>
            )}

            {/* Home */}
            <Tooltip title={globalize.translate('Home')} placement='top'>
                <IconButton
                    onClick={() => navigate('/home')}
                    sx={navBtnSx(isActive('/home'))}
                >
                    <HomeRoundedIcon />
                </IconButton>
            </Tooltip>

            {/* Coming up */}
            <Tooltip title={globalize.translate('UpcTitle')} placement='top'>
                <IconButton
                    onClick={() => navigate('/upcoming')}
                    aria-label={globalize.translate('UpcTitle')}
                    sx={navBtnSx(isActive('/upcoming'))}
                >
                    <CalendarMonthRoundedIcon />
                </IconButton>
            </Tooltip>

            {/* Search */}
            <Tooltip title={globalize.translate('Search')} placement='top'>
                <IconButton
                    onClick={() => setSearchOpen(true)}
                    sx={navBtnSx(searchOpen)}
                >
                    <SearchRoundedIcon />
                </IconButton>
            </Tooltip>

            {/* Portal — escapa el transform del FloatingNav para position:fixed correcto */}
            {createPortal(
                <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />,
                document.body
            )}

            {/* Divisor */}
            <Box sx={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)', mx: 0.5 }} />

            {/* Cast */}
            <Box sx={{
                color: 'rgba(255,255,255,0.55)',
                borderRadius: '14px',
                padding: '2px',
                '& button': {
                    color: 'inherit !important',
                    borderRadius: '14px !important',
                    padding: '10px 14px !important',
                    '&:hover': { color: '#00a4dc !important', background: 'rgba(0,164,220,0.12) !important' }
                },
                '& svg': { fontSize: '1.5rem !important' }
            }}>
                <RemotePlayButton />
            </Box>

            {/* Profile */}
            {isLoggedIn && (
                <Box sx={{
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
        </Box>
    );
};

export default FloatingNav;