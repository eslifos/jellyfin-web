/**
 * The sound of the music player: equalizer and DJ transitions.
 * Nothing is rerouted until one of them is turned on, so normal playback stays exactly as it was. iPhone and iPad
 * cannot process the audio without breaking it, so there they are not offered.
 */

export const EQ_BANDS = [ 32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 ];
export const EQ_RANGE = 12;

export const EQ_PRESETS: Record<string, number[]> = {
    flat: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],
    bass: [ 7, 6, 5, 3, 1, 0, 0, 0, 0, 0 ],
    vocal: [ -2, -2, -1, 1, 3, 4, 4, 3, 1, 0 ],
    treble: [ 0, 0, 0, 0, 0, 1, 3, 5, 6, 7 ],
    rock: [ 5, 4, 3, 1, -1, -1, 1, 3, 4, 5 ],
    pop: [ -1, 1, 3, 4, 3, 0, -1, -1, 0, 1 ],
    electronic: [ 6, 5, 2, 0, -2, 1, 0, 2, 4, 5 ],
    acoustic: [ 3, 3, 2, 1, 1, 1, 2, 3, 2, 1 ]
};

export interface EqSettings {
    on: boolean;
    preset: string;
    gains: number[];
}

export interface DjSettings {
    on: boolean;
    seconds: number;
}

export const DJ_MIN_SECONDS = 2;
export const DJ_MAX_SECONDS = 12;

/** A small setting kept in this browser that the screens can follow. */
const createStore = <T>(key: string, fallback: T) => {
    let value = fallback;
    try {
        const saved = localStorage.getItem(key);
        if (saved) value = { ...fallback, ...JSON.parse(saved) as T };
    } catch {
        // storage blocked: the setting lasts while the page is open
    }
    const listeners = new Set<() => void>();
    return {
        get: () => value,
        set: (next: T) => {
            value = next;
            try {
                localStorage.setItem(key, JSON.stringify(next));
            } catch {
                // storage blocked: the setting lasts while the page is open
            }
            for (const listen of listeners) listen();
        },
        subscribe: (listen: () => void) => {
            listeners.add(listen);
            return () => {
                listeners.delete(listen);
            };
        }
    };
};

export const eqStore = createStore<EqSettings>('cosmic-music-eq', { on: false, preset: 'flat', gains: EQ_PRESETS.flat });
export const djStore = createStore<DjSettings>('cosmic-music-dj', { on: false, seconds: 6 });

interface Graph {
    context: AudioContext;
    source: AudioNode;
    gain: AudioNode;
}

interface Chain {
    context: AudioContext;
    source: AudioNode;
    filters: BiquadFilterNode[];
    pre: GainNode;
    fader: GainNode;
}

let chain: Chain | null = null;

const graphOf = (player: object | null) => (player as { getAudioGraph?: () => Graph | null } | null)?.getAudioGraph?.() ?? null;

/** Whether this device can process the sound of the player. */
export const canProcess = (player: object | null) => typeof (player as { getAudioGraph?: unknown } | null)?.getAudioGraph === 'function'
    && !/iPad|iPhone|iPod/.test(navigator.userAgent);

const ensureChain = (player: object | null) => {
    const graph = canProcess(player) ? graphOf(player) : null;
    if (!graph) return null;
    if (chain?.source === graph.source) return chain;

    const { context, source, gain } = graph;
    const filters = EQ_BANDS.map((frequency, i) => {
        const filter = context.createBiquadFilter();
        filter.type = 'peaking';
        if (i === 0) filter.type = 'lowshelf';
        if (i === EQ_BANDS.length - 1) filter.type = 'highshelf';
        filter.frequency.value = frequency;
        filter.Q.value = 1;
        return filter;
    });
    const pre = context.createGain();
    const fader = context.createGain();
    source.disconnect();
    let last: AudioNode = source;
    for (const node of [ ...filters, pre, fader ]) {
        last.connect(node);
        last = node;
    }
    last.connect(gain);
    chain = { context, source, filters, pre, fader };
    return chain;
};

/** Applies the equalizer; the level goes down as much as the highest band goes up, so the sound never distorts. */
export const applyEq = (player: object | null) => {
    const eq = eqStore.get();
    if (!eq.on && !chain) return;
    const current = ensureChain(player);
    if (!current) return;
    void current.context.resume();
    current.filters.forEach((filter, i) => {
        filter.gain.value = eq.on ? (eq.gains[i] ?? 0) : 0;
    });
    const peak = eq.on ? Math.max(0, ...eq.gains) : 0;
    current.pre.gain.value = Math.pow(10, -peak / 20);
};

let analyser: AnalyserNode | null = null;
let analyserFader: GainNode | null = null;

/**
 * Lets the screen read the sound without changing it. A song from another address without permission would play
 * silent through this path, so then it is not used.
 */
export const getAnalyser = (player: object | null) => {
    const element = document.querySelector<HTMLAudioElement>('audio.mediaPlayerAudio');
    if (!element?.currentSrc) return null;
    let sameOrigin = false;
    try {
        sameOrigin = new URL(element.currentSrc, window.location.href).origin === window.location.origin;
    } catch {
        return null;
    }
    if (!sameOrigin && !element.crossOrigin) return null;
    // Rerouting before the browser allows sound would silence the song: the screen follows the tempo instead
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    const strictBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (!chain && (strictBrowser || activation?.hasBeenActive === false)) return null;
    const current = ensureChain(player);
    if (!current) return null;
    if (analyserFader !== current.fader) {
        analyser = current.context.createAnalyser();
        // Fine enough to tell the bass apart, with a range that loud songs do not saturate
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.5;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -8;
        current.fader.connect(analyser);
        analyserFader = current.fader;
    }
    void current.context.resume();
    return analyser;
};

let ghost: HTMLAudioElement | null = null;
let ghostTimer = 0;
let fadeTimer = 0;
let cancelPlaying: (() => void) | null = null;

/** Ends a transition at once and leaves the sound at its normal level. */
export const stopTransition = () => {
    window.clearInterval(ghostTimer);
    window.clearTimeout(fadeTimer);
    cancelPlaying?.();
    cancelPlaying = null;
    if (ghost) {
        ghost.pause();
        ghost.removeAttribute('src');
        ghost.load();
        ghost = null;
    }
    if (chain) {
        const now = chain.context.currentTime;
        chain.fader.gain.cancelScheduledValues(now);
        chain.fader.gain.setValueAtTime(1, now);
    }
};

/** The copy may arrive late from a busy server: it goes to where the song is now, so the sound does not jump back. */
const alignCopy = (copy: HTMLAudioElement, element: HTMLAudioElement) => new Promise<void>(resolve => {
    if (Math.abs(element.currentTime - copy.currentTime) < 0.12) {
        resolve();
        return;
    }
    let limit = 0;
    const done = () => {
        window.clearTimeout(limit);
        copy.removeEventListener('seeked', done);
        resolve();
    };
    limit = window.setTimeout(done, 1500);
    copy.addEventListener('seeked', done);
    copy.currentTime = element.currentTime + 0.05;
});

/**
 * Mixes into the next song: a copy of the song that ends keeps sounding and fades out while the next one starts
 * and fades in. If the song cannot be copied (it is being converted) the songs simply follow each other.
 */
export const crossfade = async (player: object | null, seconds: number, next: () => void) => {
    const element = document.querySelector<HTMLAudioElement>('audio.mediaPlayerAudio');
    const source = element?.currentSrc ?? '';
    const current = ensureChain(player);
    if (!element || !current || !source || source.startsWith('blob:') || source.includes('.m3u8')) return false;

    stopTransition();
    const copy = new Audio();
    copy.crossOrigin = element.crossOrigin;
    copy.preload = 'auto';
    copy.volume = element.volume;
    copy.src = source;
    try {
        await new Promise<void>((resolve, reject) => {
            copy.addEventListener('loadedmetadata', () => resolve(), { once: true });
            copy.addEventListener('error', () => reject(new Error('copy failed')), { once: true });
        });
        copy.currentTime = element.currentTime;
        await copy.play();
        await alignCopy(copy, element);
    } catch {
        copy.removeAttribute('src');
        return false;
    }
    ghost = copy;
    void current.context.resume();

    const { fader, context } = current;
    fader.gain.cancelScheduledValues(context.currentTime);
    fader.gain.setValueAtTime(0.0001, context.currentTime);
    next();

    const started = performance.now();
    const startVolume = copy.volume;
    ghostTimer = window.setInterval(() => {
        const left = 1 - ((performance.now() - started) / (seconds * 1000));
        if (left <= 0) {
            stopGhostOnly();
            return;
        }
        copy.volume = Math.max(0, startVolume * left * left);
    }, 50);

    // The next song comes up when it really starts (from a remote drive it may take a moment)
    const rise = () => {
        window.clearTimeout(fadeTimer);
        cancelPlaying?.();
        cancelPlaying = null;
        const now = context.currentTime;
        fader.gain.cancelScheduledValues(now);
        fader.gain.setValueAtTime(0.0001, now);
        fader.gain.linearRampToValueAtTime(1, now + seconds);
    };
    element.addEventListener('playing', rise, { once: true });
    cancelPlaying = () => element.removeEventListener('playing', rise);
    fadeTimer = window.setTimeout(rise, 8000);
    return true;
};

const stopGhostOnly = () => {
    window.clearInterval(ghostTimer);
    if (ghost) {
        ghost.pause();
        ghost.removeAttribute('src');
        ghost.load();
        ghost = null;
    }
};
