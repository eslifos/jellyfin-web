/**
 * The TV layout runs this (legacy) app, but its libraries are the Cosmic ones of the desktop: the same pages, with
 * their bar of views, sort and filters, and the items loading as the list scrolls (no pages to step through).
 * This wraps those pages with what they need from the modern app.
 */
import React, { type FC, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import LibraryTopBar from 'apps/modern/features/libraries/components/LibraryTopBar';
import { LibraryProvider } from 'apps/modern/features/libraries/hooks/useLibrary';
import { isLibraryPath } from 'apps/modern/features/libraries/utils/path';
import { initCardBadges } from 'components/cardbuilder/cardBadges';
import { initCollectionCollage } from 'components/cardbuilder/collectionCollage';

/** The library pages the TV layout takes from the modern app (the legacy ones step through pages). */
export const TV_LIBRARY_PATHS = [
    'movies', 'tv', 'music', 'books', 'musicvideos', 'homevideos', 'boxsets', 'playlists', 'mixed', 'livetv',
    'genre', 'universe', 'universes', 'upcoming'
];

const TvLibraryLayout: FC = () => {
    const { pathname } = useLocation();

    // Poster overlays (resolution, audio, ratings...) like the desktop cards
    useEffect(() => {
        initCardBadges();
        initCollectionCollage();
    }, []);

    return (
        <LibraryProvider>
            {isLibraryPath(pathname) && <LibraryTopBar />}
            <Outlet />
        </LibraryProvider>
    );
};

export default TvLibraryLayout;
