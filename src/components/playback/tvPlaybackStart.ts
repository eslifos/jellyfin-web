/**
 * TV: from Play until the screen of the video opens, the remote is held. In those seconds (the server is asked, the
 * stream loads) the screen it was started from is still there, under the loading spinner or the black of the player,
 * and its keys would act on it: OK on its Play button would start the video again; left would open the TV menu, and
 * OK there leave the video playing in the background, minimized.
 *
 * Back in those seconds cancels the start (appRouter.handleBack): it neither goes to the screen before nor leaves the
 * app while the player is about to open its screen (that race left the app on a blank screen with the video paused,
 * or closed it from the home screen). The video screen stops it as it opens (cancelledOnOpen).
 */
import layoutManager from 'components/layoutManager';

/** The keys of the remote that act on what has the focus. */
const REMOTE_KEYS = [ 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ];
/** Longer than any start: past it the remote is free whatever happened. */
const MAX_START_MS = 30000;
/** What is over the screen while a video starts: the loading spinner, then the player before its screen opens. */
const STARTING_SELECTOR = '.docspinner.mdlSpinnerActive, .videoPlayerContainer-onTop';

let startedAt = 0;
let cancelled = false;

/** Whether the remote is held now: a start under way, still loading over the screen it was started from. */
export const isStartingPlayback = () => {
    if (!startedAt) return false;
    // A start that ended without the screen of the video (an error, another player): free again
    if (Date.now() - startedAt > MAX_START_MS || !document.querySelector(STARTING_SELECTOR)) {
        startedAt = 0;
        cancelled = false;
    }
    return startedAt > 0;
};

/** Play on TV, fullscreen. */
export const startingPlayback = () => {
    if (!layoutManager.tv) return;
    startedAt = Date.now();
    cancelled = false;
};

/** Back while it starts: the video goes as soon as its screen opens; the keys stay held until then. */
export const cancelStartingPlayback = () => {
    cancelled = true;
};

/** The screen of the video is open: the remote is its own. Returns whether Back cancelled the start meanwhile. */
export const playbackScreenOpen = () => {
    const wasCancelled = cancelled && startedAt > 0;
    startedAt = 0;
    cancelled = false;
    return wasCancelled;
};

// Capture on the window, from the start of the app: before the screens and the TV menu see the key
window.addEventListener('keydown', e => {
    if (REMOTE_KEYS.includes(e.key) && isStartingPlayback()) {
        e.preventDefault();
        e.stopImmediatePropagation();
    }
}, true);
