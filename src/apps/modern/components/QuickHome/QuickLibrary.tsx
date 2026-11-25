/**
 * Fast start page of a library (movies, series, mixed like anime or kids, music, books, music videos, home
 * videos), built like the home page:
 *  - /HomeFeed/Library/{id}: what the scheduled task prepared (banner with its top 10 or its artists, "what do
 *    we watch / read today?", rows, genres, upcoming). Cheap and shown first.
 *  - /HomeFeed/Library/{id}/Personal: continue watching or listening, next up, music played and favorites of
 *    the user in this library.
 *  - In theaters / coming soon (TMDb) and recommendations: movies only, when scrolled to them.
 * Rows below the screen are drawn when they get near, so phones stay fast.
 */
import { useQuery } from '@tanstack/react-query';
import React, { type FC, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { type ExternalMovie, ExternalMovieDialog } from 'apps/modern/components/Trailer';
import LoadErrorState from 'components/common/LoadErrorState';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { ExternalCard, type UpcomingRelease } from '../HomeFeed/FeedWidgets';
import {
    type Block, Card, Hero, ICONS, Lazy, type Personal, type ProgressCard, Recommendations, Row, type Shape, ShelfRow, Spotlight,
    UpcomingCard, Wide, accentOf, get
} from './parts';

interface LibraryPage {
    Ready: boolean;
    Block?: Block | null;
}

interface LibraryDiscovery {
    Upcoming: UpcomingRelease[];
    NowPlaying: UpcomingRelease[];
}

const useLibraryPage = (libraryId: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'QuickLibrary', user?.Id, libraryId, 'page' ],
        queryFn: ({ signal }) => get<LibraryPage>(api!, `/HomeFeed/Library/${libraryId}`, signal),
        enabled: !!api && !!user?.Id,
        staleTime: 5 * 60 * 1000,
        // The very first time the server is still preparing it
        refetchInterval: query => (query.state.data && !query.state.data.Ready ? 20 * 1000 : false)
    });
};

const useLibraryPersonal = (libraryId: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'QuickLibrary', user?.Id, libraryId, 'personal' ],
        queryFn: ({ signal }) => get<Personal>(api!, `/HomeFeed/Library/${libraryId}/Personal`, signal),
        enabled: !!api && !!user?.Id,
        staleTime: 30 * 1000
    });
};

/** In theaters and coming soon (TMDb): heavier, so only asked when scrolled to. */
const TheaterRows: FC<{ libraryId: string, theme?: string, onOpen: (movie: ExternalMovie) => void }> = ({ libraryId, theme, onOpen }) => {
    const { api, user } = useApi();
    const { data } = useQuery({
        queryKey: [ 'QuickLibrary', user?.Id, libraryId, 'theaters', theme ],
        queryFn: ({ signal }) => get<LibraryDiscovery>(api!, '/Discovery/Library/' + libraryId + (theme ? '?theme=' + theme : ''), signal),
        enabled: !!api && !!user?.Id,
        staleTime: 30 * 60 * 1000
    });

    // Anime and kids only get their kind of movies: fewer, so a shorter row is fine
    const min = theme ? 3 : 4;
    return (
        <>
            {(data?.NowPlaying?.length ?? 0) >= min && (
                <Row title={globalize.translate('MoviesHomeNowPlaying')} accent='#ff7043'>
                    {data?.NowPlaying.map(r => <ExternalCard key={r.TmdbId} release={r} showDate={false} onOpen={onOpen} />)}
                </Row>
            )}
            {(data?.Upcoming?.length ?? 0) >= min && (
                <Row title={globalize.translate('MoviesHomeUpcoming')} accent='#ffab40'>
                    {data?.Upcoming.map(r => <ExternalCard key={r.TmdbId} release={r} showDate onOpen={onOpen} />)}
                </Row>
            )}
        </>
    );
};

/** Libraries without a banner open with their name, like the blocks of the home page. */
const LibraryTitle: FC<{ name: string, type?: string }> = ({ name, type }) => (
    <header className='qh-library-head'>
        <span className='qh-block-icon' aria-hidden='true'>{(type && ICONS[type]) || '✨'}</span>
        <h1 className='qh-library-name'>{name}</h1>
    </header>
);

/** "What do we … today?" in the words of each kind of library. */
const spotlightTitle = (type: string | undefined, name: string) => {
    if (type === 'books') return globalize.translate('QhReadTodayIn', name);
    return globalize.translate('QhSpotlightIn', name);
};

/** Favorites keep the shape of the library: wide music videos and home videos, posters for the rest. */
const favoriteShape = (type?: string): Shape => (type === 'musicvideos' || type === 'homevideos' ? 'wide' : 'poster');

const QuickLibrary: FC<{ libraryId: string, name?: string, accent?: string, theme?: string }> = ({ libraryId, name, accent: themeAccent, theme }) => {
    const { api, user, __legacyApiClient__: legacy } = useApi();
    const pageQuery = useLibraryPage(libraryId);
    const { data: personal, refetch: refetchPersonal } = useLibraryPersonal(libraryId);
    const page = pageQuery.data;
    const refetchPage = pageQuery.refetch;
    const retry = useCallback(() => {
        void refetchPage();
        void refetchPersonal();
    }, [ refetchPage, refetchPersonal ]);
    const root = useRef<HTMLDivElement>(null);
    const serverId = legacy?.serverId();
    const [ external, setExternal ] = useState<ExternalMovie | null>(null);
    const onCloseExternal = useCallback(() => setExternal(null), []);

    // Coming back to this page (after watching something) refreshes the user's rows
    useEffect(() => {
        const host = root.current?.closest('.page');
        if (!host) return;
        const onShow = () => {
            void queryClient.invalidateQueries({ queryKey: [ 'QuickLibrary', user?.Id, libraryId, 'personal' ] });
        };
        host.addEventListener('viewshow', onShow);
        return () => host.removeEventListener('viewshow', onShow);
    }, [ user?.Id, libraryId ]);

    // The server did not answer and nothing was kept from before: say so instead of loading forever
    if (api && !page && pageQuery.isError) {
        return <div ref={root} className='qh'><LoadErrorState error={pageQuery.error} onRetry={retry} /></div>;
    }

    if (!api || !page) {
        return <div ref={root} className='qh qh-loading' aria-busy='true'><div className='qh-skeleton-hero' /><div className='qh-skeleton-row' /><div className='qh-skeleton-row' /></div>;
    }

    const block = page.Block;
    const type = block?.CollectionType ?? undefined;
    const accent = themeAccent ?? accentOf(type, block?.Name ?? name ?? '');
    // Movies alone or with series (anime, kids): what is in theaters and recommendations
    const hasMovies = !!block && (!type || type === 'movies');
    const playedRows = personal?.LibraryRows.find(b => b.LibraryId === libraryId)?.Rows ?? [];

    const progressRow = (key: string, cards: ProgressCard[] | undefined, title: string, color: string): ReactNode => (cards?.length ? (
        <Row key={key} title={globalize.translate(title)} accent={color}>
            {cards.map(c => <Wide key={c.Id} api={api} card={c} serverId={serverId} />)}
        </Row>
    ) : null);

    const rows = block?.Rows ?? [];
    const extra = block?.Extra ?? [];
    const upcoming = block?.Upcoming ?? [];

    return (
        <div ref={root} className='qh qh-library' style={{ '--qh-accent': accent } as React.CSSProperties}>
            {block?.Hero && block.Hero.length > 0 ?
                <Hero api={api} items={block.Hero} serverId={serverId} /> :
                <LibraryTitle name={block?.Name ?? name ?? ''} type={type} />}
            {!page.Ready && <p className='qh-preparing'>{globalize.translate('QhPreparing')}</p>}

            {progressRow('resume', personal?.Continue, 'QhContinue', '#00a4dc')}
            {progressRow('listening', personal?.Listening, 'QhListening', '#ff7043')}
            {progressRow('nextup', personal?.NextUp, 'QhNextUp', '#aa5cc3')}

            {rows.slice(0, 1).map(r => <ShelfRow key={r.Key} api={api} shelf={r} serverId={serverId} accent={accent} />)}
            {playedRows.map(r => <ShelfRow key={r.Key} api={api} shelf={r} serverId={serverId} accent={accent} />)}
            {block?.Spotlight && block.Spotlight.length > 0 && (
                <Spotlight api={api} items={block.Spotlight} title={spotlightTitle(type, block.Name)} accent={accent} serverId={serverId} />
            )}
            {rows.slice(1, 3).map(r => <ShelfRow key={r.Key} api={api} shelf={r} serverId={serverId} accent={accent} />)}

            {upcoming.length > 0 && (
                <Lazy height={240}>
                    <Row title={globalize.translate('QhUpcoming')} hint={globalize.translate('QhUpcomingHint')} accent='#26c6da'>
                        {upcoming.map(r => <UpcomingCard key={`${r.Kind}-${r.SeriesId ?? r.RelatedItemId}-${r.ReleaseDate}-${r.Title}`} api={api} release={r} serverId={serverId} />)}
                    </Row>
                </Lazy>
            )}

            {rows.slice(3).map(r => (
                <Lazy key={r.Key} height={300}>
                    <ShelfRow api={api} shelf={r} serverId={serverId} accent={accent} />
                </Lazy>
            ))}

            {hasMovies && page.Ready && (
                <Lazy height={300}>
                    <TheaterRows libraryId={libraryId} theme={theme} onOpen={setExternal} />
                </Lazy>
            )}

            {extra.map(r => (
                <Lazy key={r.Key} height={300}>
                    <ShelfRow api={api} shelf={r} serverId={serverId} accent={accent} />
                </Lazy>
            ))}

            {hasMovies && page.Ready && (
                <Lazy height={120}>
                    <Recommendations api={api} serverId={serverId} parentId={libraryId} />
                </Lazy>
            )}

            {personal && personal.Favorites.length > 0 && (
                <Lazy height={300}>
                    <Row title={globalize.translate('Favorites')} accent='#ef5350'>
                        {personal.Favorites.map(c => <Card key={c.Id} api={api} card={c} shape={favoriteShape(type)} serverId={serverId} />)}
                    </Row>
                </Lazy>
            )}
            <ExternalMovieDialog movie={external} parentId={libraryId} onClose={onCloseExternal} />
        </div>
    );
};

export default QuickLibrary;
