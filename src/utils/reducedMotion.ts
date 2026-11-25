/**
 * The system setting "reduce motion" (prefers-reduced-motion). The stylesheets follow it on their own (theme.scss);
 * this is for what moves from code: smooth scrolling, Web Animations and animations written in MUI sx.
 */

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the system asks for less motion. */
export const prefersReducedMotion = (): boolean =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

/** How to scroll: a jump when motion is reduced, else smoothly. */
export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');

/** Length of a Web Animation: none when motion is reduced (its onfinish still runs, so what waits for it goes on). */
export const motionDuration = (ms: number): number => (prefersReducedMotion() ? 0 : ms);

/**
 * sx of a decorative animation (a glow, a floating logo, a pulse) that stops when motion is reduced, whatever the
 * theme. Not for loading spinners: they say the app is working.
 * @param {string} animation The CSS animation, i.e. 'jf-glow-pulse 4s ease-in-out infinite'.
 * @returns {object} The sx properties.
 */
export const ambientAnimation = (animation: string) => ({
    animation,
    [`@media ${REDUCED_MOTION_QUERY}`]: { animation: 'none' }
});
