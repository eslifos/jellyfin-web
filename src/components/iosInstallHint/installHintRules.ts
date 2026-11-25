/**
 * When to show the "add to Home Screen" hint: Safari on an iPhone or iPad (the only iOS browser that can add a web
 * app to the Home Screen), not already opened from it (standalone), and only once.
 */

export const IOS_INSTALL_HINT_KEY = 'jfIosInstallHintShown';

/** Other browsers on iOS also run on Safari's engine: they say who they are in the user agent. */
const OTHER_IOS_BROWSERS = /\b(CriOS|FxiOS|EdgiOS|OPiOS|OPT|YaBrowser|GSA|DuckDuckGo|Brave)\b|FBAN|FBAV|Instagram|Line\//i;

export interface IosHintInput {
    /** From scripts/browser: iOS (iPhone, iPad or iPod) and Safari's engine. */
    iOS?: boolean;
    safari?: boolean;
    userAgent: string;
    /** Opened from the Home Screen (navigator.standalone or display-mode: standalone). */
    standalone: boolean;
    /** It was shown before (localStorage). */
    shownBefore: boolean;
}

export const shouldShowIosInstallHint = ({ iOS, safari, userAgent, standalone, shownBefore }: IosHintInput): boolean =>
    !!iOS && !!safari && !standalone && !shownBefore && !OTHER_IOS_BROWSERS.test(userAgent);
