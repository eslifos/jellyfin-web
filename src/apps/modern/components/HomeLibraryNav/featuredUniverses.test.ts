import { describe, expect, it } from 'vitest';

import { featuredUniverses, sameNameKey, type UniverseLike } from './featuredUniverses';

const universe = (Id: string, Name: string, extra: Partial<UniverseLike> = {}): UniverseLike => ({
    Id, Name, Source: 'auto', Hidden: false, MovieCount: 2, SeriesCount: 0, AlbumCount: 0, CollectionCount: 0, ...extra
});

describe('HomeLibraryNav: featuredUniverses', () => {
    it('Should compare names without case, accents or extra spaces', () => {
        expect(sameNameKey('  Música ')).toBe(sameNameKey('musica'));
        expect(sameNameKey('La  Momia')).toBe(sameNameKey('la momia'));
        expect(sameNameKey('Niños')).not.toBe(sameNameKey('Nidos'));
    });

    it('Should leave out a universe named like a library', () => {
        const names = featuredUniverses([ universe('a', 'Anime'), universe('b', 'MÚSICA'), universe('c', 'Star Wars') ], [ 'Anime', 'Música' ]).map(u => u.Name);
        expect(names).toEqual([ 'Star Wars' ]);
    });

    it('Should show two universes with the same name only once (the bigger)', () => {
        const result = featuredUniverses([ universe('small', 'La momia', { MovieCount: 2 }), universe('big', 'La Momia', { MovieCount: 5 }) ], []);
        expect(result.map(u => u.Id)).toEqual([ 'big' ]);
    });

    it('Should put the built-in sagas first, then the biggest', () => {
        const result = featuredUniverses([
            universe('auto-big', 'Rocky', { MovieCount: 40 }),
            universe('builtin', 'Star Wars', { Source: 'builtin', MovieCount: 3 }),
            universe('custom', 'Mis favoritas', { Source: 'custom', MovieCount: 1 }),
            universe('auto-small', 'Shrek', { MovieCount: 4 })
        ], []);
        expect(result.map(u => u.Id)).toEqual([ 'builtin', 'custom', 'auto-big', 'auto-small' ]);
    });

    it('Should leave out hidden and empty universes and keep the limit', () => {
        const many = Array.from({ length: 20 }, (_, i) => universe(`u${i}`, `Universo ${i}`, { MovieCount: 20 - i }));
        const result = featuredUniverses([ universe('hidden', 'Oculto', { Hidden: true, MovieCount: 99 }), universe('empty', 'Vacío', { MovieCount: 0 }), ...many ], [], 8);
        expect(result).toHaveLength(8);
        expect(result.map(u => u.Id)).not.toContain('hidden');
        expect(result.map(u => u.Id)).not.toContain('empty');
        expect(result[0].Id).toBe('u0');
    });
});
