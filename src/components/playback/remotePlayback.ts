/**
 * Sends the video or song playing in this browser to a Chromecast (or other device) with the browser's own Remote Playback
 * API. Unlike the Google Cast SDK, it also works when Jellyfin is opened over plain http on the local network.
 */

/** unsupported: the browser can't; unknown: it can't say in advance, but prompting may still work. */
export type RemoteState = 'unsupported' | 'unknown' | 'unavailable' | 'available' | 'connecting' | 'connected';

export const getVideoElement = () =>
    document.querySelector<HTMLVideoElement>('video.htmlvideoplayer') ?? document.querySelector<HTMLVideoElement>('video');

export const getAudioElement = () => document.querySelector<HTMLAudioElement>('audio.mediaPlayerAudio');

export const isRemotePlaybackSupported = () =>
    typeof HTMLMediaElement !== 'undefined' && 'remote' in HTMLMediaElement.prototype;

/** Watches whether the current video or song can be sent to a device; returns the function that stops watching. */
export function watchRemotePlayback(media: HTMLMediaElement | null, onState: (state: RemoteState) => void): () => void {
    const remote = media?.remote;
    if (!media || !remote) {
        onState('unsupported');
        return () => { /* nothing to stop */ };
    }

    let availability: boolean | null = null;
    let watchId: number | undefined;
    let disposed = false;

    const emit = () => {
        if (disposed) return;
        if (remote.state === 'connected') onState('connected');
        else if (remote.state === 'connecting') onState('connecting');
        else if (availability === null) onState('unknown');
        else onState(availability ? 'available' : 'unavailable');
    };

    remote.watchAvailability(available => {
        availability = available;
        emit();
    }).then(id => {
        watchId = id;
        if (disposed) remote.cancelWatchAvailability(id).catch(() => { /* already gone */ });
    }).catch(() => {
        // Some browsers (and some sources) can't monitor availability: the picker may still find devices
        availability = null;
        emit();
    });

    remote.addEventListener('connecting', emit);
    remote.addEventListener('connect', emit);
    remote.addEventListener('disconnect', emit);
    emit();

    return () => {
        disposed = true;
        remote.removeEventListener('connecting', emit);
        remote.removeEventListener('connect', emit);
        remote.removeEventListener('disconnect', emit);
        if (watchId !== undefined) remote.cancelWatchAvailability(watchId).catch(() => { /* already gone */ });
    };
}

/** Opens the browser's device picker (must run from a click). Resolves false when nothing was chosen or it failed. */
export async function promptRemotePlayback(media: HTMLMediaElement | null = getVideoElement()) {
    if (!media?.remote) return false;
    try {
        await media.remote.prompt();
        return true;
    } catch (err) {
        console.warn('[RemotePlayback] prompt failed', err);
        return false;
    }
}
