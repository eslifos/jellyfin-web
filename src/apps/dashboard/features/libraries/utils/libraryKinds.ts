/**
 * Library types offered when adding a library or changing its type. Anime and Kids are mixed movies and
 * shows libraries with a theme (LibraryOptions.ContentTheme) that gives them their own start screen;
 * Audiobooks is a books library with a theme.
 */
import type { VirtualFolderInfo } from '@jellyfin/sdk/lib/generated-client/models/virtual-folder-info';

import globalize from 'lib/globalize';

export type LibraryKind = 'movies' | 'tvshows' | 'anime' | 'kids' | 'music' | 'books' | 'audiobooks' | 'homevideos' | 'musicvideos' | 'mixed';

export interface LibraryKindOption {
    value: LibraryKind;
    /** Server collection type */
    collectionType: string;
    /** Theme: anime and kids (mixed libraries), audiobooks (books library) */
    theme?: 'anime' | 'kids' | 'audiobooks';
    label: string;
    description: string;
    /** Name suggested for a new library */
    defaultName: string;
}

export const getLibraryKinds = (): LibraryKindOption[] => [
    { value: 'movies', collectionType: 'movies', label: globalize.translate('Movies'), description: globalize.translate('LkMoviesHelp'), defaultName: globalize.translate('Movies') },
    { value: 'tvshows', collectionType: 'tvshows', label: globalize.translate('Shows'), description: globalize.translate('LkShowsHelp'), defaultName: globalize.translate('Shows') },
    { value: 'anime', collectionType: 'mixed', theme: 'anime', label: globalize.translate('LkAnime'), description: globalize.translate('LkAnimeHelp'), defaultName: globalize.translate('LkAnime') },
    { value: 'kids', collectionType: 'mixed', theme: 'kids', label: globalize.translate('LkKids'), description: globalize.translate('LkKidsHelp'), defaultName: globalize.translate('LkKids') },
    { value: 'music', collectionType: 'music', label: globalize.translate('TabMusic'), description: globalize.translate('LkMusicHelp'), defaultName: globalize.translate('TabMusic') },
    { value: 'audiobooks', collectionType: 'books', theme: 'audiobooks', label: globalize.translate('LkAudiobooks'), description: globalize.translate('LkAudiobooksHelp'), defaultName: globalize.translate('LkAudiobooks') },
    { value: 'books', collectionType: 'books', label: globalize.translate('Books'), description: globalize.translate('LkBooksHelp'), defaultName: globalize.translate('Books') },
    { value: 'homevideos', collectionType: 'homevideos', label: globalize.translate('HomeVideosPhotos'), description: globalize.translate('LkHomeVideosHelp'), defaultName: globalize.translate('HomeVideosPhotos') },
    { value: 'musicvideos', collectionType: 'musicvideos', label: globalize.translate('MusicVideos'), description: globalize.translate('LkMusicVideosHelp'), defaultName: globalize.translate('MusicVideos') },
    { value: 'mixed', collectionType: 'mixed', label: globalize.translate('MixedMoviesShows'), description: globalize.translate('LkMixedHelp'), defaultName: globalize.translate('MixedMoviesShows') }
];

/** The kind of an existing library: its theme for anime / kids, otherwise its collection type. */
export const getLibraryKind = (folder: VirtualFolderInfo): string => {
    const theme = (folder.LibraryOptions as { ContentTheme?: string | null } | undefined)?.ContentTheme;
    if (theme === 'anime' || theme === 'kids' || theme === 'audiobooks') return theme;
    return folder.CollectionType || 'mixed';
};
