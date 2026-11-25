import { pluginManager } from 'components/pluginManager';

/**
 * Why Google Cast (Chromecast from the Cast SDK) is or is not available in this browser.
 * - ready: there are Cast devices in the network
 * - none: Cast works, but no device was found
 * - loading: still starting
 * - insecure: Chrome only allows the Cast SDK on https pages (or localhost)
 * - browser: not a Chromium browser (Chrome, Edge…)
 * - unsupported: the Cast plugin is not loaded
 * - appNoCast: this build of the phone app comes without Google Cast
 */
export type CastStatus = 'ready' | 'none' | 'loading' | 'insecure' | 'browser' | 'unsupported' | 'appNoCast';

interface CastPlugin {
    id: string
    _castPlayer?: { hasReceivers?: boolean, isInitialized?: boolean }
}

const isChromium = () => {
    const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
    if (brands?.some(b => /Chrom|Edge/i.test(b.brand))) return true;
    return /Chrome|CriOS|Edg\//.test(navigator.userAgent);
};

const getNativeApp = () => (window as unknown as { NativeShell?: { AppHost?: { supports?: (feature: string) => boolean } } }).NativeShell;

export function getCastStatus(): CastStatus {
    const nativeApp = getNativeApp();
    if (nativeApp?.AppHost?.supports?.('chromecast') === false) return 'appNoCast';
    const plugin = (pluginManager.plugins as CastPlugin[]).find(p => p.id === 'chromecast');
    if (!plugin) return 'unsupported';
    if (nativeApp) return plugin._castPlayer?.isInitialized ? 'ready' : 'loading';
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
    unsupported: 'GoogleCastUnsupported',
    appNoCast: 'RpCastAppNoCast'
};
