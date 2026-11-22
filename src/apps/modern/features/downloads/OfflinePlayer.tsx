/**
 * Full screen player of downloads (works without connection). Plays one title or a list (the episodes of a
 * season, the parts of an audiobook), remembers where the user is and sends it to the server when it can.
 */
import React, { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import globalize from 'lib/globalize';
import { renderComponent } from 'utils/reactUtils';

import { getDownloads, removeFromDevice, saveProgress } from './engine';
import { attachOffline } from './offlineSource';
import { readDownloadSettings } from './settings';
import { readCover } from './store';

import './downloads.scss';

const TICKS_PER_SECOND = 10_000_000;
const WATCHED = 0.92;

const OfflinePlayer: FC<{ ids: string[], start: number, onClose: () => void }> = ({ ids, start, onClose }) => {
    const media = useRef<HTMLVideoElement>(null);
    const [ index, setIndex ] = useState(start);
    const [ cover, setCover ] = useState<string>();
    const [ failed, setFailed ] = useState(false);
    const id = ids[index];
    // The title as it was when it started (its progress changes while it plays)
    const record = useMemo(() => getDownloads()[id], [ id ]);

    useEffect(() => {
        let url: string | undefined;
        void readCover(id).then(blob => {
            if (blob) {
                url = URL.createObjectURL(blob);
                setCover(url);
            }
        });
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [ id ]);

    useEffect(() => {
        const element = media.current;
        if (!element || !record) return;
        const resumeAt = record.played ? 0 : record.positionTicks / TICKS_PER_SECOND;
        const detach = attachOffline(element, id, resumeAt);
        setFailed(!detach);
        void element.play().catch(() => undefined);

        // Where the user is, every few seconds and when leaving
        const save = () => {
            const duration = element.duration || record.runTimeTicks / TICKS_PER_SECOND;
            const played = duration > 0 && element.currentTime / duration >= WATCHED;
            saveProgress(id, Math.round(element.currentTime * TICKS_PER_SECOND), played);
        };
        const timer = window.setInterval(save, 10000);
        element.addEventListener('pause', save);
        return () => {
            window.clearInterval(timer);
            element.removeEventListener('pause', save);
            save();
            detach?.();
        };
    }, [ id, record ]);

    const onEnded = useCallback(() => {
        saveProgress(id, 0, true);
        if (readDownloadSettings().deleteWatched) void removeFromDevice(id);
        if (index < ids.length - 1) setIndex(i => i + 1);
        else onClose();
    }, [ id, index, ids.length, onClose ]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        document.documentElement.classList.add('abp-open');
        return () => {
            document.removeEventListener('keydown', onKey);
            document.documentElement.classList.remove('abp-open');
        };
    }, [ onClose ]);

    if (!record) return null;
    const title = record.groupName ? `${record.groupName} · ${record.name}` : record.name;

    return (
        <div className='dl-player' role='dialog' aria-modal='true' aria-label={title}>
            <header className='dl-player-top'>
                <span className='dl-player-title'>{title}</span>
                <button type='button' className='dl-round' onClick={onClose} aria-label={globalize.translate('ApClose')}>
                    <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 6l12 12M18 6L6 18' /></svg>
                </button>
            </header>
            {failed ?
                <p className='dl-player-error'>{globalize.translate('DlCannotPlay')}</p> :
                // Subtitles chosen when downloading are drawn into the picture
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                    ref={media}
                    className={record.mediaType === 'Audio' ? 'dl-player-media is-audio' : 'dl-player-media'}
                    controls
                    playsInline
                    autoPlay
                    poster={record.mediaType === 'Audio' ? cover : undefined}
                    onEnded={onEnded}
                />}
        </div>
    );
};

/** Opens the player over everything with one download or a list of them. */
export const playOffline = (ids: string[], start = 0) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const mounted: { unmount?: () => void } = {};
    const onClose = () => {
        mounted.unmount?.();
        host.remove();
    };
    mounted.unmount = renderComponent(OfflinePlayer, { ids, start, onClose }, host);
};
