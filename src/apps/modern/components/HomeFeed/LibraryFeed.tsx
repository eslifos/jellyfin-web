/**
 * Start screen ("Home" tab) of a library: the fast page prepared on the server (QuickLibrary) for every kind of
 * library (movies, series, anime, kids, music, books, music videos, home videos); audiobooks have their own fast
 * page (QuickAudiobooks).
 */
import Box from '@mui/material/Box';
import React, { type FC } from 'react';

import LibraryTabsBar from 'apps/modern/features/libraries/components/LibraryTabsBar';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';

import MusicHub from '../MusicHub';
import QuickAudiobooks from '../QuickHome/QuickAudiobooks';
import QuickLibrary from '../QuickHome/QuickLibrary';
import { THEME_ACCENT, themeOf, useLibraryThemes } from './libraryThemes';
import { useLiveLibraryRefresh } from './useLiveLibraryRefresh';
import { toKind } from './feedParts';

const LibraryFeed: FC<{ parentId?: string | null, collectionType?: string | null }> = ({ parentId, collectionType }) => {
    const { user } = useApi();
    useLiveLibraryRefresh();
    const { data: views } = useUserViews({ userId: user?.Id });
    const themes = useLibraryThemes();

    if (!parentId) return null;
    const view = views?.Items?.find(v => v.Id === parentId);
    const kind = toKind(collectionType && collectionType !== 'unknown' ? collectionType : view?.CollectionType);
    const theme = kind === 'mixed' ? themeOf(view ?? { Id: parentId }, themes) : undefined;
    // Audiobooks: a books library with that type (or named so) has its own start screen
    const audiobooks = kind === 'books' && (themes[parentId.replace(/-/g, '').toLowerCase()] === 'audiobooks' || /audio ?libros?|audiobooks?/i.test(view?.Name ?? ''));

    return (
        <Box className='padded-bottom-page'>
            <LibraryTabsBar floating />
            {kind === 'music' && <MusicHub key={parentId} parentId={parentId} name={view?.Name ?? ''} />}
            {kind !== 'music' && (audiobooks ?
                <QuickAudiobooks key={parentId} libraryId={parentId} name={view?.Name ?? ''} /> :
                <QuickLibrary key={parentId} libraryId={parentId} name={view?.Name ?? ''} accent={theme ? THEME_ACCENT[theme] : undefined} theme={theme} />)}
        </Box>
    );
};

export default LibraryFeed;
