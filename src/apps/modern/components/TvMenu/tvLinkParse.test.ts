import { describe, expect, it } from 'vitest';

import { parseTvLink } from './tvLinkParse';

describe('parseTvLink', () => {
    it('reads the links of the TV home screen', () => {
        expect(parseTvLink('play/0123456789abcdef0123456789abcdef')).toEqual({ action: 'play', id: '0123456789abcdef0123456789abcdef' });
        expect(parseTvLink('details/01234567-89ab-cdef-0123-456789abcdef')).toEqual({ action: 'details', id: '01234567-89ab-cdef-0123-456789abcdef' });
    });

    it('ignores anything else', () => {
        expect(parseTvLink(null)).toBeNull();
        expect(parseTvLink('')).toBeNull();
        expect(parseTvLink('delete/0123456789abcdef0123456789abcdef')).toBeNull();
        expect(parseTvLink('play/../../etc')).toBeNull();
    });
});
