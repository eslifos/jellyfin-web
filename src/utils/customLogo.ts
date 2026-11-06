/**
 * Custom branding logo (server endpoint /Branding/Logo, see CustomLogoController).
 *
 * Loads which custom logos exist, overrides the CSS logos (header, splash,
 * login, wizard) and the favicon, and exposes the URLs to React through
 * `useCustomLogo`. Falls back to the default Jellyfin images.
 */
import { useSyncExternalStore } from 'react';

import defaultBanner from '@jellyfin/ux-web/banner-light.png';
import defaultIcon from '@jellyfin/ux-web/icon-transparent.png';

export type CustomLogoType = 'Icon' | 'Banner';

interface CustomLogoState {
    iconUrl: string
    bannerUrl: string
    hasCustomIcon: boolean
    hasCustomBanner: boolean
}

interface CustomLogoInfo {
    IconTag?: string | null
    BannerTag?: string | null
}

const STYLE_ID = 'jf-custom-logo-style';

let serverBase = '';
let state: CustomLogoState = {
    iconUrl: defaultIcon,
    bannerUrl: defaultBanner,
    hasCustomIcon: false,
    hasCustomBanner: false
};
const listeners = new Set<() => void>();

/** Server base URL; the web client is normally served from `<server>/web/`. */
const getServerBase = () => {
    if (serverBase) return serverBase;
    const path = window.location.pathname;
    const index = path.lastIndexOf('/web/');
    return window.location.origin + (index >= 0 ? path.slice(0, index) : '');
};

export const getCustomLogoUrl = (type: CustomLogoType, tag?: string | null) => (
    `${getServerBase()}/Branding/Logo?type=${type}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`
);

const applyStyles = () => {
    let style = document.getElementById(STYLE_ID);
    if (!state.hasCustomIcon && !state.hasCustomBanner) {
        style?.remove();
    } else {
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }

        const banner = `url("${state.bannerUrl}")`;
        const icon = `url("${state.iconUrl}")`;
        style.textContent = [
            state.hasCustomBanner && `.pageTitleWithDefaultLogo { background-image: ${banner} !important; }`,
            state.hasCustomBanner && `@media screen and (min-device-width: 992px) { .splashLogo { background-image: ${banner} !important; } }`,
            state.hasCustomBanner && `.wizardContent::before, html > .padded-left::before { background-image: ${banner} !important; }`,
            state.hasCustomIcon && `.layout-tv .pageTitleWithDefaultLogo, .splashLogo { background-image: ${icon} !important; }`,
            // Re-apply the desktop banner after the icon rule so it keeps priority
            state.hasCustomBanner && `@media screen and (min-device-width: 992px) { .splashLogo { background-image: ${banner} !important; } }`
        ].filter(Boolean).join('\n');
    }

    if (state.hasCustomIcon) {
        document.querySelectorAll<HTMLLinkElement>('link[rel="shortcut icon"], link[rel="icon"], link[rel="apple-touch-icon"]').forEach(link => {
            link.href = state.iconUrl;
        });
    }
};

const setState = (next: CustomLogoState) => {
    state = next;
    applyStyles();
    listeners.forEach(listener => listener());
};

/** Fetches the custom logo info from the server and applies it. */
export const refreshCustomLogo = async () => {
    try {
        const response = await fetch(`${getServerBase()}/Branding/Logo/Info`, { cache: 'no-store' });
        if (!response.ok) return;
        const info = await response.json() as CustomLogoInfo;
        setState({
            iconUrl: info.IconTag ? getCustomLogoUrl('Icon', info.IconTag) : defaultIcon,
            bannerUrl: info.BannerTag ? getCustomLogoUrl('Banner', info.BannerTag) : defaultBanner,
            hasCustomIcon: Boolean(info.IconTag),
            hasCustomBanner: Boolean(info.BannerTag)
        });
    } catch (err) {
        console.warn('[customLogo] failed to load custom logo info', err);
    }
};

/** Called at startup with the server address the app connects to. */
export const initCustomLogo = (address?: string | null) => {
    if (address) serverBase = address.replace(/\/+$/, '');
    void refreshCustomLogo();
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const getSnapshot = () => state;

/** Current logo URLs (custom or default Jellyfin). */
export const useCustomLogo = () => useSyncExternalStore(subscribe, getSnapshot);
