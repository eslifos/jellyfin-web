import { pluginManager } from 'components/pluginManager';

/**
 * Why Google Cast (Chromecast from the Cast SDK) is or is not available in this browser.
 * - ready: there are Cast devices in the network
 * - none: Cast works, but no device was found
 * - loading: still starting
 * - insecure: Chrome only allows the Cast SDK on https pages (or localhost)
 * - browser: not a Chromium browser (Chrome, Edge…)
 * - unsupported: the Cast plugin is not loaded
 */
export type CastStatus = 'ready' | 'none' | 'loading' | 'insecure' | 'browser' | 'unsupported';

interface CastPlugin {
    id: string
    _castPlayer?: { hasReceivers?: boolean, isInitialized?: boolean }
}

const isChromium = () => {
    const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
    if (brands?.some(b => /Chrom|Edge/i.test(b.brand))) return true;
    return /Chrome|CriOS|Edg\//.test(navigator.userAgent);
};

export function getCastStatus(): CastStatus {
    const plugin = (pluginManager.plugins as CastPlugin[]).find(p => p.id === 'chromecast');
    if (!plugin) return 'unsupported';
    if (!isChromium()) return 'browser';
    if (!window.isSecureContext) return 'insecure';
    const castPlayer = plugin._castPlayer;
    if (!castPlayer?.isInitialized) return 'loading';
    return castPlayer.hasReceivers ? 'ready' : 'none';
}

export const CAST_STATUS_TEXT: Record<Exclude<CastStatus, 'ready'>, string> = {
    none: 'RpCastNone',
    loading: 'RpCastLoading',
    insecure: 'RpCastInsecure',
    browser: 'RpCastBrowser',
    unsupported: 'GoogleCastUnsupported'
};
