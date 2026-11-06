/** Pages reached from the settings menu (/mypreferencesmenu). */
const SETTINGS_SUB_PATHS = [
    '/userprofile',
    '/quickconnect',
    '/mypreferencesdisplay',
    '/mypreferenceshome',
    '/mypreferencesplayback',
    '/mypreferencessubtitles',
    '/mypreferencescontrols'
];

export const isSettingsSubPath = (pathname: string) => SETTINGS_SUB_PATHS.includes(pathname);
