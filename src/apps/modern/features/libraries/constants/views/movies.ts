import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';

import { LibraryTab } from 'types/libraryTab';
import type { LibraryTabContent } from 'types/libraryTabContent';

const moviesTabContent: LibraryTabContent = {
    viewType: LibraryTab.Movies,
    collectionType: CollectionType.Movies,
    isBtnPlayAllEnabled: true,
    isBtnShuffleEnabled: true,
    itemType: [BaseItemKind.Movie]
};

const collectionsTabContent: LibraryTabContent = {
    viewType: LibraryTab.Collections,
    collectionType: CollectionType.Movies,
    isBtnNewCollectionEnabled: true,
    itemType: [BaseItemKind.BoxSet],
    noItemsMessage: 'MessageNoCollectionsAvailable'
};

const favoritesTabContent: LibraryTabContent = {
    viewType: LibraryTab.Favorites,
    collectionType: CollectionType.Movies,
    itemType: [BaseItemKind.Movie]
};

/** Start screen of the library: top 10, trending, upcoming, recently added… */
const homeTabContent: LibraryTabContent = {
    viewType: LibraryTab.Home,
    collectionType: CollectionType.Movies,
    itemType: [BaseItemKind.Movie]
};

const genresTabContent: LibraryTabContent = {
    viewType: LibraryTab.Genres,
    collectionType: CollectionType.Movies,
    itemType: [BaseItemKind.Movie]
};

const playlistsTabContent: LibraryTabContent = {
    viewType: LibraryTab.Playlists,
    isBtnFilterEnabled: false,
    isBtnGridListEnabled: false,
    isBtnNewPlaylistEnabled: true,
    isAlphabetPickerEnabled: false,
    itemType: [BaseItemKind.Playlist]
};

const studiosTabContent: LibraryTabContent = {
    viewType: LibraryTab.Studios,
    itemType: [BaseItemKind.Movie],
    isBtnGridListEnabled: false,
    isBtnSortEnabled: false
};

const moviesViews: Record<number, LibraryTabContent> = {
    0: moviesTabContent,
    1: homeTabContent,
    2: favoritesTabContent,
    3: collectionsTabContent,
    4: genresTabContent,
    5: studiosTabContent,
    6: playlistsTabContent
};

export default moviesViews;
