/**
 * The floating bar with the remote (TV layout). The bar is at the bottom of the screen, over the page:
 *  - down when there is nothing further down on the page reaches it (on the button of the page on screen);
 *  - left / right go through its buttons; up goes back to where the focus was on the page;
 *  - Back on the home screen goes to it as well (see appRouter.handleBack), so it is one key away from anywhere.
 */
import layoutManager from 'components/layoutManager';
import { scrollBehavior } from 'utils/reducedMotion';

const BAR_SELECTOR = 'nav[data-bottom-bar]';
const BUTTONS = 'button:not([disabled]), a[href]';

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
 * What is on screen just above the bar, closest to the focused button: where up goes when the element the focus
 * came from is no longer there (the page drew that row again).
 */
const justAboveBar = (from: HTMLElement) => {
    const barTop = bar()?.getBoundingClientRect().top ?? window.innerHeight;
    const fromRect = from.getBoundingClientRect();
    const fromX = fromRect.left + fromRect.width / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')) {
        if (isInBottomBar(el) || !el.getClientRects().length) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > barTop || r.top < 0 || r.width === 0) continue;
        // Closest to the bar first, then closest sideways
        const score = (barTop - r.bottom) * 4 + Math.abs(r.left + r.width / 2 - fromX);
        if (score < bestScore) {
            bestScore = score;
            best = el;
        }
    }
    return best;
};

/** Back to the page, where the focus was before going to the bar. */
const leaveBottomBar = (from: HTMLElement) => {
    const target = returnTo?.isConnected && returnTo.getClientRects().length ? returnTo : justAboveBar(from);
    returnTo = null;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: scrollBehavior() });
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
        // In the bar the keys are its own: through its buttons, up back to the page, nothing further down
        const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
        if (e.key in steps) moveInBar(active, steps[e.key]);
        else if (e.key === 'ArrowUp') leaveBottomBar(active);
        else if (e.key !== 'ArrowDown') return;
        e.preventDefault();
        // The rows of the page listen on the window too: they must not move the focus as well
        e.stopImmediatePropagation();
        return;
    }

    if (e.key !== 'ArrowDown') return;
    // Down: when the page's own navigation finds nothing below (the focus stays put), the bar is next
    const before = active;
    window.setTimeout(() => {
        if (document.activeElement === before && !dialogOpen()) focusBottomBar();
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
