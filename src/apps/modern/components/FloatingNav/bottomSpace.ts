/**
 * The floating bars at the bottom of the screen (the navigation pill, the small player) cover the end of the pages.
 * Each one tells how far it reaches from the bottom of the screen; every page then leaves that much room at its end
 * (--jf-bottom-bar-space, used in site.scss) plus a margin. The bottom offset of the bars already includes the
 * iPhone home indicator area (env(safe-area-inset-bottom)).
 *
 * On phones and tablets the navigation pill also goes away while scrolling down and comes back when scrolling up.
 */
import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';

const SPACE_VAR = '--jf-bottom-bar-space';
const HIDDEN_CLASS = 'jf-bottom-bar-hidden';
/** Room between the end of the page and the top of the highest bar. */
const MARGIN = 16;
/** How much has to be scrolled in one direction before the bar goes away or comes back. */
const SCROLL_STEP = 24;
/** Near the top of the page the bar always shows. */
const TOP_ZONE = 48;

/** How far each bar reaches from the bottom of the screen, in pixels. */
const parts = new Map<string, number>();
/** While the bar is away the room stays the same, so the end of the page does not jump. */
let frozen = false;

const apply = () => {
    if (frozen) return;
    const root = document.documentElement;
    if (!parts.size) {
        root.style.removeProperty(SPACE_VAR);
        return;
    }
    root.style.setProperty(SPACE_VAR, `${Math.ceil(Math.max(...parts.values())) + MARGIN}px`);
};

/** Makes every page leave room at its end for this bar while it is on screen. */
export const useBottomSpace = (id: string, ref: RefObject<HTMLElement | null>, active: boolean) => {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!active || !el) return;

        const measure = () => {
            if (frozen) return;
            // Its height plus its distance from the bottom (which includes the safe area)
            parts.set(id, el.offsetHeight + (Number.parseFloat(getComputedStyle(el).bottom) || 0));
            apply();
        };
        measure();
        // Old browsers without it still get the room measured when the window changes size
        // eslint-disable-next-line compat/compat -- checked just here
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(el);
        window.addEventListener('resize', measure);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
            parts.delete(id);
            apply();
        };
    }, [ id, ref, active ]);
};

const scrollerOf = (target: EventTarget | null) => {
    if (target instanceof Document) return document.scrollingElement;
    return target instanceof HTMLElement ? target : null;
};

/**
 * Whether the bar should step aside: after scrolling down a little, until scrolling up a little, reaching the top
 * or the end of the page (where its room is already left).
 */
export const useHideOnScroll = (enabled: boolean) => {
    const [ hidden, setHidden ] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setHidden(false);
            return;
        }
        const anchors = new WeakMap<Element, number>();
        const onScroll = (e: Event) => {
            const el = scrollerOf(e.target);
            if (!el) return;
            const top = el.scrollTop;
            const anchor = anchors.get(el) ?? top;
            const atEnd = el.scrollHeight - el.clientHeight - top < 4;
            if (top < TOP_ZONE || atEnd || anchor - top > SCROLL_STEP) {
                anchors.set(el, top);
                setHidden(false);
            } else if (top - anchor > SCROLL_STEP) {
                anchors.set(el, top);
                setHidden(true);
            } else if (!anchors.has(el)) {
                anchors.set(el, top);
            }
        };
        window.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => window.removeEventListener('scroll', onScroll, { capture: true });
    }, [ enabled ]);

    useEffect(() => {
        frozen = hidden;
        document.body.classList.toggle(HIDDEN_CLASS, hidden);
        return () => {
            frozen = false;
            document.body.classList.remove(HIDDEN_CLASS);
        };
    }, [ hidden ]);

    // Reaching the bar with the keyboard brings it back
    const show = useCallback(() => setHidden(false), []);

    return { hidden, show };
};

/** Styles that move the bar out of the way (it keeps its place, so nothing else moves). */
export const hiddenBarSx = (hidden: boolean) => ({
    transition: 'transform 0.25s ease, opacity 0.2s ease, left 0.25s',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    ...(hidden && {
        transform: 'translate(-50%, calc(100% + 24px))',
        opacity: 0,
        pointerEvents: 'none'
    })
});
