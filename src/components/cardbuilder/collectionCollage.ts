/**
 * Collections (BoxSet) without a primary image: the card shows a collage of the backdrops of their first 2 or 3
 * movies, stacked in strips. Collections with a primary image keep it. Works on every card of the app (legacy card
 * builder and the new home / library feeds): a MutationObserver finds collection cards and asks the server, in
 * batches, which collections have no primary image.
 */
import './collectionCollage.scss';

interface CollageItem {
    Id: string;
    BackdropImageTags?: string[];
    ImageTags?: Record<string, string>;
}

const STRIPS = 3;
/** Collage urls per collection; empty when the collection has its own primary image. */
const cache = new Map<string, Promise<string[]>>();
const waiting = new Map<string, (urls: Promise<string[]>) => void>();
let observer: MutationObserver | null = null;
let timer: number | undefined;
let batchTimer: number | undefined;

const normId = (id: string) => id.replace(/-/g, '').toLowerCase();

/** Backdrop urls of the first movies of the collection (release order). */
const loadChildren = (collectionId: string): Promise<string[]> => {
    const client = window.ApiClient;
    if (!client) return Promise.resolve([]);

    return (client.getJSON(client.getUrl('Items', {
        ParentId: collectionId,
        UserId: client.getCurrentUserId(),
        SortBy: 'PremiereDate,ProductionYear,SortName',
        SortOrder: 'Ascending',
        EnableImageTypes: 'Backdrop,Primary',
        ImageTypeLimit: 1,
        Limit: 12
    })) as Promise<{ Items?: CollageItem[] }>)
        .then(result => {
            const items = result.Items ?? [];
            const withBackdrop = items.filter(i => i.BackdropImageTags?.length);
            const chosen = (withBackdrop.length ? withBackdrop : items.filter(i => i.ImageTags?.Primary)).slice(0, STRIPS);
            return chosen.map(i => (i.BackdropImageTags?.length ?
                client.getScaledImageUrl(i.Id, { type: 'Backdrop', tag: i.BackdropImageTags[0], maxWidth: 600 }) :
                client.getScaledImageUrl(i.Id, { type: 'Primary', tag: i.ImageTags!.Primary, maxWidth: 400 })));
        })
        .catch(() => []);
};

/** One request for all the collections waiting: which ones have no primary image. */
const runBatch = () => {
    batchTimer = undefined;
    const client = window.ApiClient;
    const ids = Array.from(waiting.keys()).slice(0, 100);
    if (!client || !ids.length) return;
    const resolvers = ids.map(id => [ id, waiting.get(id)! ] as const);
    ids.forEach(id => {
        waiting.delete(id);
    });

    (client.getJSON(client.getUrl('Items', {
        Ids: ids.join(','),
        UserId: client.getCurrentUserId(),
        EnableImageTypes: 'Primary',
        ImageTypeLimit: 1
    })) as Promise<{ Items?: CollageItem[] }>)
        .then(result => {
            const withPrimary = new Set((result.Items ?? []).filter(i => i.ImageTags?.Primary).map(i => normId(i.Id)));
            resolvers.forEach(([ id, resolve ]) => {
                resolve(withPrimary.has(normId(id)) ? Promise.resolve([]) : loadChildren(id));
            });
        })
        .catch(() => {
            resolvers.forEach(([ , resolve ]) => {
                resolve(Promise.resolve([]));
            });
        });

    if (waiting.size) batchTimer = window.setTimeout(runBatch, 50);
};

const collageUrls = (collectionId: string): Promise<string[]> => {
    const key = normId(collectionId);
    const cached = cache.get(key);
    if (cached) return cached;
    const promise = new Promise<string[]>(resolve => {
        waiting.set(collectionId, urls => resolve(urls));
    });
    cache.set(key, promise);
    if (!batchTimer) batchTimer = window.setTimeout(runBatch, 80);
    return promise;
};

const decorate = (card: HTMLElement) => {
    const id = card.dataset.id;
    if (!id || card.dataset.collage) return;
    card.dataset.collage = 'pending';

    void collageUrls(id).then(urls => {
        const scalable = card.querySelector<HTMLElement>('.cardScalable');
        if (!urls.length || !scalable || scalable.querySelector('.jfCollage')) {
            card.dataset.collage = 'none';
            return;
        }
        const collage = document.createElement('div');
        collage.className = `jfCollage jfCollage-${urls.length}`;
        urls.forEach(url => {
            const strip = document.createElement('div');
            strip.className = 'jfCollage-strip';
            strip.style.backgroundImage = `url("${url}")`;
            collage.appendChild(strip);
        });
        // Over the empty image area, under the hover overlay, play button and badges
        const host = scalable.querySelector<HTMLElement>('.cardImageContainer') ?? scalable;
        host.appendChild(collage);
        card.dataset.collage = 'done';
    });
};

const scan = () => {
    timer = undefined;
    document.querySelectorAll<HTMLElement>('.card[data-type="BoxSet"][data-id]:not([data-collage])').forEach(decorate);
};

const schedule = () => {
    if (!timer) timer = window.setTimeout(scan, 250);
};

/** Starts filling collection cards without a primary image (idempotent). */
export const initCollectionCollage = () => {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
};
