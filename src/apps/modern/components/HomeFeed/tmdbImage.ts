/**
 * TMDb pictures of upcoming releases come from the server cache (Discovery/Images) at the size each place needs:
 * the browser never depends on reaching TMDb and never downloads the original size.
 */
export type TmdbSize = 'w92' | 'w154' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780';

/** A TMDb picture URL of any size: https://image.tmdb.org/t/p/{size}/{file}. */
const TMDB_URL = /^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+\/([A-Za-z0-9_-]+\.(?:jpe?g|png))$/;

export interface WithTmdbImage {
    /** The TMDb path ("/abc.jpg"); servers before it was added only send ImageUrl. */
    ImagePath?: string | null;
    ImageUrl?: string | null;
}

/** The TMDb file of a release: its ImagePath, or the one inside its ImageUrl. */
export const tmdbFile = (release: WithTmdbImage) => {
    const fromPath = release.ImagePath?.replace(/^\//, '');
    if (fromPath) return fromPath;
    return release.ImageUrl ? TMDB_URL.exec(release.ImageUrl)?.[1] : undefined;
};

/** The picture from the server at a TMDb size, or undefined when the release has none. */
export const tmdbImageUrl = (basePath: string, release: WithTmdbImage, size: TmdbSize) => {
    const file = tmdbFile(release);
    return file ? `${basePath}/Discovery/Images/${size}/${encodeURIComponent(file)}` : undefined;
};
