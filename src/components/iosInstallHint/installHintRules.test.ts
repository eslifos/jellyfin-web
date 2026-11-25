import { describe, expect, it } from 'vitest';

import { type IosHintInput, shouldShowIosInstallHint } from './installHintRules';

const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHROME_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const FIREFOX_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15';

const base: IosHintInput = { iOS: true, safari: true, userAgent: SAFARI_IPHONE, standalone: false, shownBefore: false };

describe('iOS install hint', () => {
    it('Should show in Safari on an iPhone or iPad the first time', () => {
        expect(shouldShowIosInstallHint(base)).toBe(true);
    });

    it('Should not show once it was shown', () => {
        expect(shouldShowIosInstallHint({ ...base, shownBefore: true })).toBe(false);
    });

    it('Should not show when opened from the Home Screen', () => {
        expect(shouldShowIosInstallHint({ ...base, standalone: true })).toBe(false);
    });

    it('Should not show in other iOS browsers (they cannot add to the Home Screen this way)', () => {
        expect(shouldShowIosInstallHint({ ...base, userAgent: CHROME_IPHONE })).toBe(false);
        expect(shouldShowIosInstallHint({ ...base, userAgent: FIREFOX_IPAD })).toBe(false);
    });

    it('Should not show outside iOS or Safari', () => {
        expect(shouldShowIosInstallHint({ ...base, iOS: false })).toBe(false);
        expect(shouldShowIosInstallHint({ ...base, safari: false })).toBe(false);
    });
});
