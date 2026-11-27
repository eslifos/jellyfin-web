import { describe, expect, it } from 'vitest';

import { encodeQr, gfMultiply, rsRemainder } from './qrCode';

/** The format information read back from the modules around the top left finder pattern (15 bits). */
const readFormat = (m: boolean[][]) => {
    const bits: boolean[] = [];
    for (let i = 0; i <= 5; i++) bits.push(m[i][8]);
    bits.push(m[7][8], m[8][8], m[8][7]);
    for (let i = 9; i < 15; i++) bits.push(m[8][14 - i]);
    return bits.reduce((value, b, i) => value | (Number(b) << i), 0) ^ 0x5412;
};

describe('qrCode', () => {
    it('multiplies in GF(256)', () => {
        expect(gfMultiply(0, 7)).toBe(0);
        expect(gfMultiply(1, 0x53)).toBe(0x53);
        expect(gfMultiply(2, 0x80)).toBe(0x1D);
    });

    it('computes the error correction of the standard example (HELLO WORLD, 1-M)', () => {
        const data = [ 32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17 ];
        expect(rsRemainder(data, 10)).toEqual([ 196, 35, 39, 119, 235, 215, 231, 226, 93, 23 ]);
    });

    it('picks the smallest version that fits', () => {
        expect(encodeQr('hello')).toHaveLength(21);
        const url = 'https://jellyfin.example.com/web/#/quickconnect?code=123456';
        const size = encodeQr(url).length;
        expect((size - 17) % 4).toBe(0);
        expect(size).toBeLessThanOrEqual(37);
    });

    it('draws the finder patterns and a valid format information for level M', () => {
        const m = encodeQr('https://jellyfin.example.com/web/#/quickconnect?code=123456');
        const size = m.length;
        // Finder: a dark 7x7 ring with a dark 3x3 center
        for (const [ ox, oy ] of [ [ 0, 0 ], [ size - 7, 0 ], [ 0, size - 7 ] ]) {
            expect(m[oy][ox]).toBe(true);
            expect(m[oy + 1][ox + 1]).toBe(false);
            expect(m[oy + 3][ox + 3]).toBe(true);
        }
        const format = readFormat(m);
        // Level M is 00, so the 5 data bits are the mask (0 to 7)
        expect(format >>> 13).toBe(0);
        // The BCH remainder of the data bits matches
        const data = format >>> 10;
        let rem = data;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        expect(format & 0x3FF).toBe(rem & 0x3FF);
    });

    it('refuses a text too long for version 10', () => {
        expect(() => encodeQr('x'.repeat(300))).toThrow();
    });
});
