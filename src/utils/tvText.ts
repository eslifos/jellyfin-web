/**
 * A text size with the floor of the TV layout: read from the couch, no text under 20 px (styles/tv.scss sets
 * --tv-min-text on the TV layout only; elsewhere the size stays as it is).
 * @param {string} size The size elsewhere, i.e. '0.7rem'.
 * @returns {string} The CSS size.
 */
export const minText = (size: string) => `max(var(--tv-min-text, 0px), ${size})`;
