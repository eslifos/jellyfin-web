/**
 * Per-user look of the home library bar (order, hidden items, colors, labels).
 * Saved in the user's display preferences, so it follows the account across devices.
 */
import * as userSettings from 'scripts/settings/userSettings';

export const UNIVERSES_KEY = 'universes';
const SETTING = 'homeLibraryNav';

export type LabelMode = 'auto' | 'always' | 'icons';

export interface NavSettings {
    order: string[];
    hidden: string[];
    background: string;
    customColor: string;
    opacity: number;
    accent: string;
    labels: LabelMode;
    glow: boolean;
    sticky: boolean;
}

export interface BackgroundPreset {
    id: string;
    colors: [string, string];
}

export const BACKGROUNDS: BackgroundPreset[] = [
    { id: 'cosmic', colors: [ '#080a16', '#080a16' ] },
    { id: 'black', colors: [ '#000000', '#000000' ] },
    { id: 'navy', colors: [ '#0b1a33', '#0b1a33' ] },
    { id: 'nebula', colors: [ '#2a1240', '#0f1a3a' ] },
    { id: 'ocean', colors: [ '#04303d', '#0a1022' ] },
    { id: 'ember', colors: [ '#3a0f12', '#140a18' ] }
];

export const ACCENTS = [ '#00a4dc', '#aa5cc3', '#1ce783', '#ffca28', '#ff5c8a', '#ff7a1a', '#ffffff' ];

export const DEFAULT_SETTINGS: NavSettings = {
    order: [],
    hidden: [],
    background: 'cosmic',
    customColor: '#1b2440',
    opacity: 82,
    accent: '#00a4dc',
    labels: 'auto',
    glow: true,
    sticky: true
};

const HEX = /^#[0-9a-f]{6}$/i;

export const loadNavSettings = (): NavSettings => {
    try {
        const raw = userSettings.get(SETTING, true) as string | null | undefined;
        if (!raw) return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw) as Partial<NavSettings>;
        const s = { ...DEFAULT_SETTINGS, ...parsed };
        // Sanitize everything that ends up in styles
        if (!Array.isArray(s.order)) s.order = [];
        if (!Array.isArray(s.hidden)) s.hidden = [];
        if (!HEX.test(s.customColor)) s.customColor = DEFAULT_SETTINGS.customColor;
        if (!HEX.test(s.accent)) s.accent = DEFAULT_SETTINGS.accent;
        if (s.background !== 'custom' && !BACKGROUNDS.some(b => b.id === s.background)) s.background = DEFAULT_SETTINGS.background;
        if (![ 'auto', 'always', 'icons' ].includes(s.labels)) s.labels = 'auto';
        s.opacity = Math.min(100, Math.max(20, Number(s.opacity) || DEFAULT_SETTINGS.opacity));
        return s;
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
};

export const saveNavSettings = (s: NavSettings) => {
    userSettings.set(SETTING, JSON.stringify(s), true);
};

export const rgba = (hex: string, alpha: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const backgroundCss = (s: NavSettings) => {
    const a = s.opacity / 100;
    if (s.background === 'custom') return rgba(s.customColor, a);
    const preset = BACKGROUNDS.find(b => b.id === s.background) || BACKGROUNDS[0];
    const [ c1, c2 ] = preset.colors;
    return c1 === c2 ? rgba(c1, a) : `linear-gradient(135deg, ${rgba(c1, a)}, ${rgba(c2, a)})`;
};

/** Item keys in the user's order: saved order first, then anything new at the end (Universes last). */
export const orderKeys = (viewIds: string[], s: NavSettings) => {
    const all = [ ...viewIds, UNIVERSES_KEY ];
    const known = s.order.filter(k => all.includes(k));
    const missing = all.filter(k => !known.includes(k));
    // New libraries go before Universes if Universes was never placed by the user
    if (!known.includes(UNIVERSES_KEY)) {
        return [ ...known, ...missing.filter(k => k !== UNIVERSES_KEY), UNIVERSES_KEY ];
    }
    return [ ...known, ...missing ];
};
