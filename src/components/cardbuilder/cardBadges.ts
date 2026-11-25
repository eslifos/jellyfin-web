/**
 * Poster overlays (Kometa-like) on every movie / series / season / episode card:
 * resolution + HDR/DV, audio, edition, network, ratings, source, multi audio,
 * episode code and runtime. Data comes in batches from the custom /ItemBadges endpoint.
 * Works on any page: a MutationObserver finds new cards and decorates them.
 * Each user chooses in Display preferences whether all badges, only the quality one or none are drawn;
 * on phones the styles keep at most the quality badge and one rating.
 */
import escapeHtml from 'escape-html';

import { currentSettings as userSettings } from 'scripts/settings/userSettings';
import Events from 'utils/events';
import { formatNumber } from 'utils/localeNumber';

import './cardBadges.scss';

interface ItemBadges {
    ItemId: string;
    Resolution?: string | null;
    Hdr?: string | null;
    Audio?: string | null;
    Source?: string | null;
    Edition?: string | null;
    AudioLanguages: number;
    Network?: string | null;
    CommunityRating?: number | null;
    CriticRating?: number | null;
    ImdbId?: string | null;
    ImdbRating?: number | null;
    ImdbVotes?: number | null;
    EpisodeCode?: string | null;
    RuntimeMinutes?: number | null;
}

const TYPES = new Set([ 'Movie', 'Series', 'Season', 'Episode' ]);
const NETWORKS: Record<string, string> = {
    netflix: 'NETFLIX', amazon: 'prime video', disney: 'Disney+', hbo: 'HBO max',
    apple: 'tv+', hulu: 'hulu', paramount: 'Paramount+', peacock: 'peacock'
};

const cache = new Map<string, ItemBadges | null>();
const pending = new Set<string>();
let disabled = false;
let scanTimer: number | undefined;
let fetchTimer: number | undefined;
let observer: MutationObserver | null = null;

const normId = (id: string) => id.replace(/-/g, '').toLowerCase();

const hdrClass = (hdr: string) => {
    if (hdr === 'DV') return 'dv';
    if (hdr === 'HDR10+') return 'hdrplus';
    return 'hdr';
};

const audioHtml = (audio: string) => {
    // Highlight the "Atmos" / ":X" part like the posters do
    const m = /^(.*?)(\s?Atmos|:X)$/.exec(audio);
    if (!m) return escapeHtml(audio);
    const mark = m[2].trim() === 'Atmos' ? ' ATMOS' : ':X';
    return `${escapeHtml(m[1])}<b class="jfB-atmos">${escapeHtml(mark)}</b>`;
};

const criticHtml = (rating: number) => {
    const fresh = rating >= 60;
    const look = fresh ? 'fresh' : 'rotten';
    const icon = fresh ? '🍅' : '🤢';
    return `<span class="jfB jfB-rate jfB-rt ${look}" title="Rotten Tomatoes"><i>${icon}</i>${Math.round(rating)}%</span>`;
};

const audienceHtml = (b: ItemBadges) => {
    if (b.ImdbRating) {
        const votes = b.ImdbVotes ? ' · ' + formatNumber(b.ImdbVotes) : '';
        return `<span class="jfB jfB-rate jfB-imdb" title="IMDb${votes}"><i>IMDb</i>${b.ImdbRating.toFixed(1)}</span>`;
    }
    if (b.CommunityRating) {
        return `<span class="jfB jfB-rate jfB-star" title="TMDb"><i>★</i>${b.CommunityRating.toFixed(1)}</span>`;
    }
    return '';
};

const ratingsHtml = (b: ItemBadges) => {
    const html = (b.CriticRating == null ? '' : criticHtml(b.CriticRating)) + audienceHtml(b);
    return html ? `<div class="jfB-right">${html}</div>` : '';
};

/** Which badges the user wants: 'all', 'quality' or 'none'. */
const badgesMode = (): string => userSettings.cardBadges();

const qualityHtml = (b: ItemBadges) => {
    if (!b.Resolution) return '';
    let extra = '';
    if (b.Hdr) extra = ` <b class="jfB-${hdrClass(b.Hdr)}">${escapeHtml(b.Hdr)}</b>`;
    else if (b.Resolution === '1080P') extra = ' <b>FHD</b>';
    return `<span class="jfB jfB-res">${escapeHtml(b.Resolution)}${extra}</span>`;
};

const topHtml = (badges: string) => (badges ? `<div class="jfB-top"><div class="jfB-topleft">${badges}</div></div>` : '');

const runtimeText = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    return (h ? h + 'h ' : '') + `${minutes % 60}m`;
};

const bottomHtml = (b: ItemBadges, isEpisode: boolean) => {
    const left = b.Source ? `<span class="jfB jfB-src">${escapeHtml(b.Source)}</span>` : '';
    let center = '';
    if (isEpisode && b.EpisodeCode) center = `<span class="jfB jfB-ep">${escapeHtml(b.EpisodeCode)}</span>`;
    else if (b.AudioLanguages >= 2) center = `<span class="jfB jfB-multi">${b.AudioLanguages === 2 ? 'DUAL' : 'MULTI'}<br>AUDIO</span>`;
    const right = isEpisode && b.RuntimeMinutes ? `<span class="jfB jfB-time">${runtimeText(b.RuntimeMinutes)}</span>` : '';
    return left || center || right ? `<div class="jfB-bottom"><div>${left}</div><div>${center}</div><div>${right}</div></div>` : '';
};

/** Every badge: quality and audio on top, edition, network and ratings in the middle, the rest at the bottom. */
const allHtml = (b: ItemBadges, isEpisode: boolean) => {
    let html = topHtml(qualityHtml(b) + (b.Audio ? `<span class="jfB jfB-audio">${audioHtml(b.Audio)}</span>` : ''));
    if (b.Edition) html += `<div class="jfB-edition">${escapeHtml(b.Edition.toUpperCase())}</div>`;

    // Network on the left, at the height of the ratings
    if (b.Network && !isEpisode) {
        html += `<div class="jfB-left"><span class="jfB jfB-net jfB-net-${escapeHtml(b.Network)}">${escapeHtml(NETWORKS[b.Network] || b.Network)}</span></div>`;
    }

    html += ratingsHtml(b) + bottomHtml(b, isEpisode);

    // Corner ribbon for very well rated titles
    if (!isEpisode && b.CriticRating != null && b.CriticRating >= 90) {
        html += '<div class="jfB-ribbon"><span>🍅 FRESH</span></div>';
    }
    return html;
};

const render = (b: ItemBadges, type: string, mode: string) => {
    const inner = mode === 'quality' ? topHtml(qualityHtml(b)) : allHtml(b, type === 'Episode');
    return inner ? `<div class="jfBadges" data-mode="${mode}" aria-hidden="true">${inner}</div>` : '';
};

const decorate = (card: HTMLElement) => {
    const id = card.dataset.id;
    const type = card.dataset.type || '';
    if (!id) return;
    const badges = cache.get(normId(id));
    const scalable = card.querySelector<HTMLElement>('.cardScalable');
    if (!scalable || !badges) return;
    const mode = badgesMode();
    const drawn = scalable.querySelector<HTMLElement>(':scope > .jfBadges');
    if (drawn?.dataset.mode === mode) return;
    drawn?.remove();
    scalable.insertAdjacentHTML('beforeend', render(badges, type, mode));
};

const fetchPending = () => {
    fetchTimer = undefined;
    const client = window.ApiClient;
    if (!client || !pending.size) return;
    const ids = Array.from(pending).slice(0, 200);
    for (const i of ids) pending.delete(i);

    void client.ajax({
        type: 'POST',
        url: client.getUrl('ItemBadges'),
        data: JSON.stringify(ids),
        contentType: 'application/json',
        dataType: 'json'
    }).then((result: ItemBadges[]) => {
        const got = new Set<string>();
        (result || []).forEach(b => {
            const key = normId(b.ItemId);
            got.add(key);
            cache.set(key, b);
        });
        for (const i of ids) {
            if (!got.has(normId(i))) cache.set(normId(i), null);
        }
        document.querySelectorAll<HTMLElement>('.card[data-id]').forEach(c => {
            if (c.dataset.id && ids.some(i => normId(i) === normId(c.dataset.id!))) decorate(c);
        });
        if (pending.size) fetchTimer = window.setTimeout(fetchPending, 50);
    }).catch((err: unknown) => {
        // Old server without the endpoint: stop trying.
        const status = (err as { status?: number })?.status;
        if (status === 404 || status === 405) {
            disabled = true;
            observer?.disconnect();
        } else {
            for (const i of ids) cache.set(normId(i), null);
        }
    });
};

const scan = () => {
    scanTimer = undefined;
    if (disabled) return;
    if (badgesMode() === 'none') {
        for (const b of document.querySelectorAll('.jfBadges')) b.remove();
        return;
    }
    document.querySelectorAll<HTMLElement>('.card[data-id]').forEach(card => {
        const id = card.dataset.id;
        if (!id || !TYPES.has(card.dataset.type || '')) return;
        const key = normId(id);
        if (cache.has(key)) {
            decorate(card);
        } else {
            pending.add(id);
        }
    });
    if (pending.size && !fetchTimer) fetchTimer = window.setTimeout(fetchPending, 60);
};

const scheduleScan = () => {
    if (!scanTimer) scanTimer = window.setTimeout(scan, 200);
};

/** Starts decorating cards across the app (idempotent). */
export const initCardBadges = () => {
    if (observer || disabled || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    // Another choice in Display preferences (here or on another device) redraws the cards on screen
    Events.on(userSettings, 'change', (_e: unknown, name?: string) => {
        if (name === 'cardBadges') scheduleScan();
    });
    scheduleScan();
};
