/**
 * Remote control on the TV layout, by rows (the home screen and the Cosmic library pages):
 *  - up / down go to the previous / next row, in the order they are on screen (banner → library menu → each row),
 *    back to the card last focused in that row (the first one the first time);
 *  - left / right go through the row, one item at a time, and stop at its ends;
 *  - the focused item is always scrolled into view (the row sideways, the page up and down).
 * A row is any element marked with data-focus-row; its items are the links and buttons in it, in order, with the
 * links of its header (e.g. "See all") last. Rows still waiting to be drawn below are brought in by scrolling.
 * Anything else (dialogs, text fields, the pages without rows) keeps the usual navigation.
 */
import { type RefObject, useEffect } from 'react';

import layoutManager from 'components/layoutManager';
import { scrollBehavior } from 'utils/reducedMotion';

export const ROW_ATTRIBUTE = 'data-focus-row';
const ROW_SELECTOR = `[${ROW_ATTRIBUTE}]`;
const ITEM_SELECTOR = 'a[href], button:not([disabled]), [tabindex="0"]';
/** Scroll buttons of a row are for the mouse. */
const NOT_ITEMS = '.qh-arrow, [tabindex="-1"], [aria-hidden="true"]';
const HEADERS = '.qh-row-head, .qh-block-head';
/** How long to wait for a row drawn after scrolling to it. */
const LOAD_WAIT_MS = 1500;

type Direction = 'up' | 'down' | 'left' | 'right';

const DIRECTIONS: Record<string, Direction> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right'
};

const isShown = (el: Element) => {
    if (!(el instanceof HTMLElement) || !el.getClientRects().length) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
};

/** The items of a row, in order: the content first, the links of the header last. */
export const rowItems = (row: Element): HTMLElement[] => {
    const all = [ ...row.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ]
        .filter(el => el.closest(ROW_SELECTOR) === row && !el.matches(NOT_ITEMS) && isShown(el));
    const inHeader = (el: HTMLElement) => !!el.closest(HEADERS);
    return [ ...all.filter(el => !inHeader(el)), ...all.filter(inHeader) ];
};

/** The rows with something to focus, in the order of the page. */
export const pageRows = (root: Element) => [ ...root.querySelectorAll(ROW_SELECTOR) ].filter(row => rowItems(row).length > 0);

const isTextField = (el: Element) => el instanceof HTMLInputElement && ![ 'button', 'checkbox', 'radio', 'submit', 'reset' ].includes(el.type)
    || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable;

const dialogOpen = () => !!document.querySelector('.dialogContainer .dialog.opened, [role="dialog"], [role="menu"], .MuiPopover-root');

export const useTvRows = (rootRef: RefObject<HTMLElement>) => {
    useEffect(() => {
        if (!layoutManager.tv) return;
        const remembered = new WeakMap<Element, HTMLElement>();
        let waiting = false;

        const show = (row: Element, item: HTMLElement, first: boolean) => {
            item.focus({ preventScroll: true });
            const behavior = scrollBehavior();
            // The first row (the banner) shows the top of the page; any other row goes to the middle of the screen
            if (first) window.scrollTo({ top: 0, behavior });
            item.scrollIntoView({ block: first ? 'nearest' : 'center', inline: 'nearest', behavior });
        };

        const enterRow = (row: Element, rows: Element[]) => {
            const items = rowItems(row);
            const last = remembered.get(row);
            show(row, last && last.isConnected && items.includes(last) ? last : items[0], rows[0] === row);
        };

        /** Rows still to be drawn below: scroll to the next one and go into it once it has something. */
        const bringNextRow = (root: HTMLElement, from: Element) => {
            const pending = [ ...root.querySelectorAll('.qh-placeholder') ]
                .find(p => from.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);
            if (!pending) return false;
            waiting = true;
            pending.scrollIntoView({ block: 'center', behavior: 'auto' });
            const started = Date.now();
            const poll = () => {
                const rows = pageRows(root);
                const next = rows[rows.indexOf(from) + 1];
                if (next) {
                    waiting = false;
                    enterRow(next, rows);
                } else if (Date.now() - started < LOAD_WAIT_MS) {
                    window.setTimeout(poll, 100);
                } else {
                    waiting = false;
                }
            };
            poll();
            return true;
        };

        /** Left / right: the next item of the row; its ends keep the focus where it is. */
        const moveInRow = (row: Element, rows: Element[], active: HTMLElement | null, direction: Direction) => {
            const items = rowItems(row);
            const index = items.findIndex(el => el === active || (!!active && el.contains(active)));
            const target = items[index + (direction === 'right' ? 1 : -1)];
            if (target) show(row, target, rows[0] === row);
        };

        /**
         * Up / down: the next row. Returns false when there is none in the page (above the first row, below the
         * last one): then the app's usual navigation takes the key (the header of the app, the bar at the bottom).
         */
        const moveToRow = (root: HTMLElement, row: Element, rows: Element[], direction: Direction) => {
            const target = rows[rows.indexOf(row) + (direction === 'down' ? 1 : -1)];
            if (target) {
                enterRow(target, rows);
                return true;
            }
            return direction === 'down' && bringNextRow(root, row);
        };

        /** The page on screen (hidden pages stay in the document); its root changes once it has loaded. */
        const activeRoot = () => {
            const root = rootRef.current;
            return root && isShown(root) && !dialogOpen() ? root : null;
        };

        const onKeyDown = (e: KeyboardEvent) => {
            const direction = DIRECTIONS[e.key];
            if (!direction || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            const root = activeRoot();
            const active = document.activeElement as HTMLElement | null;
            if (!root || (active && isTextField(active))) return;
            const rows = pageRows(root);
            if (!rows.length) return;
            const row = active?.closest(ROW_SELECTOR);

            if (!row || !root.contains(row)) {
                // Focus lost (on nothing): back to the first row; anywhere else, the usual navigation
                if (active && active !== document.body) return;
                e.preventDefault();
                enterRow(rows[0], rows);
                return;
            }

            if (waiting) {
                e.preventDefault();
            } else if (direction === 'left' || direction === 'right') {
                e.preventDefault();
                moveInRow(row, rows, active, direction);
            } else if (moveToRow(root, row, rows, direction)) {
                e.preventDefault();
            }
        };

        const onFocusIn = (e: FocusEvent) => {
            const root = rootRef.current;
            const target = e.target as HTMLElement;
            const row = target?.closest?.(ROW_SELECTOR);
            if (!root || !row || !root.contains(row)) return;
            const item = rowItems(row).find(el => el === target || el.contains(target));
            if (item) remembered.set(row, item);
        };

        // Before the app's own navigation (it listens on the window too, later)
        window.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('focusin', onFocusIn);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('focusin', onFocusIn);
        };
    }, [ rootRef ]);
};
