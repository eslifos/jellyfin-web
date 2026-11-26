/**
 * HomeLibraryNav — the "My media" libraries as a floating glass pill on top of the
 * home screen (same look as the bottom FloatingNav). It sticks to the top while
 * scrolling and shrinks to icons only once the page has scrolled.
 * On phones each icon keeps its name below in small text (it scrolls sideways when they do not fit),
 * unless the user chose icons only.
 * Each user can reorder / hide items and change colors and labels (gear button).
 * TV layout: a rail fixed on the left of every page instead (the pages move right to leave it room), always in
 * reach of the remote (see tvRail).
 */
import React, { type FC, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import type { Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Link, useLocation } from 'react-router-dom';

import layoutManager from 'components/layoutManager';
import { appRouter } from 'components/router/appRouter';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import LibraryIcon from '../LibraryIcon';
import NavCustomizeDialog, { type NavEntry } from './NavCustomizeDialog';
import { UNIVERSES_KEY, type NavSettings, backgroundCss, loadNavSettings, orderKeys, rgba, saveNavSettings } from './navSettings';
import { ambientAnimation } from 'utils/reducedMotion';
import { installTvRail, RAIL_ATTRIBUTE } from './tvRail';

const COMPACT_AFTER = 140;
/** Width of the TV rail, folded (icons): the pages leave it room (--tv-rail-width, AppOverrides.scss). */
export const RAIL_FOLDED = 96;
/** Width of the TV rail with the focus in it (the names too), over the page. */
export const RAIL_OPEN = 320;

// The remote reaches the rail on the TV layout (it acts only there)
installTvRail();
/** TV, read at 3 m: names at least 24 px. */
const TV_LABEL_SIZE = '26px';
const TV_ICON_SIZE = '34px';

interface Entry extends NavEntry {
    to: string;
}

const HomeLibraryNav: FC<{ rail?: boolean }> = ({ rail = false }) => {
    const location = useLocation();
    const { user } = useApi();
    const { data } = useUserViews({ userId: user?.Id });
    const [ compact, setCompact ] = useState(false);
    const [ saved, setSaved ] = useState<NavSettings>(loadNavSettings);
    const [ draft, setDraft ] = useState<NavSettings | null>(null);
    const phone = useMediaQuery((t: Theme) => t.breakpoints.down('sm'));
    const settings = draft || saved;

    // Display preferences may arrive after the first render (or the user changes)
    useEffect(() => {
        setSaved(loadNavSettings());
    }, [ user?.Id ]);

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

    const views = data?.Items;
    const entries = useMemo<Entry[]>(() => {
        const byKey = new Map<string, Entry>();
        (views || []).forEach(view => {
            byKey.set(view.Id!, {
                key: view.Id!,
                name: view.Name || '',
                icon: <LibraryIcon item={view} />,
                to: appRouter.getRouteUrl(view, { context: view.CollectionType }).substring(1)
            });
        });
        byKey.set(UNIVERSES_KEY, { key: UNIVERSES_KEY, name: globalize.translate('UniTitle'), icon: <PublicRoundedIcon />, to: '/universes' });
        return orderKeys((views || []).map(v => v.Id!), settings).map(k => byKey.get(k)!).filter(Boolean);
    }, [ views, settings ]);

    // TV: always the name next to the icon, big enough to read from the couch
    const tv = layoutManager.tv;
    // Phones: the name goes under the icon in small text, so it still fits once the page has scrolled
    const stacked = !tv && phone && settings.labels !== 'icons';
    const showLabels = tv || stacked || (!phone && (settings.labels === 'always' || (settings.labels === 'auto' && !compact)));
    const iconsOnly = !tv && !stacked && (settings.labels === 'icons' || (settings.labels === 'auto' && compact));

    const openCustomize = useCallback(() => setDraft({ ...saved }), [ saved ]);
    const cancelCustomize = useCallback(() => setDraft(null), []);
    const saveCustomize = useCallback(() => {
        if (!draft) return;
        saveNavSettings(draft);
        setSaved(draft);
        setDraft(null);
    }, [ draft ]);

    // The pages leave the rail its room while it is on screen
    useEffect(() => {
        if (!rail) return;
        document.documentElement.style.setProperty('--tv-rail-width', `${RAIL_FOLDED}px`);
        return () => {
            document.documentElement.style.removeProperty('--tv-rail-width');
        };
    }, [ rail ]);

    if (!views?.length) return null;

    const visible = entries.filter(e => !settings.hidden.includes(e.key));
    const accent = settings.accent;

    const itemSx = (special: boolean) => ({
        display: 'flex', alignItems: 'center', flexShrink: 0,
        ...(stacked ?
            { flexDirection: 'column', gap: 0.25, minWidth: 52, maxWidth: 84, px: 1, py: 0.6, borderRadius: '18px' } :
            { gap: 1, px: iconsOnly ? 1.5 : { xs: 1.5, sm: 2 }, py: 1, borderRadius: '50px' }),
        color: special ? '#fff' : 'rgba(255,255,255,0.7)', textDecoration: 'none', whiteSpace: 'nowrap',
        transition: 'all 0.2s',
        background: special ? `linear-gradient(135deg, rgba(170,92,195,0.35), ${rgba(accent, 0.3)})` : 'none',
        '& svg': { fontSize: tv ? TV_ICON_SIZE : '1.35rem', transition: 'filter 0.2s' },
        ...(tv && { px: 2.5, py: 1.25, gap: 1.25 }),
        '&:hover, &:focus-visible': {
            outline: 'none',
            color: special ? '#fff' : accent,
            background: special ? `linear-gradient(135deg, rgba(170,92,195,0.55), ${rgba(accent, 0.5)})` : rgba(accent, 0.14),
            '& svg': { filter: `drop-shadow(0 0 6px ${rgba(accent, 0.8)})` }
        },
        // The remote: where the focus is must be seen from across the room
        ...(tv && { '&:focus': { outline: 'none', color: '#fff', background: rgba(accent, 0.3), boxShadow: `0 0 0 3px ${accent}` } })
    });

    const label = (text: ReactNode, bold = false) => (
        <Box component='span' sx={stacked ? {
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
            fontSize: '0.66rem', lineHeight: 1.15, fontWeight: bold ? 700 : 600
        } : {
            fontSize: tv ? TV_LABEL_SIZE : '0.9rem', fontWeight: bold ? 700 : 600,
            display: showLabels ? 'inline' : 'none'
        }}>
            {text}
        </Box>
    );

    if (rail) {
        // The library on screen (its id is in the address) or the universes
        const parentId = new URLSearchParams(location.search).get('topParentId') ?? new URLSearchParams(location.search).get('parentId');
        const isCurrent = (e: Entry) => (e.key === UNIVERSES_KEY ? location.pathname.startsWith('/universes') : !!parentId && e.key === parentId);
        return (
            <>
                <Box
                    component='nav'
                    aria-label={globalize.translate('HeaderMyMedia')}
                    {...{ [RAIL_ATTRIBUTE]: '' }}
                    sx={{
                        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 1050, width: RAIL_FOLDED, boxSizing: 'border-box',
                        overflowX: 'hidden', transition: 'width 0.2s ease',
                        // Folded: icons only; with the focus of the remote in it, it widens over the page with the names
                        '& a > span, & button > span': { opacity: 0, transition: 'opacity 0.15s' },
                        '&:focus-within': { width: RAIL_OPEN, '& a > span, & button > span': { opacity: 1 } },
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.75, px: 1.5, py: 3, overflowY: 'auto', scrollbarWidth: 'none',
                        background: backgroundCss(settings),
                        backdropFilter: 'blur(24px) saturate(1.5)',
                        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                        borderRight: `1px solid ${rgba(accent, 0.2)}`,
                        boxShadow: `8px 0 32px rgba(0,0,0,0.45), 0 0 24px ${rgba(accent, 0.08)}`
                    }}
                >
                    {visible.map(e => {
                        const special = e.key === UNIVERSES_KEY;
                        const current = isCurrent(e);
                        return (
                            <Box
                                key={e.key}
                                component={Link}
                                to={e.to}
                                aria-label={e.name}
                                aria-current={current ? 'page' : undefined}
                                sx={{
                                    ...itemSx(special),
                                    width: '100%', boxSizing: 'border-box', borderRadius: '16px',
                                    ...(current && !special && { color: '#fff', background: rgba(accent, 0.22) }),
                                    '& > span': { overflow: 'hidden', textOverflow: 'ellipsis' }
                                }}
                            >
                                {e.icon}
                                {label(e.name, special || current)}
                            </Box>
                        );
                    })}
                    <Box
                        component='button'
                        type='button'
                        aria-label={globalize.translate('NavCustomize')}
                        onClick={openCustomize}
                        sx={{
                            ...itemSx(false), mt: 'auto', width: '100%', boxSizing: 'border-box', borderRadius: '16px', border: 0, cursor: 'pointer', font: 'inherit',
                            '& > span': { overflow: 'hidden', textOverflow: 'ellipsis' }
                        }}
                    >
                        <TuneRoundedIcon />
                        {label(globalize.translate('NavCustomize'))}
                    </Box>
                </Box>
                {draft && (
                    <NavCustomizeDialog
                        open
                        settings={draft}
                        entries={entries}
                        onChange={setDraft}
                        onCancel={cancelCustomize}
                        onSave={saveCustomize}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <Box sx={{
                // TV: in its place (the remote brings the page to it), so it never covers what has the focus
                position: settings.sticky && !tv ? 'sticky' : 'relative', top: { xs: 10, md: 14 }, zIndex: 1050,
                display: 'flex', justifyContent: 'center', px: 2, pt: 1.5, pb: 1, pointerEvents: 'none'
            }}>
                <Box
                    component='nav'
                    aria-label={globalize.translate('HeaderMyMedia')}
                    data-focus-row=''
                    sx={{
                        pointerEvents: 'auto', maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 0.5,
                        px: 1, py: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
                        background: backgroundCss(settings),
                        backdropFilter: 'blur(24px) saturate(1.5)',
                        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                        border: `1px solid ${rgba(accent, 0.2)}`,
                        borderRadius: '50px',
                        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px ${rgba(accent, 0.1)}`,
                        ...(settings.glow ? ambientAnimation('jf-glow-pulse 4s ease-in-out infinite') : { animation: 'none' }),
                        transition: 'padding 0.25s',
                        '&:hover .jfNavGear, &:focus-within .jfNavGear': { opacity: 1 }
                    }}
                >
                    {visible.map((e, i) => {
                        const special = e.key === UNIVERSES_KEY;
                        const divider = special && i > 0 && i === visible.length - 1;
                        return (
                            <React.Fragment key={e.key}>
                                {divider && <Box aria-hidden='true' sx={{ width: '1px', alignSelf: 'stretch', my: 0.8, mx: 0.5, flexShrink: 0, background: 'rgba(255,255,255,0.14)' }} />}
                                <Tooltip title={showLabels ? '' : e.name} placement='bottom'>
                                    <Box component={Link} to={e.to} aria-label={e.name} sx={itemSx(special)}>
                                        {e.icon}
                                        {label(e.name, special)}
                                    </Box>
                                </Tooltip>
                            </React.Fragment>
                        );
                    })}
                    <Tooltip title={globalize.translate('NavCustomize')} placement='bottom'>
                        <Box
                            component='button'
                            type='button'
                            className='jfNavGear'
                            aria-label={globalize.translate('NavCustomize')}
                            onClick={openCustomize}
                            sx={{
                                display: 'grid', placeItems: 'center', flexShrink: 0, width: 34, height: 34, ml: 0.25, p: 0,
                                border: 0, borderRadius: '50%', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', background: 'none',
                                opacity: { xs: 1, md: 0.35 }, transition: 'all 0.2s',
                                '&:hover, &:focus-visible': { outline: 'none', color: accent, background: rgba(accent, 0.14) }
                            }}
                        >
                            <TuneRoundedIcon sx={{ fontSize: '1.2rem' }} />
                        </Box>
                    </Tooltip>
                </Box>
            </Box>
            {draft && (
                <NavCustomizeDialog
                    open
                    settings={draft}
                    entries={entries}
                    onChange={setDraft}
                    onCancel={cancelCustomize}
                    onSave={saveCustomize}
                />
            )}
        </>
    );
};

export default HomeLibraryNav;
