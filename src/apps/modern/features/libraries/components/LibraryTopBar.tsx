import React, { type FC } from 'react';

import OffsetAppBar from 'components/OffsetAppBar';
import { LibraryTab } from 'types/libraryTab';

import { useLibrary } from '../hooks/useLibrary';
import LibraryToolbar from './LibraryToolbar';

/**
 * Library toolbar in a fixed bar. The start screen of a library has no bar: its floating
 * tabs sit right on top of the banner, like the home screen.
 */
const LibraryTopBar: FC = () => {
    const { content } = useLibrary();
    if (content?.viewType === LibraryTab.Home) return null;

    return (
        <OffsetAppBar dense>
            <LibraryToolbar />
        </OffsetAppBar>
    );
};

export default LibraryTopBar;
