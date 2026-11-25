/**
 * The floating bars on phones: they take the width of the screen and their buttons scroll sideways when they do
 * not fit (like the bar of the libraries), centred while everything fits, the side that still hides buttons faded.
 */
import Box from '@mui/material/Box';
import React, { type FC, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';

interface Edges {
    start: boolean;
    end: boolean;
}

/** The edges of a row that scrolls sideways still hiding buttons. */
const useScrollEdges = (ref: RefObject<HTMLElement>, enabled: boolean) => {
    const [ edges, setEdges ] = useState<Edges>({ start: false, end: false });
    useEffect(() => {
        const el = ref.current;
        if (!el || !enabled) return;
        const update = () => {
            const max = el.scrollWidth - el.clientWidth;
            const start = el.scrollLeft > 2;
            const end = el.scrollLeft < max - 2;
            setEdges(prev => (prev.start === start && prev.end === end ? prev : { start, end }));
        };
        update();
        el.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        // The buttons can change (a tool appears, the scanner lights up) without the window changing
        // eslint-disable-next-line compat/compat -- checked: older browsers keep the window resize only
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : undefined;
        observer?.observe(el);
        if (el.firstElementChild) observer?.observe(el.firstElementChild);
        return () => {
            el.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
            observer?.disconnect();
        };
    }, [ ref, enabled ]);
    return edges;
};

/** Fades the side that still has buttons to scroll to. */
const edgeMask = ({ start, end }: Edges) => {
    if (!start && !end) return undefined;
    const left = start ? 'transparent 0, #000 28px' : '#000 0';
    const right = end ? '#000 calc(100% - 28px), transparent 100%' : '#000 100%';
    return `linear-gradient(to right, ${left}, ${right})`;
};

/** Where a bar goes on a phone: edge to edge (8 px margins), sliding down when it steps aside. */
export const narrowBarPlacement = (hidden: boolean) => ({
    left: 8, right: 8, px: 0.5, maxWidth: 'none',
    transform: hidden ? 'translateY(calc(100% + 24px))' : 'none'
});

interface ScrollRailProps {
    /** Phones: scroll sideways; elsewhere the buttons sit in the bar as they are. */
    enabled: boolean;
    children: ReactNode;
}

const ScrollRail: FC<ScrollRailProps> = ({ enabled, children }) => {
    const railRef = useRef<HTMLDivElement>(null);
    const mask = edgeMask(useScrollEdges(railRef, enabled));

    // Wider screens: the buttons sit straight in the bar
    if (!enabled) return <Box sx={{ display: 'contents' }}>{children}</Box>;

    return (
        <Box
            ref={railRef}
            sx={{
                flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', overscrollBehaviorX: 'contain',
                scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
                maskImage: mask, WebkitMaskImage: mask
            }}
        >
            {/* Centred while everything fits; from the start when it scrolls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, width: 'max-content', mx: 'auto' }}>
                {children}
            </Box>
        </Box>
    );
};

export default ScrollRail;
