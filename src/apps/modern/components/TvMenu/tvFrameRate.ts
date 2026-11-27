/**
 * TV app: the web player tells the app the frame rate of the video it plays, so the screen can take it (the setting
 * "Match the screen to the video frame rate" of the app; NativeInterface.setVideoFrameRate), and 0 when it stops.
 */
import { playbackManager } from 'components/playback/playbackmanager';
import Events from 'utils/events';

interface NativeFrameRate {
    setVideoFrameRate?: (fps: number) => void;
}

const native = () => (window as unknown as { NativeInterface?: NativeFrameRate }).NativeInterface;

interface VideoStream {
    Type?: string;
    RealFrameRate?: number | null;
    AverageFrameRate?: number | null;
}

/** The frame rate of the video stream of a media source (the real one first), 0 when unknown. */
export const frameRateOf = (source?: { MediaStreams?: VideoStream[] | null } | null) => {
    const video = source?.MediaStreams?.find(s => s.Type === 'Video');
    return video?.RealFrameRate || video?.AverageFrameRate || 0;
};

let installed = false;

/** Once, in the TV app: on each video started and stopped. */
export const installTvFrameRate = () => {
    if (installed || typeof native()?.setVideoFrameRate !== 'function') return;
    installed = true;
    const tell = (fps: number) => {
        try {
            native()?.setVideoFrameRate?.(fps);
        } catch (err) {
            console.warn('[tvFrameRate] the app could not take the frame rate', err);
        }
    };
    Events.on(playbackManager, 'playbackstart', (_e: unknown, player: unknown) => {
        if (!playbackManager.isPlayingVideo(player)) return;
        tell(frameRateOf(playbackManager.currentMediaSource(player)));
    });
    Events.on(playbackManager, 'playbackstop', () => tell(0));
};
