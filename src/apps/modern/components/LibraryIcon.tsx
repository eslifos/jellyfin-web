import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import Favorite from '@mui/icons-material/Favorite';
import Movie from '@mui/icons-material/Movie';
import MusicNote from '@mui/icons-material/MusicNote';
import Photo from '@mui/icons-material/Photo';
import LiveTv from '@mui/icons-material/LiveTv';
import Tv from '@mui/icons-material/Tv';
import Theaters from '@mui/icons-material/Theaters';
import MusicVideo from '@mui/icons-material/MusicVideo';
import Book from '@mui/icons-material/Book';
import Queue from '@mui/icons-material/Queue';
import VideoLibrary from '@mui/icons-material/VideoLibrary';
import Folder from '@mui/icons-material/Folder';
import OndemandVideo from '@mui/icons-material/OndemandVideo';
import TempleBuddhistRounded from '@mui/icons-material/TempleBuddhistRounded';
import Toys from '@mui/icons-material/Toys';
import React, { FC } from 'react';

import { MetaView } from '../constants/metaView';
import { themeOf, useLibraryThemes } from './HomeFeed/libraryThemes';

interface LibraryIconProps {
    item: BaseItemDto
}

const LibraryIcon: FC<LibraryIconProps> = ({
    item
}) => {
    const themes = useLibraryThemes();
    if (item.Id === MetaView.Favorites.Id) {
        return <Favorite />;
    }

    // Anime and kids libraries (mixed libraries with a theme)
    const theme = themeOf(item, themes);
    if (theme === 'anime') return <TempleBuddhistRounded />;
    if (theme === 'kids') return <Toys />;

    switch (item.CollectionType) {
        case CollectionType.Movies:
            return <Movie />;
        case CollectionType.Music:
            return <MusicNote />;
        case CollectionType.Homevideos:
        case CollectionType.Photos:
            return <Photo />;
        case CollectionType.Livetv:
            return <LiveTv />;
        case CollectionType.Tvshows:
            return <Tv />;
        case CollectionType.Trailers:
            return <Theaters />;
        case CollectionType.Musicvideos:
            return <MusicVideo />;
        case CollectionType.Books:
            return <Book />;
        case CollectionType.Boxsets:
            return <VideoLibrary />;
        case CollectionType.Playlists:
            return <Queue />;
        case undefined:
            return <OndemandVideo />;
        default:
            return <Folder />;
    }
};

export default LibraryIcon;
