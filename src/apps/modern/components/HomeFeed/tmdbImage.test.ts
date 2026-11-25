import { describe, expect, test } from 'vitest';

import { tmdbFile, tmdbImageUrl } from './tmdbImage';

describe('tmdbFile', () => {
    test('uses the TMDb path of the release', () => {
        expect(tmdbFile({ ImagePath: '/abc123.jpg', ImageUrl: 'https://image.tmdb.org/t/p/w185/other.jpg' })).toBe('abc123.jpg');
    });

    test('older servers: takes it from the TMDb URL of any size', () => {
        expect(tmdbFile({ ImageUrl: 'https://image.tmdb.org/t/p/original/zhB5CHEgqqh4wnEqDNJLfWXJlcL.jpg' })).toBe('zhB5CHEgqqh4wnEqDNJLfWXJlcL.jpg');
        expect(tmdbFile({ ImageUrl: 'https://image.tmdb.org/t/p/w300/still_1-a.png' })).toBe('still_1-a.png');
    });

    test('nothing for other addresses or no picture', () => {
        expect(tmdbFile({ ImageUrl: 'https://example.org/t/p/w185/abc.jpg' })).toBeUndefined();
        expect(tmdbFile({ ImageUrl: 'https://image.tmdb.org/t/p/w185/../abc.jpg' })).toBeUndefined();
        expect(tmdbFile({ ImagePath: null, ImageUrl: null })).toBeUndefined();
        expect(tmdbFile({})).toBeUndefined();
    });
});

describe('tmdbImageUrl', () => {
    test('asks the server at the size given', () => {
        expect(tmdbImageUrl('https://jf.example', { ImagePath: '/abc.jpg' }, 'w92')).toBe('https://jf.example/Discovery/Images/w92/abc.jpg');
    });

    test('undefined without a picture', () => {
        expect(tmdbImageUrl('https://jf.example', {}, 'w185')).toBeUndefined();
    });
});
