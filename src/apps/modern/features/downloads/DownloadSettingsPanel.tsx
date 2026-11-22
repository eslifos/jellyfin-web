/**
 * The download settings of this device (Settings › Downloads): the space (used, left, the 10% always kept free),
 * the preferences (default quality, Wi-Fi only, how many at a time, delete when watched, keep the screen on) and
 * the cleaning (delete the watched ones, delete everything).
 */
import React, { type ChangeEvent, type FC, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import confirm from 'components/confirm/confirm';
import globalize from 'lib/globalize';

import { getDownloads, loadDownloads, removeFromDevice, subscribeDownloads } from './engine';
import { formatBytes } from './format';
import { type DownloadSettings, QUALITY_LABELS, QUALITY_PRESETS, readDownloadSettings, saveDownloadSettings } from './settings';
import { type Quality, type Space, readSpace } from './store';

import './downloads.scss';

const QUALITIES = Object.keys(QUALITY_PRESETS) as Quality[];

const SpaceCard: FC<{ space?: Space, downloads: number }> = ({ space, downloads }) => {
    if (!space?.quota) return null;
    const device = space.quota / 0.6;
    const pct = (n: number) => `${Math.min(100, (n / device) * 100)}%`;
    const other = Math.max(0, space.usage - downloads);
    return (
        <section className='dl-card'>
            <h2 className='dl-card-title'>{globalize.translate('DlSpace')}</h2>
            <div className='dl-space-bar' aria-hidden='true'>
                <span className='is-downloads' style={{ width: pct(downloads) }} />
                <span className='is-other' style={{ width: pct(other) }} />
                <span className='is-reserve' style={{ width: pct(space.reserve), marginLeft: 'auto' }} />
            </div>
            <ul className='dl-legend'>
                <li><i className='is-downloads' />{globalize.translate('DlSpaceDownloads', formatBytes(downloads))}</li>
                <li><i className='is-free' />{globalize.translate('DlSpaceFree', formatBytes(space.available))}</li>
                <li><i className='is-reserve' />{globalize.translate('DlSpaceReserve', formatBytes(space.reserve))}</li>
            </ul>
        </section>
    );
};

const PreferencesCard: FC = () => {
    const [ settings, setSettings ] = useState<DownloadSettings>(readDownloadSettings);
    const change = useCallback((next: DownloadSettings) => {
        setSettings(next);
        saveDownloadSettings(next);
    }, []);
    const onQuality = useCallback((e: ChangeEvent<HTMLSelectElement>) => change({ ...settings, quality: e.target.value as Quality }), [ change, settings ]);
    const onParallel = useCallback((e: ChangeEvent<HTMLSelectElement>) => change({ ...settings, parallel: Number(e.target.value) }), [ change, settings ]);
    const onToggle = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const key = e.target.name as 'wifiOnly' | 'deleteWatched' | 'keepAwake';
        change({ ...settings, [key]: e.target.checked });
    }, [ change, settings ]);

    return (
        <section className='dl-card'>
            <h2 className='dl-card-title'>{globalize.translate('DlSettings')}</h2>
            <label className='dl-field'>
                <span className='dl-field-text'>{globalize.translate('DlQuality')}<small>{globalize.translate('DlQualityHelp')}</small></span>
                <select value={settings.quality} onChange={onQuality}>
                    {QUALITIES.map(q => <option key={q} value={q}>{globalize.translate(QUALITY_LABELS[q])}</option>)}
                </select>
            </label>
            <label className='dl-field'>
                <span className='dl-field-text'>{globalize.translate('DlParallel')}</span>
                <select value={settings.parallel} onChange={onParallel}>
                    {[ 1, 2, 3 ].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
            </label>
            <label className='dl-field'>
                <span className='dl-field-text'>{globalize.translate('DlWifiOnly')}<small>{globalize.translate('DlWifiOnlyHelp')}</small></span>
                <input type='checkbox' name='wifiOnly' checked={settings.wifiOnly} onChange={onToggle} />
            </label>
            <label className='dl-field'>
                <span className='dl-field-text'>{globalize.translate('DlDeleteWatched')}</span>
                <input type='checkbox' name='deleteWatched' checked={settings.deleteWatched} onChange={onToggle} />
            </label>
            <label className='dl-field'>
                <span className='dl-field-text'>{globalize.translate('DlKeepAwake')}<small>{globalize.translate('DlKeepAwakeHelp')}</small></span>
                <input type='checkbox' name='keepAwake' checked={settings.keepAwake} onChange={onToggle} />
            </label>
        </section>
    );
};

const DownloadSettingsPanel: FC = () => {
    const all = useSyncExternalStore(subscribeDownloads, getDownloads);
    const list = useMemo(() => Object.values(all), [ all ]);
    const [ space, setSpace ] = useState<Space>();

    useEffect(() => {
        void loadDownloads();
    }, []);

    const used = list.reduce((sum, r) => sum + r.bytes, 0);
    const watched = list.filter(r => r.status === 'done' && r.played);

    useEffect(() => {
        readSpace().then(setSpace).catch(() => undefined);
    }, [ list.length, used ]);

    const onDeleteWatched = useCallback(() => {
        void confirm(globalize.translate('DlDeleteWatchedConfirm', watched.length), globalize.translate('Delete'))
            .then(async () => {
                for (const r of watched) await removeFromDevice(r.id);
            })
            .catch(() => undefined);
    }, [ watched ]);
    const onDeleteAll = useCallback(() => {
        void confirm(globalize.translate('DlDeleteAllConfirm'), globalize.translate('Delete'))
            .then(async () => {
                for (const r of list) await removeFromDevice(r.id);
            })
            .catch(() => undefined);
    }, [ list ]);

    return (
        <>
            <SpaceCard space={space} downloads={used} />
            <PreferencesCard />
            <section className='dl-card'>
                <h2 className='dl-card-title'>{globalize.translate('DlManage')}</h2>
                <p className='dl-card-note'>{globalize.translate('DlManageSummary', list.length, formatBytes(used))}</p>
                <div className='dl-card-actions'>
                    <button type='button' className='dl-pill' onClick={onDeleteWatched} disabled={!watched.length}>
                        {globalize.translate('DlDeleteWatchedButton')}{watched.length ? ` (${watched.length})` : ''}
                    </button>
                    <button type='button' className='dl-pill is-danger' onClick={onDeleteAll} disabled={!list.length}>
                        {globalize.translate('DlDeleteAll')}
                    </button>
                </div>
            </section>
        </>
    );
};

export default DownloadSettingsPanel;
