/**
 * Downloads of this device: the series, movies, albums and audiobooks saved to watch or listen without connection
 * (a poster each; a series opens its episodes by season), plus what is still downloading or failed. The space and
 * the preferences live in Settings › Downloads.
 */
import React, { type FC, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';

import confirm from 'components/confirm/confirm';
import Page from 'components/Page';
import globalize from 'lib/globalize';

import { getDownloads, getLive, loadDownloads, pauseDownload, removeFromDevice, resumeDownload, subscribeDownloads } from '../features/downloads/engine';
import { formatBytes, formatDuration } from '../features/downloads/format';
import { playOffline } from '../features/downloads/OfflinePlayer';
import { QUALITY_LABELS } from '../features/downloads/settings';
import { type DownloadRecord, groupCoverKey, readCover } from '../features/downloads/store';
import { downloadsAvailable } from '../features/downloads/support';

import '../features/downloads/downloads.scss';

type Kind = 'movie' | 'show' | 'audio';
type Filter = Kind | 'all';

interface Group {
    key: string;
    name: string;
    kind: Kind;
    /** Covers to try, in order: the poster of the series or album, then the item's own. */
    covers: string[];
    records: DownloadRecord[];
}

const FILTERS: { key: Filter, label: string }[] = [
    { key: 'all', label: 'DlFilterAll' },
    { key: 'show', label: 'DlFilterShows' },
    { key: 'movie', label: 'DlFilterMovies' },
    { key: 'audio', label: 'DlFilterAudio' }
];

const percentOf = (r: DownloadRecord) => {
    if (r.status === 'done') return 100;
    return r.segments.length ? Math.round((r.done / r.segments.length) * 100) : 0;
};

const sizeOf = (r: DownloadRecord) => (r.status === 'done' ? r.bytes : Math.max(r.bytes, r.estimatedBytes));

const watchedOf = (r: DownloadRecord) => (r.played ? 100 : Math.round((r.positionTicks / Math.max(1, r.runTimeTicks)) * 100));

const kindOf = (r: DownloadRecord): Kind => {
    if (r.mediaType === 'Audio') return 'audio';
    return r.type === 'Episode' ? 'show' : 'movie';
};

const subtitleOf = (r: DownloadRecord) => {
    const parts: string[] = [];
    if (r.seasonNumber != null && r.episodeNumber != null) parts.push(`T${r.seasonNumber}:E${r.episodeNumber}`);
    if (r.runTimeTicks) parts.push(formatDuration(r.runTimeTicks));
    parts.push(globalize.translate(QUALITY_LABELS[r.quality]));
    parts.push(formatBytes(sizeOf(r)));
    return parts.join(' · ');
};

const reasonText = (r: DownloadRecord) => {
    switch (r.reason) {
        case 'space': return globalize.translate('DlReasonSpace');
        case 'wifi': return globalize.translate('DlReasonWifi');
        case 'network': return globalize.translate('DlReasonNetwork');
        case 'server': return globalize.translate('DlReasonServer');
        default: return undefined;
    }
};

const statusText = (r: DownloadRecord) => {
    if (r.status === 'downloading') {
        if (!r.segments.length) return globalize.translate('DlPreparing');
        const live = getLive(r.id);
        const parts = [ `${percentOf(r)}%`, globalize.translate('DlPiece', r.done, r.segments.length) ];
        if (live?.speed) parts.push(`${formatBytes(live.speed)}/s`);
        if (live?.eta) parts.push(globalize.translate('DlTimeLeft', formatDuration(live.eta * 10_000_000)));
        return parts.join(' · ');
    }
    if (r.status === 'paused') return globalize.translate('DlPaused');
    if (r.status === 'queued') return reasonText(r) ?? globalize.translate('DlWaiting');
    return reasonText(r) ?? '';
};

/** Ready downloads as shelves: a series, album or audiobook is one card; a movie, its own. */
const groupReady = (list: DownloadRecord[]): Group[] => {
    const groups = new Map<string, Group>();
    for (const r of list) {
        const key = r.groupId ?? r.id;
        const group = groups.get(key) ?? {
            key,
            name: r.groupName ?? r.name,
            kind: kindOf(r),
            covers: r.groupId ? [ groupCoverKey(r.groupId), r.id ] : [ r.id ],
            records: []
        };
        group.records.push(r);
        groups.set(key, group);
    }
    for (const g of groups.values()) {
        g.records.sort((a, b) => ((a.seasonNumber ?? 0) - (b.seasonNumber ?? 0)) || ((a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)) || a.name.localeCompare(b.name));
    }
    return [ ...groups.values() ].sort((a, b) => a.name.localeCompare(b.name));
};

/** Where to start playing a group: the first one not finished. */
const startOf = (group: Group) => Math.max(0, group.records.findIndex(r => !r.played));

const playGroup = (group: Group, from = startOf(group)) => playOffline(group.records.map(r => r.id), from);

const Cover: FC<{ ids: string[], square?: boolean, className?: string }> = ({ ids, square, className = 'dl-cover' }) => {
    const [ url, setUrl ] = useState<string>();
    const key = ids.join('|');
    useEffect(() => {
        let made: string | undefined;
        let alive = true;
        (async () => {
            for (const id of key.split('|')) {
                const blob = await readCover(id);
                if (blob && alive) {
                    made = URL.createObjectURL(blob);
                    setUrl(made);
                    return;
                }
            }
        })().catch(() => undefined);
        return () => {
            alive = false;
            if (made) URL.revokeObjectURL(made);
        };
    }, [ key ]);
    return (
        <span className={square ? `${className} is-square` : className}>
            {url ? <img src={url} alt='' /> : <span aria-hidden='true'>{square ? '🎧' : '🎬'}</span>}
        </span>
    );
};

const Row: FC<{ record: DownloadRecord, onPlay?: () => void }> = ({ record, onPlay }) => {
    const onPause = useCallback(() => pauseDownload(record.id), [ record.id ]);
    const onResume = useCallback(() => resumeDownload(record.id), [ record.id ]);
    const onDelete = useCallback(() => {
        void confirm(globalize.translate('DlDeleteOne', record.name), globalize.translate('Delete'))
            .then(() => removeFromDevice(record.id))
            .catch(() => undefined);
    }, [ record ]);
    const active = record.status !== 'done';
    const watched = watchedOf(record);

    return (
        <li className={`dl-row is-${record.status}`}>
            <Cover ids={[ record.id ]} square={record.mediaType === 'Audio'} />
            <div className='dl-row-body'>
                <span className='dl-row-title'>{record.name}</span>
                <span className='dl-row-sub'>{subtitleOf(record)}</span>
                {active ? (
                    <>
                        <span className='dl-bar'><span style={{ width: `${percentOf(record)}%` }} /></span>
                        <span className='dl-row-state'>{statusText(record)}</span>
                    </>
                ) : watched > 0 && <span className='dl-bar is-watched'><span style={{ width: `${watched}%` }} /></span>}
            </div>
            <div className='dl-row-actions'>
                {onPlay && <button type='button' className='dl-btn dl-btn-main' onClick={onPlay} aria-label={globalize.translate('Play')}>▶</button>}
                {record.status === 'downloading' && <button type='button' className='dl-btn' onClick={onPause} aria-label={globalize.translate('DlPause')}>❚❚</button>}
                {(record.status === 'paused' || record.status === 'error' || (record.status === 'queued' && record.reason)) && (
                    <button type='button' className='dl-btn' onClick={onResume} aria-label={globalize.translate('DlResume')}>↻</button>
                )}
                <button type='button' className='dl-btn dl-btn-danger' onClick={onDelete} aria-label={globalize.translate('Delete')}>✕</button>
            </div>
        </li>
    );
};

/** A row of a group that plays the group from that item on. */
const GroupRow: FC<{ group: Group, index: number }> = ({ group, index }) => {
    const onPlay = useCallback(() => playGroup(group, index), [ group, index ]);
    return <Row record={group.records[index]} onPlay={onPlay} />;
};

const groupSummary = (group: Group) => {
    const parts: string[] = [];
    const first = group.records[0];
    if (group.kind === 'show') {
        parts.push(globalize.translate('DlEpisodes', group.records.length));
    } else if (group.records.length > 1) {
        parts.push(globalize.translate('DlTracks', group.records.length));
    } else {
        if (first.year) parts.push(String(first.year));
        if (first.runTimeTicks) parts.push(formatDuration(first.runTimeTicks));
    }
    parts.push(formatBytes(group.records.reduce((sum, r) => sum + r.bytes, 0)));
    return parts.join(' · ');
};

const GroupCard: FC<{ group: Group, onOpen: (key: string) => void }> = ({ group, onOpen }) => {
    const open = useCallback(() => onOpen(group.key), [ group.key, onOpen ]);
    const play = useCallback(() => playGroup(group), [ group ]);
    const total = group.records.reduce((sum, r) => sum + r.runTimeTicks, 0);
    const seen = group.records.reduce((sum, r) => sum + (r.played ? r.runTimeTicks : r.positionTicks), 0);
    const watched = Math.round((seen / Math.max(1, total)) * 100);
    return (
        <li className='dl-tile'>
            <button type='button' className='dl-tile-open' onClick={open} aria-label={group.name}>
                <Cover ids={group.covers} square={group.kind === 'audio'} className='dl-poster' />
                {watched > 0 && <span className='dl-bar is-watched dl-tile-bar'><span style={{ width: `${watched}%` }} /></span>}
            </button>
            <button type='button' className='dl-tile-play' onClick={play} aria-label={globalize.translate('Play')}>▶</button>
            <span className='dl-tile-title'>{group.name}</span>
            <span className='dl-tile-sub'>{groupSummary(group)}</span>
        </li>
    );
};

/** One series, album or movie: play, its episodes by season, delete. */
const GroupView: FC<{ group: Group, onBack: () => void }> = ({ group, onBack }) => {
    const play = useCallback(() => playGroup(group), [ group ]);
    const onDelete = useCallback(() => {
        void confirm(globalize.translate('DlDeleteGroupConfirm', group.name, group.records.length), globalize.translate('Delete'))
            .then(async () => {
                for (const r of group.records) await removeFromDevice(r.id);
                onBack();
            })
            .catch(() => undefined);
    }, [ group, onBack ]);
    const seasons = useMemo(() => {
        const map = new Map<number | undefined, number[]>();
        group.records.forEach((r, i) => {
            map.set(r.seasonNumber, [ ...(map.get(r.seasonNumber) ?? []), i ]);
        });
        return [ ...map.entries() ];
    }, [ group ]);

    return (
        <>
            <button type='button' className='dl-link dl-back' onClick={onBack}>‹ {globalize.translate('DlBack')}</button>
            <header className='dl-hero'>
                <Cover ids={group.covers} square={group.kind === 'audio'} className='dl-poster' />
                <div className='dl-hero-body'>
                    <h1>{group.name}</h1>
                    <p>{groupSummary(group)}</p>
                    <div className='dl-card-actions'>
                        <button type='button' className='dl-pill is-main' onClick={play}>▶ {globalize.translate('Play')}</button>
                        <button type='button' className='dl-pill is-danger' onClick={onDelete}>{globalize.translate('Delete')}</button>
                    </div>
                </div>
            </header>
            {seasons.map(([ season, indexes ]) => (
                <section key={season ?? 'none'} className='dl-section'>
                    {group.kind === 'show' && season != null && (
                        <header className='dl-section-head'><h2>{globalize.translate('DlSeason', season)}</h2></header>
                    )}
                    <ul className='dl-list'>{indexes.map(i => <GroupRow key={group.records[i].id} group={group} index={i} />)}</ul>
                </section>
            ))}
        </>
    );
};

const FilterChip: FC<{ filter: Filter, label: string, active: boolean, onPick: (f: Filter) => void }> = ({ filter, label, active, onPick }) => {
    const pick = useCallback(() => onPick(filter), [ filter, onPick ]);
    return <button type='button' className={active ? 'dl-chip is-active' : 'dl-chip'} onClick={pick}>{globalize.translate(label)}</button>;
};

/** What is still downloading or failed, with pause and resume. */
const Activity: FC<{ pending: DownloadRecord[], failed: DownloadRecord[] }> = ({ pending, failed }) => {
    const onPauseAll = useCallback(() => {
        for (const r of pending.filter(p => p.status === 'downloading' || p.status === 'queued')) pauseDownload(r.id);
    }, [ pending ]);
    const onResumeAll = useCallback(() => {
        for (const r of [ ...pending, ...failed ].filter(p => p.status !== 'downloading')) resumeDownload(r.id);
    }, [ pending, failed ]);
    return (
        <>
            {pending.length > 0 && (
                <section className='dl-section'>
                    <header className='dl-section-head'>
                        <h2>{globalize.translate('DlInProgress', pending.length)}</h2>
                        <button type='button' className='dl-link' onClick={onPauseAll}>{globalize.translate('DlPauseAll')}</button>
                        <button type='button' className='dl-link' onClick={onResumeAll}>{globalize.translate('DlResumeAll')}</button>
                    </header>
                    <ul className='dl-list'>{pending.map(r => <Row key={r.id} record={r} />)}</ul>
                </section>
            )}
            {failed.length > 0 && (
                <section className='dl-section'>
                    <header className='dl-section-head'><h2>{globalize.translate('DlFailed', failed.length)}</h2></header>
                    <ul className='dl-list'>{failed.map(r => <Row key={r.id} record={r} />)}</ul>
                </section>
            )}
        </>
    );
};

const useOnline = () => {
    const [ online, setOnline ] = useState(navigator.onLine);
    useEffect(() => {
        const onLine = () => setOnline(navigator.onLine);
        window.addEventListener('online', onLine);
        window.addEventListener('offline', onLine);
        return () => {
            window.removeEventListener('online', onLine);
            window.removeEventListener('offline', onLine);
        };
    }, []);
    return online;
};

const Shelves: FC<{ groups: Group[], onOpen: (key: string) => void }> = ({ groups, onOpen }) => {
    const [ filter, setFilter ] = useState<Filter>('all');
    const kinds = new Set(groups.map(g => g.kind));
    const shown = groups.filter(g => filter === 'all' || g.kind === filter);
    if (!groups.length) return <p className='dl-empty'>{globalize.translate('DlNothingYet')}</p>;
    return (
        <section className='dl-section'>
            {kinds.size > 1 && (
                <div className='dl-chips'>
                    {FILTERS.filter(f => f.key === 'all' || kinds.has(f.key)).map(f => (
                        <FilterChip key={f.key} filter={f.key} label={f.label} active={filter === f.key} onPick={setFilter} />
                    ))}
                </div>
            )}
            <ul className='dl-grid'>{shown.map(g => <GroupCard key={g.key} group={g} onOpen={onOpen} />)}</ul>
        </section>
    );
};

const DownloadsPage: FC = () => {
    const all = useSyncExternalStore(subscribeDownloads, getDownloads);
    const online = useOnline();
    const available = downloadsAvailable();
    const [ openKey, setOpenKey ] = useState<string>();
    const onBack = useCallback(() => setOpenKey(undefined), []);

    useEffect(() => {
        if (available) void loadDownloads();
    }, [ available ]);

    const list = useMemo(() => Object.values(all), [ all ]);
    const groups = useMemo(() => groupReady(list.filter(r => r.status === 'done')), [ list ]);
    const pending = list.filter(r => r.status !== 'done' && r.status !== 'error').sort((a, b) => a.addedAt - b.addedAt);
    const failed = list.filter(r => r.status === 'error');
    const open = groups.find(g => g.key === openKey);

    // Back to the top when a series opens or closes
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [ openKey ]);

    let body: React.ReactNode;
    if (!available) {
        body = <p className='dl-empty'>{globalize.translate('DlNotAvailable')}</p>;
    } else if (open) {
        body = <GroupView group={open} onBack={onBack} />;
    } else {
        body = (
            <>
                <Activity pending={pending} failed={failed} />
                <Shelves groups={groups} onOpen={setOpenKey} />
            </>
        );
    }

    return (
        <Page id='downloadsPage' title={globalize.translate('DlPageTitle')} className='mainAnimatedPage libraryPage noSecondaryNavPage'>
            <div className='dl-page'>
                {!open && (
                    <header className='dl-head'>
                        <div className='dl-head-row'>
                            <h1>{globalize.translate('DlPageTitle')}</h1>
                            {available && online && (
                                <Link to='/mypreferencesdownloads' className='dl-round dl-settings' aria-label={globalize.translate('DlSettingsLink')} title={globalize.translate('DlSettingsLink')}>⚙</Link>
                            )}
                        </div>
                        <p>{globalize.translate('DlPageHelp')}</p>
                        {!online && <span className='dl-offline'>{globalize.translate('DlOffline')}</span>}
                    </header>
                )}
                {body}
            </div>
        </Page>
    );
};

export default DownloadsPage;
