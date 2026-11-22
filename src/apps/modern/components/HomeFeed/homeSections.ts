/**
 * Order and visibility of the home screen sections, per user (saved in the display preferences,
 * so they follow the account across devices). Each library is its own section ("lib:<id>").
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

import * as userSettings from 'scripts/settings/userSettings';

export const HOME_SECTIONS_SETTING = 'cosmicHomeSections';

export interface HomeSectionsSettings {
    order: string[];
    hidden: string[];
}

/** Sections before the libraries and after them, in the default order. */
export const SECTIONS_BEFORE = [ 'resume', 'nextup', 'listening', 'spotlight' ];
export const SECTIONS_AFTER = [ 'upcoming', 'recommendations', 'genres', 'favorites' ];

export const SECTION_LABELS: Record<string, string> = {
    resume: 'HfContinueWatching',
    nextup: 'HfNextUp',
    listening: 'HfContinueListening',
    spotlight: 'HfSpotlight',
    upcoming: 'HfUpcoming',
    recommendations: 'HfRecommendations',
    genres: 'HfGenres',
    favorites: 'Favorites'
};

export const libKey = (id: string) => `lib:${id}`;
export const isLibKey = (key: string) => key.startsWith('lib:');

type Settings = { get: (name: string, enableOnServer?: boolean) => unknown, set: (name: string, value: string, enableOnServer?: boolean) => void };

export const loadHomeSections = (settings: Settings = userSettings as unknown as Settings): HomeSectionsSettings => {
    try {
        const raw = settings.get(HOME_SECTIONS_SETTING, true) as string | null | undefined;
        if (!raw) return { order: [], hidden: [] };
        const parsed = JSON.parse(raw) as Partial<HomeSectionsSettings>;
        return {
            order: Array.isArray(parsed.order) ? parsed.order.filter(k => typeof k === 'string') : [],
            hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter(k => typeof k === 'string') : []
        };
    } catch {
        return { order: [], hidden: [] };
    }
};

export const saveHomeSections = (value: HomeSectionsSettings, settings: Settings = userSettings as unknown as Settings) => {
    settings.set(HOME_SECTIONS_SETTING, JSON.stringify(value), true);
};

/**
 * All the section keys in the user's order: the saved order first (sections that no longer exist are dropped),
 * then anything new in its default place (new libraries after the last library).
 */
export const orderSections = (views: BaseItemDto[], s: HomeSectionsSettings) => {
    // Collections are not a home section (they repeat the movies; they stay in the menu)
    const libs = views.filter(v => v.CollectionType !== 'boxsets').map(v => libKey(v.Id!));
    const defaults = [ ...SECTIONS_BEFORE, ...libs, ...SECTIONS_AFTER ];
    const order = s.order.filter(k => defaults.includes(k));
    for (const key of defaults.filter(k => !order.includes(k))) {
        order.splice(insertAt(order, key), 0, key);
    }
    return order;
};

/** Where a section missing from the saved order goes: libraries after the last library, the rest in their default group. */
const insertAt = (order: string[], key: string) => {
    let at = -1;
    if (isLibKey(key)) {
        const lastLib = order.reduce((last, k, i) => (isLibKey(k) ? i : last), -1);
        at = lastLib >= 0 ? lastLib + 1 : order.findIndex(k => SECTIONS_AFTER.includes(k));
    } else if (SECTIONS_BEFORE.includes(key)) {
        at = order.findIndex(k => isLibKey(k) || SECTIONS_AFTER.includes(k));
    }
    return at >= 0 ? at : order.length;
};
