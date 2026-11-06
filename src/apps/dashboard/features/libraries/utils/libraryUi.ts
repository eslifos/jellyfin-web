import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';

import globalize from 'lib/globalize';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';
import type { LibraryStats } from '../api/useLibraryStats';

/** Accent color for each library type (Cosmic Dark palette). */
export const getLibraryAccent = (collectionType?: string | null) => {
    switch (collectionType) {
        case CollectionType.Movies: return '#00a4dc';
        case CollectionType.Tvshows: return '#aa5cc3';
        case CollectionType.Music: return '#4caf50';
        case CollectionType.Books: return '#ff9800';
        case CollectionType.Homevideos: return '#26c6da';
        case CollectionType.Photos: return '#ec407a';
        case CollectionType.Musicvideos: return '#ffca28';
        case CollectionType.Boxsets: return '#7e57c2';
        default: return '#90a4ae';
    }
};

export interface StatTile {
    label: string;
    value: number;
}

/** The three most relevant counters for a library type. */
export const getMainStats = (collectionType: string | null | undefined, stats?: LibraryStats): StatTile[] => {
    if (!stats) return [];
    const files = { label: globalize.translate('LibFiles'), value: stats.FileCount };

    switch (collectionType) {
        case CollectionType.Movies:
            return [
                { label: globalize.translate('Movies'), value: stats.MovieCount },
                { label: globalize.translate('Collections'), value: stats.BoxSetCount },
                files
            ];
        case CollectionType.Tvshows:
            return [
                { label: globalize.translate('Series'), value: stats.SeriesCount },
                { label: globalize.translate('LibSeasons'), value: stats.SeasonCount },
                { label: globalize.translate('Episodes'), value: stats.EpisodeCount }
            ];
        case CollectionType.Music:
            return [
                { label: globalize.translate('Artists'), value: stats.ArtistCount },
                { label: globalize.translate('Albums'), value: stats.AlbumCount },
                { label: globalize.translate('Songs'), value: stats.SongCount }
            ];
        case CollectionType.Books:
            return [
                { label: globalize.translate('Books'), value: stats.BookCount },
                files
            ];
        case CollectionType.Musicvideos:
            return [
                { label: globalize.translate('MusicVideos'), value: stats.MusicVideoCount },
                files
            ];
        case CollectionType.Homevideos:
        case CollectionType.Photos:
            return [
                { label: globalize.translate('Photos'), value: stats.PhotoCount },
                { label: globalize.translate('HeaderVideos'), value: stats.VideoCount },
                files
            ];
        case CollectionType.Boxsets:
            return [ { label: globalize.translate('Collections'), value: stats.BoxSetCount } ];
        default:
            return [
                { label: globalize.translate('Items'), value: stats.ItemCount },
                files
            ];
    }
};

export const formatNumber = (value: number) => value.toLocaleString(globalize.getCurrentDateTimeLocale());

/** Bytes to a short readable size (1.2 TB, 340 GB...). */
export const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = [ 'B', 'KB', 'MB', 'GB', 'TB', 'PB' ];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

/** Runtime ticks to "12 d 4 h" or "5 h 20 min". */
export const formatRuntime = (ticks: number) => {
    const totalMinutes = Math.floor(ticks / 10_000_000 / 60);
    if (totalMinutes <= 0) return '—';
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return globalize.translate('LibDurationDays', days, hours);
    return globalize.translate('LibDurationHours', hours, minutes);
};

export const formatRelative = (date?: string | null) => {
    if (!date) return globalize.translate('Never');
    const d = new Date(date);
    if (isNaN(d.getTime()) || d.getFullYear() < 1990) return globalize.translate('Never');
    return formatDistanceToNow(d, getLocaleWithSuffix());
};

export const formatFullDate = (date?: string | null) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime()) || d.getFullYear() < 1990) return '';
    return d.toLocaleString(globalize.getCurrentDateTimeLocale(), { dateStyle: 'long', timeStyle: 'short' });
};
