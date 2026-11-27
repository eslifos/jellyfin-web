/**
 * TvMenu — the one menu of the TV layout, fixed on the left of every screen (the screens move right to leave it room):
 * the profile, Search, Home, the user's libraries (in the order the user chose, see HomeLibraryNav), Universes,
 * My list, Coming up and, after a line, Settings. Folded it shows the icons, the one of the screen on view lit; with
 * the focus of the remote in it, it widens with the names and darkens the screen behind (see tvMenu for the keys).
 */
import React, { type FC, type ReactNode, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import ProfileSwitchDialog from 'components/profiles/ProfileSwitchDialog';
import UserAvatar from 'components/UserAvatar';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { fetchProfiles, shouldOfferProfilePicker } from 'utils/profiles';

import { UNIVERSES_KEY, type NavSettings, loadNavSettings } from '../HomeLibraryNav/navSettings';
import { useNavEntries } from '../HomeLibraryNav/useNavEntries';
import { isSettingsSubPath } from '../FloatingNav/settingsPaths';
import { MENU_ATTRIBUTE, closeTvMenu, focusNewScreen, installTvMenu } from './tvMenu';
import { installTvFrameRate } from './tvFrameRate';
import { TV_LINK_EVENT, openPendingTvLink } from './tvLinks';

/** Folded: icons only. The screens leave it this room (--tv-menu-width, AppOverrides.scss). */
const FOLDED = 72;
/** With the focus in it: the names too, over the screen. */
const OPEN = 320;
/** Read at 3 m. */
const LABEL_SIZE = '26px';
const ICON_SIZE = '32px';
const ACCENT = '#00a4dc';
/** The screen behind the open menu. */
const DARKEN = 'rgba(0, 0, 0, 0.6)';
/** The event the TV app fires with the search key of the remote. */
const OPEN_SEARCH_EVENT = 'cosmicopensearch';

// The remote reaches the menu on the TV layout (it acts only there)
installTvMenu();
installTvFrameRate();

const itemSx = (current: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 2, width: '100%', boxSizing: 'border-box', flexShrink: 0,
    // The icon centered in the folded menu: (72 - 2 × 12 padding - 32 icon) / 2 more on each side
    px: '12px', py: 1.25, borderRadius: '14px', border: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left',
    textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
    color: current ? '#fff' : 'rgba(255,255,255,0.7)',
    background: current ? 'rgba(0,164,220,0.22)' : 'transparent',
    transition: 'background 0.15s, color 0.15s',
    '& > svg': { fontSize: ICON_SIZE, flexShrink: 0, mx: '8px' },
    '& > .MuiAvatar-root': { width: ICON_SIZE, height: ICON_SIZE, fontSize: '20px', flexShrink: 0, mx: '8px' },
    '& > span': { fontSize: LABEL_SIZE, fontWeight: current ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0, transition: 'opacity 0.15s' },
    // Where the focus is must be seen from across the room
    '&:focus, &:hover': { outline: 'none', color: '#fff', background: 'rgba(0,164,220,0.32)', boxShadow: `inset 0 0 0 3px ${ACCENT}` }
});

interface ItemProps {
    icon: ReactNode;
    label: string;
    current?: boolean;
    to?: string;
    onClick?: () => void;
}

/**
 * Out of the focus order (tabIndex -1): the screens' own navigation never lands in the menu (it is left of
 * everything, and "below" the top of the screen); the remote opens it with left from the edge or Back (tvMenu).
 */
const Item: FC<ItemProps> = ({ icon, label, current = false, to, onClick }) => {
    const content = (
        <>
            {icon}
            <span>{label}</span>
        </>
    );
    return to ? (
        // The screen on view: the menu closes, back to it
        <Box component={Link} to={to} tabIndex={-1} onClick={current ? closeTvMenu : undefined} aria-label={label} aria-current={current ? 'page' : undefined} sx={itemSx(current)}>
            {content}
        </Box>
    ) : (
        <Box component='button' type='button' tabIndex={-1} onClick={onClick} aria-label={label} aria-current={current ? 'page' : undefined} sx={itemSx(current)}>
            {content}
        </Box>
    );
};

const TvMenu: FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useApi();
    const { hasViews, entriesFor } = useNavEntries();
    const [ settings, setSettings ] = useState<NavSettings>(loadNavSettings);
    const [ profilesOpen, setProfilesOpen ] = useState(false);

    // Display preferences may arrive after the first render (or the user changes)
    useEffect(() => {
        setSettings(loadNavSettings());
    }, [ user?.Id ]);

    // Another screen: the menu closes and the focus goes to that screen
    const screenKey = location.pathname + location.search;
    useEffect(() => {
        focusNewScreen();
    }, [ screenKey ]);

    // A program of the Android TV home screen: the one the app was opened with (before "Who is watching?", which is
    // then not asked), and the ones that arrive later
    useEffect(() => {
        const open = () => {
            openPendingTvLink().catch(err => console.warn('[TvMenu] could not open the link of the TV home screen', err));
        };
        open();
        window.addEventListener(TV_LINK_EVENT, open);
        return () => window.removeEventListener(TV_LINK_EVENT, open);
    }, []);

    // Opening the app with several profiles in the account: "Who is watching?" first (once per opening; a profile
    // chosen there reloads the app, which does not ask again)
    useEffect(() => {
        if (location.pathname !== '/home' || !shouldOfferProfilePicker()) return;
        fetchProfiles()
            .then(list => {
                if (list && list.Profiles.length > 1) navigate('/profiles?next=%2Fhome', { replace: true });
            })
            .catch(err => console.warn('[TvMenu] could not load the profiles', err));
    }, [ location.pathname, navigate ]);

    // The search key of the remote (sent by the TV app): the search screen
    useEffect(() => {
        const onOpenSearch = () => {
            window.location.hash = '#/search';
        };
        window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
        return () => window.removeEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    }, []);

    // The screens leave the menu its room while it is there
    useEffect(() => {
        document.documentElement.style.setProperty('--tv-menu-width', `${FOLDED}px`);
        return () => {
            document.documentElement.style.removeProperty('--tv-menu-width');
        };
    }, []);

    const openProfiles = useCallback(() => setProfilesOpen(true), []);
    const closeProfiles = useCallback(() => setProfilesOpen(false), []);

    const { pathname } = location;
    const params = new URLSearchParams(location.search);
    const parentId = params.get('topParentId') ?? params.get('parentId');
    const onHome = pathname === '/home';
    const onMyList = onHome && params.get('tab') === '1';

    // The user's libraries in the user's order (not the hidden ones), then Universes
    const entries = hasViews ? entriesFor(settings).filter(e => !settings.hidden.includes(e.key)) : [];
    const libraries = entries.filter(e => e.key !== UNIVERSES_KEY);
    const universes = entries.find(e => e.key === UNIVERSES_KEY);

    return (
        <>
            <Box
                component='nav'
                aria-label={globalize.translate('HeaderNavigation')}
                {...{ [MENU_ATTRIBUTE]: '' }}
                sx={{
                    position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 1100, width: FOLDED, boxSizing: 'border-box',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5, px: 0, py: 3,
                    overflowX: 'hidden', overflowY: 'auto', scrollbarWidth: 'none',
                    // Solid (no blur: it costs too much on a TV)
                    background: '#080a16', borderRight: '1px solid rgba(0,164,220,0.2)',
                    transition: 'width 0.2s ease',
                    '&:focus-within': {
                        width: OPEN, px: 1.5,
                        '& a > span, & button > span': { opacity: 1 }
                    },
                    // The screen behind, darkened while the menu is open
                    '&:focus-within + [data-tv-menu-shade]': { opacity: 1 },
                    '& hr': { border: 0, borderTop: '1px solid rgba(255,255,255,0.12)', mx: 1.5, my: 1, flexShrink: 0 }
                }}
            >
                {user && (
                // OK: who is watching (the profiles of this server)
                    <Item icon={<UserAvatar user={user} />} label={user.Name || globalize.translate('Profile')} onClick={openProfiles} current={profilesOpen} />
                )}
                <Item icon={<SearchRoundedIcon />} label={globalize.translate('Search')} to='/search' current={pathname === '/search'} />
                <Item icon={<HomeRoundedIcon />} label={globalize.translate('Home')} to='/home' current={onHome && !onMyList} />
                {libraries.map(e => (
                    <Item key={e.key} icon={e.icon} label={e.name} to={e.to} current={!!parentId && e.key === parentId} />
                ))}
                {universes && (
                    <Item icon={universes.icon} label={universes.name} to={universes.to} current={pathname.startsWith('/universe')} />
                )}
                <Item icon={<FavoriteRoundedIcon />} label={globalize.translate('TvMyList')} to='/home?tab=1' current={onMyList} />
                <Item icon={<CalendarMonthRoundedIcon />} label={globalize.translate('UpcTitle')} to='/upcoming' current={pathname === '/upcoming'} />
                <hr />
                <Item
                    icon={<SettingsRoundedIcon />}
                    label={globalize.translate('Settings')}
                    to='/mypreferencesmenu'
                    current={pathname === '/mypreferencesmenu' || isSettingsSubPath(pathname)}
                />
            </Box>
            {/* Its own layer under the menu (a pseudo-element of the menu, a scroller, is drawn out of order on Android) */}
            <Box
                data-tv-menu-shade=''
                aria-hidden='true'
                sx={{ position: 'fixed', inset: 0, zIndex: 1099, background: DARKEN, opacity: 0, pointerEvents: 'none', transition: 'opacity 0.2s' }}
            />
            {createPortal(<ProfileSwitchDialog open={profilesOpen} onClose={closeProfiles} />, document.body)}
        </>
    );
};

export default TvMenu;
