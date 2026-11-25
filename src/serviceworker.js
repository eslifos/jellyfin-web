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
 *  - install: the shell is kept (index.html, the bundles it loads, the main CSS, themes, fonts, the downloads page
 *    and the translations of English and of the device), from the list webpack writes below;
 *  - files with a hash (in the name, or the ?hash index.html adds) never change: cache first;
 *  - index.html and other files without a hash: network first, the kept copy when the network fails;
 *  - the server API is never kept (downloads live in IndexedDB, not here).
 */
/* eslint-disable no-restricted-globals, compat/compat -- self is valid in a serviceworker; service workers only run where caches and Request exist */
const SHELL_CACHE = 'jf-shell-v1';
/** Files kept besides the shell (pages opened online); the oldest go first. */
const MAX_FILES = 600;
const FALLBACK_LANGUAGE = 'en-us';
/** Filled by scripts/shellManifestPlugin.js when building: { shell, translations, buildQuery }. */
const MANIFEST = JSON.parse('__JF_SHELL_MANIFEST__');
/** A content hash in the file name: "name.0a1b2c3d4e5f6a7b8c9d.chunk.js", "font.0a1b2c3d4e5f6a7b8c9d.woff2". */
const HASHED_NAME = /\.[0-9a-f]{16,}\.[a-z0-9.]+$/;
/** The files of the app (never the API): the server answers its endpoints without these extensions. */
const STATIC_FILE = /\.(js|css|html|json|webmanifest|woff2?|ttf|eot|otf|png|jpe?g|gif|svg|ico|wasm)$/i;
/**
 * Inside the web view of an app (the Android app marks it with "wv"), the app itself must see every request: it
 * knows the web client started when it sees the main bundle go by, and answers some files with its own. A worker
 * answering from its cache hides them, so there it does nothing and removes itself.
 */
const IN_APP_WEB_VIEW = /;\s*wv\)/.test(self.navigator.userAgent);

/** The folder the app is served from, read when it is needed. */
const appScope = () => new URL(self.registration.scope).pathname;
const toUrl = file => new URL(file, self.registration.scope).href;

const isAuthenticated = (request, url) => request.headers.has('Authorization')
    || request.headers.has('X-Emby-Authorization')
    || [ ...url.searchParams.keys() ].some(k => k.toLowerCase() === 'api_key');

const isAppFile = (request, url) => request.method === 'GET'
    && url.origin === self.location.origin
    && url.pathname.startsWith(appScope())
    && !url.pathname.endsWith('serviceworker.js')
    && (request.mode === 'navigate' || STATIC_FILE.test(url.pathname))
    && !isAuthenticated(request, url);

const isVersioned = url => HASHED_NAME.test(url.pathname)
    || (!!MANIFEST.buildQuery && url.search === `?${MANIFEST.buildQuery}`);

/** English always (the app falls back to it) and the languages of the device: "es-MX" → es-mx, es. */
const translationFiles = () => {
    const wanted = new Set([ FALLBACK_LANGUAGE ]);
    for (const lang of self.navigator.languages || [ self.navigator.language ]) {
        if (!lang) continue;
        const code = lang.toLowerCase().replace(/_/g, '-');
        wanted.add(code);
        wanted.add(code.split('-')[0]);
    }
    return [ ...wanted ].map(lang => MANIFEST.translations[lang]).filter(Boolean);
};

/** Keeps the cache small: the oldest copies go first, never the shell. */
const trim = async cache => {
    const shell = new Set([ toUrl(''), ...MANIFEST.shell.map(toUrl) ]);
    const extra = (await cache.keys()).filter(key => !shell.has(key.url));
    for (const key of extra.slice(0, Math.max(0, extra.length - MAX_FILES))) await cache.delete(key);
};

const keep = async (cache, key, response) => {
    // A redirected answer cannot be given back to a page load
    if (!response.ok || response.type !== 'basic' || response.redirected) return;
    await cache.put(key, response);
    trim(cache).catch(() => undefined);
};

const cacheFirst = async request => {
    const cache = await caches.open(SHELL_CACHE);
    const kept = await cache.match(request);
    if (kept) return kept;
    const response = await fetch(request);
    await keep(cache, request, response.clone());
    return response;
};

const networkFirst = async (request, key) => {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const response = await fetch(request);
        await keep(cache, key, response.clone());
        return response;
    } catch (err) {
        const kept = await cache.match(key, { ignoreSearch: true });
        if (kept) return kept;
        throw err;
    }
};

/** Keeps a list of files; one that fails does not stop the others. */
const keepAll = async (cache, files) => {
    const results = await Promise.allSettled(files.map(async file => {
        const response = await fetch(new Request(toUrl(file), { cache: 'reload' }));
        if (!response.ok) throw new Error(`${response.status} ${file}`);
        await cache.put(toUrl(file), response);
    }));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) console.warn(`[serviceworker] ${failed.length} of ${files.length} files not kept`, failed[0].reason);
};

self.addEventListener('install', event => {
    if (IN_APP_WEB_VIEW) {
        event.waitUntil(self.skipWaiting());
        return;
    }
    event.waitUntil(caches.open(SHELL_CACHE)
        // index.html is the folder of the app: every route of the app is that same document
        .then(cache => keepAll(cache, [ '', ...MANIFEST.shell, ...translationFiles() ]))
        .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    if (IN_APP_WEB_VIEW) {
        event.waitUntil(caches.keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('jf-shell-')).map(k => caches.delete(k))))
            .then(() => self.registration.unregister()));
        return;
    }
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('jf-shell-') && k !== SHELL_CACHE).map(k => caches.delete(k))))
        // The bundles of an older build (another ?hash) are not asked for again
        .then(() => caches.open(SHELL_CACHE))
        .then(async cache => {
            for (const key of await cache.keys()) {
                const url = new URL(key.url);
                if (url.search && !isVersioned(url)) await cache.delete(key);
            }
        })
        .then(() => self.clients.claim()));
});

/** The page lists the files it loaded before this worker was in charge; the app files missing are kept. */
self.addEventListener('message', event => {
    // Only pages of this app, and never inside an app's web view
    if (IN_APP_WEB_VIEW || event.origin !== self.location.origin) return;
    if (event.data?.type !== 'jf-keep' || !Array.isArray(event.data.urls)) return;
    event.waitUntil(caches.open(SHELL_CACHE).then(async cache => {
        for (const href of event.data.urls) {
            let url;
            try {
                url = new URL(href);
            } catch {
                continue;
            }
            const request = new Request(url.href);
            if (!isAppFile(request, url) || await cache.match(request)) continue;
            try {
                await keep(cache, request, await fetch(request));
            } catch {
                // Not reachable now: it is kept the next time it is loaded
            }
        }
    }));
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (IN_APP_WEB_VIEW || !isAppFile(request, url)) return;
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, toUrl('')));
    } else if (isVersioned(url)) {
        event.respondWith(cacheFirst(request));
    } else {
        event.respondWith(networkFirst(request, request));
    }
});
/* eslint-enable no-restricted-globals, compat/compat */
