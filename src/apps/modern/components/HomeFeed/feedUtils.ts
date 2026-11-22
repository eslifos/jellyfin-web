/**
 * Helpers of the home feed: which image a card shows, its title and subtitle, and where it opens.
 */
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';

import { appRouter } from 'components/router/appRouter';
import globalize from 'lib/globalize';

export type CardShape = 'portrait' | 'square' | 'landscape';

const url = (api: Api, id: string | null | undefined, type: ImageType, tag: string | null | undefined, maxWidth: number) =>
    (id && tag ? getImageApi(api).getItemImageUrlById(id, type, { maxWidth, tag, quality: 90 }) : undefined);

/** The best image of an item for a card shape, falling back to its parents. */
export const cardImage = (api: Api, item: BaseItemDto, shape: CardShape): string | undefined => {
    const tags = item.ImageTags || {};

    if (shape === 'landscape') {
        const width = 560;
        return (item.Type === 'Episode' || item.Type === 'Program' || item.Type === 'Recording' ? url(api, item.Id, ImageType.Primary, tags.Primary, width) : undefined)
            ?? url(api, item.Id, ImageType.Thumb, tags.Thumb, width)
            ?? url(api, item.ParentThumbItemId, ImageType.Thumb, item.ParentThumbImageTag, width)
            ?? url(api, item.Id, ImageType.Backdrop, item.BackdropImageTags?.[0], width)
            ?? url(api, item.ParentBackdropItemId, ImageType.Backdrop, item.ParentBackdropImageTags?.[0], width)
            ?? url(api, item.Id, ImageType.Primary, tags.Primary, width)
            ?? url(api, item.ChannelId, ImageType.Primary, item.ChannelPrimaryImageTag, width);
    }

    const width = shape === 'square' ? 340 : 320;
    return (item.Type === 'Episode' ? url(api, item.SeriesId, ImageType.Primary, item.SeriesPrimaryImageTag, width) : undefined)
        ?? url(api, item.Id, ImageType.Primary, tags.Primary, width)
        ?? url(api, item.AlbumId, ImageType.Primary, item.AlbumPrimaryImageTag, width)
        ?? url(api, item.SeriesId, ImageType.Primary, item.SeriesPrimaryImageTag, width);
};

/** Backdrop for big banners (spotlight). */
/** Shape that suits the item best when a row mixes types. */
export const naturalShape = (item: BaseItemDto): CardShape => {
    switch (item.Type) {
        case 'MusicAlbum':
        case 'Audio':
        case 'MusicArtist':
        case 'Playlist':
        case 'AudioBook':
        case 'Photo':
            return 'square';
        case 'Episode':
        case 'Program':
        case 'TvChannel':
        case 'Video':
        case 'MusicVideo':
            return 'landscape';
        default:
            if (item.PrimaryImageAspectRatio && item.PrimaryImageAspectRatio > 1.2) return 'landscape';
            if (item.PrimaryImageAspectRatio && item.PrimaryImageAspectRatio > 0.85) return 'square';
            return 'portrait';
    }
};

const pad = (n?: number | null) => (n == null ? '?' : String(n));

export const cardTitle = (item: BaseItemDto) => (item.Type === 'Episode' && item.SeriesName ? item.SeriesName : item.Name || '');

export const cardSubtitle = (item: BaseItemDto): string | undefined => {
    switch (item.Type) {
        case 'Episode':
            return `T${pad(item.ParentIndexNumber)}:E${pad(item.IndexNumber)} · ${item.Name ?? ''}`;
        case 'MusicAlbum':
            return item.AlbumArtist || item.Artists?.[0] || undefined;
        case 'Audio':
            return item.Artists?.[0] || item.Album || undefined;
        case 'Program':
            return item.ChannelName || undefined;
        case 'Series':
            if (item.ProductionYear) {
                return item.Status === 'Continuing' ? `${item.ProductionYear} – ${globalize.translate('HfOngoing')}` : String(item.ProductionYear);
            }
            return undefined;
        default:
            return item.ProductionYear ? String(item.ProductionYear) : undefined;
    }
};

/** Minutes left of a started item ("45 min left"). */
export const timeLeft = (item: BaseItemDto) => {
    const total = item.RunTimeTicks ?? 0;
    const pos = item.UserData?.PlaybackPositionTicks ?? 0;
    if (!total || !pos) return undefined;
    const minutes = Math.max(1, Math.round((total - pos) / 600000000));
    return minutes >= 60 ?
        globalize.translate('HfLeftHours', Math.floor(minutes / 60), minutes % 60) :
        globalize.translate('HfLeftMinutes', minutes);
};

/** In-app route of an item (react-router path, without the leading #). */
export const itemRoute = (item: BaseItemDto, context?: string | null) => {
    const route = appRouter.getRouteUrl(item, context ? { context } : undefined) as string;
    return route.startsWith('#') ? route.substring(1) : route;
};

const PLAYABLE = new Set([ 'Movie', 'Episode', 'Series', 'Season', 'MusicAlbum', 'Audio', 'Playlist', 'AudioBook', 'MusicVideo', 'Video', 'BoxSet', 'MusicArtist', 'TvChannel' ]);

export const isPlayable = (item: BaseItemDto) => PLAYABLE.has(item.Type || '');

/** Stable colour from a text (genre tiles). */
export const hashColor = (text: string) => {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return `hsl(${hue} 70% 45%)`;
};
