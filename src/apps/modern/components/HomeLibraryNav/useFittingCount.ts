/**
 * How many of the optional pieces at the end of the bar (the universes) fit next to the libraries without the
 * bar scrolling sideways. Every piece stays rendered: the ones that do not fit are marked data-fit="0" and taken
 * out of the flow (invisible), so they can still be measured when the window grows.
 */
import { type RefObject, useLayoutEffect, useState } from 'react';

/** Space between the pieces of the group (MUI gap 0.5). */
const GAP_PX = 4;

export const PIECE_SELECTOR = '[data-fit]';

const innerWidth = (el: HTMLElement) => {
    const style = getComputedStyle(el);
    return el.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
};

/**
 * @param barRef The bar (its parent is the space it may take).
 * @param total How many pieces there are.
 * @param enabled False to show them all (phones scroll sideways) or none matter (bar with icons only).
 * @param deps What changes the width of the rest of the bar (labels shown or not, libraries…).
 * @returns The number of pieces to show.
 */
export const useFittingCount = (barRef: RefObject<HTMLElement>, total: number, enabled: boolean, deps: readonly unknown[]) => {
    const [ count, setCount ] = useState(total);

    useLayoutEffect(() => {
        const bar = barRef.current;
        const host = bar?.parentElement;
        if (!enabled || !bar || !host) {
            setCount(total);
            return;
        }
        const measure = () => {
            const pieces = [ ...bar.querySelectorAll<HTMLElement>(PIECE_SELECTOR) ];
            const widths = pieces.map(p => p.offsetWidth + GAP_PX);
            const shownWidth = pieces.reduce((sum, p, i) => sum + (p.dataset.fit === '1' ? widths[i] : 0), 0);
            // The bar without any piece (its end padding is not part of scrollWidth), then the pieces while they fit
            let used = bar.scrollWidth + Number.parseFloat(getComputedStyle(bar).paddingRight) - shownWidth;
            const available = innerWidth(host);
            let fits = 0;
            while (fits < widths.length && used + widths[fits] <= available) {
                used += widths[fits];
                fits++;
            }
            setCount(fits);
        };
        measure();
        // The buttons grow with an animation when their names appear: measured again once it ends
        bar.addEventListener('transitionend', measure);
        // eslint-disable-next-line compat/compat -- checked before use
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(host);
        return () => {
            bar.removeEventListener('transitionend', measure);
            observer?.disconnect();
        };
    }, [ barRef, total, enabled, ...deps ]);

    return enabled ? count : total;
};
