/**
 * Fast home page, by sections:
 *  - /HomeFeed/Page: what the server prepared with a scheduled task (banner, one block of rows per library,
 *    upcoming releases, genres). Cheap and shown first.
 *  - /HomeFeed/Personal: the rows of the user (continue, next up, listening, favorites, music played).
 *  - Recommendations: only when scrolled to them.
 * Library blocks are drawn when they get near the screen; cards are plain links with small lazy images, so
 * the page is light for the server, the network and phones alike. The order and the hidden sections are the
 * ones chosen in Settings → Home.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import React, { type FC, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LoadErrorState from 'components/common/LoadErrorState';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { formatNumber } from 'utils/localeNumber';
import { queryClient } from 'utils/query/queryClient';

import { isLibKey, loadHomeSections, orderSections } from '../HomeFeed/homeSections';
import ContinueRow from './ContinueRow';
import HomeEmptyState from './HomeEmptyState';
import {
    Card, Hero, Lazy, LibraryBlock, type ProgressCard, Recommendations, Row, Spotlight, UpcomingCard, Wide,
    hashColor, useHomePage, usePersonal
} from './parts';
import { useTvRows } from './useTvRows';

/* ---------- Page ---------- */

/** A stable empty list, so the row does not see new cards on every render. */
const NO_CARDS: ProgressCard[] = [];

const QuickHome: FC<{ nav?: ReactNode }> = ({ nav }) => {
    const { api, user, __legacyApiClient__: legacy } = useApi();
    const pageQuery = useHomePage();
    const personalQuery = usePersonal();
    const page = pageQuery.data;
    const personal = personalQuery.data;
    const root = useRef<HTMLDivElement>(null);
    // TV: the remote moves by rows
    useTvRows(root);
    const serverId = legacy?.serverId();
    const [ sections, setSections ] = useState(loadHomeSections);

    // Coming back to the home screen (after watching something or changing the settings) refreshes the user's rows
    useEffect(() => {
        const host = root.current?.closest('.page');
        if (!host) return;
        const onShow = () => {
            setSections(loadHomeSections());
            void queryClient.invalidateQueries({ queryKey: [ 'QuickHome', user?.Id, 'personal' ] });
        };
        host.addEventListener('viewshow', onShow);
        return () => host.removeEventListener('viewshow', onShow);
    }, [ user?.Id ]);

    const views = useMemo(() => (page?.Libraries ?? []).map(l => ({ Id: l.Id, Name: l.Name, CollectionType: l.CollectionType } as BaseItemDto)), [ page?.Libraries ]);
    const order = useMemo(() => orderSections(views, sections).filter(k => !sections.hidden.includes(k)), [ views, sections ]);
    const blocks = useMemo(() => new Map((page?.Blocks ?? []).map(b => [ `lib:${b.LibraryId}`, b ])), [ page?.Blocks ]);
    const personalRows = useMemo(() => new Map((personal?.LibraryRows ?? []).map(b => [ b.LibraryId, b.Rows ])), [ personal?.LibraryRows ]);
    const refetchPage = pageQuery.refetch;
    const refetchPersonal = personalQuery.refetch;
    const retryPage = useCallback(() => {
        void refetchPage();
        void refetchPersonal();
    }, [ refetchPage, refetchPersonal ]);
    const retryPersonal = useCallback(() => {
        void refetchPersonal();
    }, [ refetchPersonal ]);

    // The server did not answer and nothing was kept from before: say so instead of loading forever
    if (api && !page && pageQuery.isError) {
        return (
            <div ref={root} className='qh'>
                {nav}
                <LoadErrorState error={pageQuery.error} onRetry={retryPage} />
            </div>
        );
    }

    if (!api || !page) {
        return <div ref={root} className='qh qh-loading' aria-busy='true'><div className='qh-skeleton-hero' />{nav}<div className='qh-skeleton-row' /><div className='qh-skeleton-row' /></div>;
    }

    // Anything to watch: the banner, a row of a library or a row of the user
    const hasContent = page.Hero.length > 0
        || page.Blocks.some(b => b.Rows.some(r => r.Items.length > 0))
        || !!(personal && (personal.Continue.length || personal.NextUp.length || personal.Listening.length || personal.Favorites.length));

    const personalFailed = !personal && personalQuery.isError;

    const progressRow = (key: string, cards: ProgressCard[] | undefined, title: string, accent: string): ReactNode => (cards?.length ? (
        <Row key={key} id={`qh-${key}`} title={globalize.translate(title)} accent={accent}>
            {cards.map(c => <Wide key={c.Id} api={api} card={c} serverId={serverId} />)}
        </Row>
    ) : null);

    // One small piece per section, drawn in the user's order
    const sectionViews: Record<string, () => ReactNode> = {
        spotlight: () => (page.Spotlight?.length ? (
            <Spotlight key='spotlight' id='qh-today' api={api} items={page.Spotlight} title={globalize.translate('HfSpotlight')} accent='#ffca28' serverId={serverId} />
        ) : null),
        // With a menu on each card: remove it from the row (undo) or mark it as watched. Always mounted: when the
        // last card leaves, the row hides itself but keeps its undo notice
        // When the user's rows could not be asked for, their place says so (with retry)
        resume: () => (personalFailed ? (
            <LoadErrorState key='resume' error={personalQuery.error} onRetry={retryPersonal} />
        ) : (
            <ContinueRow key='resume' id='qh-resume' api={api} cards={personal?.Continue ?? NO_CARDS} title={globalize.translate('QhContinue')} accent='#00a4dc' serverId={serverId} />
        )),
        nextup: () => progressRow('nextup', personal?.NextUp, 'QhNextUp', '#aa5cc3'),
        listening: () => progressRow('listening', personal?.Listening, 'QhListening', '#ff7043'),
        upcoming: () => (page.Upcoming.length ? (
            <Lazy key='upcoming' id='qh-upcoming' height={240}>
                <Row title={globalize.translate('QhUpcoming')} hint={globalize.translate('QhUpcomingHint')} accent='#26c6da'>
                    {page.Upcoming.map(r => <UpcomingCard api={api} key={`${r.Kind}-${r.SeriesId ?? r.RelatedItemId}-${r.ReleaseDate}-${r.Title}`} release={r} serverId={serverId} />)}
                </Row>
            </Lazy>
        ) : null),
        // Heavy for the server: only asked when scrolled to, and never while the server prepares the page
        recommendations: () => (page.Ready ? (
            <Lazy key='recommendations' id='qh-recommendations' height={120}>
                <Recommendations api={api} serverId={serverId} />
            </Lazy>
        ) : null),
        genres: () => (page.Genres.length ? (
            <section key='genres' id='qh-genres' className='qh-row' data-focus-row=''>
                <header className='qh-row-head'><h3 className='qh-row-title'>{globalize.translate('QhGenres')}</h3></header>
                <div className='qh-genre-list'>
                    {page.Genres.map(g => (
                        <a key={g.Id} className='qh-genre' href={`#/genre?genreId=${g.Id}`} aria-label={globalize.translate('QhGenreLabel', g.Name, formatNumber(g.Count))} style={{ '--qh-genre': hashColor(g.Name) } as React.CSSProperties}>
                            <span>{g.Name}</span>
                            <small>{formatNumber(g.Count)}</small>
                        </a>
                    ))}
                </div>
            </section>
        ) : null),
        favorites: () => (personal?.Favorites.length ? (
            <Lazy key='favorites' id='qh-favorites' height={300}>
                <Row title={globalize.translate('Favorites')} accent='#ef5350'>
                    {personal.Favorites.map(c => <Card key={c.Id} api={api} card={c} shape='poster' serverId={serverId} />)}
                </Row>
            </Lazy>
        ) : null)
    };

    const libraryView = (key: string) => {
        const block = blocks.get(key);
        return (
            <Lazy key={key} id={block ? `qh-${block.LibraryId}` : undefined} height={block ? 260 * Math.min(block.Rows.length, 3) : 0}>
                {block && <LibraryBlock api={api} block={block} extra={personalRows.get(block.LibraryId)} serverId={serverId} />}
            </Lazy>
        );
    };

    const render = (key: string): ReactNode => (isLibKey(key) ? libraryView(key) : sectionViews[key]?.() ?? null);

    // Under the banner: "still preparing", or the empty home (not when the user's rows just failed to load)
    let intro: ReactNode = null;
    if (hasContent) {
        if (!page.Ready) intro = <p className='qh-preparing'>{globalize.translate('QhPreparing')}</p>;
    } else if (!personalFailed) {
        intro = <HomeEmptyState hasLibraries={page.Libraries.length > 0} ready={page.Ready} />;
    }

    return (
        <div ref={root} className='qh'>
            {/* The banner always goes on top, edge to edge, then the one row of libraries and universes */}
            {page.Hero.length > 0 && <Hero api={api} items={page.Hero} serverId={serverId} />}
            {nav}
            {intro}
            {order.map(render)}
        </div>
    );
};

export default QuickHome;
