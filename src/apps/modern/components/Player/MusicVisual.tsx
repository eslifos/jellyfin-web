/**
 * The show of the music player: the cover and the bars around it hit with the bass of the song (hard with heavy drums,
 * softly in a ballad), sparks on each hit, the colors of the album and the real shape of the song. When the sound
 * cannot be read (another device, iPhone) it follows the measured tempo and energy of the song instead.
 */
import React, { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getAnalyser } from './audioEngine';
import { createSoundMotion } from './soundMotion';
import { prefersReducedMotion, scrollBehavior } from 'utils/reducedMotion';

const BARS = 88;
const MAX_SPARKS = 36;
/** How much the cover grows on the hardest hit. */
const COVER_HIT = 0.1;
/** Two lively colors of the album and a deep one for the background. */
export type SongColors = [string, string, string];

const DEFAULT_COLORS: SongColors = [ '#ff5c8a', '#9b6bff', '#1c1230' ];
const HUE_GROUPS = 24;
const GRAY_COVER = 0.05;
/** The movement is measured in frames: a 90 or 120 Hz phone is drawn at 60 so it moves like everywhere else. */
const MIN_FRAME_MS = 15;
const knownColors = new Map<string, SongColors>();

export const decodeWave = (waveform?: string | null) => {
    if (!waveform) return [];
    try {
        return Array.from(atob(waveform), c => c.charCodeAt(0));
    } catch {
        return [];
    }
};

/** A shape for a song that was not analyzed yet, always the same for that song. */
export const standInWave = (id: string) => {
    let seed = 7;
    for (const c of id) seed = ((seed * 31) + c.charCodeAt(0)) % 9973;
    return Array.from({ length: 96 }, (_, i) => {
        const body = Math.sin((i / 95) * Math.PI);
        const ripple = (Math.sin((i * 0.41) + seed) + Math.sin((i * 1.13) + (seed / 3))) / 2;
        return Math.round(26 + (body * 30) + (ripple * 16));
    });
};

/** Centers something inside its own scrolling box, without moving the rest of the screen. */
export const centerInside = (scroller: Element | null | undefined, target: Element | null | undefined) => {
    if (!scroller || !target) return;
    const box = scroller.getBoundingClientRect();
    const place = target.getBoundingClientRect();
    scroller.scrollTo({ top: scroller.scrollTop + place.top - box.top - ((box.height - place.height) / 2), behavior: scrollBehavior() });
};

const toHsl = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const light = (max + min) / 2;
    const delta = max - min;
    if (!delta) return { hue: 0, saturation: 0, light };
    const saturation = delta / (1 - Math.abs((2 * light) - 1));
    let hue = ((g - b) / 255 / delta) % 6;
    if (max === g / 255) hue = ((b - r) / 255 / delta) + 2;
    if (max === b / 255) hue = ((r - g) / 255 / delta) + 4;
    return { hue: (hue * 60 + 360) % 360, saturation, light };
};

const hueGap = (a: number, b: number) => {
    const gap = Math.abs(a - b);
    return Math.min(gap, 360 - gap);
};

const pickColors = (pixels: Uint8ClampedArray): SongColors => {
    const groups = Array.from({ length: HUE_GROUPS }, () => ({ weight: 0, x: 0, y: 0, saturation: 0 }));
    let total = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const { hue, saturation, light } = toHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
        const weight = saturation * (1 - Math.abs((2 * light) - 1));
        const group = groups[Math.floor(hue / (360 / HUE_GROUPS)) % HUE_GROUPS];
        const angle = (hue * Math.PI) / 180;
        group.weight += weight;
        group.x += Math.cos(angle) * weight;
        group.y += Math.sin(angle) * weight;
        group.saturation += saturation * weight;
        total += weight;
    }
    const hueOf = (g: { x: number, y: number }) => Math.round(((Math.atan2(g.y, g.x) * 180) / Math.PI) + 360) % 360;
    const ranked = groups.filter(g => g.weight > 0).sort((a, b) => b.weight - a.weight);
    const first = ranked[0];
    if (!first) return [ 'hsl(230 10% 74%)', 'hsl(230 8% 54%)', 'hsl(230 10% 13%)' ];
    const hue = hueOf(first);
    // A black and white cover keeps its sober tones instead of getting colors it does not have
    if (total / (pixels.length / 4) < GRAY_COVER) return [ `hsl(${hue} 14% 76%)`, `hsl(${hue} 10% 56%)`, `hsl(${hue} 12% 13%)` ];
    const second = ranked.find(g => hueGap(hueOf(g), hue) > 35 && g.weight > first.weight * 0.12);
    const other = second ? hueOf(second) : (hue + 38) % 360;
    const saturation = Math.round(Math.max(48, Math.min(90, (first.saturation / first.weight) * 100)));
    return [ `hsl(${hue} ${saturation}% 66%)`, `hsl(${other} ${saturation}% 60%)`, `hsl(${hue} ${Math.min(saturation, 68)}% 15%)` ];
};

/** The colors of the album cover; the last ones stay until the new cover is read, so they change smoothly. */
export const useCoverColors = (url?: string | null) => {
    const [ colors, setColors ] = useState<SongColors>(() => (url && knownColors.get(url)) || DEFAULT_COLORS);
    useEffect(() => {
        if (!url) {
            setColors(DEFAULT_COLORS);
            return;
        }
        const known = knownColors.get(url);
        if (known) {
            setColors(known);
            return;
        }
        let live = true;
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            if (!live) return;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 32;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) return;
                context.drawImage(image, 0, 0, 32, 32);
                const picked = pickColors(context.getImageData(0, 0, 32, 32).data);
                knownColors.set(url, picked);
                setColors(picked);
            } catch {
                setColors(DEFAULT_COLORS);
            }
        };
        image.src = url;
        return () => {
            live = false;
            image.onload = null;
        };
    }, [ url ]);
    return colors;
};

interface Spark {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
    note: boolean;
    second: boolean;
}

interface VisualizerProps {
    player: object | null;
    playing: boolean;
    remote: boolean;
    bpm?: number | null;
    energy?: number | null;
    waveform: number[];
    positionMs: number;
    durationMs: number;
    colors: SongColors;
}

/** Distance from the centre to the edge of the rounded cover, in that direction. */
const edgeOf = (angle: number, half: number) => Math.min(half / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle))), half * 1.24);

const levelAt = (wave: number[], at: number, total: number) => {
    if (!wave.length || total <= 0) return 0.6;
    return (wave[Math.min(wave.length - 1, Math.floor((at / total) * wave.length))] ?? 60) / 100;
};

const drawBars = (
    context: CanvasRenderingContext2D,
    levels: Float32Array,
    values: Float32Array,
    shown: number,
    paint: CanvasGradient | string,
    grow: number
) => {
    const centre = shown / 2;
    const half = shown * 0.41 * (1 + (grow * COVER_HIT));
    context.beginPath();
    for (let i = 0; i < BARS; i++) {
        const mirrored = i < BARS / 2 ? i : BARS - 1 - i;
        const value = values[mirrored];
        levels[i] += (value - levels[i]) * (value > levels[i] ? 0.62 : 0.17);

        const angle = ((i / BARS) * Math.PI * 2) - (Math.PI / 2);
        const start = edgeOf(angle, half) + (shown * 0.012);
        const room = Math.max(1, (shown * 0.497) - start);
        const length = Math.min(room, 2 + (levels[i] * shown * 0.1));
        context.moveTo(centre + Math.cos(angle) * start, centre + Math.sin(angle) * start);
        context.lineTo(centre + Math.cos(angle) * (start + length), centre + Math.sin(angle) * (start + length));
    }
    context.strokeStyle = paint;
    context.lineWidth = Math.max(2, shown / 200);
    context.lineCap = 'round';
    context.stroke();
};

const drawSparks = (context: CanvasRenderingContext2D, sparks: Spark[], shown: number, colors: SongColors) => {
    context.font = `${Math.round(shown / 26)}px sans-serif`;
    for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.016;
        if (s.life <= 0) {
            sparks.splice(i, 1);
            continue;
        }
        context.globalAlpha = s.life;
        context.fillStyle = s.second ? colors[1] : colors[0];
        if (s.note) {
            context.fillText('♪', s.x, s.y);
        } else {
            context.beginPath();
            context.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            context.fill();
        }
    }
    context.globalAlpha = 1;
};

export const SongVisualizer: FC<VisualizerProps> = ({ player, playing, remote, bpm, energy, waveform, positionMs, durationMs, colors }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Read while it draws: a new song changes them without restarting the animation
    const place = useRef({ waveform, positionMs, durationMs, bpm, energy, colors });
    place.current = { waveform, positionMs, durationMs, bpm, energy, colors };

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const stage = canvas?.parentElement;
        if (!canvas || !context || !stage) return;
        if (!playing || prefersReducedMotion()) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            stage.style.setProperty('--abp-beat', '0');
            return;
        }

        const levels = new Float32Array(BARS);
        const motion = createSoundMotion(BARS / 2);
        const sparks: Spark[] = [];
        let analyser: AnalyserNode | null = null;
        let sound: Uint8Array<ArrayBuffer> | null = null;
        let frame = 0;
        let count = 0;
        let width = 0;
        let paint: CanvasGradient | string = place.current.colors[0];
        let painted: SongColors | null = null;
        let lastFrame = 0;

        const hit = (cx: number, cy: number, half: number) => {
            const amount = 1 + Math.round(motion.heaviness() * 3);
            for (let i = 0; i < amount && sparks.length < MAX_SPARKS; i++) {
                const angle = Math.random() * Math.PI * 2;
                const from = edgeOf(angle, half) + (half * 0.14);
                const speed = (0.5 + Math.random()) * (width / 340);
                sparks.push({
                    x: cx + Math.cos(angle) * from,
                    y: cy + Math.sin(angle) * from,
                    vx: Math.cos(angle) * speed,
                    vy: (Math.sin(angle) * speed) - 0.25,
                    life: 1,
                    size: 1.5 + (Math.random() * 2.5),
                    note: Math.random() < 0.3,
                    second: Math.random() < 0.5
                });
            }
        };

        const resize = (shown: number, ratio: number) => {
            const now = place.current.colors;
            if (shown === width && now === painted) return;
            if (shown !== width) {
                width = shown;
                canvas.width = Math.round(shown * ratio);
                canvas.height = Math.round(shown * ratio);
            }
            painted = now;
            const gradient = context.createLinearGradient(0, 0, shown, shown);
            gradient.addColorStop(0, now[0]);
            gradient.addColorStop(1, now[1]);
            paint = gradient;
        };

        /** The sound right now, or null if it cannot be read. */
        const listen = () => {
            if (!analyser && !remote && count % 60 === 0) {
                analyser = getAnalyser(player);
                sound = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
            }
            count++;
            if (!analyser || !sound) return null;
            analyser.getByteFrequencyData(sound);
            return sound.some(v => v > 0) ? sound : null;
        };

        const move = (now: number, dt: number) => {
            const heard = listen();
            if (heard && analyser) return motion.hear(heard, analyser.context.sampleRate / analyser.fftSize, now, dt);
            const { waveform: wave, positionMs: at, durationMs: total, bpm: tempo, energy: power } = place.current;
            return motion.keepTempo(now, dt, tempo, power, levelAt(wave, at, total));
        };

        const draw = (now: number) => {
            frame = requestAnimationFrame(draw);
            if (lastFrame && now - lastFrame < MIN_FRAME_MS) return;
            const shown = canvas.clientWidth;
            if (!shown) return;
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            resize(shown, ratio);
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            context.clearRect(0, 0, shown, shown);

            const dt = lastFrame ? Math.min(64, now - lastFrame) : 16;
            lastFrame = now;
            const isHit = move(now, dt);
            const grow = motion.strength();
            if (isHit) hit(shown / 2, shown / 2, shown * 0.41 * (1 + (grow * COVER_HIT)));
            stage.style.setProperty('--abp-beat', grow.toFixed(3));
            drawBars(context, levels, motion.levels, shown, paint, grow);
            drawSparks(context, sparks, shown, place.current.colors);
        };
        frame = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(frame);
            stage.style.setProperty('--abp-beat', '0');
        };
    }, [ player, playing, remote ]);

    return <canvas ref={canvasRef} className='abp-viz' aria-hidden='true' />;
};

/** The real shape of the song; touching it jumps to that moment. */
export const SongWave: FC<{ waveform: number[], percent: number, playing: boolean, durationMs: number, onSeekTo: (ms: number) => void }> = ({ waveform, percent, playing, durationMs, onSeekTo }) => {
    const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        if (box.width > 0 && durationMs > 0) onSeekTo(((e.clientX - box.left) / box.width) * durationMs);
    }, [ durationMs, onSeekTo ]);
    const reached = Math.floor((percent / 100) * waveform.length);
    const bars = useMemo(() => waveform.map((value, i) => ({ id: i, height: `${Math.max(8, value)}%` })), [ waveform ]);
    return (
        <button type='button' className={playing ? 'abp-songwave is-playing' : 'abp-songwave'} onClick={onClick} tabIndex={-1} aria-hidden='true'>
            {bars.map(b => <i key={b.id} className={b.id <= reached ? 'is-past' : undefined} style={{ height: b.height }} />)}
        </button>
    );
};
