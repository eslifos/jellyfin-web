/**
 * TV: the banner of the home screen follows the remote, and plays a trailer when the remote rests on something.
 *  - the focus on a card of any row shows that title in the banner (backdrop, logo, year, length, rating, quality and
 *    synopsis), 300 ms after it arrives so going fast along a row does not flicker;
 *  - after 3 s on the same thing, its trailer (the server's own, /Discovery/Trailer) plays muted behind the banner,
 *    in one <video> that is reused; any key stops it;
 *  - "Automatic trailers on TV" in Preferences > Home turns the trailers off.
 */
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useQuery } from '@tanstack/react-query';
import { type RefObject, useEffect, useState } from 'react';

import layoutManager from 'components/layoutManager';
import { playbackManager } from 'components/playback/playbackmanager';
import globalize from 'lib/globalize';
import * as userSettings from 'scripts/settings/userSettings';
import Events from 'utils/events';
import { queryClient } from 'utils/query/queryClient';

/** The setting (per user, as the TV home screen layout). */
export const TV_TRAILERS_SETTING = 'tvtrailers';
/** On by default: only "false" turns them off. */
export const tvTrailersEnabled = () => userSettings.get(TV_TRAILERS_SETTING) !== 'false';

/** The card a focused element stands for (Card, Wide and UpcomingCard set it). */
export const ITEM_ATTRIBUTE = 'data-item-id';
const FOLLOW_DELAY_MS = 300;
const TRAILER_DELAY_MS = 3000;
const TICKS_PER_MINUTE = 600000000;
const TRAILER_TYPES = new Set([ 'Movie', 'Series', 'Episode' ]);

export interface HeroPreview {
    id: string;
    name: string;
    backdrop?: { itemId: string, tag: string };
    logo?: { itemId: string, tag: string };
    meta: string[];
    rating?: number | null;
    overview?: string | null;
    /** The episode line under the title of an episode ("S1:E2 · Name") */
    episode?: string;
    /** The movie or series whose trailer plays */
    trailerItemId?: string;
}

/**
 * The item of the card with the focus, a moment after it got it; null while the focus is in the banner itself (it
 * shows its own titles then) or before the remote reaches any card.
 */
export const useFocusedCard = (heroRef: RefObject<HTMLElement>, enabled: boolean) => {
    const [ id, setId ] = useState<string | null>(null);
    useEffect(() => {
        if (!enabled) return;
        let timer: number | undefined;
        const onFocusIn = (e: FocusEvent) => {
            const target = e.target instanceof Element ? e.target : null;
            if (!target) return;
            window.clearTimeout(timer);
            if (heroRef.current?.contains(target)) {
                setId(null);
                return;
            }
            // Anything else without an item (a genre, a menu) keeps the last title on view
            const next = target.closest(`[${ITEM_ATTRIBUTE}]`)?.getAttribute(ITEM_ATTRIBUTE);
            if (next) timer = window.setTimeout(() => setId(next), FOLLOW_DELAY_MS);
        };
        document.addEventListener('focusin', onFocusIn);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('focusin', onFocusIn);
        };
    }, [ heroRef, enabled ]);
    return enabled ? id : null;
};

const formatLength = (ticks?: number | null) => {
    if (!ticks) return undefined;
    const total = Math.max(1, Math.round(ticks / TICKS_PER_MINUTE));
    const hours = Math.floor(total / 60);
    return hours ? globalize.translate('TvHoursMinutes', hours, total % 60) : globalize.translate('TvMinutes', total);
};

/** "4K", "1080p", "HDR"… of the picture, when the item has one. */
const qualityOf = (item: BaseItemDto) => {
    const video = item.MediaStreams?.find(s => s.Type === 'Video');
    if (!video?.Width) return [];
    const labels: string[] = [];
    if (video.Width >= 3200) labels.push('4K');
    else if (video.Width >= 1800) labels.push('1080p');
    else if (video.Width >= 1200) labels.push('720p');
    const range = video.VideoRangeType ?? '';
    if (range.startsWith('DOVI')) labels.push('Dolby Vision');
    else if (range && range !== 'SDR' && range !== 'Unknown') labels.push('HDR');
    return labels;
};

/** The movie or series whose trailer stands for the item (an episode: its series). */
const trailerItemOf = (item: BaseItemDto) => {
    if (item.Type === 'Episode') return item.SeriesId ?? undefined;
    return TRAILER_TYPES.has(item.Type ?? '') ? item.Id ?? undefined : undefined;
};

const toPreview = (item: BaseItemDto): HeroPreview => {
    const own = item.BackdropImageTags?.[0];
    const parent = item.ParentBackdropImageTags?.[0];
    let backdrop: HeroPreview['backdrop'];
    if (own) backdrop = { itemId: item.Id ?? '', tag: own };
    else if (parent && item.ParentBackdropItemId) backdrop = { itemId: item.ParentBackdropItemId, tag: parent };
    let logo: HeroPreview['logo'];
    if (item.ImageTags?.Logo) logo = { itemId: item.Id ?? '', tag: item.ImageTags.Logo };
    else if (item.ParentLogoImageTag && item.ParentLogoItemId) logo = { itemId: item.ParentLogoItemId, tag: item.ParentLogoImageTag };
    const isEpisode = item.Type === 'Episode';
    const meta = [
        item.ProductionYear ? String(item.ProductionYear) : '',
        item.Type === 'Series' ? '' : formatLength(item.RunTimeTicks) ?? '',
        item.OfficialRating ?? '',
        ...qualityOf(item)
    ].filter(Boolean);
    return {
        id: item.Id ?? '',
        name: (isEpisode ? item.SeriesName : null) ?? item.Name ?? '',
        backdrop,
        logo,
        meta,
        rating: item.CommunityRating,
        overview: item.Overview,
        episode: isEpisode ?
            [ globalize.translate('TvEpisodeCode', item.ParentIndexNumber ?? 0, item.IndexNumber ?? 0), item.Name ].filter(Boolean).join(' · ') :
            undefined,
        trailerItemId: trailerItemOf(item)
    };
};

/** What the banner shows for the focused card (the last one shown stays while the next one loads). */
export const useHeroPreview = (api: Api, userId: string | undefined, id: string | null) => {
    const query = useQuery({
        queryKey: [ 'QuickHome', 'TvHero', userId, id ],
        queryFn: async ({ signal }) => toPreview((await api.axiosInstance.get<BaseItemDto>(
            `${api.basePath}/Users/${userId}/Items/${id}`,
            { headers: { Authorization: api.authorizationHeader }, signal }
        )).data),
        enabled: !!id && !!userId,
        staleTime: 10 * 60 * 1000,
        placeholderData: previous => previous
    });
    return id ? query.data ?? null : null;
};

interface TrailerInfo {
    Key: string;
}

const trailerOf = (api: Api, itemId: string) => queryClient.fetchQuery({
    // The same entry as the trailer button of the details (Trailer/useTrailer)
    queryKey: [ 'Trailer', itemId, undefined, undefined ],
    queryFn: async ({ signal }) => (await api.axiosInstance.get<TrailerInfo | ''>(`${api.basePath}/Discovery/Trailer`, {
        headers: { Authorization: api.authorizationHeader },
        params: { itemId },
        signal
    })).data || null,
    staleTime: 12 * 60 * 60 * 1000
});

/**
 * Plays the trailer of `itemId` in `videoRef` (muted, behind the banner) after the remote rested 3 s; stops it with
 * any key, when the item changes or the page goes. Returns whether a trailer is on screen.
 */
export const useHeroTrailer = (api: Api, videoRef: RefObject<HTMLVideoElement>, itemId: string | undefined, enabled: boolean) => {
    const [ playing, setPlaying ] = useState(false);
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !enabled || !itemId || !layoutManager.tv) return;
        let timer: number | undefined;
        let cancelled = false;

        const stopShowing = () => setPlaying(false);
        const stop = () => {
            window.clearTimeout(timer);
            setPlaying(false);
            if (!video.getAttribute('src')) return;
            video.pause();
            video.removeAttribute('src');
            video.load();
        };
        const start = async () => {
            // Not while another video plays or the page is not on screen
            if (document.visibilityState !== 'visible' || playbackManager.isPlaying() || !video.getClientRects().length) return;
            try {
                const info = await trailerOf(api, itemId);
                if (cancelled || !info?.Key) return;
                video.src = `${api.basePath}/Discovery/Trailer/${encodeURIComponent(info.Key)}/Video?ApiKey=${encodeURIComponent(api.accessToken)}`;
                await video.play();
            } catch {
                // No trailer, or it cannot play here: the backdrop stays
                if (!cancelled) stop();
            }
        };
        const arm = () => {
            stop();
            timer = window.setTimeout(() => {
                void start();
            }, TRAILER_DELAY_MS);
        };
        // Shown only once its picture really moves (not on "playing", which comes before the first frame, nor while
        // it waits for data): never a black box or the player's icon over the banner
        const onTimeUpdate = () => {
            if (video.currentTime > 0.3 && !video.paused) setPlaying(true);
        };
        const onPlaybackStart = () => stop();

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('waiting', stopShowing);
        video.addEventListener('ended', stop);
        video.addEventListener('error', stop);
        window.addEventListener('keydown', arm, true);
        document.addEventListener('visibilitychange', arm);
        Events.on(playbackManager, 'playbackstart', onPlaybackStart);
        arm();
        return () => {
            cancelled = true;
            stop();
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('waiting', stopShowing);
            video.removeEventListener('ended', stop);
            video.removeEventListener('error', stop);
            window.removeEventListener('keydown', arm, true);
            document.removeEventListener('visibilitychange', arm);
            Events.off(playbackManager, 'playbackstart', onPlaybackStart);
        };
    }, [ api, videoRef, itemId, enabled ]);
    return enabled && playing;
};
