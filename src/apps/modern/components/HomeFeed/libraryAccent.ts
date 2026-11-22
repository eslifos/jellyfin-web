/**
 * The colour of each library (anime and kids have their own).
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

import { THEME_ACCENT, themeOf } from './libraryThemes';

export const LIBRARY_ACCENT: Record<string, string> = {
    movies: '#00a4dc',
    tvshows: '#aa5cc3',
    music: '#ec407a',
    books: '#ffb300',
    audiobooks: '#ff7043',
    homevideos: '#26a69a',
    photos: '#66bb6a',
    musicvideos: '#ef5350',
    boxsets: '#7e57c2',
    playlists: '#29b6f6',
    livetv: '#ef5350'
};

/** Anime libraries are tvshows libraries; they get their own colour when the name says so. */
export const libraryAccent = (view: BaseItemDto) => {
    const theme = themeOf(view);
    return theme ? THEME_ACCENT[theme] : LIBRARY_ACCENT[view.CollectionType || ''] ?? '#00a4dc';
};
