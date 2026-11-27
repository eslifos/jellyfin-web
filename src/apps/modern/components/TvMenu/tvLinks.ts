/**
 * TV: the programs of the Android TV home screen ("Watch next" and the Jellyfin Cosmic channel) open the app with a
 * link that the TV app keeps until the web takes it (NativeInterface.takePendingLink): "play/<id>" plays the item
 * (from where it was left) and "details/<id>" opens its details. The TV app fires "cosmictvlink" when one arrives
 * with the app already open.
 */
import { playbackManager } from 'components/playback/playbackmanager';
import { appRouter } from 'components/router/appRouter';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { markProfilePickerShown } from 'utils/profiles';

import { parseTvLink } from './tvLinkParse';

export const TV_LINK_EVENT = 'cosmictvlink';

interface NativeLinks {
    takePendingLink?: () => string | null;
}

const takePendingLink = () => {
    const native = (window as unknown as { NativeInterface?: NativeLinks }).NativeInterface;
    try {
        return native?.takePendingLink?.() ?? null;
    } catch {
        return null;
    }
};

/** Longest wait for the screen the app opened on, at a cold start. */
const SETTLE_MAX_MS = 10000;
/** Once it has drawn, a moment more: its own navigation (focus, replaced address) is done. */
const SETTLE_AFTER_MS = 1200;

/**
 * Resolves once the screen on view has drawn its content (a cold start opens the app on its home screen first; a
 * video started meanwhile was left minimized when that screen finished opening).
 */
const screenSettled = () => new Promise<void>(resolve => {
    const started = Date.now();
    const check = () => {
        const page = [ ...document.querySelectorAll('.mainAnimatedPage') ].find(p => !p.classList.contains('hide'));
        const drawn = !!page && !page.querySelector('.qh-loading, [aria-busy="true"]') && !document.querySelector('.docspinner.mdlSpinnerActive');
        if (drawn || Date.now() - started > SETTLE_MAX_MS) {
            window.setTimeout(resolve, SETTLE_AFTER_MS);
            return;
        }
        window.setTimeout(check, 200);
    };
    check();
});

/** Opens the link waiting in the TV app, if there is one. */
export const openPendingTvLink = async () => {
    const link = parseTvLink(takePendingLink());
    if (!link) return;
    // Opened to watch something: "Who is watching?" is not asked on the way
    markProfilePickerShown();
    await screenSettled();
    const apiClient = ServerConnections.currentApiClient();
    if (!apiClient) return;
    if (link.action === 'details') {
        await appRouter.showItem(link.id, apiClient.serverId());
        return;
    }
    const item = await apiClient.getItem(apiClient.getCurrentUserId(), link.id);
    await playbackManager.play({
        items: [ item ],
        serverId: apiClient.serverId(),
        startPositionTicks: item.UserData?.PlaybackPositionTicks || 0
    });
};
