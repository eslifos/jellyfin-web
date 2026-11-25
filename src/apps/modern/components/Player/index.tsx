/**
 * The player of the app (it replaces the classic now playing bar of Jellyfin): a small bar while something
 * plays, with play / pause and stop side by side, that opens a full player for audio: big cover over its
 * colours, rings and sound waves that move with the voice or the music, the queue (or the parts of an
 * audiobook) and a sleep timer. Audiobooks also get ±30 s, speed and the progress of the whole book, and open
 * the full player by themselves. Videos open their own screen, except when they play on another device (a TV):
 * then the full player is the remote control, with the volume, the audio and the subtitles of that device.
 */
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';
import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import React, { type FC, type ChangeEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';

import { playbackManager } from 'components/playback/playbackmanager';
import { appRouter } from 'components/router/appRouter';
import toast from 'components/toast/toast';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import Events from 'utils/events';

import { useBottomSpace } from '../FloatingNav/bottomSpace';
import { djStore, stopTransition } from './audioEngine';
import { OPEN_PLAYER_EVENT } from './events';
import { StudioChips, StudioPanel, type StudioTab, VideoSlot, useMusicEngine, useSongInfo } from './MusicStudio';
import { type SongColors, SongVisualizer, SongWave, centerInside, decodeWave, standInWave, useCoverColors } from './MusicVisual';
import { songVideoMode } from './songVideoMode';
import { type Speech, type VoiceMeter, openVoiceMeter, simulateSpeech } from './voiceMeter';

import './player.scss';

type Engine = object;

/** The parts of the playback manager used here (it is plain JavaScript). */
interface Playback {
    getCurrentPlayer: () => Engine | null;
    currentItem: (player: Engine) => BaseItemDto | null;
    currentTime: (player: Engine) => number;
    duration: (player: Engine) => number | null;
    paused: (player: Engine) => boolean;
    playPause: (player: Engine) => void;
    stop: (player: Engine) => void;
    pause: (player: Engine) => void;
    seek: (ticks: number, player: Engine) => void;
    nextTrack: (player: Engine) => void;
    previousTrack: (player: Engine) => void;
    getPlaylist: (player: Engine) => Promise<BaseItemDto[]>;
    getCurrentPlaylistIndex: (player: Engine) => number;
    setCurrentPlaylistItem: (id: string, player: Engine) => void;
    setPlaybackRate: (rate: number, player: Engine) => void;
    getPlaybackRate: (player: Engine) => number;
    getPlayerInfo: () => { id?: string, name?: string, deviceName?: string } | null;
    getVolume: (player: Engine) => number;
    setVolume: (value: number, player: Engine) => void;
    isMuted: (player: Engine) => boolean;
    setMute: (mute: boolean, player: Engine) => void;
    audioTracks: (player: Engine) => MediaStream[];
    subtitleTracks: (player: Engine) => MediaStream[];
    getAudioStreamIndex: (player: Engine) => number | null;
    getSubtitleStreamIndex: (player: Engine) => number | null;
    setAudioStreamIndex: (index: number, player: Engine) => void;
    setSubtitleStreamIndex: (index: number, player: Engine) => void;
    setDefaultPlayerActive: () => void;
    beginPlayerUpdates: (player: Engine) => void;
    endPlayerUpdates: (player: Engine) => void;
}

const pm = playbackManager as unknown as Playback;

/** Reads a value of the player; remote devices may not know it yet. */
const attempt = <T,>(read: () => T, fallback: T): T => {
    try {
        return read() ?? fallback;
    } catch {
        return fallback;
    }
};

const TICKS_PER_MS = 10000;
const SKIP_MS = 30000;
const SPEEDS = [ 0.75, 1, 1.25, 1.5, 1.75, 2 ];
/** Sleep timer steps, in minutes; -1 is "at the end of this part". */
const SLEEP_STEPS = [ 0, 15, 30, 45, 60, -1 ];
const WAVE = Array.from({ length: 40 }, (_, i) => ({ id: `w${i}` }));

/** What the sleep button says: off, at the end of the part, or the minutes left. */
const sleepText = (sleep: number, sleepAt: number | null) => {
    if (sleep === -1) return globalize.translate('ApSleepEnd');
    if (sleep > 0 && sleepAt) return `${Math.max(1, Math.ceil((sleepAt - Date.now()) / 60000))} min`;
    return globalize.translate('ApSleep');
};

const clock = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    const hours = h ? String(h) + ':' : '';
    return hours + mm + ':' + String(s).padStart(2, '0');
};

const hoursLeft = (ms: number) => {
    const minutes = Math.max(1, Math.round(ms / 60000));
    const h = Math.floor(minutes / 60);
    return h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
};

interface State {
    item: BaseItemDto | null;
    positionMs: number;
    durationMs: number;
    paused: boolean;
    playlist: BaseItemDto[];
    index: number;
    rate: number;
    /** It plays on another device (a TV, a phone…) controlled from here. */
    remote: boolean;
    device: string;
    volume: number;
    muted: boolean;
    audio: MediaStream[];
    subtitles: MediaStream[];
    audioIndex: number | null;
    subtitleIndex: number | null;
}

const EMPTY: State = {
    item: null, positionMs: 0, durationMs: 0, paused: true, playlist: [], index: 0, rate: 1,
    remote: false, device: '', volume: 100, muted: false, audio: [], subtitles: [], audioIndex: null, subtitleIndex: null
};

/** How long between two questions to the server about what another device plays. */
const REMOTE_POLL_MS = 2000;
/** Where the bar starts on a device that does not tell its real volume (it says 100): never suggests the maximum. */
const SAFE_VOLUME = 10;
/** The most the volume of a device can go up each VOLUME_SEND_MS: a slip of the finger cannot blast the speakers. */
const MAX_VOLUME_RISE = 10;
/** Answers in a row without the other device before leaving it: a short network cut does not disconnect. */
const GONE_AFTER = 3;
/** The longest the next song may take to start (from a remote drive) before the player accepts that nothing plays. */
const NEXT_SONG_WAIT_MS = 30000;
/** How often the volume goes to another device while its bar is dragged. */
const VOLUME_SEND_MS = 250;

const isRemote = (player: Engine | null) => (player as { isLocalPlayer?: boolean } | null)?.isLocalPlayer === false;

/** How long a song that was asked to start may look like it plays before the real state of the player is shown. */
const START_GRACE_MS = 5000;

/** An empty picture, so a video that has not started shows black instead of the gray button of the phone. */
const BLANK_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** One song has left the audio element and the next has not entered yet: nothing on the screen should react to it. */
const isBetweenSongs = (player: Engine) => {
    const media = player as { currentSrc?: () => string | null | undefined };
    return pm.currentItem(player)?.MediaType === 'Audio' && typeof media.currentSrc === 'function' && !media.currentSrc();
};

/**
 * The session of another device (a TV): what it plays and how. The device sends it to this one; until it
 * arrives (or if it never does) the copy asked to the server is used.
 */
const remoteSession = (player: Engine, asked: SessionInfoDto | null): SessionInfoDto | null => {
    const own = attempt(() => (player as { getPlayerState?: () => SessionInfoDto }).getPlayerState?.() ?? null, null);
    if (own?.NowPlayingItem) return own;
    return asked?.NowPlayingItem ? asked : own;
};

/** What another device plays, read from its session. */
const readRemote = (player: Engine, asked: SessionInfoDto | null): Partial<State> => {
    const session = remoteSession(player, asked);
    const item = session?.NowPlayingItem ?? null;
    const play = session?.PlayState ?? {};
    const info = pm.getPlayerInfo();
    // Audio and subtitles are chosen here only for a video (the video screen of this device has its own)
    const streams = item?.MediaType === 'Video' ? (item.MediaStreams ?? attempt(() => pm.audioTracks(player).concat(pm.subtitleTracks(player)), [])) : [];
    return {
        item,
        positionMs: (play.PositionTicks ?? 0) / TICKS_PER_MS,
        durationMs: (item?.RunTimeTicks ?? 0) / TICKS_PER_MS,
        paused: !!play.IsPaused,
        rate: 1,
        remote: true,
        device: info?.deviceName || info?.name || session?.DeviceName || '',
        volume: play.VolumeLevel ?? 100,
        muted: !!play.IsMuted,
        audio: streams.filter(s => s.Type === 'Audio'),
        subtitles: streams.filter(s => s.Type === 'Subtitle'),
        audioIndex: play.AudioStreamIndex ?? null,
        subtitleIndex: play.SubtitleStreamIndex ?? null
    };
};

/** What plays on this device. */
const readLocal = (player: Engine): Partial<State> => {
    const item = pm.currentItem(player);
    return {
        item,
        positionMs: pm.currentTime(player) || 0,
        durationMs: (pm.duration(player) || item?.RunTimeTicks || 0) / TICKS_PER_MS,
        paused: pm.paused(player),
        rate: pm.getPlaybackRate(player) || 1,
        remote: false,
        device: '',
        volume: attempt(() => pm.getVolume(player), 100),
        muted: attempt(() => pm.isMuted(player), false),
        audio: [],
        subtitles: [],
        audioIndex: null,
        subtitleIndex: null
    };
};

/**
 * Where the current item is in the queue. Another device (a TV) does not give the position, only the id of
 * what plays, so it is looked up in the queue.
 */
const playlistIndex = (player: Engine, playlist: BaseItemDto[]) => {
    const remote = player as { getCurrentPlaylistIndex?: unknown, getCurrentPlaylistItemId?: () => string | null };
    if (typeof remote.getCurrentPlaylistIndex !== 'function' && typeof remote.getCurrentPlaylistItemId === 'function') {
        const id = attempt(() => remote.getCurrentPlaylistItemId?.() ?? null, null);
        return Math.max(0, playlist.findIndex(p => p.PlaylistItemId === id));
    }
    return Math.max(0, attempt(() => pm.getCurrentPlaylistIndex(player), 0));
};

/** Follows the current player: what plays, where, paused or not, and the parts in the queue. */
const usePlayback = (api: Api | undefined) => {
    const [ state, setState ] = useState<State>(EMPTY);
    const playerRef = useRef<Engine | null>(null);

    useEffect(() => {
        let bound: Engine | null = null;
        // Another device: its session as the server last told it, and the timer that asks for it
        let asked: SessionInfoDto | null = null;
        let poll = 0;
        // Whether the server has shown that device, and how many answers in a row it has been missing
        let seen = false;
        let missed = 0;
        // The device being controlled, and whether its bar still has to be told it was lowered on connecting
        let connected: string | null = null;
        let lowered = false;
        let firstBind = true;

        let shownId: string | null = null;
        let waitingNext = 0;
        // The next song was asked for and has not sounded yet: it does not count as a pause
        let starting = false;
        let startTimer = 0;
        const stopWaiting = () => {
            window.clearTimeout(waitingNext);
            waitingNext = 0;
        };
        const stopStarting = () => {
            starting = false;
            window.clearTimeout(startTimer);
            startTimer = 0;
        };
        const nothingPlays = () => {
            const player = pm.getCurrentPlayer();
            if (!player) return true;
            return !(isRemote(player) ? readRemote(player, asked).item : pm.currentItem(player));
        };
        const clearIfNothingPlays = () => {
            if (!nothingPlays()) return;
            shownId = null;
            setState(EMPTY);
        };
        const read = (): Partial<State> => {
            const player = pm.getCurrentPlayer();
            playerRef.current = player;
            if (!player) {
                stopWaiting();
                stopStarting();
                return { item: null };
            }
            if (isRemote(player)) return readRemote(player, asked);
            const local = readLocal(player);
            if (local.item && !isBetweenSongs(player)) {
                stopWaiting();
                if (!starting) return local;
                // If the browser never lets it sound, the real state shows after a moment
                startTimer ||= window.setTimeout(() => {
                    stopStarting();
                    setState(prev => ({ ...prev, paused: pm.paused(player) }));
                }, START_GRACE_MS);
                return { ...local, paused: false };
            }
            // Between two songs the screen stays exactly as it is until the next one is there
            if (local.item) {
                starting = true;
                window.clearTimeout(startTimer);
                startTimer = 0;
            }
            waitingNext ||= window.setTimeout(() => {
                waitingNext = 0;
                if (isBetweenSongs(player)) {
                    shownId = null;
                    setState(EMPTY);
                } else {
                    clearIfNothingPlays();
                }
            }, NEXT_SONG_WAIT_MS);
            return {};
        };
        const idOf = (next: Partial<State>) => (next.item === undefined ? shownId : next.item?.PlaylistItemId ?? next.item?.Id ?? null);
        const refresh = () => setState(prev => ({ ...prev, ...read() }));
        const onPlaying = () => {
            stopStarting();
            refresh();
        };
        const loadQueue = () => {
            const player = pm.getCurrentPlayer();
            if (!player) return;
            void Promise.resolve(attempt(() => pm.getPlaylist(player), Promise.resolve([] as BaseItemDto[]))).then(list => {
                const playlist = list ?? [];
                const index = playlistIndex(player, playlist);
                setState(prev => ({ ...prev, playlist, index }));
            }).catch(() => undefined);
        };
        const onStart = () => {
            const next = read();
            shownId = idOf(next);
            setState(prev => ({ ...prev, ...next }));
            loadQueue();
        };
        // Another device (a TV) only says "something changed": when what plays is another item, the queue is read again
        const onChange = () => {
            const next = read();
            const id = idOf(next);
            setState(prev => ({ ...prev, ...next }));
            if (id !== shownId) {
                shownId = id;
                loadQueue();
            }
        };
        const onTime = () => {
            const player = playerRef.current;
            if (!player || (!isRemote(player) && (!pm.currentItem(player) || isBetweenSongs(player)))) return;
            const positionMs = isRemote(player) ? read().positionMs ?? 0 : pm.currentTime(player) || 0;
            setState(prev => ({ ...prev, positionMs }));
        };
        // Asks the server what the other device plays (the same the dashboard shows)
        const watchDevice = (session: SessionInfoDto | null) => {
            if (session && session.IsActive !== false) {
                seen = true;
                missed = 0;
                return;
            }
            // Never seen: this account may not be allowed to list it, which does not mean it closed
            missed = seen ? missed + 1 : 0;
            if (missed < GONE_AFTER) return;
            const info = pm.getPlayerInfo();
            pm.setDefaultPlayerActive();
            toast(globalize.translate('ApDeviceClosed', info?.deviceName || info?.name || ''));
        };
        const askServer = () => {
            const target = pm.getPlayerInfo()?.id;
            if (!api || !target || !isRemote(pm.getCurrentPlayer()) || document.visibilityState === 'hidden') return;
            // Without a time limit: a TV paused for a long while is still there
            getSessionApi(api).getSessions().then(({ data }) => {
                if (pm.getPlayerInfo()?.id !== target) return;
                asked = data.find(s => s.Id === target) ?? null;
                const player = pm.getCurrentPlayer();
                if (lowered && player) {
                    lowered = false;
                    const now = readRemote(player, asked);
                    storeAsked(`abp-volume-${now.device}`, { value: SAFE_VOLUME, over: Math.round(now.volume ?? 100) });
                }
                onChange();
                watchDevice(asked);
            }).catch(() => undefined);
        };
        const onStop = (_event?: unknown, stopped?: { NextItem?: unknown }) => {
            // Another song is coming: the screen waits for it
            if (stopped?.NextItem) return;
            // Between two parts the player stops and starts again: only gone if nothing plays a moment later
            window.setTimeout(clearIfNothingPlays, 600);
        };

        const events: [string, (event?: unknown, stopped?: { NextItem?: unknown }) => void][] = [
            [ 'playbackstart', onStart ], [ 'playing', onPlaying ], [ 'statechange', onChange ], [ 'pause', refresh ], [ 'unpause', refresh ],
            [ 'timeupdate', onTime ], [ 'playbackstop', onStop ], [ 'playbackratechange', refresh ], [ 'volumechange', refresh ],
            [ 'playlistitemadd', loadQueue ], [ 'playlistitemremove', loadQueue ], [ 'playlistitemmove', loadQueue ]
        ];
        const unbind = () => {
            stopWaiting();
            stopStarting();
            window.clearInterval(poll);
            poll = 0;
            asked = null;
            seen = false;
            missed = 0;
            lowered = false;
            if (bound) {
                for (const [ name, fn ] of events) Events.off(bound, name, fn);
                if (isRemote(bound)) pm.endPlayerUpdates(bound);
            }
            bound = null;
        };
        const bind = () => {
            unbind();
            bound = pm.getCurrentPlayer();
            if (bound) {
                for (const [ name, fn ] of events) Events.on(bound, name, fn);
                // Another device: its updates are asked for while it is followed, and the server is asked too
                if (isRemote(bound)) {
                    pm.beginPlayerUpdates(bound);
                    // Connecting to a device lowers it, so it never starts loud; opening the app already connected does not
                    const id = pm.getPlayerInfo()?.id ?? null;
                    if (!firstBind && id !== connected) {
                        pm.setVolume(SAFE_VOLUME, bound);
                        lowered = true;
                    }
                    connected = id;
                    askServer();
                    poll = window.setInterval(askServer, REMOTE_POLL_MS);
                } else {
                    connected = null;
                }
            } else {
                connected = null;
            }
            firstBind = false;
            onStart();
        };

        Events.on(playbackManager, 'playerchange', bind);
        bind();
        return () => {
            Events.off(playbackManager, 'playerchange', bind);
            unbind();
        };
    }, [ api ]);

    const reset = useCallback(() => setState(EMPTY), []);

    return { state, playerRef, reset };
};

const coverOf = (basePath: string, item?: BaseItemDto | null, width = 600) => {
    if (!item) return undefined;
    if (item.AlbumId && item.AlbumPrimaryImageTag) return `${basePath}/Items/${item.AlbumId}/Images/Primary?tag=${item.AlbumPrimaryImageTag}&maxWidth=${width}&quality=90`;
    const tag = item.ImageTags?.Primary;
    return tag ? `${basePath}/Items/${item.Id}/Images/Primary?tag=${tag}&maxWidth=${width}&quality=90` : undefined;
};

/** A wide picture for a video: the frame of the episode, else the backdrop of the movie or of its series. */
const sceneOf = (basePath: string, item: BaseItemDto, width = 900) => {
    const url = (id: string, type: string, tag: string) => `${basePath}/Items/${id}/Images/${type}?tag=${tag}&maxWidth=${width}&quality=90`;
    if (item.Type === 'Episode' && item.ImageTags?.Primary) return url(item.Id ?? '', 'Primary', item.ImageTags.Primary);
    if (item.BackdropImageTags?.length) return url(item.Id ?? '', 'Backdrop/0', item.BackdropImageTags[0]);
    if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) return url(item.ParentBackdropItemId, 'Backdrop/0', item.ParentBackdropImageTags[0]);
    if (item.ImageTags?.Thumb) return url(item.Id ?? '', 'Thumb', item.ImageTags.Thumb);
    return coverOf(basePath, item, width);
};

/** A cover that changes by fading over the previous one, once the new picture is ready: never an empty frame. */
const CoverLayers: FC<{ src: string }> = ({ src }) => {
    const [ shown, setShown ] = useState(src);
    const [ under, setUnder ] = useState<string | null>(null);
    useEffect(() => {
        if (src === shown) return;
        let live = true;
        const next = new Image();
        const swap = () => {
            if (!live) return;
            setUnder(shown);
            setShown(src);
        };
        next.onload = swap;
        next.onerror = swap;
        next.src = src;
        return () => {
            live = false;
            next.onload = null;
            next.onerror = null;
        };
    }, [ src, shown ]);
    const onFaded = useCallback(() => setUnder(null), []);
    return (
        <span className='abp-layers'>
            {under && <img className='abp-layer' src={under} alt='' />}
            <img key={shown} className={under ? 'abp-layer is-new' : 'abp-layer'} src={shown} alt='' onAnimationEnd={onFaded} />
        </span>
    );
};

/** Keeps a row as tall as it has been, so a button that comes or goes with a song does not move the whole screen. */
const useSteadyHeight = (change: unknown) => {
    const box = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const element = box.current;
        if (!element) return;
        const height = element.offsetHeight;
        if (height > (parseFloat(element.style.minHeight) || 0)) element.style.minHeight = `${height}px`;
    }, [ change ]);
    useEffect(() => {
        const release = () => {
            if (box.current) box.current.style.minHeight = '';
        };
        window.addEventListener('resize', release);
        return () => window.removeEventListener('resize', release);
    }, []);
    return box;
};

const REST = 0.08;

/** Sound waves that follow the voice while it plays and rest when paused. */
const Waves: FC<{ playing: boolean, track: string }> = ({ playing, track }) => {
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const bars = Array.from(box.current?.children ?? []) as HTMLElement[];
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (!playing || still || !bars.length) {
            for (const bar of bars) bar.style.transform = `scaleY(${REST})`;
            return;
        }

        let meter: VoiceMeter | null = openVoiceMeter();
        const speech: Speech = { level: 0, target: 0, next: 0 };
        const levels = bars.map(() => REST);
        let frame = 0;
        const tick = (now: number) => {
            let values = meter?.read(bars.length) ?? null;
            if (!values) {
                meter?.close();
                meter = null;
                values = simulateSpeech(now, bars.length, speech);
            }
            for (let i = 0; i < bars.length; i++) {
                levels[i] += ((values[i] ?? 0) - levels[i]) * 0.35;
                bars[i].style.transform = `scaleY(${Math.max(REST, Math.min(1, levels[i])).toFixed(3)})`;
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frame);
            meter?.close();
        };
    }, [ playing, track ]);

    return (
        <div ref={box} className='abp-waves' aria-hidden='true'>
            {WAVE.map(w => <i key={w.id} className='abp-w' />)}
        </div>
    );
};

type Kind = 'book' | 'audio' | 'video';

const kindOf = (item: BaseItemDto): Kind => {
    if (item.Type === 'AudioBook') return 'book';
    return item.MediaType === 'Video' ? 'video' : 'audio';
};

interface MiniProps {
    kind: Kind;
    title: string;
    line: string;
    cover?: string;
    /** The video of the song, in place of the cover. */
    videoHost?: HTMLElement | null;
    percent: number;
    playing: boolean;
    canPrev: boolean;
    canNext: boolean;
    onOpen: () => void;
    onBack: () => void;
    onForward: () => void;
    onPrev: () => void;
    onNext: () => void;
    onPlayPause: () => void;
    onStop: () => void;
}

const playLabel = (playing: boolean) => globalize.translate(playing ? 'ButtonPause' : 'Play');

/** The small bar: tap it to open the full player (or the video); its buttons work without opening it. */
const MiniBar: FC<MiniProps> = ({ kind, title, line, cover, videoHost, percent, playing, canPrev, canNext, onOpen, onBack, onForward, onPrev, onNext, onPlayPause, onStop }) => {
    const stop = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);
    const onKey = useCallback((e: React.KeyboardEvent) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpen();
        }
    }, [ onOpen ]);
    // The pages leave room at their end for it too
    const barRef = useRef<HTMLDivElement>(null);
    useBottomSpace('player', barRef, true);
    return (
        <div ref={barRef} className='abp-mini' role='button' tabIndex={0} onClick={onOpen} onKeyDown={onKey} aria-label={title}>
            <span className='abp-mini-progress' style={{ width: `${percent}%` }} />
            <span className={[ 'abp-mini-cover', playing && 'is-playing', videoHost && 'has-video' ].filter(Boolean).join(' ')}>
                {videoHost ? <VideoSlot host={videoHost} /> : cover && <CoverLayers src={cover} />}
            </span>
            <span key={title} className='abp-mini-text abp-text-in'>
                <span className='abp-mini-title'>{title}</span>
                <span className='abp-mini-sub'>{line}</span>
            </span>
            <span className='abp-mini-actions' onClick={stop} onKeyDown={stop} role='presentation'>
                {kind === 'book' && <button type='button' className='abp-icon abp-hide-xs' onClick={onBack} aria-label={globalize.translate('ApBack30')}>↺<small>30</small></button>}
                {kind === 'audio' && <button type='button' className='abp-icon abp-hide-xs' onClick={onPrev} disabled={!canPrev} aria-label={globalize.translate('ApPrevious')}>⏮</button>}
                <button type='button' className='abp-icon abp-main-sm' onClick={onPlayPause} aria-label={playLabel(playing)}>{playing ? '❚❚' : '▶'}</button>
                <button type='button' className='abp-icon abp-stop-sm' onClick={onStop} aria-label={globalize.translate('ApStop')} title={globalize.translate('ApStop')}>■</button>
                {kind === 'book' && <button type='button' className='abp-icon abp-hide-xs' onClick={onForward} aria-label={globalize.translate('ApForward30')}>↻<small>30</small></button>}
                {kind === 'audio' && <button type='button' className='abp-icon abp-hide-xs' onClick={onNext} disabled={!canNext} aria-label={globalize.translate('ApNext')}>⏭</button>}
            </span>
        </div>
    );
};

interface Actions {
    onPlayPause: () => void;
    onStop: () => void;
    onBack: () => void;
    onForward: () => void;
    onPrev: () => void;
    onNext: () => void;
}

/** Play / pause with stop right next to it; audiobooks and videos also get ±30 s, the parts are prev / next. */
const Controls: FC<Actions & { isBook: boolean, skips: boolean, playing: boolean, canPrev: boolean, canNext: boolean }> = ({ isBook, skips, playing, canPrev, canNext, onPlayPause, onStop, onBack, onForward, onPrev, onNext }) => (
    <div className='abp-controls'>
        <button type='button' className='abp-icon' onClick={onPrev} disabled={!canPrev} aria-label={globalize.translate(isBook ? 'ApPrevPart' : 'ApPrevious')}>⏮</button>
        {skips && <button type='button' className='abp-icon abp-skip' onClick={onBack} aria-label={globalize.translate('ApBack30')}>↺<small>30</small></button>}
        <button type='button' className='abp-play' onClick={onPlayPause} aria-label={playLabel(playing)}>{playing ? '❚❚' : '▶'}</button>
        <button type='button' className='abp-stop-big' onClick={onStop} aria-label={globalize.translate('ApStop')} title={globalize.translate('ApStop')}>■</button>
        {skips && <button type='button' className='abp-icon abp-skip' onClick={onForward} aria-label={globalize.translate('ApForward30')}>↻<small>30</small></button>}
        <button type='button' className='abp-icon' onClick={onNext} disabled={!canNext} aria-label={globalize.translate(isBook ? 'ApNextPart' : 'ApNext')}>⏭</button>
    </div>
);

/** The queue, or the parts of an audiobook: tap one to jump to it. It keeps what plays in sight. */
const QueuePanel: FC<{ title: string, playlist: BaseItemDto[], index: number, playing: boolean, onPick: (e: React.MouseEvent<HTMLButtonElement>) => void }> = ({ title, playlist, index, playing, onPick }) => {
    const list = useRef<HTMLOListElement>(null);
    useEffect(() => {
        centerInside(list.current, list.current?.querySelector('.is-current'));
    }, [ index, playlist.length ]);
    return (
        <aside className='abp-chapters abp-queue'>
            <h3>{title}</h3>
            <ol ref={list}>
                {playlist.map((p, i) => (
                    <li key={p.PlaylistItemId ?? p.Id}>
                        <button type='button' data-id={p.PlaylistItemId ?? ''} className={i === index ? 'is-current' : undefined} onClick={onPick}>
                            <span className='abp-ch-n'>{i === index && playing ? <span className='abp-eq'><i /><i /><i /></span> : i + 1}</span>
                            <span className='abp-ch-name'>{p.Name}</span>
                            {p.RunTimeTicks ? <span className='abp-ch-time'>{clock(p.RunTimeTicks / TICKS_PER_MS)}</span> : null}
                        </button>
                    </li>
                ))}
            </ol>
        </aside>
    );
};

interface SeekProps {
    positionMs: number;
    durationMs: number;
    percent: number;
    bookLine?: string;
    /** A song: the line that was played is a wave, which travels while it plays. */
    wavy: boolean;
    playing: boolean;
    onSeek: (e: ChangeEvent<HTMLInputElement>) => void;
}

/** Where it is in this track (or part), and for audiobooks in the whole book. */
const SeekBar: FC<SeekProps> = ({ positionMs, durationMs, percent, bookLine, wavy, playing, onSeek }) => {
    const slider = (
        <input
            type='range'
            min={0}
            max={Math.max(1, Math.round(durationMs))}
            value={Math.round(positionMs)}
            onChange={onSeek}
            aria-label={globalize.translate('ApPosition')}
            style={{ '--abp-fill': `${percent}%` } as React.CSSProperties}
        />
    );
    return (
        <div className={wavy ? 'abp-seek is-wavy' : 'abp-seek'}>
            {wavy ? (
                <div className={playing ? 'abp-seek-line is-playing' : 'abp-seek-line'} style={{ '--abp-done': percent / 100 } as React.CSSProperties}>
                    <span className='abp-squiggle' />
                    {slider}
                </div>
            ) : slider}
            <div className='abp-times'>
                <span>{clock(positionMs)}</span>
                <span>-{clock(durationMs - positionMs)}</span>
            </div>
            {bookLine && <p className='abp-book'>{bookLine}</p>}
        </div>
    );
};

interface View {
    item: BaseItemDto;
    isBook: boolean;
    isVideo: boolean;
    title: string;
    subtitle: string;
    partLine: string;
    cover?: string;
    background?: string;
    playing: boolean;
    percent: number;
    canPrev: boolean;
    canNext: boolean;
    queueTitle: string;
    bookLine?: string;
}

/** A video: the series and its episode, or the movie with its year and genres. */
const videoText = (item: BaseItemDto) => {
    if (item.Type === 'Episode') {
        const episode = item.IndexNumber == null ? '' : globalize.translate('VpEpisodeNumber', item.ParentIndexNumber ?? 1, item.IndexNumber);
        return { title: item.SeriesName || item.Name || '', subtitle: [ episode, item.Name ].filter(Boolean).join(' · ') };
    }
    return { title: item.Name || '', subtitle: [ item.ProductionYear, ...(item.Genres ?? []).slice(0, 2) ].filter(Boolean).join(' · ') };
};

/** What the player shows for the item that plays. */
const describe = (basePath: string, state: State, book: { total: number, done: number, percent: number }): View | null => {
    const { item, positionMs, durationMs, paused, playlist, index, rate } = state;
    if (!item) return null;
    const kind = kindOf(item);
    const isBook = kind === 'book';
    const isVideo = kind === 'video';
    const artist = item.AlbumArtist || item.Artists?.[0] || '';
    const count = playlist.length;
    const partLine = isBook && count > 1 ? `${globalize.translate('AbPartOf', index + 1, count)} · ${item.Name ?? ''}` : '';
    const showBook = isBook && count > 1 && book.total > 0;
    const text = isVideo ? videoText(item) : {
        title: (isBook ? item.Album : undefined) || item.Name || '',
        subtitle: isBook ? artist : [ artist, item.Album ].filter(Boolean).join(' · ')
    };
    return {
        item,
        isBook,
        isVideo,
        ...text,
        partLine,
        cover: isVideo ? sceneOf(basePath, item) : coverOf(basePath, item),
        background: isVideo ? sceneOf(basePath, item, 240) : coverOf(basePath, item, 160),
        playing: !paused,
        percent: durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0,
        canPrev: count > 1,
        canNext: count > 1 && index < count - 1,
        queueTitle: globalize.translate(isBook ? 'ApParts' : 'ApQueue'),
        bookLine: showBook ? globalize.translate('ApBookProgress', book.percent, hoursLeft((book.total - book.done) / (rate || 1))) : undefined
    };
};

interface RemoteActions {
    onVolume: (value: number) => void;
    onMute: () => void;
    onAudio: (e: ChangeEvent<HTMLSelectElement>) => void;
    onSubtitle: (e: ChangeEvent<HTMLSelectElement>) => void;
    onDisconnect: () => void;
}

const trackName = (s: MediaStream) => s.DisplayTitle || s.Title || s.Language || String(s.Index);

interface Asked<T> {
    value: number;
    over: T;
}

const storeAsked = <T,>(key: string, asked: Asked<T> | null) => {
    try {
        if (asked) localStorage.setItem(key, JSON.stringify(asked));
        else localStorage.removeItem(key);
    } catch {
        // storage blocked: it is only remembered while the player stays open
    }
};

const recallAsked = <T,>(key: string): Asked<T> | null => {
    try {
        return JSON.parse(localStorage.getItem(key) ?? 'null') as Asked<T> | null;
    } catch {
        return null;
    }
};

/**
 * A value set on a remote device: what was asked is shown until the device reports a value different from the one it
 * had when it was asked (then the device is right again). With a memory key it is still there when the player opens
 * again.
 */
const useAsked = <T,>(reported: T, memory?: string, start?: number) => {
    const [ asked, setAsked ] = useState<Asked<T> | null>(() => {
        const known = memory ? recallAsked<T>(memory) : null;
        return known ?? (start === undefined ? null : { value: start, over: reported });
    });
    const ask = useCallback((value: number) => setAsked(a => {
        const next = { value, over: a ? a.over : reported };
        if (memory) storeAsked(memory, next);
        return next;
    }), [ memory, reported ]);
    const settled = asked !== null && asked.over !== reported;
    useEffect(() => {
        if (!settled) return;
        setAsked(null);
        if (memory) storeAsked(memory, null);
    }, [ memory, settled ]);
    return useMemo(() => ({ value: asked && !settled ? asked.value : reported, ask }), [ asked, settled, reported, ask ]);
};

/** What only a remote device has: its volume, its audio and subtitles, and leaving it. */
const RemotePanel: FC<RemoteActions & { state: State }> = ({ state, onVolume, onMute, onAudio, onSubtitle, onDisconnect }) => {
    // What was asked shows until the device reports something new: some TVs take seconds to answer, and others
    // (Android TV) change the volume of the TV itself and keep telling 100, so a timer would jump the bar back
    const heard = Math.round(state.volume);
    const volume = useAsked(heard, `abp-volume-${state.device}`, heard >= 100 ? SAFE_VOLUME : undefined);
    // Moving the bar takes the mute off: it shows at once, before the device confirms it
    const [ unmuting, setUnmuting ] = useState(false);
    useEffect(() => {
        if (!state.muted) setUnmuting(false);
    }, [ state.muted ]);
    const shown = state.muted && !unmuting ? 0 : volume.value;
    const audio = useAsked(state.audioIndex ?? '');
    const subtitle = useAsked(state.subtitleIndex ?? -1);
    // Going up is gradual, however far the finger lands; going down is immediate
    const climb = useRef({ at: 0, from: 0 });
    const onSlide = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const now = Date.now();
        if (now - climb.current.at >= VOLUME_SEND_MS) climb.current = { at: now, from: shown };
        const value = Math.min(Number(e.target.value), Math.max(shown, climb.current.from + MAX_VOLUME_RISE));
        volume.ask(value);
        setUnmuting(true);
        onVolume(value);
    }, [ onVolume, shown, volume ]);
    const onPickAudio = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
        audio.ask(Number(e.target.value));
        onAudio(e);
    }, [ onAudio, audio ]);
    const onPickSubtitle = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
        subtitle.ask(Number(e.target.value));
        onSubtitle(e);
    }, [ onSubtitle, subtitle ]);
    return (
        <div className='abp-remote'>
            <div className='abp-volume'>
                <button type='button' className={state.muted ? 'abp-icon is-on' : 'abp-icon'} onClick={onMute} aria-label={globalize.translate(state.muted ? 'ApUnmute' : 'Mute')} title={globalize.translate(state.muted ? 'ApUnmute' : 'Mute')}>
                    {shown === 0 ? '🔇' : '🔊'}
                </button>
                <input
                    type='range'
                    min={0}
                    max={100}
                    step={2}
                    value={shown}
                    onChange={onSlide}
                    aria-label={globalize.translate('ApVolume')}
                    style={{ '--abp-fill': `${shown}%` } as React.CSSProperties}
                />
                <span className='abp-volume-n'>{shown}</span>
            </div>
            {(state.audio.length > 1 || state.subtitles.length > 0) && (
                <div className='abp-tracks'>
                    {state.audio.length > 1 && (
                        <label className='abp-select'>
                            <span>🗣 {globalize.translate('Audio')}</span>
                            <select value={audio.value} onChange={onPickAudio}>
                                {state.audio.map(s => <option key={s.Index} value={s.Index}>{trackName(s)}</option>)}
                            </select>
                        </label>
                    )}
                    {state.subtitles.length > 0 && (
                        <label className='abp-select'>
                            <span>💬 {globalize.translate('Subtitles')}</span>
                            <select value={subtitle.value} onChange={onPickSubtitle}>
                                <option value={-1}>{globalize.translate('VpSubtitlesOff')}</option>
                                {state.subtitles.map(s => <option key={s.Index} value={s.Index}>{trackName(s)}</option>)}
                            </select>
                        </label>
                    )}
                </div>
            )}
            <button type='button' className='abp-chip abp-leave' onClick={onDisconnect}>📴 {globalize.translate('ApLeaveDevice')}</button>
        </div>
    );
};

const iconOf = (view: View) => {
    if (view.isVideo) return '🎬';
    return view.isBook ? '🎧' : '🎵';
};

/** Over the player: the device it plays on, or what it is doing. */
const topLabel = (view: View, state: State) => {
    if (state.remote && state.device) return globalize.translate('ApPlayingOn', state.device);
    return globalize.translate(view.isBook ? 'ApListening' : 'ApNowPlaying');
};

/** Around the cover: the bars that follow a song, or the soft rings of a book or a video. */
const StageShow: FC<{ isSong: boolean, view: View, state: State, engine: Engine | null, bpm?: number | null, energy?: number | null, wave: number[], colors: SongColors }> = ({ isSong, view, state, engine, bpm, energy, wave, colors }) => (isSong ? (
    <SongVisualizer player={engine} playing={view.playing} remote={state.remote} bpm={bpm} energy={energy} waveform={wave} positionMs={state.positionMs} durationMs={state.durationMs} colors={colors} />
) : (
    <>
        <span className='abp-ring' />
        <span className='abp-ring abp-ring-2' />
        <span className='abp-ring abp-ring-3' />
    </>
));

/** The shape of the song, the same bar for every song; the waves that follow the voice are for books. */
const PlayerWave: FC<{ view: View, isSong: boolean, wave: number[], durationMs: number, onSeekTo: (ms: number) => void }> = ({ view, isSong, wave, durationMs, onSeekTo }) => {
    if (view.isVideo) return null;
    if (isSong) return <SongWave waveform={wave} percent={view.percent} playing={view.playing} durationMs={durationMs} onSeekTo={onSeekTo} />;
    return <Waves playing={view.playing} track={view.item.Id ?? ''} />;
};

const songStyle = (isSong: boolean, colors: SongColors) => (isSong ? { '--abp-song-a': colors[0], '--abp-song-b': colors[1], '--abp-song-deep': colors[2] } as React.CSSProperties : undefined);

/** What the screen shows of the song: its analysis, its shape and the colors of its album. */
const useSongShow = (api: Api, isSong: boolean, itemId?: string | null, cover?: string | null) => {
    const { data: songInfo } = useSongInfo(api, isSong ? itemId : null);
    const audio = songInfo?.Analysis?.Audio;
    const songWave = useMemo(() => {
        const measured = decodeWave(audio?.Waveform);
        return measured.length || !isSong ? measured : standInWave(itemId ?? '');
    }, [ audio?.Waveform, isSong, itemId ]);
    const colors = useCoverColors(isSong ? cover : null);
    return { songInfo, audio, songWave, colors };
};

/** Opens the list; it is always there, also with a single song. */
const QueueButton: FC<{ on: boolean, title: string, onClick: () => void }> = ({ on, title, onClick }) => (
    <button type='button' className={on ? 'abp-round is-on' : 'abp-round'} onClick={onClick} aria-label={title} title={title} aria-pressed={on}>
        <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M4 6h16M4 12h16M4 18h10' /></svg>
    </button>
);

/** Turning the DJ on opens the list, so the songs it adds can be seen. */
const useListWithDj = (queue: boolean, onToggleQueue: () => void) => {
    const djOn = useSyncExternalStore(djStore.subscribe, () => djStore.get().on);
    const wasOn = useRef(djOn);
    useEffect(() => {
        if (djOn && !wasOn.current && !queue) onToggleQueue();
        wasOn.current = djOn;
    }, [ djOn, queue, onToggleQueue ]);
};

/** Behind the player: the colors of the cover for a song, the blurred picture for a book or a video. */
const PlayerBackdrop: FC<{ isSong: boolean, background?: string }> = ({ isSong, background }) => (isSong ? (
    <div className='abp-aura' aria-hidden='true'><i /><i /><i /></div>
) : (
    <>
        <div className='abp-bg' style={background ? { backgroundImage: `url("${background}")` } : undefined} />
        <div className='abp-bg-glow' />
    </>
));

/** Next to the player: the list opened with its button and, for a song, the open panel above it. */
const PlayerSide: FC<{ isSong: boolean, showList: boolean, studio: React.ReactNode, list: React.ReactNode }> = ({ isSong, showList, studio, list }) => (
    <div className={isSong ? 'abp-side' : 'abp-side-plain'}>{studio}{showList && list}</div>
);

const panelClassOf = (showSide: boolean, isSong: boolean, hasStudio: boolean) => (
    [ 'abp-panel', showSide && 'has-chapters', isSong && 'has-side', hasStudio && 'has-studio' ].filter(Boolean).join(' ')
);

/** The video in place of the cover: touching it pauses, and it can fill the screen. */
const StageVideo: FC<{ host: HTMLElement, playing: boolean, onPlayPause: () => void, onFullscreen: () => void }> = ({ host, playing, onPlayPause, onFullscreen }) => (
    <>
        <VideoSlot host={host} />
        <button type='button' className='abp-video-tap' onClick={onPlayPause} aria-label={playLabel(playing)}>
            {!playing && <span className='abp-video-paused' aria-hidden='true'>▶</span>}
        </button>
        <button type='button' className='abp-round abp-video-full' onClick={onFullscreen} aria-label={globalize.translate('MhVideoFullscreen')} title={globalize.translate('MhVideoFullscreen')}>⛶</button>
    </>
);

interface VideoChipsProps {
    hasVideo: boolean;
    videoChecked: boolean;
    videoMode: boolean;
    showing: boolean;
    onWatch: () => void;
    onSongOnly: () => void;
    onVideoMode: () => void;
}

/** Watch the video of this song or go back to its audio, and the choice of always preferring videos. */
const VideoChips: FC<VideoChipsProps> = ({ hasVideo, videoChecked, videoMode, showing, onWatch, onSongOnly, onVideoMode }) => (
    <>
        {hasVideo && <button type='button' className='abp-chip abp-chip-video' onClick={showing ? onSongOnly : onWatch}>{showing ? '🎵' : '🎬'} {globalize.translate(showing ? 'MhSongOnly' : 'MhWatchVideo')}</button>}
        <button type='button' className={videoMode ? 'abp-chip is-on' : 'abp-chip'} aria-pressed={videoMode} onClick={onVideoMode}>📺 {globalize.translate(videoMode && videoChecked && !hasVideo ? 'MhNoSongVideo' : 'MhPreferVideos')}</button>
    </>
);

interface FullProps extends Actions, RemoteActions {
    view: View;
    state: State;
    queue: boolean;
    sleepLabel: string;
    sleepOn: boolean;
    onClose: () => void;
    onToggleQueue: () => void;
    onSeek: (e: ChangeEvent<HTMLInputElement>) => void;
    onSpeed: () => void;
    onSleep: () => void;
    onPick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    api: Api;
    engine: Engine | null;
    onSeekTo: (ms: number) => void;
    hasVideo: boolean;
    /** The server already answered whether this song has a video. */
    videoChecked: boolean;
    videoMode: boolean;
    /** The box of the video while it plays in place of the cover. */
    videoHost: HTMLElement | null;
    onWatch: () => void;
    onSongOnly: () => void;
    onFullscreen: () => void;
    onVideoMode: () => void;
}

/** The full player: cover, waves, position, controls, speed and sleep timer, queue; and the remote control of another device. */
const FullPlayer: FC<FullProps> = ({ view, state, queue, sleepLabel, sleepOn, onClose, onToggleQueue, onSeek, onSpeed, onSleep, onPick, onVolume, onMute, onAudio, onSubtitle, onDisconnect, api, engine, onSeekTo, hasVideo, videoChecked, videoMode, videoHost, onWatch, onSongOnly, onFullscreen, onVideoMode, ...actions }) => {
    const { item, isBook, isVideo, title, subtitle, partLine, cover, background, playing, percent, canPrev, canNext, queueTitle, bookLine } = view;
    useListWithDj(queue, onToggleQueue);
    const icon = iconOf(view);
    const label = topLabel(view, state);
    const isSong = item.Type === 'Audio';
    const [ chosenTab, setStudio ] = useState<StudioTab | null>(null);
    const studio = isSong ? chosenTab : null;
    const { audio, songWave, colors } = useSongShow(api, isSong, item.Id, cover);
    const onStudioClose = useCallback(() => setStudio(null), []);
    const showSide = !!studio || queue;
    const extras = useSteadyHeight(`${item.Id}-${hasVideo}`);
    // Another device may not tell its queue: at least what plays is in the list
    const queuePanel = <QueuePanel title={queueTitle} playlist={state.playlist.length ? state.playlist : [ item ]} index={state.index} playing={playing} onPick={onPick} />;
    return (
        <div className='abp' role='dialog' aria-modal='true' aria-label={title} style={songStyle(isSong, colors)}>
            {/* Background: the cover blurred, larger than the window so its soft edges never show */}
            <PlayerBackdrop isSong={isSong} background={background} />
            <div className={panelClassOf(showSide, isSong && showSide, !!studio)}>
                <header className='abp-top'>
                    <QueueButton on={queue} title={queueTitle} onClick={onToggleQueue} />
                    <span className='abp-top-label'>{state.remote ? '📡' : icon} {label}</span>
                    {/* Minimize: back to the small bar, playback goes on */}
                    <button type='button' className='abp-round abp-minimize' onClick={onClose} aria-label={globalize.translate('ApClose')} title={globalize.translate('ApClose')}>
                        <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 9l6 6 6-6' /></svg>
                    </button>
                </header>

                <div className='abp-main'>
                    <div className={[ 'abp-stage', playing && 'is-playing', isVideo && 'is-wide', isSong && 'is-song', videoHost && 'has-video' ].filter(Boolean).join(' ')}>
                        {videoHost ? (
                            <StageVideo host={videoHost} playing={playing} onPlayPause={actions.onPlayPause} onFullscreen={onFullscreen} />
                        ) : (
                            <>
                                <StageShow isSong={isSong} view={view} state={state} engine={engine} bpm={audio?.Bpm} energy={audio?.Energy} wave={songWave} colors={colors} />
                                {cover ? <span className='abp-cover'><CoverLayers src={cover} /></span> : <span className='abp-cover abp-cover-empty'>{icon}</span>}
                            </>
                        )}
                    </div>

                    <div className={isSong ? 'abp-info is-song' : 'abp-info'}>
                        <div key={item.Id} className='abp-info-text abp-text-in'>
                            <h2 className='abp-title'>{title}</h2>
                            {subtitle && <p className='abp-author'>{subtitle}</p>}
                            {partLine && <p className='abp-part'>{partLine}</p>}
                        </div>
                    </div>

                    {!videoHost && <PlayerWave view={view} isSong={isSong} wave={songWave} durationMs={state.durationMs} onSeekTo={onSeekTo} />}
                    <SeekBar positionMs={state.positionMs} durationMs={state.durationMs} percent={percent} bookLine={bookLine} wavy={isSong} playing={playing} onSeek={onSeek} />
                    <Controls isBook={isBook} skips={isBook || isVideo} playing={playing} canPrev={canPrev} canNext={canNext} {...actions} />

                    <div ref={extras} className='abp-extras'>
                        {isBook && !state.remote && <button type='button' className={state.rate === 1 ? 'abp-chip' : 'abp-chip is-on'} onClick={onSpeed}>⚡ {state.rate}×</button>}
                        {isSong && !state.remote && <VideoChips hasVideo={hasVideo} videoChecked={videoChecked} videoMode={videoMode} showing={!!videoHost} onWatch={onWatch} onSongOnly={onSongOnly} onVideoMode={onVideoMode} />}
                        {isSong && <StudioChips tab={studio} remote={state.remote} onTab={setStudio} />}
                        <button type='button' className={sleepOn ? 'abp-chip is-on' : 'abp-chip'} onClick={onSleep}>🌙 {sleepLabel}</button>
                    </div>

                    {state.remote && <RemotePanel state={state} onVolume={onVolume} onMute={onMute} onAudio={onAudio} onSubtitle={onSubtitle} onDisconnect={onDisconnect} />}
                </div>

                <PlayerSide
                    isSong={isSong}
                    showList={queue}
                    list={queuePanel}
                    studio={studio && <StudioPanel api={api} item={item} tab={studio} player={engine} positionMs={state.positionMs} durationMs={state.durationMs} percent={percent} playing={playing} onSeekTo={onSeekTo} onClose={onStudioClose} />}
                />
            </div>
        </div>
    );
};

/** Sleep timer: pauses when the time is up, or at the end of the part. */
const useSleepTimer = (state: State, playerRef: React.RefObject<Engine | null>) => {
    const [ sleep, setSleep ] = useState(0);
    const [ sleepAt, setSleepAt ] = useState<number | null>(null);
    const { positionMs, durationMs, paused } = state;

    useEffect(() => {
        const player = playerRef.current;
        if (!player || paused) return;
        const timeUp = sleepAt !== null && Date.now() >= sleepAt;
        const partEnds = sleep === -1 && durationMs > 0 && durationMs - positionMs < 1500;
        if (timeUp || partEnds) {
            pm.pause(player);
            setSleep(0);
            setSleepAt(null);
        }
    }, [ positionMs, paused, sleep, sleepAt, durationMs, playerRef ]);

    const next = useCallback(() => {
        const step = SLEEP_STEPS[(SLEEP_STEPS.indexOf(sleep) + 1) % SLEEP_STEPS.length];
        setSleep(step);
        setSleepAt(step > 0 ? Date.now() + step * 60000 : null);
    }, [ sleep ]);
    const clear = useCallback(() => {
        setSleep(0);
        setSleepAt(null);
    }, []);

    return { sleep, sleepAt, next, clear };
};

interface VideoNeeds {
    act: (fn: (player: Engine) => void) => void;
    stopAll: () => void;
    sleep: number;
    sleepAt: number | null;
    clearSleep: () => void;
}

/** Whether the app is in the background (old browsers without the property count as always on screen). */
// eslint-disable-next-line compat/compat -- read only; undefined there, which is "not hidden"
const appHidden = () => document.visibilityState === 'hidden';

/**
 * The video of a song in place of its audio. With "prefer videos" on, each song that has one shows it and the next
 * one follows at its end; the audio waits paused. If the app goes to the background, where a phone stops videos,
 * the song takes over so the music does not end; back in the app the video comes back where the song is.
 */
const useSongVideo = (api: Api | undefined, state: State, { act, stopAll, sleep, sleepAt, clearSleep }: VideoNeeds) => {
    const { item, remote, paused, playlist, index, durationMs } = state;
    const on = useSyncExternalStore(songVideoMode.subscribe, songVideoMode.get);
    const itemId = item?.Id ?? null;
    const isSong = item?.Type === 'Audio' && !remote;
    const { data: info } = useSongInfo(api, isSong ? itemId : null);
    // Known before the next song starts, so its audio does not sound first
    const upcoming = playlist[index + 1];
    useSongInfo(api, on && isSong && upcoming?.Type === 'Audio' ? upcoming.Id : null);

    const [ video, setVideo ] = useState<string | null>(null);
    const [ progress, setProgress ] = useState({ playing: true, positionMs: 0, durationMs: 0 });
    // One video element for every song: a phone lets it play by itself only after the user touched it once, and that
    // permission belongs to the element, so a new one for each song would stop at every change
    const [ host ] = useState(() => {
        const box = document.createElement('div');
        box.className = 'abp-video-host';
        const media = document.createElement('video');
        media.playsInline = true;
        media.preload = 'auto';
        media.poster = BLANK_POSTER;
        box.appendChild(media);
        return box;
    });
    const element = useRef<HTMLVideoElement | null>(null);
    element.current ??= host.querySelector('video');
    const declined = useRef<string | null>(null);
    if (declined.current && declined.current !== itemId) declined.current = null;
    // A phone stops videos while the app is in the background: no video starts then, the song plays
    const [ visible, setVisible ] = useState(() => !appHidden());
    const hasNext = index < playlist.length - 1;
    const wanted = on && isSong && visible && !!info?.HasVideo && declined.current !== itemId;
    /** Where the video starts: where the song is, coming back to the app or after a while of audio. */
    const startAt = useRef(0);

    const start = useCallback((id: string) => {
        stopTransition();
        act(p => {
            startAt.current = (pm.currentTime(p) || 0) / 1000;
            pm.pause(p);
        });
        setProgress({ playing: true, positionMs: startAt.current * 1000, durationMs: 0 });
        setVideo(id);
    }, [ act ]);

    useLayoutEffect(() => {
        if (video === itemId) return;
        // A song paused by hand (in the background, from the notification) stays paused: no video starts by itself
        if (wanted && itemId && !paused) start(itemId);
        else if (video && !wanted) setVideo(null);
    }, [ video, itemId, wanted, paused, start ]);

    // A song that was already on its way is held while its video plays
    useEffect(() => {
        if (video && video === itemId && !paused) act(p => pm.pause(p));
    }, [ video, itemId, paused, act ]);

    const resumeSong = useCallback(() => {
        act(p => {
            if (pm.paused(p)) pm.playPause(p);
        });
    }, [ act ]);
    const songOnly = useCallback(() => {
        declined.current = itemId;
        setVideo(null);
        resumeSong();
    }, [ itemId, resumeSong ]);
    const onError = useCallback(() => {
        toast(globalize.translate('MhVideoError'));
        songOnly();
    }, [ songOnly ]);
    const onEnded = useCallback(() => {
        setVideo(null);
        declined.current = itemId;
        if (sleep === -1) clearSleep();
        else if (hasNext) act(p => pm.nextTrack(p));
        else if (on) stopAll();
        else resumeSong();
    }, [ itemId, sleep, clearSleep, hasNext, on, act, stopAll, resumeSong ]);

    // Leaving the app: the song goes on from where the video was. Coming back: the video goes on from where the song
    // is (the same song, or the one it reached meanwhile)
    const playing = useRef({ video, durationMs, act });
    playing.current = { video, durationMs, act };
    useEffect(() => {
        const onChange = () => {
            const hidden = appHidden();
            const now = playing.current;
            const media = element.current;
            if (hidden && now.video && media) {
                const seconds = media.currentTime;
                const wasPlaying = !media.paused;
                now.act(p => {
                    const limit = now.durationMs > 1000 ? now.durationMs - 1000 : 0;
                    pm.seek(Math.min(seconds * 1000, limit) * TICKS_PER_MS, p);
                    if (wasPlaying && pm.paused(p)) pm.playPause(p);
                });
            }
            setVisible(!hidden);
        };
        document.addEventListener('visibilitychange', onChange);
        return () => document.removeEventListener('visibilitychange', onChange);
    }, []);

    // The sleep timer also ends a video
    useEffect(() => {
        if (!video || sleepAt === null) return;
        const timer = window.setTimeout(() => {
            element.current?.pause();
            clearSleep();
        }, Math.max(0, sleepAt - Date.now()));
        return () => window.clearTimeout(timer);
    }, [ video, sleepAt, clearSleep ]);

    const shownVideo = video === itemId ? video : null;
    const handlers = useRef({ onEnded, onError, songOnly });
    handlers.current = { onEnded, onError, songOnly };

    const onProgress = useCallback((current: HTMLVideoElement) => {
        setProgress(prev => ({
            playing: !current.paused,
            positionMs: current.currentTime * 1000,
            // A video converted on the way does not know its length: the song's is used
            durationMs: Number.isFinite(current.duration) ? current.duration * 1000 : prev.durationMs
        }));
    }, []);
    useEffect(() => {
        const media = element.current;
        if (!media) return;
        const report = () => onProgress(media);
        const ended = () => handlers.current.onEnded();
        const failed = () => {
            if (media.getAttribute('src')) handlers.current.onError();
        };
        const onFullscreen = () => {
            // eslint-disable-next-line compat/compat
            media.controls = document.fullscreenElement === media;
        };
        // The first touch anywhere in the app gives this element the permission to play later by itself
        const unlock = () => {
            if (media.getAttribute('src')) return;
            void media.play().catch(() => undefined);
            media.pause();
        };
        const events: [string, () => void][] = [ [ 'loadedmetadata', report ], [ 'play', report ], [ 'pause', report ], [ 'timeupdate', report ], [ 'ended', ended ], [ 'error', failed ] ];
        for (const [ name, fn ] of events) media.addEventListener(name, fn);
        document.addEventListener('fullscreenchange', onFullscreen);
        document.addEventListener('pointerup', unlock, { once: true, capture: true });
        document.addEventListener('keydown', unlock, { once: true, capture: true });
        return () => {
            for (const [ name, fn ] of events) media.removeEventListener(name, fn);
            document.removeEventListener('fullscreenchange', onFullscreen);
            document.removeEventListener('pointerup', unlock, { capture: true });
            document.removeEventListener('keydown', unlock, { capture: true });
        };
    }, [ onProgress ]);

    // The same element changes from one video to the next
    useEffect(() => {
        const media = element.current;
        if (!media || !api) return;
        if (!shownVideo) {
            if (media.getAttribute('src')) {
                media.pause();
                media.removeAttribute('src');
                media.load();
            }
            return;
        }
        media.src = `${api.basePath}/MusicHub/Songs/${shownVideo}/Video?ApiKey=${encodeURIComponent(api.accessToken)}`;
        const at = startAt.current;
        startAt.current = 0;
        // The song had gone on (the app was in the background): the video goes on from there. A video converted on the
        // way (.mkv) cannot jump ahead: then the song keeps playing, so nothing is heard twice
        const jump = () => {
            const range = media.seekable;
            if (range.length && range.end(range.length - 1) >= at) media.currentTime = at;
            else handlers.current.songOnly();
        };
        if (at > 2) media.addEventListener('loadedmetadata', jump, { once: true });
        void media.play().catch(() => undefined);
        return () => media.removeEventListener('loadedmetadata', jump);
    }, [ api, shownVideo ]);

    const seek = useCallback((ms: number) => {
        if (element.current) element.current.currentTime = ms / 1000;
    }, []);
    const onFullscreen = useCallback(() => {
        const current = element.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
        if (!current) return;
        if (current.requestFullscreen) void current.requestFullscreen().catch(() => undefined);
        else current.webkitEnterFullscreen?.();
    }, []);
    const toggle = useCallback(() => {
        const current = element.current;
        if (!current) return;
        if (current.paused) void current.play().catch(() => undefined);
        else current.pause();
    }, []);
    const watch = useCallback(() => {
        if (itemId) start(itemId);
    }, [ itemId, start ]);
    const onMode = useCallback(() => {
        declined.current = null;
        songVideoMode.set(!on);
        if (on && video) songOnly();
    }, [ on, video, songOnly ]);
    const clearVideo = useCallback(() => setVideo(null), []);

    return { video: shownVideo, on, hasVideo: !!info?.HasVideo, videoChecked: !!info, element, host, progress, songOnly, onEnded, onError, onProgress, seek, onFullscreen, toggle, watch, onMode, clearVideo };
};

const Player: FC = () => {
    const { api } = useApi();
    const location = useLocation();
    const { state, playerRef, reset } = usePlayback(api);
    const timer = useSleepTimer(state, playerRef);
    const [ open, setOpen ] = useState(false);
    const [ queue, setQueue ] = useState(false);
    const lastBook = useRef<string | null>(null);
    const volumeWanted = useRef<number | null>(null);
    const volumeTimer = useRef(0);
    useEffect(() => () => window.clearTimeout(volumeTimer.current), []);

    const { item, positionMs, durationMs, playlist, index, rate, remote, muted } = state;
    const kind = item ? kindOf(item) : undefined;
    const bookKey = kind === 'book' && item ? (item.AlbumId ?? item.Id ?? null) : null;
    // A video playing here has its own screen; on another device the full player is its remote control
    const ownScreen = kind === 'video' && !remote;

    // A new audiobook opens the full player
    useEffect(() => {
        if (bookKey && bookKey !== lastBook.current) setOpen(true);
        lastBook.current = bookKey;
    }, [ bookKey ]);

    // Nothing playing (or a video here, which has its own screen): no full player
    useEffect(() => {
        if (!item || ownScreen) setOpen(false);
    }, [ item, ownScreen ]);

    // "Now playing" / "Remote control" buttons of the app
    const latest = useRef({ item, ownScreen, device: state.device });
    latest.current = { item, ownScreen, device: state.device };
    useEffect(() => {
        const onOpenRequest = () => {
            const now = latest.current;
            if (!now.item) {
                // Another device just chosen: what it plays may take a moment to arrive
                if (isRemote(pm.getCurrentPlayer())) setWaiting(true);
                else toast(globalize.translate('ApNothingPlayingHere'));
            } else if (now.ownScreen) {
                void appRouter.showVideoOsd();
            } else {
                setOpen(true);
            }
        };
        window.addEventListener(OPEN_PLAYER_EVENT, onOpenRequest);
        return () => window.removeEventListener(OPEN_PLAYER_EVENT, onOpenRequest);
    }, []);

    // Waiting for what the other device plays: opens as soon as it arrives, or says that nothing plays there
    const [ waiting, setWaiting ] = useState(false);
    useEffect(() => {
        if (waiting && item) {
            setWaiting(false);
            setOpen(true);
        }
    }, [ waiting, item ]);
    useEffect(() => {
        if (!waiting) return;
        const giveUp = window.setTimeout(() => {
            setWaiting(false);
            const info = pm.getPlayerInfo();
            toast(globalize.translate('ApNothingPlaying', info?.deviceName || info?.name || ''));
        }, REMOTE_POLL_MS * 3);
        return () => window.clearTimeout(giveUp);
    }, [ waiting ]);

    // While the full player is open the page behind does not scroll (and shows no scrollbar)
    useEffect(() => {
        document.documentElement.classList.toggle('abp-open', open);
        return () => document.documentElement.classList.remove('abp-open');
    }, [ open ]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [ open ]);

    const act = useCallback((fn: (player: Engine) => void) => {
        const player = playerRef.current ?? pm.getCurrentPlayer();
        if (player) fn(player);
    }, [ playerRef ]);

    const { clear } = timer;
    // Stop: ends the playback; the full player and the small bar go away at once (where you were is kept)
    const stopAll = useCallback(() => {
        setOpen(false);
        clear();
        act(p => pm.stop(p));
        reset();
    }, [ act, reset, clear ]);
    const songVideo = useSongVideo(api, state, { act, stopAll, sleep: timer.sleep, sleepAt: timer.sleepAt, clearSleep: clear });
    const { clearVideo, seek: seekVideo, video: playingVideo } = songVideo;
    const actions: Actions = {
        onPlayPause: useCallback(() => act(p => pm.playPause(p)), [ act ]),
        onStop: useCallback(() => {
            clearVideo();
            stopAll();
        }, [ clearVideo, stopAll ]),
        onBack: useCallback(() => act(p => pm.seek(Math.max(0, positionMs - SKIP_MS) * TICKS_PER_MS, p)), [ act, positionMs ]),
        onForward: useCallback(() => act(p => pm.seek(Math.min(durationMs || Infinity, positionMs + SKIP_MS) * TICKS_PER_MS, p)), [ act, positionMs, durationMs ]),
        onPrev: useCallback(() => act(p => pm.previousTrack(p)), [ act ]),
        onNext: useCallback(() => act(p => pm.nextTrack(p)), [ act ])
    };
    const onSeek = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const ms = Number(e.target.value);
        if (playingVideo) seekVideo(ms);
        else act(p => pm.seek(ms * TICKS_PER_MS, p));
    }, [ act, playingVideo, seekVideo ]);
    const onSpeed = useCallback(() => {
        const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length] ?? 1;
        act(p => pm.setPlaybackRate(next, p));
    }, [ act, rate ]);
    const onPick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id) act(p => pm.setCurrentPlaylistItem(id, p));
    }, [ act ]);
    const remoteActions: RemoteActions = {
        // While the bar is dragged the device gets the volume a few times a second, always the last one
        onVolume: useCallback((value: number) => {
            volumeWanted.current = value;
            if (volumeTimer.current) return;
            const send = () => {
                const wanted = volumeWanted.current;
                volumeWanted.current = null;
                if (wanted === null) {
                    volumeTimer.current = 0;
                    return;
                }
                act(p => {
                    if (muted && wanted > 0) pm.setMute(false, p);
                    pm.setVolume(wanted, p);
                });
                volumeTimer.current = window.setTimeout(send, VOLUME_SEND_MS);
            };
            send();
        }, [ act, muted ]),
        onMute: useCallback(() => act(p => pm.setMute(!muted, p)), [ act, muted ]),
        onAudio: useCallback((e: ChangeEvent<HTMLSelectElement>) => {
            const value = Number(e.target.value);
            act(p => pm.setAudioStreamIndex(value, p));
        }, [ act ]),
        onSubtitle: useCallback((e: ChangeEvent<HTMLSelectElement>) => {
            const value = Number(e.target.value);
            act(p => pm.setSubtitleStreamIndex(value, p));
        }, [ act ]),
        // Stops controlling that device (what it plays goes on there); back to this one
        onDisconnect: useCallback(() => {
            setOpen(false);
            pm.setDefaultPlayerActive();
        }, [])
    };
    // Videos playing here open their own screen; everything else opens the full player
    const onOpen = useCallback(() => {
        if (ownScreen) void appRouter.showVideoOsd();
        else setOpen(true);
    }, [ ownScreen ]);
    const onClose = useCallback(() => setOpen(false), []);
    const onToggleQueue = useCallback(() => setQueue(q => !q), []);

    // Progress of the whole book: the parts before this one plus where it is in this one
    const book = useMemo(() => {
        const total = playlist.reduce((sum, p) => sum + (p.RunTimeTicks ?? 0), 0) / TICKS_PER_MS;
        const before = playlist.slice(0, index).reduce((sum, p) => sum + (p.RunTimeTicks ?? 0), 0) / TICKS_PER_MS;
        const done = before + positionMs;
        return { total, done, percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0 };
    }, [ playlist, index, positionMs ]);

    const onSeekTo = useCallback((ms: number) => {
        if (playingVideo) seekVideo(ms);
        else act(p => pm.seek(ms * TICKS_PER_MS, p));
    }, [ act, playingVideo, seekVideo ]);
    const onMixNext = useCallback(() => act(p => pm.nextTrack(p)), [ act ]);
    useMusicEngine(api, playerRef.current, item, { positionMs, durationMs, paused: state.paused, remote, songsAhead: Math.max(0, playlist.length - 1 - index), onNext: onMixNext });

    // While a video plays in place of the song, the whole player follows the video
    const shown: State = playingVideo ? {
        ...state,
        positionMs: songVideo.progress.positionMs,
        durationMs: songVideo.progress.durationMs || state.durationMs,
        paused: !songVideo.progress.playing
    } : state;
    const shownActions: Actions = playingVideo ? { ...actions, onPlayPause: songVideo.toggle } : actions;
    const view = api ? describe(api.basePath, shown, book) : null;
    // The video screen has its own controls
    if (!view || !kind || !api || location.pathname === '/video') return null;

    // Drawn straight in the page body: inside the app a parent box would clip the fixed full player
    return createPortal(
        open ? (
            <FullPlayer
                view={view}
                state={shown}
                queue={queue}
                sleepLabel={sleepText(timer.sleep, timer.sleepAt)}
                sleepOn={timer.sleep !== 0}
                onClose={onClose}
                onToggleQueue={onToggleQueue}
                onSeek={onSeek}
                onSpeed={onSpeed}
                onSleep={timer.next}
                onPick={onPick}
                api={api}
                engine={playerRef.current}
                onSeekTo={onSeekTo}
                hasVideo={songVideo.hasVideo}
                videoChecked={songVideo.videoChecked}
                videoMode={songVideo.on}
                videoHost={playingVideo ? songVideo.host : null}
                onWatch={songVideo.watch}
                onSongOnly={songVideo.songOnly}
                onFullscreen={songVideo.onFullscreen}
                onVideoMode={songVideo.onMode}
                {...shownActions}
                {...remoteActions}
            />
        ) : (
            <MiniBar
                kind={kind}
                title={view.title}
                line={view.partLine || view.subtitle}
                cover={coverOf(api.basePath, view.item, 120)}
                videoHost={playingVideo ? songVideo.host : null}
                percent={view.percent}
                playing={view.playing}
                canPrev={view.canPrev}
                canNext={view.canNext}
                onOpen={onOpen}
                {...shownActions}
            />
        ),
        document.body
    );
};

export default Player;
