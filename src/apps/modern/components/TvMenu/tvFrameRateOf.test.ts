import { describe, expect, it, vi } from 'vitest';

vi.mock('components/playback/playbackmanager', () => ({ playbackManager: {} }));
vi.mock('utils/events', () => ({ default: { on: vi.fn() } }));

import { frameRateOf } from './tvFrameRate';

describe('frameRateOf', () => {
    it('reads the real frame rate of the video stream first', () => {
        expect(frameRateOf({ MediaStreams: [ { Type: 'Audio' }, { Type: 'Video', RealFrameRate: 23.976, AverageFrameRate: 24 } ] })).toBe(23.976);
        expect(frameRateOf({ MediaStreams: [ { Type: 'Video', AverageFrameRate: 25 } ] })).toBe(25);
    });

    it('is 0 when unknown', () => {
        expect(frameRateOf(null)).toBe(0);
        expect(frameRateOf({ MediaStreams: [ { Type: 'Audio' } ] })).toBe(0);
    });
});
