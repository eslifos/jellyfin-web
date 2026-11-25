import React, { StrictMode, useEffect } from 'react';
import Box from '@mui/material/Box';
import { Outlet, useLocation } from 'react-router-dom';

import AppBody from 'components/AppBody';
import { initCardBadges } from 'components/cardbuilder/cardBadges';
import { initCollectionCollage } from 'components/cardbuilder/collectionCollage';
import CustomCss from 'components/CustomCss';
import IosInstallHint from 'components/iosInstallHint/IosInstallHint';
import ThemeCss from 'components/ThemeCss';
import { useApi } from 'hooks/useApi';

import Player from './components/Player';
import FloatingNav from './components/FloatingNav';
import SyncPlayInviteHandler from './features/syncPlay/components/SyncPlayInviteHandler';
import LibraryTopBar from './features/libraries/components/LibraryTopBar';
import { LibraryProvider } from './features/libraries/hooks/useLibrary';
import { isLibraryPath } from './features/libraries/utils/path';

import './AppOverrides.scss';

export const Component = () => {
    const { user } = useApi();
    const location = useLocation();

    // Poster overlays (resolution, audio, ratings...) on every card
    useEffect(() => {
        if (user) {
            initCardBadges();
            initCollectionCollage();
        }
    }, [ user ]);

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
                    {isLibraryPath(location.pathname) && <LibraryTopBar />}
                </StrictMode>

                {/* The room for the floating bars is left by each page (site.scss, --jf-bottom-bar-space) */}
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

            {/* Floating pill navigation */}
            {user && <SyncPlayInviteHandler />}
            {/* The player (small bar and full player) for everything that plays */}
            {user && <Player />}
            <FloatingNav />
            {/* Safari on iPhone / iPad, once: how to add the app to the Home Screen */}
            {user && <IosInstallHint />}

            <ThemeCss />
            <CustomCss />
        </LibraryProvider>
    );
};
