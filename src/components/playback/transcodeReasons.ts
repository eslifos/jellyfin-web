import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';

/** Why the server would transcode the picture (not the audio, the bitrate or the container) for a player. */
const VIDEO_TRANSCODE_REASONS = [
    'VideoCodecNotSupported', 'VideoCodecTagNotSupported', 'VideoProfileNotSupported', 'VideoLevelNotSupported',
    'VideoResolutionNotSupported', 'VideoBitDepthNotSupported', 'VideoFramerateNotSupported', 'VideoRangeTypeNotSupported',
    'VideoRotationNotSupported', 'AnamorphicVideoNotSupported', 'InterlacedVideoNotSupported', 'RefFramesNotSupported',
    'UnknownVideoStreamInfo',
    // Subtitles burnt into the picture
    'SubtitleCodecNotSupported'
];

/** The reasons the server gives for the transcoding it offers (TranscodeReasons of its address). */
export const transcodeReasons = (source?: Pick<MediaSourceInfo, 'TranscodingUrl'> | null): string[] => {
    const url = source?.TranscodingUrl;
    if (!url) return [];
    return new URLSearchParams(url.split('?')[1] || '').get('TranscodeReasons')?.split(',').filter(Boolean) ?? [];
};

/** Whether the transcoding the server offers for a media source re-encodes the picture. */
export const needsVideoTranscoding = (source?: Pick<MediaSourceInfo, 'TranscodingUrl'> | null): boolean =>
    transcodeReasons(source).some(reason => VIDEO_TRANSCODE_REASONS.includes(reason));
