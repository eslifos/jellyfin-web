import { describe, expect, it } from 'vitest';

import { classifyPlaybackError, lowerBitrate, playbackErrorAction } from './playbackError';

describe('Playback errors', () => {
    it('Should group the player and server codes in four cases', () => {
        expect(classifyPlaybackError('PlaybackErrorNoCompatibleStream')).toBe('format');
        expect(classifyPlaybackError('PlaybackError.MEDIA_NOT_SUPPORTED')).toBe('format');
        expect(classifyPlaybackError('PlaybackError.MEDIA_DECODE_ERROR')).toBe('format');
        expect(classifyPlaybackError('PlaybackError.SERVER_ERROR')).toBe('server');
        expect(classifyPlaybackError('PlaybackError.RateLimitExceeded')).toBe('server');
        expect(classifyPlaybackError('PlaybackError.NotAllowed')).toBe('server');
        expect(classifyPlaybackError('PlaybackError.NETWORK_ERROR')).toBe('network');
        expect(classifyPlaybackError('PlaybackError.FATAL_HLS_ERROR')).toBe('network');
        expect(classifyPlaybackError('PlaybackError.NO_MEDIA_ERROR')).toBe('missing');
        expect(classifyPlaybackError('PlaybackErrorPlaceHolder')).toBe('missing');
    });

    it('Should treat anything unknown as something to try again', () => {
        expect(classifyPlaybackError('ErrorDefault')).toBe('server');
        expect(classifyPlaybackError()).toBe('server');
    });

    it('Should offer the action that may fix each case', () => {
        expect(playbackErrorAction('format', 1)).toBe('lowerQuality');
        expect(playbackErrorAction('format', 3)).toBe('otherVersion');
        expect(playbackErrorAction('server')).toBe('retry');
        expect(playbackErrorAction('network', 2)).toBe('lowerQuality');
        expect(playbackErrorAction('missing', 2)).toBe('back');
    });

    it('Should lower the quality one step at a time', () => {
        expect(lowerBitrate()).toBe(4_000_000);
        expect(lowerBitrate(120_000_000)).toBe(8_000_000);
        expect(lowerBitrate(8_000_000)).toBe(4_000_000);
        expect(lowerBitrate(3_000_000)).toBe(2_000_000);
        expect(lowerBitrate(420_000)).toBe(420_000);
    });
});
