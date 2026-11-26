/**
 * Pieces shared by the fast home page and the fast start page of each library: the data shapes, the banner,
 * rows, cards, "what do we watch today?" and the library block.
 */
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useQuery } from '@tanstack/react-query';
import React, { type FC, type ReactNode, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useMovieRecommendations } from 'apps/modern/features/libraries/hooks/api/useMovieRecommendations';
import layoutManager from 'components/layoutManager';
import { playbackManager } from 'components/playback/playbackmanager';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { itemRoute } from '../HomeFeed/feedUtils';
import { tmdbImageUrl } from '../HomeFeed/tmdbImage';

import './quickHome.scss';
import { prefersReducedMotion, scrollBehavior } from 'utils/reducedMotion';

/* ---------- Data ---------- */

export interface HomeCard {
    Id: string;
    Name: string;
    Type: string;
    Year?: number | null;
    Rating?: number | null;
    PrimaryTag?: string | null;
    BackdropTag?: string | null;
    LogoTag?: string | null;
    Overview?: string | null;
    Genres?: string[] | null;
    Note?: string | null;
    NoteCount?: number | null;
    /** Audiobooks: the author under the title, how much was listened to (0 to 1) and whether it is finished */
    Subtitle?: string | null;
    Progress?: number | null;
    Done?: boolean;
}

export interface ProgressCard {
    Id: string;
    Name: string;
    Subtitle?: string | null;
    Type: string;
    Progress: number;
    RemainingTicks?: number | null;
    PositionTicks: number;
    ImageItemId: string;
    ImageType: string;
    ImageTag?: string | null;
}

export type Shape = 'poster' | 'rank' | 'square' | 'round' | 'wide';

export interface Shelf {
    Key: string;
    Shape: Shape;
    Items: HomeCard[];
}

export interface Block {
    LibraryId: string;
    Name: string;
    CollectionType?: string | null;
    Rows: Shelf[];
    Spotlight?: HomeCard[];
    /** Only on the page of the library */
    Hero?: HomeCard[];
    Extra?: Shelf[];
    Upcoming?: Upcoming[];
}

export interface Upcoming {
    Kind: string;
    Title: string;
    ReleaseDate: string;
    ImageUrl?: string | null;
    ImagePath?: string | null;
    SeriesId?: string | null;
    SeriesName?: string | null;
    SeasonNumber?: number | null;
    EpisodeNumber?: number | null;
    CollectionName?: string | null;
    RelatedItemId?: string | null;
}

export interface Genre {
    Id: string;
    Name: string;
    Count: number;
}

export interface Library {
    Id: string;
    Name: string;
    CollectionType?: string | null;
}

export interface HomePage {
    Ready: boolean;
    Libraries: Library[];
    Hero: HomeCard[];
    Blocks: Block[];
    Spotlight?: HomeCard[];
    Upcoming: Upcoming[];
    Genres: Genre[];
}

export interface Personal {
    Continue: ProgressCard[];
    NextUp: ProgressCard[];
    Listening: ProgressCard[];
    Favorites: HomeCard[];
    LibraryRows: Block[];
}

export const get = async <T,>(api: Api, path: string, signal: AbortSignal) =>
    (await api.axiosInstance.get<T>(`${api.basePath}${path}`, { headers: { Authorization: api.authorizationHeader }, signal })).data;

export const useHomePage = () => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'QuickHome', user?.Id, 'page' ],
        queryFn: ({ signal }) => get<HomePage>(api!, '/HomeFeed/Page', signal),
        enabled: !!api && !!user?.Id,
        staleTime: 5 * 60 * 1000,
        // The very first time the server is still preparing it
        refetchInterval: query => (query.state.data && !query.state.data.Ready ? 20 * 1000 : false)
    });
};

export const usePersonal = () => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'QuickHome', user?.Id, 'personal' ],
        queryFn: ({ signal }) => get<Personal>(api!, '/HomeFeed/Personal', signal),
        enabled: !!api && !!user?.Id,
        staleTime: 30 * 1000
    });
};

/* ---------- Helpers ---------- */

export const POSTER_WIDTHS = [ 180, 360 ];
export const WIDE_WIDTHS = [ 400, 720 ];
export const HERO_WIDTHS = [ 720, 1280, 1920 ];
export const HERO_DELAY = 9000;
/** The banner goes on turning after this long without keys, touches or the wheel. */
export const HERO_IDLE_RESUME = 10000;

export const ROW_TITLES: Record<string, string> = {
    top10movies: 'QhTopMovies',
    top10series: 'QhTopSeries',
    latestmovies: 'QhLatestMovies',
    latest: 'QhLatest',
    releases: 'QhReleases',
    toprated: 'QhTopRated',
    gems: 'QhGems',
    classics: 'QhClassics',
    newepisodes: 'QhNewEpisodesRow',
    newseries: 'QhNewSeriesRow',
    onair: 'QhOnAirRow',
    marathon: 'QhMarathon',
    movies: 'QhMovies',
    newalbums: 'QhNewAlbums',
    artists: 'QhArtists',
    discoveralbums: 'QhDiscoverAlbums',
    mostplayed: 'QhMostPlayed',
    recentplayed: 'QhRecentPlayed',
    latestbooks: 'QhLatestBooks',
    discoverbooks: 'QhDiscover',
    discovervideos: 'QhDiscover'
};

export const ACCENTS: Record<string, string> = {
    movies: '#00a4dc',
    tvshows: '#aa5cc3',
    music: '#ec407a',
    books: '#ffb300',
    homevideos: '#26a69a',
    musicvideos: '#ef5350',
    photos: '#66bb6a'
};

export const ICONS: Record<string, string> = {
    movies: '🎬',
    tvshows: '📺',
    music: '🎵',
    books: '📚',
    homevideos: '📹',
    musicvideos: '🎤',
    photos: '🖼️'
};

export const imageUrl = (api: Api, id: string, type: string, tag: string | null | undefined, width: number) =>
    (tag ? `${api.basePath}/Items/${id}/Images/${type}?tag=${tag}&maxWidth=${width}&quality=85` : undefined);

export const srcSet = (api: Api, id: string, type: string, tag: string | null | undefined, widths: number[]) =>
    (tag ? widths.map(w => `${imageUrl(api, id, type, tag, w)} ${w}w`).join(', ') : undefined);

export const href = (item: Partial<BaseItemDto>, serverId?: string) => '#' + itemRoute({ ServerId: serverId, ...item } as BaseItemDto);

export const hashColor = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash * 31) + text.charCodeAt(i)) % 360;
    return `hsl(${hash}, 62%, 42%)`;
};

export const accentOf = (type?: string | null, name = '') => (type && ACCENTS[type]) || hashColor(name);

export const remaining = (ticks?: number | null) => {
    if (!ticks) return undefined;
    const total = Math.max(1, Math.round(ticks / 600000000));
    return total >= 60 ?
        globalize.translate('QhLeftHours', Math.floor(total / 60), total % 60) :
        globalize.translate('QhLeftMinutes', total);
};

export const noteLabel = (card: HomeCard) => {
    switch (card.Note) {
        case 'NewSeries':
            return globalize.translate('QhNewSeries');
        case 'NewEpisodes':
            return card.NoteCount && card.NoteCount > 1 ? globalize.translate('QhNewEpisodes', card.NoteCount) : globalize.translate('QhNewEpisode');
        case 'Movie':
            return globalize.translate('QhNewMovie');
        default:
            return undefined;
    }
};

export const recommendationTitle = (type?: string | null, name?: string | null) => {
    switch (type) {
        case 'SimilarToRecentlyPlayed':
            return globalize.translate('RecommendationBecauseYouWatched', name);
        case 'SimilarToLikedItem':
            return globalize.translate('RecommendationBecauseYouLike', name);
        case 'HasDirectorFromRecentlyPlayed':
        case 'HasLikedDirector':
            return globalize.translate('RecommendationDirectedBy', name);
        default:
            return globalize.translate('RecommendationStarring', name);
    }
};

export const toCard = (item: BaseItemDto): HomeCard => ({
    Id: item.Id ?? '',
    Name: item.Name ?? '',
    Type: item.Type ?? '',
    Year: item.ProductionYear,
    Rating: item.CommunityRating,
    PrimaryTag: item.ImageTags?.Primary
});

/** Draws its content only when it gets near the screen (keeps phones fast with many libraries). */
export const Lazy: FC<{ id?: string, height: number, children: ReactNode }> = ({ id, height, children }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [ shown, setShown ] = useState(typeof IntersectionObserver === 'undefined');

    useEffect(() => {
        if (shown || !ref.current) return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) setShown(true);
        }, { rootMargin: '700px 0px' });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ shown ]);

    if (shown) return <div id={id}>{children}</div>;
    return <div ref={ref} id={id} className='qh-placeholder' style={{ minHeight: height }} />;
};

/* ---------- Banner ---------- */

export const Hero: FC<{ api: Api, items: HomeCard[], serverId?: string }> = ({ api, items, serverId }) => {
    const [ index, setIndex ] = useState(0);
    const [ paused, setPaused ] = useState(false);
    const [ inView, setInView ] = useState(true);
    const ref = useRef<HTMLElement>(null);
    const playButton = useRef<HTMLButtonElement>(null);
    const touchX = useRef<number | null>(null);
    const count = items.length;
    const item = items[index % count];

    // TV: arriving at the home screen the remote is on "Play" of the banner
    useEffect(() => {
        if (!layoutManager.tv || document.querySelector('.dialog, [role="dialog"]')) return;
        playButton.current?.focus();
    }, []);

    // Only moves on its own while it is on screen, the tab is visible and nobody is looking at it
    useEffect(() => {
        if (!ref.current || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => setInView(entries.some(e => e.isIntersecting)), { threshold: 0.3 });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    // While someone is moving around (keys of the remote, touches, the wheel) or the banner gets the focus it stays
    // still; it goes on after 10 s without anything
    const [ busy, setBusy ] = useState(false);
    const idleTimer = useRef<number>();
    const markBusy = useCallback(() => {
        setBusy(true);
        window.clearTimeout(idleTimer.current);
        idleTimer.current = window.setTimeout(() => setBusy(false), HERO_IDLE_RESUME);
    }, []);
    useEffect(() => {
        const options = { capture: true, passive: true };
        window.addEventListener('keydown', markBusy, options);
        window.addEventListener('pointerdown', markBusy, options);
        window.addEventListener('wheel', markBusy, options);
        return () => {
            window.removeEventListener('keydown', markBusy, options);
            window.removeEventListener('pointerdown', markBusy, options);
            window.removeEventListener('wheel', markBusy, options);
            window.clearTimeout(idleTimer.current);
        };
    }, [ markBusy ]);

    useEffect(() => {
        if (paused || busy || !inView || count < 2 || prefersReducedMotion()) return;
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') setIndex(i => (i + 1) % count);
        }, HERO_DELAY);
        return () => window.clearInterval(timer);
    }, [ paused, busy, inView, count ]);

    const onPick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        setIndex(Number(e.currentTarget.dataset.index ?? 0));
    }, []);
    // The mouse over it holds it
    const onEnter = useCallback(() => setPaused(true), []);
    const onLeave = useCallback(() => setPaused(false), []);
    const onTouchStart = useCallback((e: TouchEvent) => {
        touchX.current = e.touches[0]?.clientX ?? null;
    }, []);
    const onTouchEnd = useCallback((e: TouchEvent) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null || Math.abs(end - start) < 40) return;
        setIndex(i => (i + (end < start ? 1 : count - 1)) % count);
    }, [ count ]);
    const onPlay = useCallback(() => {
        if (item) void playbackManager.play({ ids: [ item.Id ], serverId });
    }, [ item, serverId ]);

    if (!item) return null;

    const note = noteLabel(item);
    const logo = imageUrl(api, item.Id, 'Logo', item.LogoTag, 600);

    return (
        <section
            ref={ref}
            id='qh-spotlight'
            className='qh-hero'
            data-focus-row=''
            aria-roledescription='carousel'
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onFocus={markBusy}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            <img
                key={item.Id}
                className='qh-hero-bg'
                src={imageUrl(api, item.Id, 'Backdrop', item.BackdropTag, 1280)}
                srcSet={srcSet(api, item.Id, 'Backdrop', item.BackdropTag, HERO_WIDTHS)}
                sizes='100vw'
                alt=''
                fetchPriority='high'
            />
            <div className='qh-hero-shade' />
            <div className='qh-hero-body'>
                {note && <span className='qh-hero-note'>{note}</span>}
                {logo ?
                    <img className='qh-hero-logo' src={logo} alt={item.Name} /> :
                    <h2 className='qh-hero-title'>{item.Name}</h2>}
                <div className='qh-hero-meta'>
                    {item.Rating ? <span className='qh-star'>★ {item.Rating.toFixed(1)}</span> : null}
                    {item.Year ? <span>{item.Year}</span> : null}
                    {item.Genres?.slice(0, 3).map(g => <span key={g}>{g}</span>)}
                </div>
                {item.Overview && <p className='qh-hero-overview'>{item.Overview}</p>}
                <div className='qh-hero-actions'>
                    <button ref={playButton} type='button' className='qh-btn qh-btn-main' onClick={onPlay}>▶ {globalize.translate('QhPlay')}</button>
                    <a className='qh-btn' href={href({ Id: item.Id, Type: item.Type as BaseItemDto['Type'] }, serverId)}>{globalize.translate('QhInfo')}</a>
                </div>
            </div>
            {count > 1 && (
                <div className='qh-hero-picks' role='tablist'>
                    {items.map((p, i) => (
                        <button
                            key={p.Id}
                            type='button'
                            role='tab'
                            aria-selected={i === index % count}
                            aria-label={p.Name}
                            data-index={i}
                            className={i === index % count ? 'qh-pick is-active' : 'qh-pick'}
                            onClick={onPick}
                        >
                            <img src={imageUrl(api, p.Id, 'Primary', p.PrimaryTag, 120)} alt='' loading='lazy' decoding='async' />
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
};

/* ---------- Rows and cards ---------- */

export const Row: FC<{ id?: string, title: string, hint?: string, accent?: string, more?: string, children: ReactNode }> = ({ id, title, hint, accent, more, children }) => {
    const scroller = useRef<HTMLDivElement>(null);
    const scroll = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const el = scroller.current;
        if (!el) return;
        const dir = e.currentTarget.dataset.dir === 'left' ? -1 : 1;
        el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: scrollBehavior() });
    }, []);

    return (
        <section id={id} className='qh-row' data-focus-row='' style={accent ? { '--qh-accent': accent } as React.CSSProperties : undefined}>
            <header className='qh-row-head'>
                <h3 className='qh-row-title'>{title}</h3>
                {hint && <span className='qh-row-hint'>{hint}</span>}
                {more && <a className='qh-row-more' href={more}>{globalize.translate('QhSeeAll')} ›</a>}
            </header>
            <div className='qh-row-frame'>
                <button type='button' className='qh-arrow qh-arrow-left' data-dir='left' aria-label={globalize.translate('Previous')} onClick={scroll}>‹</button>
                <div ref={scroller} className='qh-scroller'>{children}</div>
                <button type='button' className='qh-arrow qh-arrow-right' data-dir='right' aria-label={globalize.translate('Next')} onClick={scroll}>›</button>
            </div>
        </section>
    );
};

/** Audiobooks and albums have square covers: never cut into a tall poster. */
export const SQUARE_TYPES = new Set([ 'AudioBook', 'MusicAlbum', 'Audio', 'MusicArtist' ]);

export const Card: FC<{ api: Api, card: HomeCard, shape: Shape, serverId?: string, rank?: number }> = ({ api, card, shape, serverId, rank }) => {
    const wide = shape === 'wide';
    const look = shape === 'poster' && SQUARE_TYPES.has(card.Type) ? 'square' : shape;
    return (
        <a className={`qh-card qh-card-${look}`} href={href({ Id: card.Id, Type: card.Type as BaseItemDto['Type'] }, serverId)} title={card.Name}>
            {rank ? <span className='qh-rank' aria-hidden='true'>{rank}</span> : null}
            <span className='qh-poster'>
                <img
                    src={imageUrl(api, card.Id, 'Primary', card.PrimaryTag, wide ? 400 : 180)}
                    srcSet={srcSet(api, card.Id, 'Primary', card.PrimaryTag, wide ? WIDE_WIDTHS : POSTER_WIDTHS)}
                    sizes={wide ? '(max-width: 600px) 72vw, 300px' : '(max-width: 600px) 34vw, 180px'}
                    alt=''
                    loading='lazy'
                    decoding='async'
                />
                {card.Rating && shape !== 'round' ? <span className='qh-badge'>★ {card.Rating.toFixed(1)}</span> : null}
                {card.Note === 'Continuing' && <span className='qh-badge qh-badge-live'>{globalize.translate('QhOnAir')}</span>}
                {card.Done && <span className='qh-done' aria-hidden='true'>✓</span>}
                {!card.Done && card.Progress && card.Progress > 0 ? <span className='qh-progress'><span style={{ width: `${Math.round(card.Progress * 100)}%` }} /></span> : null}
            </span>
            {!rank && (
                <>
                    <span className='qh-card-title'>{card.Name}</span>
                    {card.Subtitle ?? card.Year ? <span className='qh-card-sub'>{card.Subtitle ?? card.Year}</span> : null}
                </>
            )}
        </a>
    );
};

/** A press this long on a touch screen opens the menu of a card instead of playing it. */
const LONG_PRESS_MS = 550;

export const Wide: FC<{ api: Api, card: ProgressCard, serverId?: string, onMenu?: (card: ProgressCard, anchor: HTMLElement) => void }> = ({ api, card, serverId, onMenu }) => {
    // A long press opened the menu: the click that follows it does not play
    const pressed = useRef(false);
    const pressTimer = useRef<number>();
    const onPlay = useCallback(() => {
        if (pressed.current) {
            pressed.current = false;
            return;
        }
        void playbackManager.play({ ids: [ card.Id ], serverId, startPositionTicks: card.PositionTicks || undefined });
    }, [ card, serverId ]);
    const cancelPress = useCallback(() => window.clearTimeout(pressTimer.current), []);
    const onTouchStart = useCallback((e: React.TouchEvent<HTMLButtonElement>) => {
        if (!onMenu) return;
        const anchor = e.currentTarget;
        pressed.current = false;
        cancelPress();
        // iPhone and iPad do not fire contextmenu on a long press
        pressTimer.current = window.setTimeout(() => {
            pressed.current = true;
            onMenu(card, anchor);
        }, LONG_PRESS_MS);
    }, [ cancelPress, card, onMenu ]);
    // Right click, and the long press of Android
    const onContextMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        if (!onMenu) return;
        e.preventDefault();
        cancelPress();
        if (!pressed.current) onMenu(card, e.currentTarget);
        pressed.current = true;
    }, [ cancelPress, card, onMenu ]);
    const onMore = useCallback((e: React.MouseEvent<HTMLButtonElement>) => onMenu?.(card, e.currentTarget), [ card, onMenu ]);
    useEffect(() => cancelPress, [ cancelPress ]);
    const left = remaining(card.RemainingTicks);
    // Audiobooks, books and songs only have their square cover: shown whole
    const cover = card.ImageType === 'Primary' && ![ 'Episode', 'Movie', 'Video' ].includes(card.Type);

    const button = (
        <button
            type='button'
            className='qh-wide'
            onClick={onPlay}
            title={card.Name}
            {...(onMenu ? { onContextMenu, onTouchStart, onTouchEnd: cancelPress, onTouchMove: cancelPress, onTouchCancel: cancelPress } : {})}
        >
            <span className={cover ? 'qh-wide-img qh-wide-cover' : 'qh-wide-img'}>
                {cover && <img className='qh-wide-blur' src={imageUrl(api, card.ImageItemId, card.ImageType, card.ImageTag, 80)} alt='' aria-hidden='true' loading='lazy' decoding='async' />}
                <img
                    className={cover ? 'qh-wide-pic' : undefined}
                    src={imageUrl(api, card.ImageItemId, card.ImageType, card.ImageTag, 400)}
                    srcSet={srcSet(api, card.ImageItemId, card.ImageType, card.ImageTag, WIDE_WIDTHS)}
                    sizes='(max-width: 600px) 72vw, 300px'
                    alt=''
                    loading='lazy'
                    decoding='async'
                />
                <span className='qh-play' aria-hidden='true'>▶</span>
                {card.Progress > 0 && <span className='qh-progress'><span style={{ width: `${card.Progress}%` }} /></span>}
            </span>
            <span className='qh-card-title'>{card.Name}</span>
            <span className='qh-card-sub'>{[ card.Subtitle, left ].filter(Boolean).join(' · ')}</span>
        </button>
    );
    if (!onMenu) return button;

    // A menu of its own (a button cannot hold another one): over the picture, top right
    return (
        <div className='qh-wide-wrap'>
            {button}
            <button type='button' className='qh-wide-more' onClick={onMore} aria-haspopup='menu' aria-label={globalize.translate('QhCardMenu', card.Name)} title={globalize.translate('QhCardMenu', card.Name)}>
                <span aria-hidden='true'>⋮</span>
            </button>
        </div>
    );
};

export const UpcomingCard: FC<{ api: Api, release: Upcoming, serverId?: string }> = ({ api, release, serverId }) => {
    const target = release.Kind === 'Episode' ? release.SeriesId : release.RelatedItemId;
    const sources = useMemo(() => {
        const local = (type: string) => (target ? `${api.basePath}/Items/${target}/Images/${type}?maxWidth=480&quality=85` : undefined);
        // The TMDb picture from the server cache first, then straight from TMDb, then the library's own art
        return [ tmdbImageUrl(api.basePath, release, 'w300'), release.ImageUrl, local('Thumb'), local('Backdrop'), local('Primary') ].filter((s): s is string => !!s);
    }, [ api, release, target ]);
    const [ source, setSource ] = useState(0);
    const onError = useCallback(() => setSource(i => i + 1), []);
    const date = new Date(release.ReleaseDate).toLocaleDateString(globalize.getCurrentDateTimeLocale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    const episode = release.Kind === 'Episode' && release.SeasonNumber != null ? `T${release.SeasonNumber}:E${release.EpisodeNumber ?? '?'}` : release.CollectionName;
    const image = sources[source];
    return (
        <a className='qh-wide qh-upcoming' href={target ? href({ Id: target, Type: release.Kind === 'Episode' ? 'Series' : 'Movie' }, serverId) : undefined}>
            <span className='qh-wide-img'>
                {image && <img key={image} src={image} alt='' loading='lazy' decoding='async' referrerPolicy='no-referrer' onError={onError} />}
                <span className='qh-date'>{date}</span>
            </span>
            <span className='qh-card-title'>{release.SeriesName ?? release.Title}</span>
            <span className='qh-card-sub'>{[ episode, release.Kind === 'Episode' ? release.Title : undefined ].filter(Boolean).join(' · ')}</span>
        </a>
    );
};

export const ShelfRow: FC<{ api: Api, shelf: Shelf, serverId?: string, accent?: string }> = ({ api, shelf, serverId, accent }) => {
    const rank = shelf.Shape === 'rank';
    return (
        <Row
            title={shelf.Key.startsWith('genre:') ? shelf.Key.slice(6) : globalize.translate(ROW_TITLES[shelf.Key] ?? 'QhLatest')}
            hint={rank ? globalize.translate('QhTopHint') : undefined}
            accent={accent}
        >
            {shelf.Items.map((c, i) => <Card key={c.Id} api={api} card={c} shape={shelf.Shape} serverId={serverId} rank={rank ? i + 1 : undefined} />)}
        </Row>
    );
};

/* ---------- What do we watch today? ---------- */

export const Spotlight: FC<{ api: Api, items: HomeCard[], title: string, accent?: string, serverId?: string, id?: string }> = ({ api, items, title, accent, serverId, id }) => {
    // A different title each visit; "another one" goes through the rest
    const [ index, setIndex ] = useState(() => Math.floor(Math.random() * Math.max(1, items.length)));
    const item = items.length ? items[index % items.length] : undefined;
    const onNext = useCallback(() => setIndex(i => i + 1), []);
    const onPlay = useCallback(() => {
        if (item) void playbackManager.play({ ids: [ item.Id ], serverId });
    }, [ item, serverId ]);

    if (!item) return null;
    const logo = imageUrl(api, item.Id, 'Logo', item.LogoTag, 500);
    const link = href({ Id: item.Id, Type: item.Type as BaseItemDto['Type'] }, serverId);

    return (
        <section id={id} className='qh-row qh-spot-row' data-focus-row='' style={accent ? { '--qh-accent': accent } as React.CSSProperties : undefined}>
            <header className='qh-row-head'>
                <h3 className='qh-row-title'>{title}</h3>
                <span className='qh-row-hint'>{globalize.translate('HfSpotlightHelp')}</span>
            </header>
            <div className='qh-spot'>
                {item.BackdropTag ? (
                    <img
                        key={item.Id}
                        className='qh-spot-bg'
                        src={imageUrl(api, item.Id, 'Backdrop', item.BackdropTag, 1280)}
                        srcSet={srcSet(api, item.Id, 'Backdrop', item.BackdropTag, HERO_WIDTHS)}
                        sizes='(max-width: 600px) 100vw, 90vw'
                        alt=''
                        loading='lazy'
                        decoding='async'
                    />
                ) : (
                    // Books and audiobooks have no backdrop: their cover, blurred
                    <img key={item.Id} className='qh-spot-bg qh-spot-bg-blur' src={imageUrl(api, item.Id, 'Primary', item.PrimaryTag, 120)} alt='' loading='lazy' decoding='async' />
                )}
                <div className='qh-spot-shade' />
                <a className={SQUARE_TYPES.has(item.Type) ? 'qh-spot-poster qh-spot-square' : 'qh-spot-poster'} href={link} tabIndex={-1} aria-hidden='true' aria-label={item.Name} title={item.Name}>
                    <img key={item.Id} className='qh-spot-cover' src={imageUrl(api, item.Id, 'Primary', item.PrimaryTag, 300)} alt='' loading='lazy' decoding='async' />
                </a>
                <div key={item.Id} className='qh-spot-body'>
                    {logo ?
                        <img className='qh-spot-logo' src={logo} alt={item.Name} loading='lazy' /> :
                        <h4 className='qh-spot-title'>{item.Name}</h4>}
                    <div className='qh-hero-meta'>
                        {item.Rating ? <span className='qh-star'>★ {item.Rating.toFixed(1)}</span> : null}
                        {item.Year ? <span>{item.Year}</span> : null}
                        {item.Genres?.slice(0, 3).map(g => <span key={g}>{g}</span>)}
                    </div>
                    {item.Overview && <p className='qh-spot-overview'>{item.Overview}</p>}
                    <div className='qh-hero-actions'>
                        <button type='button' className='qh-btn qh-btn-main' onClick={onPlay}>▶ {globalize.translate('QhPlay')}</button>
                        <a className='qh-btn' href={link}>{globalize.translate('QhInfo')}</a>
                        {items.length > 1 && (
                            <button type='button' className='qh-btn qh-btn-dice' onClick={onNext}>🎲 {globalize.translate('HfAnother')}</button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

/* ---------- Library block ---------- */

export const LibraryBlock: FC<{ api: Api, block: Block, extra?: Shelf[], serverId?: string }> = ({ api, block, extra, serverId }) => {
    const type = block.CollectionType ?? undefined;
    const accent = accentOf(type, block.Name);
    const more = href({ Id: block.LibraryId, Type: 'CollectionFolder', CollectionType: type as BaseItemDto['CollectionType'] }, serverId);
    return (
        <section className='qh-block' style={{ '--qh-accent': accent } as React.CSSProperties}>
            <header className='qh-block-head'>
                <span className='qh-block-icon' aria-hidden='true'>{(type && ICONS[type]) || '✨'}</span>
                <h2 className='qh-block-title'>{block.Name}</h2>
                <a className='qh-row-more' href={more}>{globalize.translate('QhSeeAll')} ›</a>
            </header>
            {block.Rows.slice(0, 1).map(r => <ShelfRow key={r.Key} api={api} shelf={r} serverId={serverId} accent={accent} />)}
            {block.Spotlight && block.Spotlight.length > 0 && (
                <Spotlight api={api} items={block.Spotlight} title={globalize.translate(type === 'books' ? 'QhListenTodayIn' : 'QhSpotlightIn', block.Name)} accent={accent} serverId={serverId} />
            )}
            {block.Rows.slice(1).map(r => <ShelfRow key={r.Key} api={api} shelf={r} serverId={serverId} accent={accent} />)}
            {extra?.map(r => <ShelfRow key={r.Key} api={api} shelf={r} serverId={serverId} accent={accent} />)}
        </section>
    );
};

export const Recommendations: FC<{ api: Api, serverId?: string, parentId?: string }> = ({ api, serverId, parentId }) => {
    const { data } = useMovieRecommendations({ parentId, categoryLimit: parentId ? 2 : 3, itemLimit: 20 }, true);
    return (
        <div>
            {data?.filter(r => r.Items?.length).map(r => (
                <Row key={`${r.CategoryId}-${r.BaselineItemName}`} title={recommendationTitle(r.RecommendationType, r.BaselineItemName)} accent='#66bb6a'>
                    {r.Items?.filter(i => i.ImageTags?.Primary).map(i => <Card key={i.Id} api={api} card={toCard(i)} shape='poster' serverId={serverId} />)}
                </Row>
            ))}
        </div>
    );
};
