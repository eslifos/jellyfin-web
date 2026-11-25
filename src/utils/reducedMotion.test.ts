import { afterEach, describe, expect, it, vi } from 'vitest';

import { REDUCED_MOTION_QUERY, ambientAnimation, motionDuration, prefersReducedMotion, scrollBehavior } from './reducedMotion';

const setReduced = (reduced: boolean) => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query === REDUCED_MOTION_QUERY, media: query }));
};

describe('Utils: reducedMotion', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('Should follow the system setting', () => {
        setReduced(true);
        expect(prefersReducedMotion()).toBe(true);
        setReduced(false);
        expect(prefersReducedMotion()).toBe(false);
    });

    it('Should not fail where matchMedia does not exist', () => {
        vi.stubGlobal('matchMedia', undefined);
        expect(prefersReducedMotion()).toBe(false);
    });

    it('Should jump instead of scrolling smoothly when motion is reduced', () => {
        setReduced(true);
        expect(scrollBehavior()).toBe('auto');
        setReduced(false);
        expect(scrollBehavior()).toBe('smooth');
    });

    it('Should give Web Animations no length when motion is reduced', () => {
        setReduced(true);
        expect(motionDuration(300)).toBe(0);
        setReduced(false);
        expect(motionDuration(300)).toBe(300);
    });

    it('Should stop a decorative sx animation with the media query', () => {
        expect(ambientAnimation('jf-glow-pulse 4s ease-in-out infinite')).toEqual({
            animation: 'jf-glow-pulse 4s ease-in-out infinite',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
        });
    });
});
