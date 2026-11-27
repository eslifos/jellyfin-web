/**
 * TV app: the settings of the web that also show in the native settings of the app (Settings > Client settings),
 * kept the same on both sides:
 *  - the web tells the app their values (NativeInterface.setTvSettings) on start, on each screen and on each change;
 *  - a change in the native settings comes as the event "cosmictvsetting" ({ name, value }) and is saved here.
 * Automatic trailers (TV home) and the size of the subtitles (which the app's own player takes too).
 */
import { currentSettings as userSettings } from 'scripts/settings/userSettings';
import Events from 'utils/events';

import { TV_TRAILERS_SETTING, tvTrailersEnabled } from '../QuickHome/tvHero';

interface NativeTvSettings {
    setTvSettings?: (json: string) => void;
}

const native = () => (window as unknown as { NativeInterface?: NativeTvSettings }).NativeInterface;

/** The event of the app with a change of its settings. */
export const TV_SETTING_EVENT = 'cosmictvsetting';
/** The key of the subtitle appearance of this device's player (userSettings.getSubtitleAppearanceSettings). */
const SUBTITLE_APPEARANCE_KEY = 'localplayersubtitleappearance3';
/** The size names of the subtitle appearance; the default (medium) is stored empty. */
const SUBTITLE_SIZES = [ 'smaller', 'small', 'medium', 'large', 'larger', 'extralarge' ];
const MEDIUM = 'medium';

interface Appearance {
    textSize?: string;
}

/** The subtitle size of the appearance settings, as the app names it ("medium" for the default). */
export const subtitleSizeOf = (appearance: Appearance | null | undefined) => {
    const size = appearance?.textSize;
    return size && SUBTITLE_SIZES.includes(size) ? size : MEDIUM;
};

/** The appearance settings with the size of the app (the default stored empty, as the web does). */
export const withSubtitleSize = <T extends Appearance>(appearance: T, size: unknown): T => ({
    ...appearance,
    textSize: typeof size === 'string' && SUBTITLE_SIZES.includes(size) && size !== MEDIUM ? size : ''
});

const currentValues = () => JSON.stringify({
    trailers: tvTrailersEnabled(),
    subtitleSize: subtitleSizeOf(userSettings.getSubtitleAppearanceSettings(SUBTITLE_APPEARANCE_KEY) as Appearance)
});

let installed = false;
let lastTold = '';

/** Once, in the TV app. */
export const installTvSettings = () => {
    if (installed || typeof native()?.setTvSettings !== 'function') return;
    installed = true;

    const tell = () => {
        const values = currentValues();
        if (values === lastTold) return;
        lastTold = values;
        try {
            native()?.setTvSettings?.(values);
        } catch (err) {
            console.warn('[tvSettings] the app could not take the settings', err);
        }
    };

    // Each screen (the user's settings load after signing in, or with another profile) and each change
    document.addEventListener('viewshow', tell, true);
    Events.on(userSettings, 'change', (_e: unknown, name?: string) => {
        if (name === TV_TRAILERS_SETTING || name === SUBTITLE_APPEARANCE_KEY) tell();
    });

    window.addEventListener(TV_SETTING_EVENT, (e: Event) => {
        const { name, value } = (e as CustomEvent<{ name?: string; value?: unknown }>).detail ?? {};
        if (name === 'trailers' && typeof value === 'boolean') {
            userSettings.set(TV_TRAILERS_SETTING, String(value));
        } else if (name === 'subtitleSize') {
            const appearance = userSettings.getSubtitleAppearanceSettings(SUBTITLE_APPEARANCE_KEY) as Appearance;
            userSettings.setSubtitleAppearanceSettings(withSubtitleSize(appearance, value), SUBTITLE_APPEARANCE_KEY);
        }
        tell();
    });
};
