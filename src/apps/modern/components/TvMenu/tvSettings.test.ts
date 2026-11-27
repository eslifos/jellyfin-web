import { describe, expect, it, vi } from 'vitest';

vi.mock('scripts/settings/userSettings', () => ({ currentSettings: {} }));
vi.mock('utils/events', () => ({ default: { on: vi.fn() } }));
vi.mock('../QuickHome/tvHero', () => ({ tvTrailersEnabled: () => true }));

import { subtitleSizeOf, withSubtitleSize } from './tvSettings';

describe('tvSettings', () => {
    it('names the subtitle size as the app does, medium for the default', () => {
        expect(subtitleSizeOf({ textSize: 'large' })).toBe('large');
        expect(subtitleSizeOf({ textSize: '' })).toBe('medium');
        expect(subtitleSizeOf({})).toBe('medium');
        expect(subtitleSizeOf({ textSize: 'huge' })).toBe('medium');
        expect(subtitleSizeOf(null)).toBe('medium');
    });

    it('stores the size of the app, the default empty, keeping the rest of the appearance', () => {
        expect(withSubtitleSize({ textSize: '', dropShadow: 'raised' } as { textSize?: string }, 'larger'))
            .toEqual({ textSize: 'larger', dropShadow: 'raised' });
        expect(withSubtitleSize({ textSize: 'large' }, 'medium')).toEqual({ textSize: '' });
        expect(withSubtitleSize({ textSize: 'large' }, 42)).toEqual({ textSize: '' });
    });
});
