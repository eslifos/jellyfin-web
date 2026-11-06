/**
 * FloatingDashboardNav — floating glass side navigation for the admin dashboard (desktop).
 *
 * Collapsed: a slim rail of icons. Hovering the rail expands it as an overlay
 * (content does not move). The pin button keeps it expanded and the page
 * content shifts next to it. The pinned state is remembered per browser.
 */
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { getDisplayVersion } from '@jellyfin/sdk/lib/utils/versioning';
import React, { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSystemInfo } from 'hooks/useSystemInfo';
import globalize from 'lib/globalize';

import { useCustomLogo } from 'utils/customLogo';

import DrawerSections from './DrawerSections';

export const NAV_GAP = 12;
export const NAV_COLLAPSED_WIDTH = 72;
export const NAV_EXPANDED_WIDTH = 264;

const STORAGE_KEY = 'dashboardNavPinned';

const readPinned = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

/** Space the page content must leave on the left for the nav. */
export const getNavOffset = (pinned: boolean) => (pinned ? NAV_EXPANDED_WIDTH : NAV_COLLAPSED_WIDTH) + NAV_GAP * 2;

export const usePinnedNav = () => {
    const [ pinned, setPinned ] = useState(readPinned);

    const togglePinned = useCallback(() => {
        setPinned(value => {
            try {
                localStorage.setItem(STORAGE_KEY, String(!value));
            } catch {
                // ignore storage errors (private mode, blocked storage)
            }
            return !value;
        });
    }, []);

    return { pinned, togglePinned };
};

interface FloatingDashboardNavProps {
    pinned: boolean;
    onTogglePinned: () => void;
}

const FloatingDashboardNav: FC<FloatingDashboardNavProps> = ({ pinned, onTogglePinned }) => {
    const { iconUrl: appIcon } = useCustomLogo();
    const { data: systemInfo } = useSystemInfo();
    const [ hovered, setHovered ] = useState(false);
    const hoverTimer = useRef<number>();
    const expanded = pinned || hovered;

    const onMouseEnter = useCallback(() => {
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => setHovered(true), 120);
    }, []);

    const onMouseLeave = useCallback(() => {
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => setHovered(false), 200);
    }, []);

    useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

    const onPinClick = useCallback(() => {
        setHovered(false);
        onTogglePinned();
    }, [ onTogglePinned ]);

    return (
        <Box
            component='nav'
            className={`dashFloatingNav ${expanded ? 'dashFloatingNav-expanded' : 'dashFloatingNav-collapsed'}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            sx={{
                position: 'fixed',
                top: NAV_GAP,
                left: NAV_GAP,
                bottom: NAV_GAP,
                width: expanded ? NAV_EXPANDED_WIDTH : NAV_COLLAPSED_WIDTH,
                zIndex: 1200,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: 'rgba(8, 10, 22, 0.86)',
                backdropFilter: 'blur(24px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                border: '1px solid rgba(0, 164, 220, 0.2)',
                borderRadius: '24px',
                boxShadow: (hovered && !pinned) ?
                    '0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 28px rgba(0,164,220,0.18)' :
                    '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px rgba(0,164,220,0.1)',
                transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s',

                // ── List styling ──
                '& .MuiList-root': { background: 'transparent', py: 0.25 },
                '& .MuiListItem-root': { display: 'block' },
                '& .MuiListSubheader-root': {
                    background: 'transparent', color: '#00a4dc', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '1.5px',
                    textTransform: 'uppercase', lineHeight: '2.2rem', px: 2.25, whiteSpace: 'nowrap', position: 'static'
                },
                '& .MuiListItemButton-root': {
                    borderRadius: '14px', mx: 1, my: '2px', minHeight: 42, px: 1.5, whiteSpace: 'nowrap',
                    color: 'rgba(255,255,255,0.75)', transition: 'background 0.18s, color 0.18s',
                    '&:hover': { background: 'rgba(0,164,220,0.12)', color: '#fff' },
                    '&.Mui-selected': {
                        background: 'linear-gradient(90deg, rgba(0,164,220,0.26), rgba(170,92,195,0.14))',
                        color: '#fff',
                        boxShadow: 'inset 0 0 0 1px rgba(0,164,220,0.25)',
                        '& .MuiListItemIcon-root svg': { color: '#00a4dc', filter: 'drop-shadow(0 0 6px rgba(0,164,220,0.7))' },
                        '& .MuiListItemText-primary': { fontWeight: 600 }
                    },
                    '& > svg': { color: 'rgba(255,255,255,0.4)', fontSize: '1.1rem' }
                },
                '& .MuiListItemIcon-root': {
                    minWidth: 40, color: 'rgba(255,255,255,0.55)',
                    '& svg': { fontSize: '1.3rem', transition: 'filter 0.2s' }
                },
                '& .MuiListItemText-root': { my: 0 },
                '& .MuiListItemText-primary': { fontSize: '0.88rem' },
                '& .MuiListItemText-inset': { pl: 5 },
                '& .MuiCollapse-root .MuiListItemButton-root': { minHeight: 36, pl: '8px !important' },
                '& .MuiCollapse-root .MuiListItemText-primary': { fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' },
                '& .MuiCollapse-root .Mui-selected .MuiListItemText-primary': { color: '#fff' },
                '& .MuiDivider-root': { borderColor: 'rgba(0,164,220,0.1)' },

                // ── Collapsed rail: icons only ──
                '&.dashFloatingNav-collapsed': {
                    '& .MuiListItemText-root, & .MuiListItemButton-root > svg, & .MuiCollapse-root': { display: 'none' },
                    '& .MuiListSubheader-root': {
                        fontSize: 0, lineHeight: 0, height: '1px', mx: 2, my: 1, p: 0, background: 'rgba(0,164,220,0.15)'
                    },
                    '& .MuiListItemButton-root': { justifyContent: 'center', px: 0 },
                    '& .MuiListItemIcon-root': { minWidth: 0 }
                }
            }}
        >
            {/* Header: server logo + name */}
            <Box
                component={Link}
                to='/'
                sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.75, textDecoration: 'none', flexShrink: 0,
                    borderBottom: '1px solid rgba(0,164,220,0.12)', justifyContent: expanded ? 'flex-start' : 'center'
                }}
            >
                <Box component='img' src={appIcon} alt='' sx={{ height: 36, width: 36, flexShrink: 0, filter: 'drop-shadow(0 0 8px rgba(0,164,220,0.45))' }} />
                {expanded && (
                    <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{
                            fontWeight: 700, fontSize: '1rem',
                            background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                        }}>
                            {systemInfo?.ServerName || 'Jellyfin'}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                            {getDisplayVersion(systemInfo?.Version)}
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Sections */}
            <Box sx={{
                flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 0.5,
                '&::-webkit-scrollbar': { width: 6 },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(0,164,220,0.25)', borderRadius: 6 }
            }}>
                <DrawerSections />
            </Box>

            {/* Footer: pin / unpin */}
            <Box sx={{
                flexShrink: 0, borderTop: '1px solid rgba(0,164,220,0.12)', p: 1,
                display: 'flex', justifyContent: expanded ? 'flex-end' : 'center'
            }}>
                <Tooltip title={globalize.translate(pinned ? 'NavCollapse' : 'NavExpand')} placement='right'>
                    <IconButton
                        onClick={onPinClick}
                        aria-label={globalize.translate(pinned ? 'NavCollapse' : 'NavExpand')}
                        sx={{
                            color: pinned ? '#00a4dc' : 'rgba(255,255,255,0.55)', borderRadius: '12px',
                            background: pinned ? 'rgba(0,164,220,0.15)' : 'transparent',
                            '&:hover': { color: '#00a4dc', background: 'rgba(0,164,220,0.12)' }
                        }}
                    >
                        {pinned ? <KeyboardDoubleArrowLeftIcon /> : <KeyboardDoubleArrowRightIcon />}
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
};

export default FloatingDashboardNav;
