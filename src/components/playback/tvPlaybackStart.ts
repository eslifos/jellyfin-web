/**
 * TV: from Play until the screen of the video opens, the remote is held. In those seconds (the server is asked, the
 * stream loads) the screen it was started from is still there, under the loading spinner or the black of the player,
 * and its keys would act on it: OK on its Play button would start the video again; left would open the TV menu, and
 * OK there leave the video playing in the background, minimized. Back stays free (it is not one of these keys).
 */
import layoutManager from 'components/layoutManager';

/** The keys of the remote that act on what has the focus. */
const REMOTE_KEYS = [ 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ];
/** Longer than any start: past it the remote is free whatever happened. */
const MAX_START_MS = 30000;
/** What is over the screen while a video starts: the loading spinner, then the player before its screen opens. */
const STARTING_SELECTOR = '.docspinner.mdlSpinnerActive, .videoPlayerContainer-onTop';

let startedAt = 0;

/** Whether the remote is held now: a start under way, still loading over the screen it was started from. */
export const isStartingPlayback = () => {
    if (!startedAt) return false;
    // A start that ended without the screen of the video (an error, another player): free again
    if (Date.now() - startedAt > MAX_START_MS || !document.querySelector(STARTING_SELECTOR)) startedAt = 0;
    return startedAt > 0;
};

/** Play on TV, fullscreen. */
export const startingPlayback = () => {
    if (layoutManager.tv) startedAt = Date.now();
};

/** The screen of the video is open: the remote is its own. */
export const playbackScreenOpen = () => {
    startedAt = 0;
};

// Capture on the window, from the start of the app: before the screens and the TV menu see the key
window.addEventListener('keydown', e => {
    if (REMOTE_KEYS.includes(e.key) && isStartingPlayback()) {
        e.preventDefault();
        e.stopImmediatePropagation();
    }
}, true);
