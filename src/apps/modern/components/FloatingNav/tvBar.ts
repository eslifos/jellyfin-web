/**
 * The bar of options with the remote (TV layout). On a TV the bar is a rail fixed on the right of the screen, only
 * icons until the focus goes into it (then it widens with the names, see FloatingNav):
 *  - right when there is nothing further right on the page reaches it (on the button of the page on screen);
 *  - up / down go through its buttons; left, right or Back close it and give the focus back to where it was;
 *  - Back on the home screen goes to it as well (see appRouter.handleBack), so it is one key away from anywhere;
 *  - going to another screen closes it (and the libraries rail): the focus goes to that screen.
 */
import { autoFocus } from 'components/autoFocuser';
import layoutManager from 'components/layoutManager';
import { scrollBehavior } from 'utils/reducedMotion';

const BAR_SELECTOR = 'nav[data-bottom-bar]';
/** Its buttons the remote goes through (not the ones kept out of reach, tabindex -1, like the scans indicator). */
const BUTTONS = 'button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"])';
const ARROWS = [ 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight' ];

/** Where the focus was on the page before going to the bar. */
let returnTo: HTMLElement | null = null;

const bar = () => document.querySelector<HTMLElement>(BAR_SELECTOR);

const barButtons = () => [ ...(bar()?.querySelectorAll<HTMLElement>(BUTTONS) ?? []) ].filter(b => b.getClientRects().length > 0);

export const isInBottomBar = (el: Element | null) => !!el?.closest?.(BAR_SELECTOR);

const isTextField = (el: Element) => el instanceof HTMLInputElement && ![ 'button', 'checkbox', 'radio', 'submit', 'reset' ].includes(el.type)
    || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable;

/** A dialog or menu on screen (the modern app keeps some mounted and hidden: those do not count). */
const dialogOpen = () => [ ...document.querySelectorAll('.dialogContainer .dialog.opened, [role="dialog"], [role="menu"], .MuiPopover-root') ]
    .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');

/** Puts the focus on the bar, on the button of the page on screen; `from` is where it goes back to (else the focus now). */
export const focusBottomBar = (from?: HTMLElement | null) => {
    const buttons = barButtons();
    if (!buttons.length) return false;
    const active = from ?? document.activeElement as HTMLElement | null;
    if (active && active !== document.body && !isInBottomBar(active)) returnTo = active;
    (buttons.find(b => b.getAttribute('aria-current') === 'page') ?? buttons[0]).focus();
    return true;
};

/**
 * What is on screen just left of the bar, at the height of the focused button: where left goes when the element the
 * focus came from is no longer there (the page drew it again).
 */
const besideBar = (from: HTMLElement) => {
    const barLeft = bar()?.getBoundingClientRect().left ?? window.innerWidth;
    const fromRect = from.getBoundingClientRect();
    const fromY = fromRect.top + fromRect.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')) {
        if (isInBottomBar(el) || el.closest('[data-tv-rail]') || !el.getClientRects().length) continue;
        const r = el.getBoundingClientRect();
        if (r.right > barLeft || r.top < 0 || r.bottom > window.innerHeight || r.width === 0) continue;
        // Closest to the bar first, then closest in height
        const score = (barLeft - r.right) * 4 + Math.abs(r.top + r.height / 2 - fromY);
        if (score < bestScore) {
            bestScore = score;
            best = el;
        }
    }
    return best;
};

/** Back to the page, where the focus was before going to the bar. */
const leaveBottomBar = (from: HTMLElement) => {
    const target = returnTo?.isConnected && returnTo.getClientRects().length ? returnTo : besideBar(from);
    returnTo = null;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: scrollBehavior() });
};

const moveInBar = (active: HTMLElement, step: number) => {
    const buttons = barButtons();
    const index = buttons.findIndex(b => b === active || b.contains(active));
    buttons[index + step]?.focus();
};

const onKeyDown = (e: KeyboardEvent) => {
    if (!layoutManager.tv || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || dialogOpen()) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && isTextField(active)) return;

    if (active && isInBottomBar(active)) {
        // In the bar the keys are its own: through its buttons; sideways, back to the page
        const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };
        if (e.key in steps) moveInBar(active, steps[e.key]);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') leaveBottomBar(active);
        else return;
        e.preventDefault();
        // The rows of the page listen on the window too: they must not move the focus as well
        e.stopImmediatePropagation();
        return;
    }

    if (!ARROWS.includes(e.key)) return;
    const before = active;
    window.setTimeout(() => {
        if (dialogOpen()) return;
        if (e.key === 'ArrowRight') {
            // Right: when the page's own navigation finds nothing further right (the focus stays put), the bar is next;
            // when it went into the bar by itself (the bar is the nearest thing that way), on the button of the screen,
            // and in both cases left / Back come back to where the focus was
            if (document.activeElement === before || (before && !isInBottomBar(before) && isInBottomBar(document.activeElement))) {
                focusBottomBar(before);
            }
        } else if (before && before !== document.body && isInBottomBar(document.activeElement)) {
            // Only right goes into the bar: up or down near the right edge (where the bar is "below") stays put
            before.focus({ preventScroll: true });
        }
    }, 0);
};

/** Back with the focus in the bar: it closes, the focus back on the page. Returns whether it was there. */
export const leaveBottomBarIfIn = () => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || !isInBottomBar(active)) return false;
    leaveBottomBar(active);
    return true;
};

/** The screen on view (the one left behind may still be in the document, hidden, while the new one comes in). */
const currentScreen = () => [ ...document.querySelectorAll<HTMLElement>('.mainAnimatedPage') ]
    .filter(page => !page.classList.contains('hide') && page.getClientRects().length > 0)
    .pop() ?? null;

/** How long a new screen may take to draw something to focus. */
const NEW_SCREEN_WAIT_MS = 8000;
/** After this, with still nothing to focus in the screen, its open tab gets the focus. */
const TABS_AFTER_MS = 1500;

/**
 * Another screen opened from the bar or the libraries rail: they close (the focus leaves them) and the focus goes to
 * the new screen, on its first useful element (autoFocuser), once it has drawn something to focus. A screen opened
 * from the page itself (a card, Back) gets it the same way once the focus is lost with the screen it was on, and so
 * does one that opens with the focus on nothing (loaded as it is).
 */
export const focusNewScreen = () => {
    if (!layoutManager.tv) return;
    const active = document.activeElement as HTMLElement | null;
    const fromSide = !!active && (isInBottomBar(active) || !!active.closest('[data-tv-rail]'));
    if (fromSide) {
        returnTo = null;
        active.blur();
    }
    /** The focus on nothing, or on something no longer on screen (in the screen that was left). */
    const lost = (el: Element | null) => !el || el === document.body || !el.isConnected || !el.getClientRects().length;
    const started = Date.now();
    const tryFocus = () => {
        const focused = document.activeElement;
        const waitMore = Date.now() - started < NEW_SCREEN_WAIT_MS;
        if (!lost(focused)) {
            // Something took it in the new screen (a dialog, the page itself); else it is still on the element of the
            // screen left behind, about to go: wait for it
            if (focused === active && !fromSide && waitMore) window.setTimeout(tryFocus, 150);
            return;
        }
        const screen = currentScreen();
        // Pages by rows put the focus on their first row themselves, once it is drawn (useTvRows)
        if (!fromSide && screen?.querySelector('[data-focus-row]')) return;
        if (screen) autoFocus(screen);
        // A screen with nothing to focus yet (or ever, like an empty live TV) but its tabs above: the open tab
        if (lost(document.activeElement) && Date.now() - started > TABS_AFTER_MS) {
            document.querySelector<HTMLElement>('[role="tablist"] [role="tab"][aria-selected="true"]')?.focus();
        }
        if (lost(document.activeElement) && waitMore) window.setTimeout(tryFocus, 150);
    };
    window.setTimeout(tryFocus, 150);
};

let installed = false;

/** Once, for the whole app (it only acts on the TV layout). */
export const installTvBottomBar = () => {
    if (installed) return;
    installed = true;
    // Capture: before the page's own navigation, so the keys pressed in the bar stay in the bar
    window.addEventListener('keydown', onKeyDown, true);
};
