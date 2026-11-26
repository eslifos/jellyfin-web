import { describe, expect, it } from 'vitest';

import { needsVideoTranscoding, transcodeReasons } from './transcodeReasons';

const BASE_URL = '/videos/1/master.m3u8?MediaSourceId=1&VideoCodec=h264';
const source = (reasons?: string) => ({
    TranscodingUrl: reasons ? `${BASE_URL}&TranscodeReasons=${reasons}` : BASE_URL
});

describe('transcodeReasons', () => {
    it('reads the reasons of the transcoding address', () => {
        expect(transcodeReasons(source('ContainerNotSupported,AudioCodecNotSupported'))).toEqual([ 'ContainerNotSupported', 'AudioCodecNotSupported' ]);
    });

    it('has none without a transcoding address or reasons', () => {
        expect(transcodeReasons(null)).toEqual([]);
        expect(transcodeReasons({})).toEqual([]);
        expect(transcodeReasons(source())).toEqual([]);
    });
});

describe('needsVideoTranscoding', () => {
    it('is false when only the audio or the container change (the picture is copied)', () => {
        expect(needsVideoTranscoding(source('AudioCodecNotSupported'))).toBe(false);
        expect(needsVideoTranscoding(source('ContainerNotSupported,AudioChannelsNotSupported'))).toBe(false);
        expect(needsVideoTranscoding(source('ContainerBitrateExceedsLimit'))).toBe(false);
    });

    it('is true when the picture is re-encoded', () => {
        expect(needsVideoTranscoding(source('VideoCodecNotSupported'))).toBe(true);
        expect(needsVideoTranscoding(source('AudioCodecNotSupported,VideoRangeTypeNotSupported'))).toBe(true);
    });

    it('is true when the subtitles are burnt into the picture', () => {
        expect(needsVideoTranscoding(source('SubtitleCodecNotSupported'))).toBe(true);
    });

    it('is false without a transcoding address', () => {
        expect(needsVideoTranscoding(null)).toBe(false);
        expect(needsVideoTranscoding({})).toBe(false);
    });
});
