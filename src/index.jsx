// Import legacy browser polyfills
import 'lib/legacy';

import React from 'react';
import { createRoot } from 'react-dom/client';

// NOTE: We need to import this first to initialize the connection
import { ServerConnections } from 'lib/jellyfin-apiclient';

import { appHost } from './components/apphost';
import autoFocuser from './components/autoFocuser';
import loading from 'components/loading/loading';
import { pluginManager } from './components/pluginManager';
import { appRouter } from './components/router/appRouter';
import { AppFeature } from 'constants/appFeature';
import { EventType } from 'constants/eventType';
import globalize from './lib/globalize';
import { loadCoreDictionary } from 'lib/globalize/loader';
import getServerAddress from 'lib/jellyfin-apiclient/utils/getServerAddress';
import { initialize as initializeAutoCast } from 'scripts/autocast';
import browser from './scripts/browser';
import keyboardNavigation from './scripts/keyboardNavigation';
import { installTvModals } from './scripts/tvModals';
import { getPlugins } from './scripts/settings/webSettings';
import taskButton from './scripts/taskbutton';
import { pageClassOn, serverAddress } from './utils/dashboard';
import Events from './utils/events';
import { updateApiClientSdk } from 'utils/jellyfin-apiclient/compat';
import { initCustomLogo } from 'utils/customLogo';
import { initializeServerConnections } from './scripts/serverNotifications';
import { ensureServerReachable, serverLabel, startBootWatchdog } from 'components/connection/bootCheck';
import layoutManager from 'components/layoutManager';
import { startConnectionMonitor } from 'utils/connection/monitor';
import { queryClient } from 'utils/query/queryClient';

import RootApp from './RootApp';

// Import the button webcomponent for use throughout the site
// NOTE: This is a bit of a hack, files should ensure the component is imported before use
import './elements/emby-button/emby-button';

// Import auto-running components
// NOTE: This is an anti-pattern
import './components/playback/displayMirrorManager';
import './components/playback/playerSelectionMenu';
import './components/themeMediaPlayer';
import './scripts/mouseManager';
import './scripts/screensavermanager';

// Import site styles
import './styles/site.scss';
import './styles/livetv.scss';
import './styles/dashboard.scss';
import './styles/detailtable.scss';
import './styles/librarybrowser.scss';

/** Enough room to list every file the first page loads (with its images) for the service worker. */
const RESOURCE_TIMING_ENTRIES = 1500;

async function init() {
    // First of all, inside an app's web view: no service worker in the way of the next opening
    if (isInAppWebView()) removeServiceWorker();

    if (typeof performance.setResourceTimingBufferSize === 'function') {
        performance.setResourceTimingBufferSize(RESOURCE_TIMING_ENTRIES);
    }

    // Log current version to console to help out with issue triage and debugging
    console.info(
        `[${__PACKAGE_JSON_NAME__}]
version: ${__PACKAGE_JSON_VERSION__}
commit: ${__COMMIT_SHA__}
build: ${__JF_BUILD_VERSION__}`);

    // Register globals used in plugins
    window.Events = Events;
    window.TaskButton = taskButton;

    // Register handlers to update header classes
    pageClassOn('viewshow', 'standalonePage', function () {
        document.querySelector('.skinHeader')?.classList.add('noHeaderRight');
    });
    pageClassOn('viewhide', 'standalonePage', function () {
        document.querySelector('.skinHeader')?.classList.remove('noHeaderRight');
    });

    // Nothing waits forever behind the logo: after 15 s a message says what is going on
    const lastServer = ServerConnections.getLastUsedServer();
    let serverUrl;
    const bootServer = () => ({ serverUrl, serverName: serverLabel(serverUrl, lastServer?.Name) });
    const stopWatchdog = startBootWatchdog(bootServer, loadCoreDictionary);

    // Whether the device has network and the server answers, for the whole app; when it comes back, data is
    // asked again
    startConnectionMonitor({
        serverAddress: () => ServerConnections.currentApiClient()?.serverAddress() ?? serverUrl,
        onRestored: () => {
            void queryClient.invalidateQueries();
        }
    });

    // Initialize app host
    await appHost.init();

    // Find the correct server URL
    if (lastServer) {
        serverUrl = getServerAddress(lastServer);
    } else {
        serverUrl = await serverAddress();
    }
    // Initialize the api client
    if (serverUrl) ServerConnections.initApiClient(serverUrl);

    // Load the custom branding logo (if any) as early as possible
    initCustomLogo(serverUrl);

    // Initialize automatic (default) cast target
    initializeAutoCast();

    // Load the translation dictionary
    await loadCoreDictionary();
    // Update localization on user changes
    Events.on(ServerConnections, 'localusersignedin', globalize.updateCurrentCulture);
    Events.on(ServerConnections, 'localusersignedout', globalize.updateCurrentCulture);
    // Update sdk language on language changes
    Events.on(document, EventType.LANGUAGE_CHANGE, () => {
        ServerConnections.getCurrentApiClientAsync()
            .then(updateApiClientSdk)
            .catch(err => {
                console.error('Failed to update ApiClient SDK on language change', err);
            });
    });

    // Load the font styles
    loadFonts();

    // Load iOS specific styles
    if (browser.iOS) {
        import('./styles/ios.scss');
    }

    // Load frontend plugins
    await loadPlugins();

    // Register API request error handlers
    ServerConnections.getApiClients().forEach(apiClient => {
        Events.off(apiClient, 'requestfail', appRouter.onRequestFail);
        Events.on(apiClient, 'requestfail', appRouter.onRequestFail);
    });
    Events.on(ServerConnections, 'apiclientcreated', (_e, apiClient) => {
        Events.off(apiClient, 'requestfail', appRouter.onRequestFail);
        Events.on(apiClient, 'requestfail', appRouter.onRequestFail);
    });

    // Start server notifications
    initializeServerConnections();

    // The server must answer before the app opens (or the device has downloads to open without it)
    stopWatchdog();
    const reach = await ensureServerReachable({
        ...bootServer(),
        canOpenOffline: async () => {
            if (!layoutManager.modern) return false;
            const { hasOfflineDownloads } = await import('apps/modern/features/downloads/offline');
            return hasOfflineDownloads();
        }
    });
    if (reach === 'changeServer') {
        // The list of servers opens without trying the one that does not answer again
        ServerConnections.firstConnection = true;
        window.location.hash = '#/selectserver';
    }

    // Render the app
    await renderApp();

    // Load platform specific features
    loadPlatformFeatures();

    // Enable navigation controls
    keyboardNavigation.enable();
    installTvModals();
    autoFocuser.enable();
}

function loadFonts() {
    if (browser.tv && !browser.android) {
        console.debug('using system fonts with explicit sizes');
        import('./styles/fonts.sized.scss');
    } else if (__USE_SYSTEM_FONTS__) {
        console.debug('using system fonts');
        import('./styles/fonts.scss');
    } else {
        console.debug('using default fonts');
        import('./styles/fonts.scss');
        import('./styles/fonts.noto.scss');
    }
}

async function loadPlugins() {
    console.groupCollapsed('loading installed plugins');
    console.dir(pluginManager);

    let list = await getPlugins();
    if (!appHost.supports(AppFeature.RemoteControl)) {
        // Disable remote player plugins if not supported
        list = list.filter(plugin => !plugin.startsWith('sessionPlayer')
            && !plugin.startsWith('chromecastPlayer'));
    } else if (!browser.chrome && !browser.edgeChromium && !browser.opera) {
        // Disable chromecast player in unsupported browsers
        list = list.filter(plugin => !plugin.startsWith('chromecastPlayer'));
    }

    // add any native plugins
    if (window.NativeShell) {
        list = list.concat(window.NativeShell.getPlugins());
    }

    try {
        await Promise.all(list.map(plugin => pluginManager.loadPlugin(plugin)));
        console.debug('finished loading plugins');
    } catch (e) {
        console.warn('failed loading plugins', e);
    }

    console.groupEnd('loading installed plugins');
}

function loadPlatformFeatures() {
    if (appHost.supports(AppFeature.RemoteControl)) {
        import('./components/playback/playerSelectionMenu');
        import('./components/playback/remotecontrolautoplay');
    }

    if (!appHost.supports(AppFeature.PhysicalVolumeControl) || browser.touch) {
        import('./components/playback/volumeosd');
    }

    if (!browser.tv && !browser.xboxOne) {
        import('./components/playback/playbackorientation');
        registerServiceWorker();

        if (window.Notification) {
            import('./components/notifications/notifications');
        }
    }
}

/**
 * Inside the web view of an app (the Android app marks it with "wv", and adds its NativeShell) the app must see
 * every request to know the web client started: a service worker would answer them unseen.
 */
const isInAppWebView = () => /;\s*wv\)/.test(navigator.userAgent) || !!window.NativeShell;

/** A service worker registered before stays until removed: remove it, with what it kept. */
function removeServiceWorker() {
    if (!navigator.serviceWorker || typeof caches === 'undefined') return;
    /* eslint-disable compat/compat -- both checked just above */
    navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(r => r.unregister())))
        .then(() => caches.keys())
        .then(keys => Promise.all(keys.filter(k => k.startsWith('jf-shell-')).map(k => caches.delete(k))))
        .catch(() => undefined);
    /* eslint-enable compat/compat */
}

function registerServiceWorker() {
    if (isInAppWebView()) return;
    if (navigator.serviceWorker && window.appMode !== 'cordova' && window.appMode !== 'android') {
        navigator.serviceWorker.register('serviceworker.js').then(() =>
            console.log('serviceWorker registered')
        ).catch(error =>
            console.log('error registering serviceWorker: ' + error)
        );
        // The files this page loaded before the service worker was in charge never went through it: it is told
        // which they are, so the screens already seen also open without connection
        navigator.serviceWorker.ready.then(registration => {
            registration.active?.postMessage({
                type: 'jf-keep',
                urls: performance.getEntriesByType('resource').map(entry => entry.name)
            });
        }).catch(() => undefined);
    } else {
        console.warn('serviceWorker unsupported');
    }
}

async function renderApp() {
    const container = document.getElementById('reactRoot');
    // Remove the splash logo
    container.innerHTML = '';

    loading.show();

    const root = createRoot(container);
    root.render(
        <RootApp />
    );
}

init();
