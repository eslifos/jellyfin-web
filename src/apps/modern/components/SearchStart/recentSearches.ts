/**
 * The last searches of each user, on this device (localStorage). A search is kept when it was used: Enter pressed or
 * a result opened, never every letter typed. Shared by the search page and the search window.
 */
import { useEffect, useState } from 'react';

const MAX = 8;
const listeners = new Set<() => void>();

const keyOf = (userId: string) => `jf-recent-searches-${userId}`;

/** One space between words, and only searches of a useful length. */
export const normalizeSearch = (term: string) => term.trim().replace(/\s+/g, ' ').slice(0, 100);

export const readRecentSearches = (userId?: string | null): string[] => {
    if (!userId) return [];
    try {
        const saved: unknown = JSON.parse(localStorage.getItem(keyOf(userId)) || '[]');
        return Array.isArray(saved) ? saved.filter((s): s is string => typeof s === 'string').slice(0, MAX) : [];
    } catch {
        return [];
    }
};

const write = (userId: string, list: string[]) => {
    try {
        if (list.length) localStorage.setItem(keyOf(userId), JSON.stringify(list.slice(0, MAX)));
        else localStorage.removeItem(keyOf(userId));
    } catch {
        // Storage blocked (private window): the list just is not kept
    }
    for (const notify of listeners) notify();
};

/** Puts a search first (the same words in other letter case count once). */
export const addRecentSearch = (userId: string | null | undefined, term: string) => {
    const value = normalizeSearch(term);
    if (!userId || value.length < 2) return;
    const lower = value.toLowerCase();
    write(userId, [ value, ...readRecentSearches(userId).filter(s => s.toLowerCase() !== lower) ]);
};

export const removeRecentSearch = (userId: string | null | undefined, term: string) => {
    if (!userId) return;
    write(userId, readRecentSearches(userId).filter(s => s !== term));
};

export const clearRecentSearches = (userId: string | null | undefined) => {
    if (userId) write(userId, []);
};

/** The list, up to date when a search is added here, in the other search view or in another tab. */
export const useRecentSearches = (userId?: string | null) => {
    const [ list, setList ] = useState(() => readRecentSearches(userId));
    useEffect(() => {
        const refresh = () => setList(readRecentSearches(userId));
        refresh();
        listeners.add(refresh);
        window.addEventListener('storage', refresh);
        return () => {
            listeners.delete(refresh);
            window.removeEventListener('storage', refresh);
        };
    }, [ userId ]);
    return list;
};
