/**
 * HomeLibraryNav — the "My media" libraries as a floating glass pill on top of the
 * home screen (same look as the bottom FloatingNav). It sticks to the top while
 * scrolling and shrinks to icons only once the page has scrolled.
 */
import React, { type FC, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { Link } from 'react-router-dom';

import { appRouter } from 'components/router/appRouter';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import LibraryIcon from '../LibraryIcon';

const COMPACT_AFTER = 140;

const HomeLibraryNav: FC = () => {
    const { user } = useApi();
    const { data } = useUserViews({ userId: user?.Id });
    const [ compact, setCompact ] = useState(false);

    useEffect(() => {
        // Capture scrolls of any scroller (window or the page container).
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

    const views = data?.Items || [];
    if (!views.length) return null;

    return (
        <Box sx={{
            position: 'sticky', top: { xs: 10, md: 14 }, zIndex: 1050,
            display: 'flex', justifyContent: 'center', px: 2, pt: 1.5, pb: 1, pointerEvents: 'none'
        }}>
            <Box
                component='nav'
                aria-label={globalize.translate('HeaderMyMedia')}
                sx={{
                    pointerEvents: 'auto', maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
                    background: 'rgba(8, 10, 22, 0.82)',
                    backdropFilter: 'blur(24px) saturate(1.5)',
                    WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                    border: '1px solid rgba(0, 164, 220, 0.2)',
                    borderRadius: '50px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px rgba(0,164,220,0.1)',
                    animation: 'jf-glow-pulse 4s ease-in-out infinite',
                    transition: 'padding 0.25s'
                }}
            >
                {views.map(view => {
                    const to = appRouter.getRouteUrl(view, { context: view.CollectionType }).substring(1);
                    return (
                        <Tooltip key={view.Id} title={compact ? (view.Name || '') : ''} placement='bottom'>
                            <Box
                                component={Link}
                                to={to}
                                aria-label={view.Name || undefined}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
                                    px: compact ? 1.5 : { xs: 1.5, sm: 2 }, py: 1, borderRadius: '50px',
                                    color: 'rgba(255,255,255,0.7)', textDecoration: 'none', whiteSpace: 'nowrap',
                                    transition: 'all 0.2s',
                                    '& svg': { fontSize: '1.35rem', transition: 'filter 0.2s' },
                                    '&:hover, &:focus-visible': {
                                        color: '#00a4dc', background: 'rgba(0,164,220,0.14)', outline: 'none',
                                        '& svg': { filter: 'drop-shadow(0 0 6px rgba(0,164,220,0.7))' }
                                    }
                                }}
                            >
                                <LibraryIcon item={view} />
                                <Box component='span' sx={{
                                    fontSize: '0.9rem', fontWeight: 600,
                                    display: compact ? 'none' : { xs: 'none', sm: 'inline' }
                                }}>
                                    {view.Name}
                                </Box>
                            </Box>
                        </Tooltip>
                    );
                })}
            </Box>
        </Box>
    );
};

export default HomeLibraryNav;
