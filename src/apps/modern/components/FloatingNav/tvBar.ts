/**
 * The bar of options with the remote (TV layout). On a TV the bar is a rail fixed on the right of the screen, only
 * icons until the focus goes into it (then it widens with the names, see FloatingNav):
 *  - right when there is nothing further right on the page reaches it (on the button of the page on screen);
 *  - up / down go through its buttons; left goes back to the page, where the focus was;
 *  - Back on the home screen goes to it as well (see appRouter.handleBack), so it is one key away from anywhere.
 */
import layoutManager from 'components/layoutManager';
import { scrollBehavior } from 'utils/reducedMotion';

const BAR_SELECTOR = 'nav[data-bottom-bar]';
const BUTTONS = 'button:not([disabled]), a[href]';
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

/** Puts the focus on the bar, on the button of the page on screen. */
export const focusBottomBar = () => {
    const buttons = barButtons();
    if (!buttons.length) return false;
    const active = document.activeElement as HTMLElement | null;
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
        // In the bar the keys are its own: through its buttons, left back to the page, nothing further right
        const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };
        if (e.key in steps) moveInBar(active, steps[e.key]);
        else if (e.key === 'ArrowLeft') leaveBottomBar(active);
        else if (e.key !== 'ArrowRight') return;
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
            // Right: when the page's own navigation finds nothing further right (the focus stays put), the bar is next
            if (document.activeElement === before) focusBottomBar();
        } else if (before && before !== document.body && isInBottomBar(document.activeElement)) {
            // Only right goes into the bar: up or down near the right edge (where the bar is "below") stays put
            before.focus({ preventScroll: true });
        }
    }, 0);
};

let installed = false;

/** Once, for the whole app (it only acts on the TV layout). */
export const installTvBottomBar = () => {
    if (installed) return;
    installed = true;
    // Capture: before the page's own navigation, so the keys pressed in the bar stay in the bar
    window.addEventListener('keydown', onKeyDown, true);
};
