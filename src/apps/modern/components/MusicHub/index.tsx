/**
 * The start screen of a music library: what was listened to lately, moods, new albums, the most played songs,
 * albums to discover, artists and genres.
 */
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useQuery } from '@tanstack/react-query';
import React, { type FC, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { playbackManager } from 'components/playback/playbackmanager';
import toast from 'components/toast/toast';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { GenreTile } from '../HomeFeed/FeedWidgets';
import { get, href } from '../QuickHome/parts';

import './musicHub.scss';

interface Items {
    Items?: BaseItemDto[];
}

interface Mood {
    Key: string;
    Count: number;
}

const player = playbackManager as unknown as { play: (options: { ids: string[], serverId: string }) => Promise<void> };

const MOOD_LOOK: Record<string, { icon: string, colors: string }> = {
    party: { icon: '🪩', colors: '#ff5c8a, #9b6bff' },
    workout: { icon: '🔥', colors: '#ff7a59, #e5393f' },
    happy: { icon: '☀️', colors: '#ffb547, #ff7a59' },
    romantic: { icon: '💜', colors: '#ec407a, #7b3fb5' },
    chill: { icon: '🌊', colors: '#00a4dc, #3f6fd8' },
    focus: { icon: '🎯', colors: '#26a69a, #00739a' },
    melancholy: { icon: '🌧️', colors: '#5c6bc0, #2c2c54' },
    intense: { icon: '⚡', colors: '#7b3fb5, #1f1235' }
};

const imageOf = (api: Api, item: BaseItemDto, width = 320) => {
    const own = item.ImageTags?.Primary;
    if (own) return `${api.basePath}/Items/${item.Id}/Images/Primary?tag=${own}&maxWidth=${width}&quality=85`;
    if (item.AlbumId && item.AlbumPrimaryImageTag) return `${api.basePath}/Items/${item.AlbumId}/Images/Primary?tag=${item.AlbumPrimaryImageTag}&maxWidth=${width}&quality=85`;
    return undefined;
};

const artistOf = (item: BaseItemDto) => item.AlbumArtist || item.Artists?.[0] || '';

const startPlaying = (ids: string[], serverId?: string | null) => {
    if (!ids.length || !serverId) {
        toast(globalize.translate('MhNothingToPlay'));
        return;
    }
    void player.play({ ids, serverId });
};

const useMusicItems = (parentId: string, name: string, query: string, enabled = true) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'MusicHub', user?.Id, parentId, name ],
        queryFn: async ({ signal }) => (await get<Items>(api!, `/Items?userId=${user?.Id}&parentId=${parentId}&recursive=true&enableUserData=true&${query}`, signal)).Items ?? [],
        enabled: !!api && !!user?.Id && enabled,
        staleTime: 5 * 60 * 1000
    });
};

const PlayButton: FC<{ item: BaseItemDto, label?: string }> = ({ item, label }) => {
    const onPlay = useCallback(() => startPlaying(item.Id ? [ item.Id ] : [], item.ServerId), [ item ]);
    return (
        <button type='button' className='mh-play' onClick={onPlay} aria-label={`${globalize.translate('Play')} ${label ?? item.Name ?? ''}`}>
            <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M8 5v14l11-7z' /></svg>
        </button>
    );
};

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** A section comes in when it reaches the screen. */
const Section: FC<{ title: string, children: ReactNode }> = ({ title, children }) => {
    const box = useRef<HTMLElement>(null);
    const [ shown, setShown ] = useState(false);
    useEffect(() => {
        const element = box.current;
        if (!element || !('IntersectionObserver' in window) || reducedMotion()) {
            setShown(true);
            return;
        }
        const observer = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) {
                setShown(true);
                observer.disconnect();
            }
        }, { rootMargin: '0px 0px -6% 0px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return (
        <section ref={box} className={shown ? 'mh-section mh-reveal is-in' : 'mh-section mh-reveal'}>
            <h2>{title}</h2>
            {children}
        </section>
    );
};

const Cover: FC<{ api: Api, item: BaseItemDto }> = ({ api, item }) => {
    const image = imageOf(api, item);
    return image ? <img src={image} alt='' loading='lazy' /> : <span className='mh-empty' aria-hidden='true'>♪</span>;
};

const AlbumCard: FC<{ api: Api, item: BaseItemDto, serverId?: string }> = ({ api, item, serverId }) => (
    <div className='mh-card'>
        <div className='mh-cover'>
            <span className='mh-disc' aria-hidden='true' />
            <a href={href(item, serverId)} aria-label={item.Name ?? ''}><Cover api={api} item={item} /></a>
            <PlayButton item={item} />
        </div>
        <a className='mh-card-title' href={href(item, serverId)}>{item.Name}</a>
        <span className='mh-card-line'>{artistOf(item)}</span>
    </div>
);

const AlbumRow: FC<{ api: Api, title: string, items?: BaseItemDto[], serverId?: string }> = ({ api, title, items, serverId }) => (items?.length ? (
    <Section title={title}>
        <div className='mh-row'>{items.map(i => <AlbumCard key={i.Id} api={api} item={i} serverId={serverId} />)}</div>
    </Section>
) : null);

const QuickTile: FC<{ api: Api, item: BaseItemDto, serverId?: string }> = ({ api, item, serverId }) => (
    <div className='mh-tile'>
        <a href={href(item, serverId)}>
            <Cover api={api} item={item} />
            <span>{item.Name}</span>
        </a>
        <PlayButton item={item} />
    </div>
);

const MoodTile: FC<{ mood: Mood, index: number, busy: boolean, onPlay: (key: string) => void }> = ({ mood, index, busy, onPlay }) => {
    const look = MOOD_LOOK[mood.Key] ?? MOOD_LOOK.chill;
    const onClick = useCallback(() => onPlay(mood.Key), [ mood.Key, onPlay ]);
    return (
        <button type='button' className='mh-mood' style={{ backgroundImage: `linear-gradient(135deg, ${look.colors})`, '--mh-i': index } as React.CSSProperties} onClick={onClick} disabled={busy}>
            <span className='mh-mood-name'>{globalize.translate(`MhMood_${mood.Key}`)}</span>
            <span className='mh-mood-count'>{globalize.translate('MhSongs', mood.Count)}</span>
            <span className='mh-mood-icon' aria-hidden='true'>{look.icon}</span>
        </button>
    );
};

const TopSongs: FC<{ api: Api, songs: BaseItemDto[] }> = ({ api, songs }) => {
    const onPlay = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const from = Number(e.currentTarget.dataset.index);
        startPlaying(songs.slice(from).flatMap(s => (s.Id ? [ s.Id ] : [])), songs[from]?.ServerId);
    }, [ songs ]);
    return (
        <ol className='mh-songs'>
            {songs.map((s, i) => (
                <li key={s.Id}>
                    <button type='button' data-index={i} onClick={onPlay}>
                        <span className='mh-song-n'>{i + 1}</span>
                        <Cover api={api} item={s} />
                        <span className='mh-song-text'><b>{s.Name}</b><small>{artistOf(s)}</small></span>
                    </button>
                </li>
            ))}
        </ol>
    );
};

/** Two lanes of album covers that drift behind the greeting. */
const HeroWall: FC<{ api: Api, items?: BaseItemDto[] }> = ({ api, items }) => {
    const covers = useMemo(() => (items ?? []).flatMap(i => {
        const image = imageOf(api, i, 200);
        return image && i.Id ? [ { id: i.Id, image } ] : [];
    }).slice(0, 18), [ api, items ]);
    if (covers.length < 4) return null;
    const lanes = [ covers, [ ...covers ].reverse() ];
    return (
        <div className='mh-wall' aria-hidden='true'>
            {lanes.map((lane, l) => (
                <div key={l === 0 ? 'one' : 'two'} className={l === 0 ? 'mh-lane' : 'mh-lane is-back'}>
                    {[ ...lane, ...lane ].map((c, i) => <img key={`${c.id}-${i < lane.length ? 'a' : 'b'}`} src={c.image} alt='' loading='lazy' />)}
                </div>
            ))}
        </div>
    );
};

/** One album at a time on stage, with its record spinning. */
const Spotlight: FC<{ api: Api, items?: BaseItemDto[], serverId?: string }> = ({ api, items, serverId }) => {
    const picks = useMemo(() => (items ?? []).filter(i => imageOf(api, i)).slice(0, 6), [ api, items ]);
    const [ index, setIndex ] = useState(0);
    useEffect(() => {
        if (picks.length < 2 || reducedMotion()) return;
        const timer = window.setInterval(() => setIndex(i => (i + 1) % picks.length), 7000);
        return () => window.clearInterval(timer);
    }, [ picks.length ]);
    const item = picks[index % Math.max(1, picks.length)];
    const onPlay = useCallback(() => {
        if (item) startPlaying(item.Id ? [ item.Id ] : [], item.ServerId);
    }, [ item ]);
    const onDot = useCallback((e: React.MouseEvent<HTMLButtonElement>) => setIndex(Number(e.currentTarget.dataset.index)), []);
    if (!item) return null;
    const image = imageOf(api, item, 520);
    return (
        <section className='mh-spot' aria-label={globalize.translate('MhSpotlight')}>
            <div key={`bg-${item.Id}`} className='mh-spot-bg' style={{ backgroundImage: `url("${image}")` }} />
            <a key={`disc-${item.Id}`} className='mh-spot-art' href={href(item, serverId)} aria-label={item.Name ?? ''}>
                <span className='mh-spot-record' style={{ '--mh-label': `url("${image}")` } as React.CSSProperties} />
                <img src={image} alt='' />
            </a>
            <div key={`text-${item.Id}`} className='mh-spot-text'>
                <p>✨ {globalize.translate('MhSpotlight')}</p>
                <h2><a href={href(item, serverId)}>{item.Name}</a></h2>
                <span>{artistOf(item)}{item.ProductionYear ? ` · ${item.ProductionYear}` : ''}</span>
                <button type='button' className='mh-shuffle' onClick={onPlay}>▶ {globalize.translate('Play')}</button>
            </div>
            {picks.length > 1 && (
                <div className='mh-dots'>
                    {picks.map((p, i) => <button key={p.Id} type='button' data-index={i} className={i === index ? 'is-on' : undefined} onClick={onDot} aria-label={p.Name ?? ''} />)}
                </div>
            )}
        </section>
    );
};

const greetingKey = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'MhGoodMorning';
    return hour < 19 ? 'MhGoodAfternoon' : 'MhGoodEvening';
};

const MusicHub: FC<{ parentId: string, name: string }> = ({ parentId, name }) => {
    const { api, user, __legacyApiClient__: legacy } = useApi();
    const serverId = legacy?.serverId();
    const [ busy, setBusy ] = useState(false);
    const album = 'includeItemTypes=MusicAlbum&fields=PrimaryImageAspectRatio';

    const { data: played } = useMusicItems(parentId, 'played', 'includeItemTypes=Audio&filters=IsPlayed&sortBy=DatePlayed&sortOrder=Descending&limit=40');
    const { data: top } = useMusicItems(parentId, 'top', 'includeItemTypes=Audio&filters=IsPlayed&sortBy=PlayCount,SortName&sortOrder=Descending&limit=10');
    const { data: recent } = useMusicItems(parentId, 'recent', `${album}&sortBy=DateCreated&sortOrder=Descending&limit=20`);
    const { data: discover } = useMusicItems(parentId, 'discover', `${album}&sortBy=Random&limit=20`);
    const { data: favorites } = useMusicItems(parentId, 'favorites', `${album}&filters=IsFavorite&sortBy=SortName&limit=20`);
    const { data: artists } = useQuery({
        queryKey: [ 'MusicHub', user?.Id, parentId, 'artists' ],
        queryFn: async ({ signal }) => (await get<Items>(api!, `/Artists/AlbumArtists?userId=${user?.Id}&parentId=${parentId}&sortBy=Random&limit=18&enableImages=true`, signal)).Items ?? [],
        enabled: !!api && !!user?.Id,
        staleTime: 15 * 60 * 1000
    });
    const { data: genres } = useQuery({
        queryKey: [ 'MusicHub', user?.Id, parentId, 'genres' ],
        queryFn: async ({ signal }) => (await get<Items>(api!, `/MusicGenres?userId=${user?.Id}&parentId=${parentId}&sortBy=Random&limit=18`, signal)).Items ?? [],
        enabled: !!api && !!user?.Id,
        staleTime: 15 * 60 * 1000
    });
    const { data: moods } = useQuery({
        queryKey: [ 'MusicHub', 'moods' ],
        queryFn: ({ signal }) => get<Mood[]>(api!, '/MusicHub/Moods', signal),
        enabled: !!api,
        staleTime: 15 * 60 * 1000
    });

    // The albums of the songs played lately, each one once
    const lately = useMemo(() => {
        const seen = new Set<string>();
        const out: BaseItemDto[] = [];
        for (const song of played ?? []) {
            const id = song.AlbumId ?? song.Id ?? '';
            if (seen.has(id)) continue;
            seen.add(id);
            out.push(song.AlbumId ? { ...song, Id: song.AlbumId, Name: song.Album, Type: 'MusicAlbum', ImageTags: song.AlbumPrimaryImageTag ? { Primary: song.AlbumPrimaryImageTag } : {} } : song);
        }
        return out.slice(0, 6);
    }, [ played ]);

    const playList = useCallback((path: string) => {
        if (!api) return;
        setBusy(true);
        // eslint-disable-next-line compat/compat
        get<BaseItemDto[] | Items>(api, path, new AbortController().signal).then(result => {
            const songs = Array.isArray(result) ? result : result.Items ?? [];
            startPlaying(songs.flatMap(s => (s.Id ? [ s.Id ] : [])), songs[0]?.ServerId ?? serverId);
        }).catch(() => toast(globalize.translate('MhNothingToPlay'))).finally(() => setBusy(false));
    }, [ api, serverId ]);
    const onMood = useCallback((key: string) => playList(`/MusicHub/Moods/${key}?parentId=${parentId}&limit=60`), [ playList, parentId ]);
    const onShuffle = useCallback(() => playList(`/Items?userId=${user?.Id}&parentId=${parentId}&recursive=true&includeItemTypes=Audio&sortBy=Random&limit=100`), [ playList, user?.Id, parentId ]);

    if (!api) return null;
    return (
        <div className='mh'>
            <header className='mh-hero'>
                <HeroWall api={api} items={recent} />
                <span className='mh-aurora' aria-hidden='true' />
                <span className='mh-aurora is-two' aria-hidden='true' />
                <span className='mh-aurora is-three' aria-hidden='true' />
                <span className='mh-floating' aria-hidden='true'><i>♪</i><i>♫</i><i>♩</i><i>♬</i><i>♪</i><i>♫</i></span>
                <div className='mh-hero-text'>
                    <p>{name}</p>
                    <h1>{globalize.translate(greetingKey())}</h1>
                    <div className='mh-hero-actions'>
                        <button type='button' className='mh-shuffle' onClick={onShuffle} disabled={busy}>🔀 {globalize.translate('MhMixForYou')}</button>
                        <span className='mh-bars' aria-hidden='true'><i /><i /><i /><i /><i /><i /></span>
                    </div>
                </div>
            </header>

            {lately.length > 0 && <div className='mh-tiles'>{lately.map(i => <QuickTile key={i.Id} api={api} item={i} serverId={serverId} />)}</div>}

            <Spotlight api={api} items={discover} serverId={serverId} />

            {!!moods?.length && (
                <Section title={globalize.translate('MhMoods')}>
                    <div className='mh-moods'>{moods.map((m, i) => <MoodTile key={m.Key} mood={m} index={i} busy={busy} onPlay={onMood} />)}</div>
                </Section>
            )}

            <AlbumRow api={api} title={globalize.translate('MhNewAlbums')} items={recent} serverId={serverId} />
            {!!top?.length && <Section title={globalize.translate('MhTopSongs')}><TopSongs api={api} songs={top} /></Section>}
            <AlbumRow api={api} title={globalize.translate('MhFavorites')} items={favorites} serverId={serverId} />
            <AlbumRow api={api} title={globalize.translate('MhDiscover')} items={discover} serverId={serverId} />

            {!!artists?.length && (
                <Section title={globalize.translate('MhArtists')}>
                    <div className='mh-row'>
                        {artists.map(a => (
                            <a key={a.Id} className='mh-artist' href={href(a, serverId)}>
                                <span><Cover api={api} item={a} /></span>
                                <b>{a.Name}</b>
                            </a>
                        ))}
                    </div>
                </Section>
            )}

            {!!genres?.length && (
                <Section title={globalize.translate('MhGenres')}>
                    <div className='mh-row mh-genres'>{genres.map(g => <GenreTile key={g.Id} genre={g} parentId={parentId} />)}</div>
                </Section>
            )}
        </div>
    );
};

export default MusicHub;
