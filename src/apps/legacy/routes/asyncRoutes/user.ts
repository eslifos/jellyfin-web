import { AsyncRoute } from '../../../../components/router/AsyncRoute';

export const ASYNC_USER_ROUTES: AsyncRoute[] = [
    { path: 'mypreferencesmenu', page: 'user/settings' },
    { path: 'mypreferencesdisplay', page: 'user/display' },
    { path: 'mypreferenceshome', page: 'user/home' },
    { path: 'mypreferencesplayback', page: 'user/playback' },
    { path: 'mypreferencessubtitles', page: 'user/subtitles' },
    { path: 'mypreferencescontrols', page: 'user/controls' },
    { path: 'profiles', page: 'user/profiles' },
    { path: 'quickconnect', page: 'quickConnect' },
    { path: 'search', page: 'search' },
    { path: 'userprofile', page: 'user/userprofile' }
];