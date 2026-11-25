function getApiClient(serverId) {
    return Promise.resolve(window.connectionManager.getApiClient(serverId));
}

function executeAction(action, data, serverId) {
    return getApiClient(serverId).then(function (apiClient) {
        switch (action) {
            case 'cancel-install':
                return apiClient.cancelPackageInstallation(data.id);
            case 'restart':
                return apiClient.restartServer();
            default:
                clients.openWindow('/');
                return Promise.resolve();
        }
    });
}

/* eslint-disable-next-line no-restricted-globals -- self is valid in a serviceworker environment */
self.addEventListener('notificationclick', function (event) {
    const notification = event.notification;
    notification.close();

    const data = notification.data;
    const serverId = data.serverId;
    const action = event.action;

    if (!action) {
        clients.openWindow('/');
        event.waitUntil(Promise.resolve());
        return;
    }

    event.waitUntil(executeAction(action, data, serverId));
}, false);

/*
 * The app kept on the device, so it opens without connection to the server (to watch downloads).
 * Every file of the app goes to the network first (an update is never hidden by an old copy); only when the
 * network fails the last copy kept is used. Requests to the server API are never kept.
 */
/* eslint-disable no-restricted-globals, compat/compat -- self is valid in a serviceworker; service workers only run where caches and Request exist */
const SHELL_CACHE = 'jf-shell-v1';
const MAX_FILES = 600;
/** This file is also added to index.html (as upstream does); there it runs in the page, which has no registration. */
const inServiceWorker = typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;
/** The folder the app is served from, read when a request arrives. */
const appScope = () => new URL(self.registration.scope).pathname;

const isAppFile = (request, url) => request.method === 'GET'
    && url.origin === self.location.origin
    && url.pathname.startsWith(appScope())
    && !url.pathname.endsWith('serviceworker.js');

/** Keeps the cache small: the oldest copies go first. */
const trim = async cache => {
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_FILES))) await cache.delete(key);
};

const networkFirst = async (request, key) => {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
            await cache.put(key, response.clone());
            trim(cache).catch(() => undefined);
        }
        return response;
    } catch (err) {
        const kept = await cache.match(key, { ignoreSearch: true });
        if (kept) return kept;
        throw err;
    }
};

if (inServiceWorker) {
    self.addEventListener('install', () => self.skipWaiting());

    self.addEventListener('activate', event => {
        event.waitUntil(caches.keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('jf-shell-') && k !== SHELL_CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim()));
    });

    self.addEventListener('fetch', event => {
        const request = event.request;
        const url = new URL(request.url);
        if (!isAppFile(request, url)) return;
        // Pages of the app are all the same document (the routes are after the #)
        const key = request.mode === 'navigate' ? new Request(url.origin + appScope()) : request;
        event.respondWith(networkFirst(request, key));
    });
}
/* eslint-enable no-restricted-globals, compat/compat */
