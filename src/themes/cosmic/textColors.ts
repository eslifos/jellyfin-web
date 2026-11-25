/**
 * Colors of the text that is not the main one, for MUI sx. They read the variables of the Cosmic theme
 * (theme.scss); the value after the comma is the same, for when another theme is in use.
 * Both stay readable on the dark backgrounds (at least 4.5:1 on #080810). Disabled text may stay dimmer.
 */

/** Labels and descriptions: rgba(255, 255, 255, 0.72). */
export const TEXT_SECONDARY = 'var(--jf-text-secondary, rgba(255, 255, 255, 0.72))';

/** Hints, dates, counts and small print: rgba(255, 255, 255, 0.6). */
export const TEXT_TERTIARY = 'var(--jf-text-tertiary, rgba(255, 255, 255, 0.6))';
