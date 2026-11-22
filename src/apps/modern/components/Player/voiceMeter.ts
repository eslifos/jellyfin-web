/**
 * Levels of the voice that is playing, for the sound waves of the audiobook player.
 * The audio element is listened to through a copy of its stream (captureStream): the sound itself is not
 * rerouted, so playback (also in the background on phones) works exactly as before. Where the browser cannot
 * do it (Safari, iPhone) the waves follow a speech-like rhythm instead.
 */

interface Capturable extends HTMLMediaElement {
    captureStream?: () => MediaStream;
}

export interface VoiceMeter {
    /** Levels from 0 to 1, loudest in the middle; null when nothing can be heard (then simulate). */
    read: (bars: number) => number[] | null;
    close: () => void;
}

const LOW_HZ = 85;
const HIGH_HZ = 4000;

export const openVoiceMeter = (): VoiceMeter | null => {
    const audio = document.querySelector<Capturable>('audio.mediaPlayerAudio');
    // Old browsers without it get the simulated rhythm (checked just below)
    // eslint-disable-next-line compat/compat
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio?.captureStream || !Context) return null;

    try {
        const stream = audio.captureStream();
        if (!stream.getAudioTracks().length) return null;
        const context = new Context();
        void context.resume();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.55;
        // Only to the analyser, not to the speakers: the element keeps playing by itself
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const binHz = context.sampleRate / analyser.fftSize;
        const low = Math.max(1, Math.round(LOW_HZ / binHz));
        const high = Math.min(data.length - 1, Math.round(HIGH_HZ / binHz));
        const started = performance.now();
        // Loudest level heard lately: quiet narrations are scaled up so the waves always move with the voice
        let loudest = 0;
        let gain = 60;

        return {
            read: bars => {
                analyser.getByteFrequencyData(data);
                const half = Math.ceil(bars / 2);
                const out = new Array<number>(bars).fill(0);
                for (let i = 0; i < half; i++) {
                    const from = low + Math.floor(((high - low) * i) / half);
                    const to = low + Math.floor(((high - low) * (i + 1)) / half);
                    let peak = 0;
                    for (let k = from; k <= to; k++) peak = Math.max(peak, data[k]);
                    loudest = Math.max(loudest, peak);
                    const level = Math.min(1, Math.pow(peak / gain, 1.3));
                    out[half - 1 - i] = level;
                    out[bars - half + i] = level;
                }
                gain = Math.max(60, gain * 0.995, loudest);
                loudest *= 0.98;
                // Nothing (or almost nothing) for a while although it plays: the stream cannot be heard, simulate
                if (gain <= 60 && loudest < 25 && performance.now() - started > 2500) return null;
                return out;
            },
            close: () => {
                source.disconnect();
                void context.close();
            }
        };
    } catch {
        return null;
    }
};

export interface Speech {
    level: number;
    target: number;
    next: number;
}

/** A speech-like rhythm: syllables of different strength with short pauses. */
export const simulateSpeech = (now: number, bars: number, speech: Speech) => {
    if (now > speech.next) {
        speech.target = Math.random() < 0.18 ? 0.05 : 0.3 + (Math.random() * 0.7);
        speech.next = now + 90 + (Math.random() * 230);
    }
    speech.level += (speech.target - speech.level) * 0.25;
    const middle = (bars - 1) / 2;
    return Array.from({ length: bars }, (_, i) => {
        const centre = 1 - (Math.abs(i - middle) / (bars / 2));
        return speech.level * (0.3 + (0.7 * centre)) * (0.6 + (0.4 * Math.random()));
    });
};
