import Box from '@mui/material/Box';
import { type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import React, { FC, StrictMode, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import AppBody from 'components/AppBody';
import ThemeCss from 'components/ThemeCss';
import { useApi } from 'hooks/useApi';
import { useLocale } from 'hooks/useLocale';

import AppDrawer from './components/drawer/AppDrawer';
import FloatingDashboardNav, { getNavOffset, usePinnedNav } from './components/drawer/FloatingDashboardNav';
import DashboardFloatingBar from './components/toolbar/DashboardFloatingBar';
import { DASHBOARD_APP_PATHS } from './routes/routes';

import './AppOverrides.scss';
import './CosmicDashboard.scss';

export const Component: FC = () => {
    const [ isDrawerActive, setIsDrawerActive ] = useState(false);
    const location = useLocation();
    const { user } = useApi();
    const { dateFnsLocale } = useLocale();

    const isMediumScreen = useMediaQuery((t: Theme) => t.breakpoints.up('md'));
    const isMetadataManager = location.pathname.startsWith(`/${DASHBOARD_APP_PATHS.MetadataManager}`);
    const isDrawerAvailable = Boolean(user) && !isMetadataManager;
    const isDrawerOpen = isDrawerActive && isDrawerAvailable;
    const { pinned, togglePinned } = usePinnedNav();
    const isFloatingNav = isMediumScreen && isDrawerAvailable;
    const navOffset = isFloatingNav ? getNavOffset(pinned) : 0;

    // Expose the nav offset to the legacy page layout (AppOverrides.scss)
    useEffect(() => {
        document.body.style.setProperty('--dash-nav-offset', `${navOffset}px`);
        return () => {
            document.body.style.removeProperty('--dash-nav-offset');
        };
    }, [ navOffset ]);

    const onToggleDrawer = useCallback(() => {
        setIsDrawerActive(!isDrawerActive);
    }, [ isDrawerActive, setIsDrawerActive ]);

    // Update body class
    useEffect(() => {
        document.body.classList.add('dashboardDocument');

        return () => {
            document.body.classList.remove('dashboardDocument');
        };
    }, []);

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateFnsLocale}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100%'
                }}
            >
                <StrictMode>
                    <DashboardFloatingBar
                        navOffset={navOffset}
                        showMenuButton={!isMediumScreen && isDrawerAvailable}
                        isMenuOpen={isDrawerOpen}
                        onMenuClick={onToggleDrawer}
                    />

                    {isFloatingNav && (
                        <FloatingDashboardNav pinned={pinned} onTogglePinned={togglePinned} />
                    )}
                    {isDrawerAvailable && !isMediumScreen && (
                        <AppDrawer
                            open={isDrawerOpen}
                            onClose={onToggleDrawer}
                            onOpen={onToggleDrawer}
                        />
                    )}
                </StrictMode>

                <Box
                    component='main'
                    sx={{
                        position: 'relative',
                        width: '100%',
                        flexGrow: 1
                    }}
                >
                    <AppBody>
                        <Outlet />
                    </AppBody>
                </Box>
            </Box>
            <ThemeCss dashboard />
        </LocalizationProvider>
    );
};
