/**
 * The libraries rail with the remote (TV layout). The rail is fixed on the left of the screen, beside every page, only
 * icons until the focus goes into it (then it widens with the names, see HomeLibraryNav):
 *  - left when there is nothing further left on the page reaches it (on the library on screen);
 *  - up / down go through it;
 *  - right goes back to the page, where the focus was.
 */
import layoutManager from 'components/layoutManager';
import { scrollBehavior } from 'utils/reducedMotion';

export const RAIL_ATTRIBUTE = 'data-tv-rail';
const RAIL_SELECTOR = `[${RAIL_ATTRIBUTE}]`;
const ITEMS = 'a[href], button:not([disabled])';

let returnTo: HTMLElement | null = null;

const rail = () => document.querySelector<HTMLElement>(RAIL_SELECTOR);

const railItems = () => [ ...(rail()?.querySelectorAll<HTMLElement>(ITEMS) ?? []) ].filter(el => el.getClientRects().length > 0);

export const isInRail = (el: Element | null) => !!el?.closest?.(RAIL_SELECTOR);

const isTextField = (el: Element) => el instanceof HTMLInputElement && ![ 'button', 'checkbox', 'radio', 'submit', 'reset' ].includes(el.type)
    || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable;

const dialogOpen = () => [ ...document.querySelectorAll('.dialogContainer .dialog.opened, [role="dialog"], [role="menu"], .MuiPopover-root') ]
    .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');

/** Puts the focus on the rail, on the library on screen (or the first one). */
export const focusRail = () => {
    const items = railItems();
    if (!items.length) return false;
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && !isInRail(active)) returnTo = active;
    (items.find(el => el.getAttribute('aria-current') === 'page') ?? items[0]).focus();
    return true;
};

/** The first thing to focus in the page on screen, from the top: where right goes when there is nothing to return to. */
const firstInPage = () => {
    const page = [ ...document.querySelectorAll<HTMLElement>('.mainAnimatedPage') ].find(p => !p.classList.contains('hide') && p.getClientRects().length);
    return [ ...(page?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]') ?? []) ]
        .find(el => {
            if (!el.getClientRects().length) return false;
            const r = el.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0;
        }) ?? null;
};

const leaveRail = () => {
    const target = returnTo?.isConnected && returnTo.getClientRects().length ? returnTo : firstInPage();
    returnTo = null;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: scrollBehavior() });
};

const onKeyDown = (e: KeyboardEvent) => {
    if (!layoutManager.tv || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || dialogOpen()) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && isTextField(active)) return;

    if (active && isInRail(active)) {
        const items = railItems();
        const index = items.findIndex(el => el === active || el.contains(active));
        if (e.key === 'ArrowUp') {
            items[index - 1]?.focus();
        } else if (e.key === 'ArrowDown') {
            items[index + 1]?.focus();
        } else if (e.key === 'ArrowRight') {
            leaveRail();
        } else if (e.key !== 'ArrowLeft') {
            return;
        }
        e.preventDefault();
        // The rows of the page listen on the window too: they must not move the focus as well
        e.stopImmediatePropagation();
        return;
    }

    if (![ 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight' ].includes(e.key)) return;
    const before = active;
    window.setTimeout(() => {
        if (dialogOpen()) return;
        if (e.key === 'ArrowLeft') {
            // Left: when the page's own navigation finds nothing further left (the focus stays put), the rail is next
            if (document.activeElement === before) focusRail();
        } else if (before && before !== document.body && isInRail(document.activeElement)) {
            // Only left goes into the rail: up from the top of the page (where the rail is "above") stays put
            before.focus({ preventScroll: true });
        }
    }, 0);
};

let installed = false;

/** Once, for the whole app (it only acts on the TV layout). */
export const installTvRail = () => {
    if (installed) return;
    installed = true;
    window.addEventListener('keydown', onKeyDown, true);
};
