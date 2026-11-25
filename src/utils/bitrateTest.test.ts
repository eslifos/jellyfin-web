import { afterEach, describe, expect, it } from 'vitest';

import {
    BITRATE_CACHE_DURATION, PROFILE_CAPS, capForProfile, getNetworkProfile, readStoredBitrate, storeBitrate, testsFor
} from './bitrateTest';

const SERVER = 'https://media.example';

describe('network profile', () => {
    it('reads save-data and mobile networks', () => {
        expect(getNetworkProfile({ saveData: true, type: 'wifi' })).toBe('saveData');
        expect(getNetworkProfile({ type: 'cellular' })).toBe('cellular');
        expect(getNetworkProfile({ type: 'wifi' })).toBe('normal');
        // The browser says nothing
        expect(getNetworkProfile({})).toBe('normal');
    });

    it('only makes the 500 KB test when data is scarce', () => {
        expect(testsFor('normal').map(t => t.bytes)).toEqual([ 500000, 1000000, 3000000 ]);
        expect(testsFor('cellular').map(t => t.bytes)).toEqual([ 500000 ]);
        expect(testsFor('saveData').map(t => t.bytes)).toEqual([ 500000 ]);
    });

    it('caps the quality where data is scarce', () => {
        expect(capForProfile(50000000, 'cellular')).toBe(PROFILE_CAPS.cellular);
        expect(capForProfile(50000000, 'saveData')).toBe(PROFILE_CAPS.saveData);
        expect(capForProfile(1000000, 'cellular')).toBe(1000000);
        expect(capForProfile(50000000, 'normal')).toBe(50000000);
    });
});

describe('kept result per server', () => {
    afterEach(() => localStorage.clear());

    it('is used for an hour, on the same kind of network', () => {
        const now = 1_000_000_000;
        storeBitrate(SERVER, 12000000, 'normal', now);
        expect(readStoredBitrate(SERVER, 'normal', now + 10 * 60 * 1000)).toBe(12000000);
        expect(readStoredBitrate(SERVER, 'normal', now + BITRATE_CACHE_DURATION + 1)).toBeUndefined();
        expect(readStoredBitrate(SERVER, 'cellular', now + 1000)).toBeUndefined();
    });

    it('belongs to its server', () => {
        storeBitrate(SERVER, 8000000, 'normal', 5);
        expect(readStoredBitrate('https://other.example', 'normal', 10)).toBeUndefined();
    });

    it('ignores what cannot be read', () => {
        localStorage.setItem(`jfBitrateTest:${SERVER}`, '{oops');
        expect(readStoredBitrate(SERVER, 'normal')).toBeUndefined();
    });
});
