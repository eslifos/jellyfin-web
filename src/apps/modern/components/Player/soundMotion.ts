/**
 * Turns the sound of a song into movement. Each band adapts to the level of the song, so quiet and loud masters
 * both move, and how hard everything hits depends on how much bass and punch the song really has: a song with heavy
 * drums jumps, a ballad breathes.
 */

const LOWEST_HZ = 45;
const HIGHEST_HZ = 14000;
const BASS_FROM_HZ = 35;
const BASS_TO_HZ = 140;
const MID_FROM_HZ = 400;
const MID_TO_HZ = 3000;
const MIN_HIT_GAP_MS = 190;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const follow = (dt: number, ms: number) => 1 - Math.exp(-dt / ms);

const averageOf = (sound: Uint8Array, from: number, to: number) => {
    const last = Math.min(sound.length - 1, Math.max(from, to));
    let sum = 0;
    for (let i = from; i <= last; i++) sum += sound[i];
    return sum / Math.max(1, last - from + 1) / 255;
};

export const createSoundMotion = (size: number) => {
    const levels = new Float32Array(size);
    const peaks = new Float32Array(size).fill(0.4);
    const means = new Float32Array(size).fill(0.25);
    let slowBass = -1;
    let slowMid = 0;
    let lastBass = 0;
    let punch = 0.03;
    let heavy = 0.35;
    let kick = 0;
    let lastHit = -MIN_HIT_GAP_MS;
    let lastPhase = 1;

    const fall = (dt: number) => {
        kick *= Math.exp(-dt / (150 + ((1 - heavy) * 170)));
    };

    /** How strong the low bars get with each hit, for a position from 0 (bass) to 1 (treble). */
    const lowBoost = (k: number) => kick * Math.pow(1 - k, 2) * (0.22 + (0.62 * heavy));

    const measureHeaviness = (bass: number, mid: number, dt: number) => {
        if (slowBass < 0) {
            slowBass = bass;
            slowMid = mid;
        }
        slowBass += (bass - slowBass) * follow(dt, 1400);
        slowMid += (mid - slowMid) * follow(dt, 1400);
        const swing = bass - slowBass;
        punch += (Math.abs(swing) - punch) * follow(dt, 2500);
        const share = clamp(((slowBass / Math.max(slowMid, 0.05)) - 1) / 0.5);
        const punchy = clamp((punch - 0.012) / 0.034);
        heavy += (clamp((share * 0.25) + (punchy * 0.85)) - heavy) * follow(dt, 1800);
        return swing;
    };

    const readBands = (sound: Uint8Array, hzPerBin: number, dt: number) => {
        for (let i = 0; i < size; i++) {
            const k = size > 1 ? i / (size - 1) : 0;
            const hz = LOWEST_HZ * Math.pow(HIGHEST_HZ / LOWEST_HZ, k);
            const from = Math.max(1, Math.floor((hz * 0.87) / hzPerBin));
            const to = Math.max(from, Math.ceil((hz * 1.15) / hzPerBin));
            const value = averageOf(sound, from, to);
            means[i] += (value - means[i]) * follow(dt, 1800);
            peaks[i] = Math.max(value, peaks[i] * Math.exp(-dt / 5000));
            const floor = means[i] * 0.72;
            const shaped = Math.pow(clamp((value - floor) / Math.max(peaks[i] - floor, 0.1)), 1.35);
            levels[i] = (shaped * (0.4 + (0.6 * heavy))) + lowBoost(k);
        }
    };

    return {
        levels,
        /** How hard the cover and the bars hit right now, from 0 to 1. */
        strength: () => clamp(kick * (0.16 + (0.84 * heavy))),
        heaviness: () => heavy,

        /** Follows the real sound; says whether this moment is a hit. */
        hear: (sound: Uint8Array, hzPerBin: number, now: number, dt: number) => {
            const bass = averageOf(sound, Math.max(1, Math.round(BASS_FROM_HZ / hzPerBin)), Math.round(BASS_TO_HZ / hzPerBin));
            const mid = averageOf(sound, Math.round(MID_FROM_HZ / hzPerBin), Math.round(MID_TO_HZ / hzPerBin));
            const swing = measureHeaviness(bass, mid, dt);
            const isHit = swing > Math.max(0.012, punch * 1.25) && bass > lastBass && bass > 0.25 && now - lastHit > MIN_HIT_GAP_MS;
            fall(dt);
            if (isHit) {
                lastHit = now;
                kick = Math.max(kick, 0.5 + (clamp(swing / 0.16) * 0.5));
            }
            lastBass = bass;
            readBands(sound, hzPerBin, dt);
            return isHit;
        },

        /** Without access to the sound (iPhone, another device): the measured tempo and energy of the song. */
        keepTempo: (now: number, dt: number, bpm: number | null | undefined, energy: number | null | undefined, here: number) => {
            heavy += (clamp(energy ?? 0.4) - heavy) * follow(dt, 800);
            const beatSeconds = 60 / (bpm || 100);
            const phase = ((now / 1000) % beatSeconds) / beatSeconds;
            const isHit = phase < lastPhase;
            lastPhase = phase;
            fall(dt);
            if (isHit) kick = 0.55 + (0.45 * heavy);
            for (let i = 0; i < size; i++) {
                const k = size > 1 ? i / (size - 1) : 0;
                const ripple = (Math.sin((now / 260) + (k * 14)) + 1) / 2;
                levels[i] = (here * (0.14 + (0.26 * ripple)) * (0.5 + (0.5 * heavy))) + lowBoost(k);
            }
            return isHit;
        }
    };
};
