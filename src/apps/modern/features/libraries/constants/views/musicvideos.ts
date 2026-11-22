import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';

import { LibraryTab } from 'types/libraryTab';
import type { LibraryTabContent } from 'types/libraryTabContent';

const foldersTabContent: LibraryTabContent = {
    viewType: LibraryTab.Folders,
    collectionType: CollectionType.Musicvideos,
    isBtnPlayAllEnabled: true,
    isBtnShuffleEnabled: true,
    itemType: [BaseItemKind.Folder, BaseItemKind.MusicVideo]
};

const musicVideosTabContent: LibraryTabContent = {
    viewType: LibraryTab.MusicVideos,
    collectionType: CollectionType.Musicvideos,
    isBtnPlayAllEnabled: true,
    isBtnShuffleEnabled: true,
    itemType: [BaseItemKind.MusicVideo]
};

const playlistsTabContent: LibraryTabContent = {
    viewType: LibraryTab.Playlists,
    isBtnFilterEnabled: false,
    isBtnGridListEnabled: false,
    isBtnNewPlaylistEnabled: true,
    isAlphabetPickerEnabled: false,
    itemType: [BaseItemKind.Playlist]
};

/** Start screen of the library, like the home screen: top 10, recently added, genres… */
const homeTabContent: LibraryTabContent = {
    viewType: LibraryTab.Home,
    collectionType: CollectionType.Musicvideos
};

const musicVideosViews: Record<number, LibraryTabContent> = {
    0: foldersTabContent,
    1: homeTabContent,
    2: musicVideosTabContent,
    3: playlistsTabContent
};

export default musicVideosViews;
