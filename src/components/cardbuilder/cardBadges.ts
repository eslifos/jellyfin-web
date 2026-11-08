/**
 * Poster overlays (Kometa-like) on every movie / series / season / episode card:
 * resolution + HDR/DV, audio, edition, network, ratings, source, multi audio,
 * episode code and runtime. Data comes in batches from the custom /ItemBadges endpoint.
 * Works on any page: a MutationObserver finds new cards and decorates them.
 */
import escapeHtml from 'escape-html';

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
    return m ?
        `${escapeHtml(m[1])}<b class="jfB-atmos">${escapeHtml(m[2].trim() === 'Atmos' ? ' ATMOS' : ':X')}</b>` :
        escapeHtml(audio);
};

const ratingsHtml = (b: ItemBadges) => {
    let html = '';
    if (b.CriticRating != null) {
        const fresh = b.CriticRating >= 60;
        html += `<span class="jfB jfB-rate jfB-rt ${fresh ? 'fresh' : 'rotten'}" title="Rotten Tomatoes"><i>${fresh ? '🍅' : '🤢'}</i>${Math.round(b.CriticRating)}%</span>`;
    }
    if (b.CommunityRating) {
        html += `<span class="jfB jfB-rate jfB-star" title="${b.ImdbId ? 'IMDb / TMDb' : 'TMDb'}"><i>★</i>${b.CommunityRating.toFixed(1)}</span>`;
    }
    return html ? `<div class="jfB-right">${html}</div>` : '';
};

const render = (b: ItemBadges, type: string) => {
    const isEpisode = type === 'Episode';
    let html = '<div class="jfBadges" aria-hidden="true">';

    // Top row: resolution/HDR, audio … network on the right
    let top = '';
    if (b.Resolution) {
        top += `<span class="jfB jfB-res">${escapeHtml(b.Resolution === '1080P' ? '1080P' : b.Resolution)}${b.Resolution === '1080P' && !b.Hdr ? ' <b>FHD</b>' : ''}${b.Hdr ? ` <b class="jfB-${hdrClass(b.Hdr)}">${escapeHtml(b.Hdr)}</b>` : ''}</span>`;
    }
    if (b.Audio) top += `<span class="jfB jfB-audio">${audioHtml(b.Audio)}</span>`;
    if (top || b.Network) {
        html += `<div class="jfB-top"><div class="jfB-topleft">${top}</div>`;
        if (b.Network && !isEpisode) html += `<span class="jfB jfB-net jfB-net-${escapeHtml(b.Network)}">${escapeHtml(NETWORKS[b.Network] || b.Network)}</span>`;
        html += '</div>';
    }
    if (b.Edition) html += `<div class="jfB-edition">${escapeHtml(b.Edition.toUpperCase())}</div>`;

    html += ratingsHtml(b);

    // Bottom row
    let bottomLeft = '';
    if (b.Source) bottomLeft += `<span class="jfB jfB-src">${escapeHtml(b.Source)}</span>`;
    let bottomCenter = '';
    if (isEpisode && b.EpisodeCode) bottomCenter = `<span class="jfB jfB-ep">${escapeHtml(b.EpisodeCode)}</span>`;
    else if (b.AudioLanguages >= 2) bottomCenter = `<span class="jfB jfB-multi">${b.AudioLanguages === 2 ? 'DUAL' : 'MULTI'}<br>AUDIO</span>`;
    let bottomRight = '';
    if (isEpisode && b.RuntimeMinutes) {
        const h = Math.floor(b.RuntimeMinutes / 60);
        bottomRight = `<span class="jfB jfB-time">${h ? `${h}h ` : ''}${b.RuntimeMinutes % 60}m</span>`;
    }
    if (bottomLeft || bottomCenter || bottomRight) {
        html += `<div class="jfB-bottom"><div>${bottomLeft}</div><div>${bottomCenter}</div><div>${bottomRight}</div></div>`;
    }

    // Corner ribbon for very well rated titles
    if (!isEpisode && b.CriticRating != null && b.CriticRating >= 90) {
        html += '<div class="jfB-ribbon"><span>🍅 FRESH</span></div>';
    }

    html += '</div>';
    return html;
};

const decorate = (card: HTMLElement) => {
    const id = card.dataset.id;
    const type = card.dataset.type || '';
    if (!id) return;
    const badges = cache.get(normId(id));
    const scalable = card.querySelector<HTMLElement>('.cardScalable');
    if (!scalable || !badges) return;
    if (scalable.querySelector(':scope > .jfBadges')) return;
    scalable.insertAdjacentHTML('beforeend', render(badges, type));
};

const fetchPending = () => {
    fetchTimer = undefined;
    const client = window.ApiClient;
    if (!client || !pending.size) return;
    const ids = Array.from(pending).slice(0, 200);
    ids.forEach(i => pending.delete(i));

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
        ids.forEach(i => { if (!got.has(normId(i))) cache.set(normId(i), null); });
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
            ids.forEach(i => cache.set(normId(i), null));
        }
    });
};

const scan = () => {
    scanTimer = undefined;
    if (disabled) return;
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
    scheduleScan();
};
