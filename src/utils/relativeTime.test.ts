import { describe, expect, it, vi } from 'vitest';

vi.mock('lib/globalize', () => ({ default: { getCurrentDateTimeLocale: () => 'es-MX' } }));

import { shortRelativeTime } from './relativeTime';

const NOW = Date.parse('2026-11-25T12:00:00Z');
const ago = (ms: number) => NOW - ms;
const MIN = 60 * 1000;

describe('shortRelativeTime', () => {
    it('says "now" for the last seconds, not "less than a minute ago"', () => {
        expect(shortRelativeTime(ago(10 * 1000), NOW)).toBe('ahora');
    });

    it('uses the short units', () => {
        expect(shortRelativeTime(ago(MIN), NOW)).toBe('hace 1 min');
        expect(shortRelativeTime(ago(50 * 1000), NOW)).toBe('hace 1 min');
        expect(shortRelativeTime(ago(3 * 60 * MIN), NOW)).toBe('hace 3 h');
        expect(shortRelativeTime(ago(24 * 60 * MIN), NOW)).toBe('ayer');
    });

    it('also for what comes next', () => {
        expect(shortRelativeTime(NOW + 2 * 60 * MIN, NOW)).toBe('en 2 h');
    });

    it('nothing without a valid date', () => {
        expect(shortRelativeTime(null, NOW)).toBe('');
        expect(shortRelativeTime('not a date', NOW)).toBe('');
    });
});
