/**
 * Fast start page of an audiobooks library, with the look of the other libraries (edge to edge banner, rows,
 * "what do we listen to today?") and what makes audiobooks easy: carry on where you left off (by parts),
 * sagas in order, authors, narrators, short listens and marathons, finished books.
 * One request: /Audiobooks/{id}/Home sends the sections and the books they show (prepared in the background).
 */
import { useQuery } from '@tanstack/react-query';
import React, { type FC, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { playbackManager } from 'components/playback/playbackmanager';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { GenresSection } from '../HomeFeed/feedParts';
import { Card, type HomeCard, Lazy, Row, Spotlight, get, href, imageUrl } from './parts';
import { useTvRows } from './useTvRows';

import './quickAudiobooks.scss';
import { prefersReducedMotion, scrollBehavior } from 'utils/reducedMotion';

interface AbProgress {
    ItemId: string;
    ResumeItemId: string;
    StartPositionTicks: number;
    PartIds: string[];
    PartIndex: number;
    Progress: number;
    RunTimeTicks: number;
    RemainingTicks: number;
}

interface AbShelf {
    Name: string;
    ItemIds: string[];
    Count: number;
    Finished: number;
}

interface AbBook {
    Id: string;
    Name: string;
    Type: string;
    Author?: string | null;
    Narrator?: string | null;
    RunTimeTicks: number;
    PrimaryTag?: string | null;
    Overview?: string | null;
    Year?: number | null;
    Rating?: number | null;
    Genres?: string[];
    Saga?: string | null;
    SagaIndex?: number | null;
    Progress: number;
    Finished: boolean;
}

interface AbHome {
    Hero?: AbProgress | null;
    Continue: AbProgress[];
    Latest: string[];
    Finished: string[];
    Unstarted: string[];
    Short: string[];
    Long: string[];
    Sagas: AbShelf[];
    Authors: AbShelf[];
    Narrators: AbShelf[];
    TotalBooks: number;
    TotalTicks: number;
    FinishedCount: number;
    Books?: AbBook[];
}

const TICKS_PER_MINUTE = 600000000;
const HERO_DELAY = 10000;

const norm = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

const hoursText = (ticks?: number | null) => {
    if (!ticks) return undefined;
    const minutes = Math.max(1, Math.round(ticks / TICKS_PER_MINUTE));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
};

/**
 * Store titles can be long: "Nietzsche para estresados (Narración en castellano) [Nietzsche for Stressed]: 99 píldoras… (Unabridged)".
 * Shown as the title itself: without edition notes, the original title in brackets or a long subtitle.
 */
const EDITION_WORDS = [ 'unabridged', 'abridged', 'narraci', 'narrado', 'íntegr', 'integr', 'audiolibro', 'castellano', 'latino', 'edición', 'edition' ];
const EDGE = ' :-–,';
const CLOSERS = new Map([ [ '[', ']' ], [ '(', ')' ] ]);

/** Removes "[…]" groups and "(…)" groups that are edition notes, scanning once. */
const withoutNotes = (name: string) => {
    let out = '';
    let i = 0;
    while (i < name.length) {
        const open = name[i];
        const close = CLOSERS.get(open) ?? '';
        const end = close ? name.indexOf(close, i + 1) : -1;
        if (end > i) {
            const inner = name.slice(i + 1, end).toLowerCase();
            if (open === '[' || EDITION_WORDS.some(w => inner.includes(w))) {
                out += ' ';
                i = end + 1;
                continue;
            }
        }
        out += name[i];
        i++;
    }
    return out.split(' ').filter(Boolean).join(' ');
};

const trimEdges = (text: string) => {
    let start = 0;
    let end = text.length;
    while (start < end && EDGE.includes(text[start])) start++;
    while (end > start && EDGE.includes(text[end - 1])) end--;
    return text.slice(start, end);
};

const bookTitle = (full?: string | null) => {
    const name = full ?? '';
    let text = trimEdges(withoutNotes(name));
    const colon = text.indexOf(':');
    if (colon > 2 && text.length > 48) text = text.slice(0, colon).trim();
    return text || name;
};

const toCard = (book: AbBook, line?: string): HomeCard => ({
    Id: book.Id,
    Name: bookTitle(book.Name),
    Type: book.Type,
    Year: book.Year,
    Rating: book.Rating,
    PrimaryTag: book.PrimaryTag,
    Overview: book.Overview,
    Genres: book.Genres,
    Subtitle: line ?? book.Author,
    Progress: book.Progress,
    Done: book.Finished
});

const playBook = (progress: AbProgress, serverId?: string) => {
    void playbackManager.play({ ids: progress.PartIds.slice(progress.PartIndex), serverId, startPositionTicks: progress.StartPositionTicks });
};

const useAudiobooks = (libraryId: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'QuickAudiobooks', user?.Id, libraryId ],
        queryFn: ({ signal }) => get<AbHome>(api!, `/Audiobooks/${libraryId}/Home`, signal),
        enabled: !!api && !!user?.Id,
        staleTime: 30 * 1000
    });
};

/* ---------- Banner ---------- */

interface Slide {
    book: AbBook;
    progress?: AbProgress;
}

const Equalizer: FC = () => (
    <span className='ab-eq' aria-hidden='true'><i /><i /><i /><i /></span>
);

const AbHero: FC<{ slides: Slide[], home: AbHome, serverId?: string }> = ({ slides, home, serverId }) => {
    const { api } = useApi();
    const [ index, setIndex ] = useState(0);
    const [ paused, setPaused ] = useState(false);
    const touchX = useRef<number | null>(null);
    const count = slides.length;
    const slide = slides[index % Math.max(1, count)];

    useEffect(() => {
        if (paused || count < 2 || prefersReducedMotion()) return;
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') setIndex(i => (i + 1) % count);
        }, HERO_DELAY);
        return () => window.clearInterval(timer);
    }, [ paused, count ]);

    const onPick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => setIndex(Number(e.currentTarget.dataset.index ?? 0)), []);
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
        if (!slide) return;
        if (slide.progress) playBook(slide.progress, serverId);
        else void playbackManager.play({ ids: [ slide.book.Id ], serverId });
    }, [ slide, serverId ]);

    if (!api || !slide) return null;
    const { book, progress } = slide;
    const cover = imageUrl(api, book.Id, 'Primary', book.PrimaryTag, 600);
    const percent = Math.round((progress?.Progress ?? 0) * 100);
    const parts = progress?.PartIds.length ?? 0;
    const left = hoursText(progress?.RemainingTicks);

    return (
        <section
            className='qh-hero ab-hero'
            data-focus-row=''
            aria-roledescription='carousel'
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {cover && <img key={book.Id} className='ab-hero-bg' src={imageUrl(api, book.Id, 'Primary', book.PrimaryTag, 160)} alt='' />}
            <div className='ab-hero-glow' />
            <div className='qh-hero-shade' />
            <div className='ab-hero-inner'>
                <div key={book.Id} className='qh-hero-body ab-hero-body'>
                    <span className={progress ? 'ab-hero-note' : 'ab-hero-note ab-hero-note-new'}>
                        {progress ? <Equalizer /> : '✨'} {globalize.translate(progress ? 'AbListeningNow' : 'AbNextStory')}
                    </span>
                    <h2 className='qh-hero-title'>{bookTitle(book.Name)}</h2>
                    <div className='qh-hero-meta'>
                        {book.Author && <span>{book.Author}</span>}
                        {book.Narrator && <span>🎙 {book.Narrator}</span>}
                        {book.RunTimeTicks > 0 && <span>{hoursText(book.RunTimeTicks)}</span>}
                    </div>
                    {progress ? (
                        <div className='ab-hero-progress'>
                            <div className='ab-bar'><span style={{ width: `${Math.max(2, percent)}%` }} /></div>
                            <div className='ab-hero-progress-text'>
                                <span>{percent}%{parts > 1 ? ` · ${globalize.translate('AbPartOf', progress.PartIndex + 1, parts)}` : ''}</span>
                                {left && <span>{globalize.translate('AbTimeLeft', left)}</span>}
                            </div>
                        </div>
                    ) : book.Overview && <p className='qh-hero-overview'>{book.Overview}</p>}
                    <div className='qh-hero-actions'>
                        <button type='button' className='qh-btn qh-btn-main ab-btn-main' onClick={onPlay}>🎧 {globalize.translate(progress ? 'AbContinue' : 'AbStart')}</button>
                        <a className='qh-btn' href={href({ Id: book.Id, Type: book.Type as never }, serverId)}>{globalize.translate('AbSeeBook')}</a>
                    </div>
                    <div className='ab-stats'>
                        <span className='ab-pill ab-pill-amber'>{globalize.translate('AbStatsBooks', home.TotalBooks)}</span>
                        {home.TotalTicks > 0 && <span className='ab-pill ab-pill-teal'>{globalize.translate('AbStatsHours', Math.round(home.TotalTicks / TICKS_PER_MINUTE / 60))}</span>}
                        {home.FinishedCount > 0 && <span className='ab-pill ab-pill-plum'>{globalize.translate('AbStatsFinished', home.FinishedCount)}</span>}
                    </div>
                </div>
                {/* The cover with a record sliding out behind it, spinning while there is a book in progress */}
                <div className='ab-hero-art' aria-hidden='true'>
                    <span className={progress ? 'ab-vinyl is-spinning' : 'ab-vinyl'} />
                    {cover && <img key={book.Id} className='ab-hero-cover' src={cover} alt='' />}
                </div>
            </div>
            {count > 1 && (
                <div className='qh-hero-picks' role='tablist'>
                    {slides.map((s, i) => (
                        <button
                            key={s.book.Id}
                            type='button'
                            role='tab'
                            aria-selected={i === index % count}
                            aria-label={s.book.Name}
                            data-index={i}
                            className={i === index % count ? 'qh-pick ab-pick is-active' : 'qh-pick ab-pick'}
                            onClick={onPick}
                        >
                            <img src={imageUrl(api, s.book.Id, 'Primary', s.book.PrimaryTag, 120)} alt='' loading='lazy' decoding='async' />
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
};

/* ---------- Rows ---------- */

const ListenCard: FC<{ progress: AbProgress, book: AbBook, serverId?: string }> = ({ progress, book, serverId }) => {
    const { api } = useApi();
    const play = useCallback(() => playBook(progress, serverId), [ progress, serverId ]);
    if (!api) return null;
    const percent = Math.round(progress.Progress * 100);
    const left = hoursText(progress.RemainingTicks);
    return (
        <div className='ab-listen'>
            <a className='ab-listen-cover' href={href({ Id: book.Id, Type: book.Type as never }, serverId)}>
                <img src={imageUrl(api, book.Id, 'Primary', book.PrimaryTag, 240)} alt='' loading='lazy' decoding='async' />
            </a>
            <div className='ab-listen-body'>
                <span className='qh-card-title'>{bookTitle(book.Name)}</span>
                {book.Author && <span className='qh-card-sub'>{book.Author}</span>}
                <div className='ab-listen-foot'>
                    <div className='ab-listen-text'>
                        <span>{progress.PartIds.length > 1 ? globalize.translate('AbPartOf', progress.PartIndex + 1, progress.PartIds.length) : `${percent}%`}</span>
                        {left && <span>{globalize.translate('AbTimeLeft', left)}</span>}
                    </div>
                    <div className='ab-listen-row'>
                        <div className='ab-bar'><span style={{ width: `${Math.max(3, percent)}%` }} /></div>
                        <button type='button' className='ab-play' onClick={play} aria-label={globalize.translate('AbContinue')}>▶</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/** Chips of sagas, authors or narrators; the books of the chosen one below. */
const ShelfPicker: FC<{ title: string, hint?: string, accent: string, shelves: AbShelf[], books: Map<string, AbBook>, saga?: boolean, serverId?: string }> = ({ title, hint, accent, shelves, books, saga, serverId }) => {
    const { api } = useApi();
    const [ active, setActive ] = useState(0);
    const onPick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => setActive(Number(e.currentTarget.dataset.index ?? 0)), []);
    const shelf = shelves[Math.min(active, shelves.length - 1)];
    if (!api || !shelf) return null;
    const items = shelf.ItemIds.map(i => books.get(norm(i))).filter((b): b is AbBook => !!b);
    return (
        <section className='qh-row ab-shelf' data-focus-row='' style={{ '--qh-accent': accent } as React.CSSProperties}>
            <header className='qh-row-head'>
                <h3 className='qh-row-title'>{title}</h3>
                {hint && <span className='qh-row-hint'>{hint}</span>}
            </header>
            <div className='ab-chips'>
                {shelves.map((s, i) => (
                    <button key={s.Name} type='button' data-index={i} className={s === shelf ? 'ab-chip is-active' : 'ab-chip'} onClick={onPick}>
                        <span className='ab-chip-name'>{s.Name}</span>
                        <small>{saga && s.Finished > 0 ? globalize.translate('AbSagaFinished', s.Finished, s.Count) : globalize.translate('AbStatsBooks', s.Count)}</small>
                    </button>
                ))}
            </div>
            <div key={shelf.Name} className='qh-scroller ab-fade'>
                {items.map((b, i) => <Card key={b.Id} api={api} card={toCard(b, saga ? globalize.translate('AbBookN', i + 1) : undefined)} shape='square' serverId={serverId} />)}
            </div>
        </section>
    );
};

/* ---------- Page ---------- */

const MOODS: { id: string, label: string, icon: string, color: string }[] = [
    { id: 'ab-continue', label: 'AbMoodContinue', icon: '🎧', color: '#ff7a59' },
    { id: 'ab-today', label: 'AbMoodSurprise', icon: '🎲', color: '#ffb547' },
    { id: 'ab-new', label: 'AbMoodNew', icon: '✨', color: '#ff5c8a' },
    { id: 'ab-sagas', label: 'AbMoodSagas', icon: '📚', color: '#9b6bff' },
    { id: 'ab-short', label: 'AbMoodShort', icon: '⏱', color: '#2ec4b6' },
    { id: 'ab-long', label: 'AbMoodLong', icon: '🌙', color: '#6c8cff' },
    { id: 'ab-authors', label: 'AbMoodAuthors', icon: '✍️', color: '#ffb547' },
    { id: 'ab-voices', label: 'AbMoodVoices', icon: '🎙', color: '#ff5c8a' },
    { id: 'ab-finished', label: 'AbMoodFinished', icon: '✅', color: '#2ec4b6' }
];

const QuickAudiobooks: FC<{ libraryId: string, name?: string }> = ({ libraryId, name }) => {
    const { api, user, __legacyApiClient__: legacy } = useApi();
    const { data: home } = useAudiobooks(libraryId);
    const root = useRef<HTMLDivElement>(null);
    // TV: the remote moves by rows
    useTvRows(root);
    const serverId = legacy?.serverId();

    // Coming back (after listening) refreshes where the user is
    useEffect(() => {
        const host = root.current?.closest('.page');
        if (!host) return;
        const onShow = () => {
            void queryClient.invalidateQueries({ queryKey: [ 'QuickAudiobooks', user?.Id, libraryId ] });
        };
        host.addEventListener('viewshow', onShow);
        return () => host.removeEventListener('viewshow', onShow);
    }, [ user?.Id, libraryId ]);

    const books = useMemo(() => new Map((home?.Books ?? []).map(b => [ norm(b.Id), b ])), [ home?.Books ]);
    const pick = useCallback((ids?: string[]) => (ids ?? []).map(i => books.get(norm(i))).filter((b): b is AbBook => !!b), [ books ]);

    const onJump = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const target = e.currentTarget.dataset.target;
        if (target) document.getElementById(target)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }, []);

    if (!api || !home) {
        return <div ref={root} className='qh qh-loading' aria-busy='true'><div className='qh-skeleton-hero' /><div className='qh-skeleton-row' /><div className='qh-skeleton-row' /></div>;
    }

    const listening = home.Continue
        .map(p => ({ progress: p, book: books.get(norm(p.ItemId)) }))
        .filter((c): c is { progress: AbProgress, book: AbBook } => !!c.book);
    const unstarted = pick(home.Unstarted);
    // The banner: the books being listened to, otherwise a few to start
    const slides: Slide[] = listening.length ?
        listening.slice(0, 8) :
        unstarted.filter(b => b.Overview).slice(0, 8).map(book => ({ book }));
    const today = unstarted.filter(b => b.Overview).slice(listening.length ? 0 : 8, (listening.length ? 0 : 8) + 12).map(b => toCard(b));
    const durationLine = (b: AbBook) => toCard(b, hoursText(b.RunTimeTicks) ?? b.Author ?? undefined);

    const present: Record<string, boolean> = {
        'ab-continue': listening.length > 0,
        'ab-today': today.length > 0,
        'ab-new': home.Latest.length > 0,
        'ab-sagas': home.Sagas.length > 0,
        'ab-short': home.Short.length > 0,
        'ab-long': home.Long.length > 0,
        'ab-authors': home.Authors.length > 0,
        'ab-voices': home.Narrators.length > 0,
        'ab-finished': home.Finished.length > 0
    };
    const moods = MOODS.filter(m => present[m.id]);

    return (
        <div ref={root} className='qh qh-library ab-page' style={{ '--qh-accent': '#ff7a59' } as React.CSSProperties}>
            {slides.length > 0 ? <AbHero slides={slides} home={home} serverId={serverId} /> : <div className='qh-library-top' />}

            {moods.length > 1 && (
                <nav className='qh-jump ab-moods' aria-label={name}>
                    {moods.map(m => (
                        <button key={m.id} type='button' className='qh-chip' data-target={m.id} style={{ '--qh-chip': m.color } as React.CSSProperties} onClick={onJump}>
                            <span aria-hidden='true'>{m.icon}</span> {globalize.translate(m.label)}
                        </button>
                    ))}
                </nav>
            )}

            {listening.length > 0 && (
                <Row id='ab-continue' title={globalize.translate('AbKeepListening')} hint={globalize.translate('AbKeepListeningHelp')} accent='#ff7a59'>
                    {listening.map(c => <ListenCard key={c.progress.ItemId} progress={c.progress} book={c.book} serverId={serverId} />)}
                </Row>
            )}

            {today.length > 0 && (
                <Spotlight id='ab-today' api={api} items={today} title={globalize.translate('QhListenTodayIn', name || globalize.translate('LkAudiobooks'))} accent='#ffb547' serverId={serverId} />
            )}

            {home.Latest.length > 0 && (
                <Row id='ab-new' title={globalize.translate('AbNew')} accent='#ff5c8a'>
                    {pick(home.Latest).map(b => <Card key={b.Id} api={api} card={toCard(b)} shape='square' serverId={serverId} />)}
                </Row>
            )}

            {home.Sagas.length > 0 && (
                <Lazy id='ab-sagas' height={360}>
                    <ShelfPicker title={globalize.translate('AbSagas')} hint={globalize.translate('AbSagasHelp')} accent='#9b6bff' shelves={home.Sagas} books={books} saga serverId={serverId} />
                </Lazy>
            )}

            {home.Short.length > 0 && (
                <Lazy id='ab-short' height={300}>
                    <Row title={globalize.translate('AbShort')} hint={globalize.translate('AbShortHelp')} accent='#2ec4b6'>
                        {pick(home.Short).map(b => <Card key={b.Id} api={api} card={durationLine(b)} shape='square' serverId={serverId} />)}
                    </Row>
                </Lazy>
            )}

            {home.Long.length > 0 && (
                <Lazy id='ab-long' height={300}>
                    <Row title={globalize.translate('AbLong')} hint={globalize.translate('AbLongHelp')} accent='#6c8cff'>
                        {pick(home.Long).map(b => <Card key={b.Id} api={api} card={durationLine(b)} shape='square' serverId={serverId} />)}
                    </Row>
                </Lazy>
            )}

            {home.Authors.length > 0 && (
                <Lazy id='ab-authors' height={360}>
                    <ShelfPicker title={globalize.translate('AbAuthors')} accent='#ffb547' shelves={home.Authors} books={books} serverId={serverId} />
                </Lazy>
            )}

            {home.Narrators.length > 0 && (
                <Lazy id='ab-voices' height={360}>
                    <ShelfPicker title={globalize.translate('AbNarrators')} hint={globalize.translate('AbNarratorsHelp')} accent='#ff5c8a' shelves={home.Narrators} books={books} serverId={serverId} />
                </Lazy>
            )}

            <Lazy height={200}>
                <div className='ab-genres'><GenresSection parentId={libraryId} /></div>
            </Lazy>

            {home.Finished.length > 0 && (
                <Lazy id='ab-finished' height={300}>
                    <Row title={globalize.translate('AbFinished')} accent='#2ec4b6'>
                        {pick(home.Finished).map(b => <Card key={b.Id} api={api} card={toCard(b)} shape='square' serverId={serverId} />)}
                    </Row>
                </Lazy>
            )}
        </div>
    );
};

export default QuickAudiobooks;
