/**
 * Download preferences of the user (kept on the server like the rest of the preferences).
 */
import { readPref, writePref } from 'utils/syncedPrefs';

import type { Quality } from './store';

export interface DownloadSettings {
    quality: Quality;
    wifiOnly: boolean;
    parallel: number;
    deleteWatched: boolean;
    keepAwake: boolean;
}

/** Best balance for phones and tablets: 720p, good picture and half the space of 1080p. */
export const DEFAULT_QUALITY: Quality = 'optimal';

export const QUALITY_PRESETS: Record<Quality, { videoBitrate: number, maxWidth: number, audioBitrate: number }> = {
    original: { videoBitrate: 120_000_000, maxWidth: 7680, audioBitrate: 320_000 },
    high: { videoBitrate: 8_000_000, maxWidth: 1920, audioBitrate: 256_000 },
    optimal: { videoBitrate: 3_000_000, maxWidth: 1280, audioBitrate: 192_000 },
    saver: { videoBitrate: 1_200_000, maxWidth: 854, audioBitrate: 128_000 }
};

export const QUALITY_LABELS: Record<Quality, string> = {
    original: 'DlQualityOriginal',
    high: 'DlQualityHigh',
    optimal: 'DlQualityOptimal',
    saver: 'DlQualitySaver'
};

const KEY = 'downloadSettings';

export const readDownloadSettings = (): DownloadSettings => {
    let saved: Partial<DownloadSettings> = {};
    try {
        saved = JSON.parse(readPref(KEY) || '{}') as Partial<DownloadSettings>;
    } catch {
        saved = {};
    }
    return {
        quality: saved.quality && saved.quality in QUALITY_PRESETS ? saved.quality : DEFAULT_QUALITY,
        wifiOnly: saved.wifiOnly ?? true,
        parallel: Math.min(3, Math.max(1, saved.parallel ?? 1)),
        deleteWatched: saved.deleteWatched ?? false,
        keepAwake: saved.keepAwake ?? true
    };
};

export const saveDownloadSettings = (settings: DownloadSettings) => writePref(KEY, JSON.stringify(settings));
