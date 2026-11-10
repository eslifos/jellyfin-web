/**
 * LibraryTabsBar — the sections of a library (Movies, Library, Favorites, Collections…) as a floating glass bar,
 * identical to the library bar of the home screen: same colors and the same titles / icons setting
 * (labels "auto" shrink to icons once the page has scrolled).
 */
import AlbumRoundedIcon from '@mui/icons-material/AlbumRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhotoRoundedIcon from '@mui/icons-material/PhotoRounded';
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded';
import RecommendRoundedIcon from '@mui/icons-material/RecommendRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import React, { type FC, type ReactNode, useCallback, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { backgroundCss, loadNavSettings, rgba } from 'apps/modern/components/HomeLibraryNav/navSettings';
import { LibraryRoutes } from 'apps/modern/features/libraries/constants/libraryRoutes';
import useCurrentTab from 'hooks/useCurrentTab';
import globalize from 'lib/globalize';
import { LibraryTab } from 'types/libraryTab';

const COMPACT_AFTER = 140;

const ICONS: Partial<Record<LibraryTab, ReactNode>> = {
    [LibraryTab.Movies]: <GridViewRoundedIcon />,
    [LibraryTab.Series]: <TvRoundedIcon />,
    [LibraryTab.Episodes]: <VideoLibraryRoundedIcon />,
    [LibraryTab.Suggestions]: <RecommendRoundedIcon />,
    [LibraryTab.Favorites]: <FavoriteRoundedIcon />,
    [LibraryTab.Collections]: <CollectionsBookmarkRoundedIcon />,
    [LibraryTab.Genres]: <CategoryRoundedIcon />,
    [LibraryTab.Studios]: <BusinessRoundedIcon />,
    [LibraryTab.Playlists]: <QueueMusicRoundedIcon />,
    [LibraryTab.Upcoming]: <CalendarMonthRoundedIcon />,
    [LibraryTab.Albums]: <AlbumRoundedIcon />,
    [LibraryTab.AlbumArtists]: <PersonRoundedIcon />,
    [LibraryTab.Artists]: <PersonRoundedIcon />,
    [LibraryTab.Songs]: <MusicNoteRoundedIcon />,
    [LibraryTab.Photos]: <PhotoRoundedIcon />,
    [LibraryTab.Folders]: <FolderRoundedIcon />,
    [LibraryTab.Channels]: <LiveTvRoundedIcon />,
    [LibraryTab.Programs]: <LiveTvRoundedIcon />
};

/** The start screen tab uses the icon of the library type */
const homeIcon = (type?: CollectionType) => (type === CollectionType.Tvshows ? <TvRoundedIcon /> : <MovieRoundedIcon />);

interface LibraryTabsBarProps {
    /** Shown when the current route has no tabs */
    fallback?: ReactNode;
    /** Float over the page (sticky, like the home bar) instead of sitting in the toolbar */
    floating?: boolean;
}

const LibraryTabsBar: FC<LibraryTabsBarProps> = ({ fallback = null, floating = false }) => {
    const location = useLocation();
    const [ searchParams, setSearchParams ] = useSearchParams();
    const { activeTab } = useCurrentTab();
    const [ settings ] = useState(loadNavSettings);
    const [ compact, setCompact ] = useState(false);
    const accent = settings.accent;

    useEffect(() => {
        const onScroll = (e: Event) => {
            const target = e.target as HTMLElement | Document;
            const top = target instanceof Document ?
                (document.documentElement.scrollTop || document.body.scrollTop) :
                target.scrollTop;
            setCompact(top > COMPACT_AFTER);
        };
        window.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => window.removeEventListener('scroll', onScroll, { capture: true });
    }, []);

    const route = LibraryRoutes.find(({ path }) => path === location.pathname);

    const select = useCallback((index: number) => {
        searchParams.set('tab', `${index}`);
        setSearchParams(searchParams);
        window.scrollTo({ top: 0 });
    }, [ searchParams, setSearchParams ]);

    if (!route || route.views.length < 2) return fallback as React.ReactElement | null;

    const showLabels = settings.labels === 'always' || (settings.labels === 'auto' && !compact);
    const iconsOnly = settings.labels === 'icons' || (settings.labels === 'auto' && compact);

    return (
        <Box sx={floating ? {
            position: settings.sticky ? 'sticky' : 'relative', top: { xs: 10, md: 14 }, zIndex: 1050,
            display: 'flex', justifyContent: 'center', px: 2, pt: 1.5, pb: 1, pointerEvents: 'none'
        } : {
            flexBasis: '100%', display: 'flex', justifyContent: 'center', py: 0.75, minWidth: 0
        }}>
            <Box
                component='nav'
                role='tablist'
                sx={{
                    pointerEvents: 'auto', maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
                    background: backgroundCss(settings),
                    backdropFilter: 'blur(24px) saturate(1.5)',
                    WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                    border: `1px solid ${rgba(accent, 0.2)}`,
                    borderRadius: '50px',
                    boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px ${rgba(accent, 0.1)}`,
                    animation: settings.glow ? 'jf-glow-pulse 4s ease-in-out infinite' : 'none',
                    transition: 'padding 0.25s'
                }}
            >
                {route.views.map(tab => {
                    const active = tab.index === activeTab;
                    const name = globalize.translate(tab.label);
                    return (
                        <Tooltip key={tab.view} title={showLabels ? '' : name} placement='bottom'>
                            <Box
                                component='button'
                                type='button'
                                role='tab'
                                aria-selected={active}
                                aria-label={name}
                                // eslint-disable-next-line react/jsx-no-bind
                                onClick={() => select(tab.index)}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
                                    px: iconsOnly ? 1.5 : { xs: 1.5, sm: 2 }, py: 1, border: 0, borderRadius: '50px', cursor: 'pointer',
                                    font: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                    color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                                    background: active ? `linear-gradient(135deg, rgba(170,92,195,0.35), ${rgba(accent, 0.3)})` : 'none',
                                    '& svg': { fontSize: '1.35rem', transition: 'filter 0.2s' },
                                    '&:hover, &:focus-visible': {
                                        outline: 'none',
                                        color: active ? '#fff' : accent,
                                        background: active ?
                                            `linear-gradient(135deg, rgba(170,92,195,0.55), ${rgba(accent, 0.5)})` :
                                            rgba(accent, 0.14),
                                        '& svg': { filter: `drop-shadow(0 0 6px ${rgba(accent, 0.8)})` }
                                    }
                                }}
                            >
                                {tab.view === LibraryTab.Home ? homeIcon(route.type) : ICONS[tab.view]}
                                <Box component='span' sx={{
                                    fontSize: '0.9rem', fontWeight: active ? 700 : 600,
                                    display: showLabels ? { xs: settings.labels === 'always' ? 'inline' : 'none', sm: 'inline' } : 'none'
                                }}>
                                    {name}
                                </Box>
                            </Box>
                        </Tooltip>
                    );
                })}
            </Box>
        </Box>
    );
};

export default LibraryTabsBar;
