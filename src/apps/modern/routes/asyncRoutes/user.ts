import { AsyncRoute } from 'components/router/AsyncRoute';
import { AppType } from 'constants/appType';

export const ASYNC_USER_ROUTES: AsyncRoute[] = [
    { path: 'home', type: AppType.Modern },
    { path: 'homevideos', type: AppType.Modern },
    { path: 'livetv', type: AppType.Modern },
    { path: 'movies', type: AppType.Modern },
    { path: 'music', type: AppType.Modern },
    { path: 'books', type: AppType.Modern },
    { path: 'musicvideos', type: AppType.Modern },
    { path: 'boxsets', type: AppType.Modern },
    { path: 'playlists', type: AppType.Modern },
    { path: 'mixed', type: AppType.Modern },
    { path: 'mypreferencesdisplay', page: 'user/display' },
    { path: 'mypreferenceshome', page: 'user/home' },
    { path: 'mypreferencesplayback', page: 'user/playback' },
    { path: 'mypreferencessubtitles', page: 'user/subtitles' },
    { path: 'mypreferencescontrols', page: 'user/controls' },
    { path: 'profiles', page: 'user/profiles' },
    { path: 'mypreferencesmenu', page: 'user/settings' },
    { path: 'quickconnect', page: 'quickConnect' },
    { path: 'search' },
    { path: 'tv', page: 'shows', type: AppType.Modern },
    { path: 'upcoming', type: AppType.Modern },
    { path: 'userprofile', page: 'user/userprofile' }
];
