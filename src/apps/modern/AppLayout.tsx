import React, { StrictMode, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import { type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Outlet, useLocation } from 'react-router-dom';

import AppBody from 'components/AppBody';
import CustomCss from 'components/CustomCss';
import OffsetAppBar from 'components/OffsetAppBar';
import ThemeCss from 'components/ThemeCss';
import { useApi } from 'hooks/useApi';
import { PUBLIC_PATHS } from 'components/router/appRouter';

import AppDrawer, { isDrawerPath } from './components/drawers/AppDrawer';
import FloatingNav from './components/FloatingNav';
import LibraryToolbar from './features/libraries/components/LibraryToolbar';
import { LibraryProvider } from './features/libraries/hooks/useLibrary';
import { isLibraryPath } from './features/libraries/utils/path';

import './AppOverrides.scss';

export const Component = () => {
    const [ isDrawerActive, setIsDrawerActive ] = useState(false);
    const { user } = useApi();
    const location = useLocation();

    const isMediumScreen = useMediaQuery((t: Theme) => t.breakpoints.up('md'));
    const isDrawerAvailable = isDrawerPath(location.pathname) && Boolean(user) && !isMediumScreen;
    const isDrawerOpen = isDrawerActive && isDrawerAvailable;
    const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
    const isVideoPage = location.pathname === '/video';

    const onToggleDrawer = useCallback(() => {
        setIsDrawerActive(!isDrawerActive);
    }, [ isDrawerActive, setIsDrawerActive ]);

    return (
        <LibraryProvider>
            <Box
                sx={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                }}
            >
                <StrictMode>
                    {/* Library filters/sort toolbar (v12.4), only on library pages */}
                    {isLibraryPath(location.pathname) && (
                        <OffsetAppBar dense>
                            <LibraryToolbar />
                        </OffsetAppBar>
                    )}

                    {isDrawerAvailable && (
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
                        flexGrow: 1,
                        pb: (!isPublicPath && !isVideoPage) ? '80px' : 0
                    }}
                >
                    <AppBody>
                        <Outlet />
                    </AppBody>
                </Box>
            </Box>

            {/* Floating pill navigation */}
            <FloatingNav />

            <ThemeCss />
            <CustomCss />
        </LibraryProvider>
    );
};