/**
 * Numbers written in the language chosen in the app, not in the one of the browser (they can differ).
 * Kept apart from utils/number so that module stays free of the app's settings.
 */
import globalize, { FALLBACK_CULTURE } from 'lib/globalize';

/**
 * The language numbers are written in: the regional format chosen in the preferences, else the language of the app.
 * @returns {string|undefined} The locale (i.e. es-mx), undefined while the app has not set its language yet.
 */
export function getNumberLocale(): string | undefined {
    return globalize.getCurrentDateTimeLocale() || globalize.getCurrentLocale() || undefined;
}

/**
 * Formats a number in the language of the app (see getNumberLocale).
 * @param {number} value The number.
 * @param {Intl.NumberFormatOptions} [options] How to write it (decimals, percent, compact…).
 * @returns {string} The number as text, i.e. "11,614" in English and "11.614" in German.
 */
export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
    try {
        return value.toLocaleString(getNumberLocale(), options);
    } catch {
        // A language name the browser does not know
        return value.toLocaleString(FALLBACK_CULTURE, options);
    }
}
