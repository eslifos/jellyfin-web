import { beforeEach, describe, expect, test } from 'vitest';

import { addRecentSearch, clearRecentSearches, normalizeSearch, readRecentSearches, removeRecentSearch } from './recentSearches';

describe('recent searches', () => {
    beforeEach(() => localStorage.clear());

    test('the last one first, each user apart', () => {
        addRecentSearch('ana', 'Dune');
        addRecentSearch('ana', 'Shrek');
        addRecentSearch('luis', 'Coco');
        expect(readRecentSearches('ana')).toEqual([ 'Shrek', 'Dune' ]);
        expect(readRecentSearches('luis')).toEqual([ 'Coco' ]);
    });

    test('the same words again move up instead of repeating', () => {
        addRecentSearch('ana', 'Dune');
        addRecentSearch('ana', 'Shrek');
        addRecentSearch('ana', '  dune  ');
        expect(readRecentSearches('ana')).toEqual([ 'dune', 'Shrek' ]);
    });

    test('keeps the last eight', () => {
        for (let i = 1; i <= 10; i++) addRecentSearch('ana', `term ${i}`);
        const list = readRecentSearches('ana');
        expect(list).toHaveLength(8);
        expect(list[0]).toBe('term 10');
        expect(list[7]).toBe('term 3');
    });

    test('nothing for a letter, empty text or no user', () => {
        addRecentSearch('ana', 'a');
        addRecentSearch('ana', '   ');
        addRecentSearch(null, 'Dune');
        expect(readRecentSearches('ana')).toEqual([]);
        expect(readRecentSearches(null)).toEqual([]);
    });

    test('remove one and clear all', () => {
        addRecentSearch('ana', 'Dune');
        addRecentSearch('ana', 'Shrek');
        removeRecentSearch('ana', 'Dune');
        expect(readRecentSearches('ana')).toEqual([ 'Shrek' ]);
        clearRecentSearches('ana');
        expect(readRecentSearches('ana')).toEqual([]);
    });

    test('a damaged value is ignored', () => {
        localStorage.setItem('jf-recent-searches-ana', '{oops');
        expect(readRecentSearches('ana')).toEqual([]);
        localStorage.setItem('jf-recent-searches-ana', JSON.stringify([ 'ok', 3, null ]));
        expect(readRecentSearches('ana')).toEqual([ 'ok' ]);
    });

    test('normalize', () => {
        expect(normalizeSearch('  la   casa  de papel ')).toBe('la casa de papel');
    });
});
