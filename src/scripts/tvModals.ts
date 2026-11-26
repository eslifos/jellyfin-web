/**
 * Menus and dialogs of the modern app with the remote (TV layout).
 *  - When one opens, the focus goes to its first option (the app puts it on the box, where the arrows do nothing),
 *    and the arrows stay inside it (it is marked as a focus container for the TV navigation).
 *  - Back closes the one on screen before anything else (see appRouter.handleBack).
 */
import layoutManager from 'components/layoutManager';

/** Dialogs and menus of Material UI, and the app's own ones marked for the remote (the search). */
const MODAL = '.MuiModal-root, [data-tv-modal]';
/** What can be chosen in a menu or dialog (not the invisible focus guards of the dialog, data-testid="sentinel…"). */
const OPTIONS = [ '[role="menuitem"]:not([aria-disabled="true"])', '[role="option"]', 'a[href]', 'button:not([disabled])', 'input', '[tabindex="0"]' ]
    .map(selector => `${selector}:not([data-testid^="sentinel"])`)
    .join(', ');

const isShown = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/** The menu or dialog on screen, the one opened last when there are several. */
export const openModal = () => [ ...document.querySelectorAll<HTMLElement>(MODAL) ].filter(isShown).pop() ?? null;

const isTextField = (el: Element) => el.matches('input:not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]');

/** Its first option; a button or item before a text field (that would bring up the keyboard of the TV on its own). */
const firstOption = (modal: HTMLElement) => {
    const options = [ ...modal.querySelectorAll<HTMLElement>(OPTIONS) ].filter(isShown);
    return options.find(el => !isTextField(el)) ?? options[0] ?? null;
};

/** Escape sent by closeOpenModal must not come back here as Back again (the TV layout maps Escape to Back). */
let closing = false;

export const isClosingModal = () => closing;

/** Closes the menu or dialog on screen, as Escape does. Returns whether there was one. */
export const closeOpenModal = () => {
    const modal = openModal();
    if (!modal) return false;
    if (closing) return true;
    const target = modal.contains(document.activeElement) ? document.activeElement as HTMLElement : modal;
    closing = true;
    try {
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    } finally {
        closing = false;
    }
    return true;
};

const onFocusIn = (e: FocusEvent) => {
    if (!layoutManager.tv) return;
    const target = e.target as HTMLElement | null;
    const modal = target?.closest?.<HTMLElement>(MODAL);
    if (!modal) return;
    // The arrows of the TV navigation stay inside it
    modal.classList.add('focuscontainer');
    // The box itself got the focus: on to its first option. Once the menu has finished opening, as it puts the focus
    // back on its box while it opens.
    if (target?.matches(OPTIONS)) return;
    for (const delay of [ 0, 150, 400 ]) {
        window.setTimeout(() => {
            const active = document.activeElement as HTMLElement | null;
            if (modal.isConnected && (!active || !active.matches(OPTIONS)) && (!active || modal.contains(active) || active === document.body)) {
                firstOption(modal)?.focus();
            }
        }, delay);
    }
};

let installed = false;

export const installTvModals = () => {
    if (installed) return;
    installed = true;
    document.addEventListener('focusin', onFocusIn);
};
