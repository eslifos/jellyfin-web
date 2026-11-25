import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatNumber, getNumberLocale } from './localeNumber';

const locales = vi.hoisted(() => ({
    language: undefined as string | undefined,
    regional: undefined as string | undefined
}));

// The real module loads the whole app: only the language is needed
vi.mock('lib/globalize', () => ({
    // eslint-disable-next-line @typescript-eslint/naming-convention -- the name of the constant it stands for
    FALLBACK_CULTURE: 'en-us',
    default: {
        getCurrentLocale: () => locales.language,
        getCurrentDateTimeLocale: () => locales.regional
    }
}));

describe('Utils: localeNumber', () => {
    afterEach(() => {
        locales.language = undefined;
        locales.regional = undefined;
    });

    describe('Function: getNumberLocale', () => {
        it('Should use the regional format chosen in the preferences', () => {
            locales.language = 'en-us';
            locales.regional = 'de-de';
            expect(getNumberLocale()).toBe('de-de');
        });

        it('Should use the language of the app when no regional format is chosen', () => {
            locales.language = 'es-ar';
            expect(getNumberLocale()).toBe('es-ar');
        });

        it('Should be undefined while the app has no language yet', () => {
            expect(getNumberLocale()).toBeUndefined();
        });
    });

    describe('Function: formatNumber', () => {
        it('Should write the number in the language of the app, not of the browser', () => {
            locales.language = 'de-de';
            expect(formatNumber(11614)).toBe('11.614');

            locales.language = 'en-us';
            expect(formatNumber(11614)).toBe('11,614');

            locales.language = 'es-ar';
            expect(formatNumber(11614)).toBe('11.614');
        });

        it('Should follow the language when it changes in the preferences', () => {
            locales.language = 'en-us';
            expect(formatNumber(1234567.5)).toBe('1,234,567.5');

            locales.language = 'de-de';
            expect(formatNumber(1234567.5)).toBe('1.234.567,5');
        });

        it('Should keep the options', () => {
            locales.language = 'de-de';
            expect(formatNumber(12.3456, { maximumFractionDigits: 2 })).toBe('12,35');
            expect(formatNumber(0.25, { style: 'percent' })).toBe(`25${' '}%`);
            expect(formatNumber(2024, { useGrouping: false })).toBe('2024');
        });

        it('Should fall back to English when the language name is not valid', () => {
            locales.language = 'not a language';
            expect(formatNumber(11614)).toBe('11,614');
        });
    });
});
