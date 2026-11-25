/**
 * The universes shown in the home library bar, after the libraries: the main ones first (the built-in sagas),
 * then the biggest. A universe named like a library ("Anime") or like another universe ("La Momia" / "La momia")
 * is shown only once.
 */

/** What the bar needs of a universe (a summary of /MetaUniverses). */
export interface UniverseLike {
    Id: string;
    Name: string;
    Source: 'builtin' | 'auto' | 'custom';
    Hidden: boolean;
    MovieCount: number;
    SeriesCount: number;
    AlbumCount: number;
    CollectionCount: number;
}

/** How many fit in the bar without hiding the libraries. */
export const MAX_FEATURED_UNIVERSES = 8;

/** Names compared without case, accents or extra spaces: "Música" = "musica". */
export const sameNameKey = (name?: string | null) => (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const SOURCE_RANK: Record<UniverseLike['Source'], number> = { builtin: 0, custom: 1, auto: 2 };

const size = (u: UniverseLike) => u.MovieCount + u.SeriesCount + u.AlbumCount + u.CollectionCount;

export const featuredUniverses = <T extends UniverseLike>(universes: readonly T[], libraryNames: readonly string[], max = MAX_FEATURED_UNIVERSES): T[] => {
    const taken = new Set(libraryNames.map(sameNameKey));
    const ranked = universes
        .filter(u => !u.Hidden && size(u) > 0 && sameNameKey(u.Name))
        .sort((a, b) => SOURCE_RANK[a.Source] - SOURCE_RANK[b.Source] || size(b) - size(a) || a.Name.localeCompare(b.Name));
    const result: T[] = [];
    for (const u of ranked) {
        if (result.length >= max) break;
        const key = sameNameKey(u.Name);
        if (taken.has(key)) continue;
        taken.add(key);
        result.push(u);
    }
    return result;
};
