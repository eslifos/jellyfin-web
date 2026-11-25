/**
 * What the full player adds to a song: synced lyrics, equalizer, DJ mixing, the analysis of the song (energy, mood
 * and similar songs) and its video when the album has one.
 */
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { type ChangeEvent, type FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { playbackManager } from 'components/playback/playbackmanager';
import toast from 'components/toast/toast';
import globalize from 'lib/globalize';

import { get } from '../QuickHome/parts';
import {
    DJ_MAX_SECONDS, DJ_MIN_SECONDS, EQ_BANDS, EQ_PRESETS, EQ_RANGE, applyEq, canProcess, crossfade, djStore, eqStore, stopTransition
} from './audioEngine';
import { SongWave, centerInside, decodeWave } from './MusicVisual';

const TICKS_PER_MS = 10000;
const MAX_EARLY_MIX_MS = 20000;
/** With the DJ on, the list is filled again when fewer songs than these are left. */
const DJ_SONGS_AHEAD = 3;

export type StudioTab = 'lyrics' | 'eq' | 'dj' | 'analysis';

interface AudioFeatures {
    Bpm?: number | null;
    KeyRoot: number;
    Minor: boolean;
    Camelot: string;
    KeyConfidence: number;
    Energy: number;
    Danceability: number;
    Positivity: number;
    Brightness: number;
    Acoustic: number;
    Loudness: number;
    Dynamics: number;
    IntroSeconds: number;
    MixOutSeconds: number;
    Seconds: number;
    Waveform: string;
}

interface Analysis {
    Energy: number;
    Positivity: number;
    Mood: string;
    Genres: string[];
    Year?: number | null;
    Audio?: AudioFeatures | null;
}

interface SongInfo {
    HasVideo: boolean;
    Analysis?: Analysis | null;
}

interface LyricLine {
    Text: string;
    Start?: number | null;
}

interface SongLyrics {
    Lyrics: LyricLine[];
    Instrumental: boolean;
    FromLrclib: boolean;
    CanChange: boolean;
}

interface LyricOption {
    Id: number;
    Title: string;
    Artist: string;
    Album?: string | null;
    Seconds?: number | null;
    Synced: boolean;
    Preview: string;
}

const queueSongs = playbackManager as unknown as {
    queue: (options: { ids: string[], serverId: string }, player?: object) => Promise<void>;
    getPlaylist: (player?: object) => Promise<BaseItemDto[]>;
};

/** The songs that sound like this one; if the analysis has none, the instant mix of the server. */
const findSimilar = async (api: Api, itemId: string) => {
    // eslint-disable-next-line compat/compat
    const { signal } = new AbortController();
    const songs = await get<BaseItemDto[]>(api, `/MusicHub/Similar/${itemId}?limit=25`, signal).catch(() => [] as BaseItemDto[]);
    if (songs.length) return songs;
    const mix = await get<{ Items?: BaseItemDto[] }>(api, `/Items/${itemId}/InstantMix?limit=25`, signal);
    return mix.Items ?? [];
};

const queueSimilar = async (api: Api, item: BaseItemDto, player: object | null) => {
    if (!item.ServerId || !item.Id) return 0;
    const songs = await findSimilar(api, item.Id);
    const listed = new Set((await queueSongs.getPlaylist(player ?? undefined)).map(p => p.Id));
    const ids = songs.flatMap(s => (s.Id && s.Type === 'Audio' && !listed.has(s.Id) ? [ s.Id ] : []));
    if (ids.length) await queueSongs.queue({ ids, serverId: item.ServerId }, player ?? undefined);
    return ids.length;
};

let addingSimilar: Promise<number> | null = null;

/** Adds to the list the songs that sound like this one and are not in it yet; says how many. */
const addSimilar = (api: Api, item: BaseItemDto, player: object | null) => {
    addingSimilar ??= queueSimilar(api, item, player).finally(() => {
        addingSimilar = null;
    });
    return addingSimilar;
};

export const useSongInfo = (api?: Api, itemId?: string | null) => useQuery({
    queryKey: [ 'MusicHub', 'song', itemId ],
    queryFn: ({ signal }) => get<SongInfo>(api!, `/MusicHub/Songs/${itemId}`, signal),
    enabled: !!api && !!itemId,
    staleTime: 10 * 60 * 1000,
    retry: false
});

const TABS: { key: StudioTab, icon: string, label: string, local: boolean }[] = [
    { key: 'lyrics', icon: '🎤', label: 'MhLyrics', local: false },
    { key: 'eq', icon: '🎚️', label: 'MhEqualizer', local: true },
    { key: 'dj', icon: '🎧', label: 'MhDj', local: true },
    { key: 'analysis', icon: '🧠', label: 'MhAnalysis', local: false }
];

export const StudioChips: FC<{ tab: StudioTab | null, remote: boolean, onTab: (tab: StudioTab | null) => void }> = ({ tab, remote, onTab }) => {
    const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const key = e.currentTarget.dataset.tab as StudioTab;
        onTab(key === tab ? null : key);
    }, [ tab, onTab ]);
    return (
        <>
            {TABS.filter(t => !remote || !t.local).map(t => (
                <button key={t.key} type='button' data-tab={t.key} className={tab === t.key ? 'abp-chip is-on' : 'abp-chip'} onClick={onClick}>
                    {t.icon} {globalize.translate(t.label)}
                </button>
            ))}
        </>
    );
};

const lyricsKey = (itemId: string) => [ 'MusicHub', 'lyrics', itemId ];

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Other lyrics that could belong to the song, for when the one found is not right. */
const LyricOptions: FC<{ api: Api, itemId: string, onClose: () => void }> = ({ api, itemId, onClose }) => {
    const client = useQueryClient();
    const [ saving, setSaving ] = useState(false);
    const { data, isLoading, isError } = useQuery({
        queryKey: [ 'MusicHub', 'lyricOptions', itemId ],
        queryFn: ({ signal }) => get<LyricOption[]>(api, `/MusicHub/Songs/${itemId}/Lyrics/Options`, signal),
        staleTime: 5 * 60 * 1000,
        retry: false
    });
    const onPick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        setSaving(true);
        api.axiosInstance.post<SongLyrics>(
            `${api.basePath}/MusicHub/Songs/${itemId}/Lyrics/Options/${e.currentTarget.dataset.id}`,
            null,
            { headers: { Authorization: api.authorizationHeader } }
        ).then(({ data: chosen }) => {
            client.setQueryData(lyricsKey(itemId), chosen);
            onClose();
        }).catch(() => toast(globalize.translate('MhLyricsError'))).finally(() => setSaving(false));
    }, [ api, client, itemId, onClose ]);

    return (
        <div className='abp-lyric-options'>
            <button type='button' className='abp-chip' onClick={onClose}>← {globalize.translate('MhBackToLyrics')}</button>
            {isLoading && <p className='abp-studio-empty'>{globalize.translate('MhLyricsSearching')}</p>}
            {isError && <p className='abp-studio-empty'>{globalize.translate('MhLyricsError')}</p>}
            {data?.length === 0 && <p className='abp-studio-empty'>{globalize.translate('MhNoOtherLyrics')}</p>}
            {data?.map(o => (
                <button key={o.Id} type='button' className='abp-lyric-option' data-id={o.Id} disabled={saving} onClick={onPick}>
                    <b>{o.Title}</b>
                    <small>{[ o.Artist, o.Album, o.Seconds ? clock(o.Seconds) : null ].filter(Boolean).join(' · ')}</small>
                    {o.Preview && <em>{o.Preview}</em>}
                    <span className={o.Synced ? 'is-synced' : ''}>{globalize.translate(o.Synced ? 'MhLyricsSynced' : 'MhLyricsPlain')}</span>
                </button>
            ))}
        </div>
    );
};

const Lyrics: FC<{ api: Api, itemId: string, positionMs: number, onSeekTo: (ms: number) => void }> = ({ api, itemId, positionMs, onSeekTo }) => {
    const [ choosing, setChoosing ] = useState(false);
    const { data, isLoading } = useQuery({
        queryKey: lyricsKey(itemId),
        queryFn: ({ signal }) => get<SongLyrics>(api, `/MusicHub/Songs/${itemId}/Lyrics`, signal),
        staleTime: 5 * 60 * 1000,
        retry: false
    });
    const lines = data?.Lyrics ?? [];
    const synced = lines.some(l => l.Start != null);
    const ticks = positionMs * TICKS_PER_MS;
    let active = -1;
    if (synced) {
        lines.forEach((l, i) => {
            if ((l.Start ?? Infinity) <= ticks) active = i;
        });
    }
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => {
        // Only the lyrics move: the cover and the buttons stay where they are
        centerInside(box.current?.closest('.abp-studio-body'), box.current?.querySelector('.is-active'));
    }, [ active ]);
    const onLine = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        onSeekTo(Number(e.currentTarget.dataset.start) / TICKS_PER_MS);
    }, [ onSeekTo ]);
    const onChoose = useCallback(() => setChoosing(true), []);
    const onBack = useCallback(() => setChoosing(false), []);

    if (isLoading) return <p className='abp-studio-empty'>{globalize.translate('MhLyricsSearching')}</p>;
    if (choosing) return <LyricOptions api={api} itemId={itemId} onClose={onBack} />;
    return (
        <>
            {lines.length > 0 ? (
                <div ref={box} className='abp-lyrics'>
                    {lines.map((l, i) => {
                        const key = `${l.Start ?? 'l'}-${i}`;
                        const state = i === active ? 'is-active' : '';
                        return synced && l.Start != null ?
                            <button key={key} type='button' className={state} data-start={l.Start} onClick={onLine}>{l.Text || '♪'}</button> :
                            <p key={key}>{l.Text || '♪'}</p>;
                    })}
                </div>
            ) : <p className='abp-studio-empty'>{globalize.translate(data?.Instrumental ? 'MhInstrumental' : 'MhNoLyrics')}</p>}
            <div className='abp-lyrics-foot'>
                {data?.FromLrclib && <small>{globalize.translate('MhLyricsSource')}</small>}
                {data?.CanChange && <button type='button' className='abp-chip' onClick={onChoose}>🔎 {globalize.translate('MhOtherLyrics')}</button>}
            </div>
        </>
    );
};

const Equalizer: FC<{ player: object | null }> = ({ player }) => {
    const eq = useSyncExternalStore(eqStore.subscribe, eqStore.get);
    useEffect(() => applyEq(player), [ player, eq ]);
    const onToggle = useCallback(() => eqStore.set({ ...eqStore.get(), on: !eqStore.get().on }), []);
    const onPreset = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const preset = e.currentTarget.dataset.preset ?? 'flat';
        eqStore.set({ on: true, preset, gains: EQ_PRESETS[preset] });
    }, []);
    const onBand = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const gains = [ ...eqStore.get().gains ];
        gains[Number(e.target.dataset.band)] = Number(e.target.value);
        eqStore.set({ on: true, preset: 'custom', gains });
    }, []);

    if (!canProcess(player)) return <p className='abp-studio-empty'>{globalize.translate('MhNotOnDevice')}</p>;
    return (
        <div className='abp-eq-panel'>
            <button type='button' className={eq.on ? 'abp-switch is-on' : 'abp-switch'} onClick={onToggle} aria-pressed={eq.on}>
                <span />{globalize.translate(eq.on ? 'MhOn' : 'MhOff')}
            </button>
            <div className='abp-presets'>
                {Object.keys(EQ_PRESETS).map(p => (
                    <button key={p} type='button' data-preset={p} className={eq.preset === p ? 'abp-chip is-on' : 'abp-chip'} onClick={onPreset}>
                        {globalize.translate(`MhEq_${p}`)}
                    </button>
                ))}
            </div>
            <div className={eq.on ? 'abp-bands' : 'abp-bands is-off'}>
                {EQ_BANDS.map((hz, i) => (
                    <label key={hz}>
                        <span>{eq.gains[i] > 0 ? '+' : ''}{eq.gains[i]}</span>
                        <input type='range' min={-EQ_RANGE} max={EQ_RANGE} step={1} value={eq.gains[i]} data-band={i} onChange={onBand} aria-label={`${hz} Hz`} />
                        <small>{hz >= 1000 ? `${hz / 1000}k` : hz}</small>
                    </label>
                ))}
            </div>
        </div>
    );
};

const DjPanel: FC<{ api: Api, item: BaseItemDto, player: object | null }> = ({ api, item, player }) => {
    const dj = useSyncExternalStore(djStore.subscribe, djStore.get);
    const [ adding, setAdding ] = useState(false);
    const onToggle = useCallback(() => {
        const now = djStore.get();
        if (now.on) stopTransition();
        djStore.set({ ...now, on: !now.on });
    }, []);
    const onSeconds = useCallback((e: ChangeEvent<HTMLInputElement>) => djStore.set({ ...djStore.get(), seconds: Number(e.target.value) }), []);
    const onSimilar = useCallback(() => {
        setAdding(true);
        addSimilar(api, item, player)
            .then(count => toast(count ? globalize.translate('MhSimilarAdded', count) : globalize.translate('MhNoSimilar')))
            .catch(() => toast(globalize.translate('MhNoSimilar')))
            .finally(() => setAdding(false));
    }, [ api, item, player ]);

    if (!canProcess(player)) return <p className='abp-studio-empty'>{globalize.translate('MhNotOnDevice')}</p>;
    return (
        <div className='abp-dj'>
            <button type='button' className={dj.on ? 'abp-switch is-on' : 'abp-switch'} onClick={onToggle} aria-pressed={dj.on}>
                <span />{globalize.translate('MhDjMix')}
            </button>
            <p>{globalize.translate('MhDjHelp')}</p>
            <label className='abp-dj-range'>
                <span>{globalize.translate('MhDjSeconds', dj.seconds)}</span>
                <input type='range' min={DJ_MIN_SECONDS} max={DJ_MAX_SECONDS} value={dj.seconds} onChange={onSeconds} />
            </label>
            <button type='button' className='abp-primary' onClick={onSimilar} disabled={adding}>✨ {globalize.translate('MhKeepSimilar')}</button>
        </div>
    );
};

const Meter: FC<{ label: string, value: number }> = ({ label, value }) => (
    <div className='abp-meter'>
        <span>{label}<b>{Math.round(value * 100)}%</b></span>
        <i style={{ '--abp-fill': `${value * 100}%` } as React.CSSProperties} />
    </div>
);

const keyName = (audio: AudioFeatures) => {
    const notes = globalize.translate('MhNotes').split(',');
    return `${notes[audio.KeyRoot] ?? ''} ${globalize.translate(audio.Minor ? 'MhKeyMinor' : 'MhKeyMajor')}`;
};

const AnalysisPanel: FC<{ info?: SongInfo, durationMs: number, percent: number, playing: boolean, onSeekTo: (ms: number) => void }> = ({ info, durationMs, percent, playing, onSeekTo }) => {
    const a = info?.Analysis;
    const audio = a?.Audio;
    const wave = useMemo(() => decodeWave(audio?.Waveform), [ audio?.Waveform ]);
    if (!a) return <p className='abp-studio-empty'>{globalize.translate('MhNotAnalyzed')}</p>;
    return (
        <div className='abp-analysis'>
            <p className='abp-mood'>{globalize.translate(`MhMood_${a.Mood}`)}</p>
            {audio && (
                <div className='abp-facts'>
                    <div className={playing ? 'abp-fact is-beating' : 'abp-fact'} style={{ '--abp-beat-time': `${60 / (audio.Bpm || 100)}s` } as React.CSSProperties}>
                        <span aria-hidden='true'>💓</span>
                        <b>{audio.Bpm ? Math.round(audio.Bpm) : globalize.translate('MhFreeTempo')}</b>
                        <small>{globalize.translate('MhBpm')}</small>
                    </div>
                    <div className='abp-fact'>
                        <span aria-hidden='true'>🎼</span>
                        <b>{keyName(audio)}</b>
                        <small>{globalize.translate('MhKey')} · {audio.Camelot}</small>
                    </div>
                </div>
            )}
            {wave.length > 0 && <SongWave waveform={wave} percent={percent} playing={playing} durationMs={durationMs} onSeekTo={onSeekTo} />}
            <Meter label={globalize.translate('MhEnergy')} value={a.Energy} />
            <Meter label={globalize.translate('MhPositivity')} value={a.Positivity} />
            {audio && (
                <>
                    <Meter label={globalize.translate('MhDanceability')} value={audio.Danceability} />
                    <Meter label={globalize.translate('MhBrightness')} value={audio.Brightness} />
                    <Meter label={globalize.translate('MhAcoustic')} value={audio.Acoustic} />
                    <p className='abp-analysis-note'>{globalize.translate('MhLoudnessLine', Math.round(audio.Loudness), Math.round(audio.Dynamics))}</p>
                </>
            )}
            {a.Genres.length > 0 && <div className='abp-tags'>{a.Genres.map(g => <span key={g}>{g}</span>)}</div>}
            {a.Year ? <p className='abp-analysis-note'>{a.Year}</p> : null}
            <p className='abp-analysis-note'>{globalize.translate(audio ? 'MhAudioNote' : 'MhAnalysisNote')}</p>
        </div>
    );
};

export const StudioPanel: FC<{
    api: Api, item: BaseItemDto, tab: StudioTab, player: object | null, positionMs: number, durationMs: number, percent: number, playing: boolean, onSeekTo: (ms: number) => void, onClose: () => void
}> = ({ api, item, tab, player, positionMs, durationMs, percent, playing, onSeekTo, onClose }) => {
    const { data: info } = useSongInfo(api, item.Id);
    const current = TABS.find(t => t.key === tab);
    return (
        <aside className='abp-chapters abp-studio'>
            <div className='abp-studio-head'>
                <h3>{current?.icon} {current && globalize.translate(current.label)}</h3>
                <button type='button' onClick={onClose} aria-label={globalize.translate('ApClose')}>✕</button>
            </div>
            <div className='abp-studio-body'>
                {tab === 'lyrics' && item.Id && <Lyrics key={item.Id} api={api} itemId={item.Id} positionMs={positionMs} onSeekTo={onSeekTo} />}
                {tab === 'eq' && <Equalizer player={player} />}
                {tab === 'dj' && <DjPanel api={api} item={item} player={player} />}
                {tab === 'analysis' && <AnalysisPanel info={info} durationMs={durationMs} percent={percent} playing={playing} onSeekTo={onSeekTo} />}
            </div>
        </aside>
    );
};

/** A place on the screen where the video shows. */
export const VideoSlot: FC<{ host: HTMLElement }> = ({ host }) => {
    const slot = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        slot.current?.appendChild(host);
    }, [ host ]);
    return <div ref={slot} className='abp-video-slot' />;
};

/** Keeps the sound settings on through the songs and starts the mix near the end of each one. */
export const useMusicEngine = (
    api: Api | undefined,
    player: object | null,
    item: BaseItemDto | null,
    { positionMs, durationMs, paused, remote, songsAhead, onNext }: { positionMs: number, durationMs: number, paused: boolean, remote: boolean, songsAhead: number, onNext: () => void }
) => {
    const dj = useSyncExternalStore(djStore.subscribe, djStore.get);
    const eq = useSyncExternalStore(eqStore.subscribe, eqStore.get);
    const mixed = useRef<string | null>(null);
    const filled = useRef<string | null>(null);
    const hasNext = songsAhead > 0;
    const itemId = item?.Id ?? null;
    const isSong = item?.Type === 'Audio' && !remote;
    const { data: info } = useSongInfo(api, dj.on && isSong ? itemId : null);
    const mixOut = info?.Analysis?.Audio?.MixOutSeconds;

    useEffect(() => {
        if (isSong) applyEq(player);
    }, [ player, itemId, isSong, eq ]);

    // Between two songs the player is paused for a moment: only a pause that lasts ends the mix
    useEffect(() => {
        if (!isSong) {
            stopTransition();
            return;
        }
        if (!paused) return;
        const timer = window.setTimeout(stopTransition, 1500);
        return () => window.clearTimeout(timer);
    }, [ paused, isSong ]);

    // Turning the DJ on adds songs to the list at once, and it is filled again before it runs out
    useEffect(() => {
        if (!dj.on) {
            filled.current = null;
            return;
        }
        if (!api || !item || !isSong || !itemId) return;
        const justOn = filled.current === null;
        if (!justOn && (songsAhead >= DJ_SONGS_AHEAD || filled.current === itemId)) return;
        filled.current = itemId;
        addSimilar(api, item, player).then(count => {
            if (justOn) toast(count ? globalize.translate('MhSimilarAdded', count) : globalize.translate('MhNoSimilar'));
        }).catch(() => {
            if (justOn) toast(globalize.translate('MhNoSimilar'));
        });
    }, [ api, dj.on, isSong, item, itemId, player, songsAhead ]);

    useEffect(() => {
        if (!dj.on || !isSong || paused || !hasNext || !itemId || mixed.current === itemId) return;
        // Starts where the song begins to end, if the analyzer found that moment
        const latest = durationMs - (dj.seconds * 1000);
        const mixAt = mixOut ? Math.max(latest - MAX_EARLY_MIX_MS, Math.min(latest, (mixOut * 1000) - (dj.seconds * 500))) : latest;
        if (durationMs < dj.seconds * 3000 || positionMs <= 0 || positionMs < mixAt) return;
        mixed.current = itemId;
        void crossfade(player, dj.seconds, onNext);
    }, [ dj, isSong, paused, hasNext, itemId, positionMs, durationMs, mixOut, player, onNext ]);
};
