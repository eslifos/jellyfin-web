/**
 * The TV menu with the remote. The menu is fixed on the left of every screen, only icons until the focus goes into
 * it (then it widens with the names and darkens the screen, see TvMenu):
 *  - left when there is nothing further left on the screen opens it, on the entry of the screen on view;
 *  - up / down go through it; right or Back close it and give the focus back to where it was;
 *  - Back on the home screen: first to the start of the row, then the menu; with the menu open, Back once more shows
 *    "Press Back again to exit" and only a second Back in those seconds leaves the app (see handleTvBack);
 *  - going to another screen closes it: the focus goes to that screen.
 */
import { autoFocus } from 'components/autoFocuser';
import { appHost } from 'components/apphost';
import layoutManager from 'components/layoutManager';
import toast from 'components/toast/toast';
import { AppFeature } from 'constants/appFeature';
import globalize from 'lib/globalize';
import { scrollBehavior } from 'utils/reducedMotion';

import { dialogOpen, ROW_ATTRIBUTE, rowItems } from '../QuickHome/useTvRows';

export const MENU_ATTRIBUTE = 'data-tv-menu';
const MENU_SELECTOR = `[${MENU_ATTRIBUTE}]`;
const ITEMS = 'a[href], button:not([disabled])';
/** How long "Press Back again to exit" stays, and a second Back leaves the app. */
const EXIT_WINDOW_MS = 3000;

/** Where the focus was on the screen before going to the menu. */
let returnTo: HTMLElement | null = null;
/** Until when a Back leaves the app (the message is on screen). */
let exitUntil = 0;

const menu = () => document.querySelector<HTMLElement>(MENU_SELECTOR);

const menuItems = () => [ ...(menu()?.querySelectorAll<HTMLElement>(ITEMS) ?? []) ].filter(el => el.getClientRects().length > 0);

export const isInTvMenu = (el: Element | null) => !!el?.closest?.(MENU_SELECTOR);

const isTextField = (el: Element) => el instanceof HTMLInputElement && ![ 'button', 'checkbox', 'radio', 'submit', 'reset' ].includes(el.type)
    || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable;

/** The screen on view (the one left behind may still be in the document, hidden, while the new one comes in). */
const currentScreen = () => [ ...document.querySelectorAll<HTMLElement>('.mainAnimatedPage') ]
    .filter(page => !page.classList.contains('hide') && page.getClientRects().length > 0)
    .pop() ?? null;

/** Opens the menu: the focus on the entry of the screen on view; `from` is where it goes back to (else the focus now). */
export const focusTvMenu = (from?: HTMLElement | null) => {
    const items = menuItems();
    if (!items.length) return false;
    const active = from ?? document.activeElement as HTMLElement | null;
    if (active && active !== document.body && !isInTvMenu(active)) returnTo = active;
    (items.find(el => el.getAttribute('aria-current') === 'page') ?? items[0]).focus();
    return true;
};

/** The first thing to focus on the screen, from the top: where the focus goes when there is nothing to return to. */
const firstOnScreen = () => [ ...(currentScreen()?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]') ?? []) ]
    .find(el => {
        if (!el.getClientRects().length) return false;
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0;
    }) ?? null;

/** Closes the menu: the focus back where it was on the screen. */
const leaveMenu = () => {
    const target = returnTo?.isConnected && returnTo.getClientRects().length ? returnTo : firstOnScreen();
    returnTo = null;
    exitUntil = 0;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: scrollBehavior() });
};

const onKeyDown = (e: KeyboardEvent) => {
    if (!layoutManager.tv || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || dialogOpen()) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && isTextField(active)) return;

    if (active && isInTvMenu(active)) {
        // In the menu the keys are its own: through its entries; right, back to the screen
        const items = menuItems();
        const index = items.findIndex(el => el === active || el.contains(active));
        if (e.key === 'ArrowUp') items[index - 1]?.focus();
        else if (e.key === 'ArrowDown') items[index + 1]?.focus();
        else if (e.key === 'ArrowRight') leaveMenu();
        else if (e.key !== 'ArrowLeft') return;
        e.preventDefault();
        // The rows of the screen listen on the window too: they must not move the focus as well
        e.stopImmediatePropagation();
        return;
    }

    const before = active;
    if (e.key !== 'ArrowLeft') return;
    // Left: when the screen's own navigation finds nothing further left (the focus stays put), the menu opens on the
    // entry of the screen (its entries are out of the focus order: nothing else reaches them)
    window.setTimeout(() => {
        if (!dialogOpen() && document.activeElement === before) focusTvMenu(before);
    }, 0);
};

/** The entry of the screen on view chosen: there is no other screen to go to, the menu just closes. */
export const closeTvMenu = () => {
    if (isInTvMenu(document.activeElement)) leaveMenu();
};

/** Back on the home screen, in a row but not on its first item: to the start of the row. */
const toRowStart = () => {
    const active = document.activeElement as HTMLElement | null;
    const row = active?.closest(`[${ROW_ATTRIBUTE}]`);
    if (!active || !row) return false;
    const first = rowItems(row)[0];
    if (!first || first === active || first.contains(active)) return false;
    first.focus({ preventScroll: true });
    first.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: scrollBehavior() });
    return true;
};

/**
 * Back with the remote, after the dialogs (appRouter.handleBack). Returns true when it was used here, false to leave
 * the app (a second Back with the message on screen), or null for the usual Back (the screen before).
 */
export const handleTvBack = (onStartPage: boolean): boolean | null => {
    if (isInTvMenu(document.activeElement)) {
        if (!onStartPage || !appHost.supports(AppFeature.Exit)) {
            leaveMenu();
            return true;
        }
        if (Date.now() < exitUntil) return false;
        exitUntil = Date.now() + EXIT_WINDOW_MS;
        toast({ text: globalize.translate('TvPressBackToExit') });
        return true;
    }
    if (!onStartPage) return null;
    return toRowStart() || focusTvMenu();
};

/** How long a new screen may take to draw something to focus. */
const NEW_SCREEN_WAIT_MS = 8000;
/** After this, with still nothing to focus in the screen (an empty live TV), its open tab gets the focus. */
const TABS_AFTER_MS = 2500;

/**
 * Another screen opened from the menu: it closes (the focus leaves it) and the focus goes to the new screen, on its
 * first useful element (autoFocuser), once it has drawn something to focus. A screen opened from the screen itself
 * (a card, Back) gets it the same way once the focus is lost with the screen it was on, and so does one that opens
 * with the focus on nothing (loaded as it is).
 */
export const focusNewScreen = () => {
    if (!layoutManager.tv) return;
    const active = document.activeElement as HTMLElement | null;
    const fromMenu = !!active && isInTvMenu(active);
    if (fromMenu) {
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
            // Something took it in the new screen (a dialog, the screen itself); else it is still on the element of
            // the screen left behind, about to go: wait for it
            if (focused === active && !fromMenu && waitMore) window.setTimeout(tryFocus, 150);
            return;
        }
        const screen = currentScreen();
        // Screens by rows put the focus on their first row themselves, once it is drawn (useTvRows)
        if (!fromMenu && screen?.querySelector(`[${ROW_ATTRIBUTE}]`)) return;
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
export const installTvMenu = () => {
    if (installed) return;
    installed = true;
    // Capture: before the screen's own navigation, so the keys pressed in the menu stay in the menu
    window.addEventListener('keydown', onKeyDown, true);
};
