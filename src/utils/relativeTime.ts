/**
 * Short relative times ("hace 1 min", "en 3 h", "ayer") in the user's language, for tiles and lists where the long
 * form ("hace menos de un minuto") would take several lines on a phone.
 */
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

import globalize from 'lib/globalize';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';

const SECOND = 1000;

/** From the largest unit down: the first one the difference reaches is used. */
const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
    [ 'year', 365 * 24 * 3600 * SECOND ],
    [ 'month', 30 * 24 * 3600 * SECOND ],
    [ 'week', 7 * 24 * 3600 * SECOND ],
    [ 'day', 24 * 3600 * SECOND ],
    [ 'hour', 3600 * SECOND ],
    [ 'minute', 60 * SECOND ]
];

/** Under this, it is "now". */
const NOW_MS = 45 * SECOND;

const formatters = new Map<string, Intl.RelativeTimeFormat>();

const formatterFor = (locale: string) => {
    let formatter = formatters.get(locale);
    if (!formatter) {
        formatter = new Intl.RelativeTimeFormat(locale, { style: 'short', numeric: 'auto' });
        formatters.set(locale, formatter);
    }
    return formatter;
};

/**
 * @param date When it happened (or will happen).
 * @param now The current time (tests).
 * @returns The short relative time, or '' when there is no valid date.
 */
export const shortRelativeTime = (date?: string | number | Date | null, now = Date.now()) => {
    if (date == null || date === '') return '';
    const time = new Date(date).getTime();
    if (Number.isNaN(time)) return '';

    // Old TV browsers without it: the long form
    if (typeof Intl === 'undefined' || typeof Intl.RelativeTimeFormat === 'undefined') {
        return formatDistanceToNow(time, getLocaleWithSuffix());
    }

    const diff = time - now;
    const formatter = formatterFor(globalize.getCurrentDateTimeLocale());
    if (Math.abs(diff) < NOW_MS) return formatter.format(0, 'second');

    const [ unit, size ] = UNITS.find(([ , ms ]) => Math.abs(diff) >= ms) ?? UNITS[UNITS.length - 1];
    // Never "0 min": 45 s already counts as one minute
    const amount = Math.round(diff / size) || Math.sign(diff);
    return formatter.format(amount, unit);
};
