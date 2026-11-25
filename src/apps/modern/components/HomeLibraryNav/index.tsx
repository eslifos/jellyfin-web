/**
 * HomeLibraryNav — the "My media" libraries as a floating glass pill on top of the
 * home screen (same look as the bottom FloatingNav). It sticks to the top while
 * scrolling and shrinks to icons only once the page has scrolled.
 * On phones each icon keeps its name below in small text (it scrolls sideways when they do not fit),
 * unless the user chose icons only.
 * Each user can reorder / hide items and change colors and labels (gear button).
 * It is the only row under the banner: the libraries, then (after a separator) a small "Universes" title that
 * opens them all, followed by the main universes (none named like a library). Universes always go last.
 */
import React, { type FC, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import type { Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Link } from 'react-router-dom';

import { appRouter } from 'components/router/appRouter';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import LibraryIcon from '../LibraryIcon';
import { useUniverses } from '../Universes/api';
import { featuredUniverses } from './featuredUniverses';
import NavCustomizeDialog, { type NavEntry } from './NavCustomizeDialog';
import { useFittingCount } from './useFittingCount';
import { UNIVERSES_KEY, type NavSettings, backgroundCss, loadNavSettings, orderKeys, rgba, saveNavSettings } from './navSettings';
import { ambientAnimation } from 'utils/reducedMotion';

const COMPACT_AFTER = 140;

interface Entry extends NavEntry {
    to: string;
}

const HomeLibraryNav: FC = () => {
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

    // Phones: the name goes under the icon in small text, so it still fits once the page has scrolled
    const stacked = phone && settings.labels !== 'icons';
    const showLabels = stacked || (!phone && (settings.labels === 'always' || (settings.labels === 'auto' && !compact)));
    const iconsOnly = !stacked && (settings.labels === 'icons' || (settings.labels === 'auto' && compact));

    const { data: universes } = useUniverses(false);
    const featured = useMemo(() => featuredUniverses(universes ?? [], (views ?? []).map(v => v.Name ?? '')), [ universes, views ]);
    // Phones scroll the bar sideways; bigger screens show only the universes that fit next to the libraries
    const barRef = useRef<HTMLElement>(null);
    const fitting = useFittingCount(barRef, featured.length, !stacked && !iconsOnly, [ featured, showLabels, entries ]);

    if (!views?.length) return null;

    const visible = entries.filter(e => !settings.hidden.includes(e.key));
    const libraries = visible.filter(e => e.key !== UNIVERSES_KEY);
    const universesEntry = visible.find(e => e.key === UNIVERSES_KEY);
    const accent = settings.accent;

    const itemSx = (special: boolean) => ({
        display: 'flex', alignItems: 'center', flexShrink: 0,
        ...(stacked ?
            { flexDirection: 'column', gap: 0.25, minWidth: 52, maxWidth: 84, px: 1, py: 0.6, borderRadius: '18px' } :
            { gap: 1, px: iconsOnly ? 1.5 : { xs: 1.5, sm: 2 }, py: 1, borderRadius: '50px' }),
        color: special ? '#fff' : 'rgba(255,255,255,0.7)', textDecoration: 'none', whiteSpace: 'nowrap',
        transition: 'all 0.2s',
        background: special ? `linear-gradient(135deg, rgba(170,92,195,0.35), ${rgba(accent, 0.3)})` : 'none',
        '& svg': { fontSize: '1.35rem', transition: 'filter 0.2s' },
        '&:hover, &:focus-visible': {
            outline: 'none',
            color: special ? '#fff' : accent,
            background: special ? `linear-gradient(135deg, rgba(170,92,195,0.55), ${rgba(accent, 0.5)})` : rgba(accent, 0.14),
            '& svg': { filter: `drop-shadow(0 0 6px ${rgba(accent, 0.8)})` }
        }
    });

    const label = (text: ReactNode) => (
        <Box component='span' sx={stacked ? {
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
            fontSize: '0.66rem', lineHeight: 1.15, fontWeight: 600
        } : {
            fontSize: '0.9rem', fontWeight: 600,
            display: showLabels ? 'inline' : 'none'
        }}>
            {text}
        </Box>
    );

    return (
        <>
            <Box sx={{
                position: settings.sticky ? 'sticky' : 'relative', top: { xs: 10, md: 14 }, zIndex: 1050,
                display: 'flex', justifyContent: 'center', px: 2, pt: 1.5, pb: 1, pointerEvents: 'none'
            }}>
                <Box
                    ref={barRef}
                    component='nav'
                    aria-label={globalize.translate('HeaderMyMedia')}
                    sx={{
                        position: 'relative', pointerEvents: 'auto', maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 0.5,
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
                    {libraries.map(e => (
                        <Tooltip key={e.key} title={showLabels ? '' : e.name} placement='bottom'>
                            <Box component={Link} to={e.to} aria-label={e.name} sx={itemSx(false)}>
                                {e.icon}
                                {label(e.name)}
                            </Box>
                        </Tooltip>
                    ))}
                    {/* Libraries first; after a separator, the small "Universes" title (it opens them all) and the main ones */}
                    {universesEntry && (
                        <>
                            {libraries.length > 0 && <Box aria-hidden='true' sx={{ width: '1px', alignSelf: 'stretch', my: 0.8, mx: 0.5, flexShrink: 0, background: 'rgba(255,255,255,0.14)' }} />}
                            <Box role='group' aria-label={universesEntry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                <Tooltip title={showLabels ? '' : globalize.translate('UniAll')} placement='bottom'>
                                    <Box component={Link} to={universesEntry.to} aria-label={globalize.translate('UniAll')} sx={itemSx(true)}>
                                        {universesEntry.icon}
                                        <Box component='span' sx={stacked ? {
                                            fontSize: '0.62rem', lineHeight: 1.15, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase'
                                        } : {
                                            fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                                            display: showLabels ? 'inline' : 'none'
                                        }}>
                                            {universesEntry.name}
                                        </Box>
                                    </Box>
                                </Tooltip>
                                {/* Once scrolled (icons only) the bar stays small: the universes come back at the top */}
                                {!iconsOnly && featured.map((u, i) => (
                                    <Box
                                        key={u.Id}
                                        component={Link}
                                        to={`/universe?id=${encodeURIComponent(u.Id)}`}
                                        title={u.Name}
                                        className='jfNavUniverse'
                                        data-fit={i < fitting ? '1' : '0'}
                                        // Out of room: kept (to measure it again when the window grows) but invisible
                                        {...(i < fitting ? {} : { 'aria-hidden': true, tabIndex: -1 })}
                                        sx={{
                                            ...(i < fitting ? {} : { position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' }),
                                            flexShrink: 0, maxWidth: stacked ? 150 : 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            px: stacked ? 1.25 : 1.5, py: stacked ? 0.75 : 0.8, borderRadius: '50px',
                                            fontSize: stacked ? '0.72rem' : '0.82rem', fontWeight: 600, lineHeight: 1.2,
                                            color: 'rgba(255,255,255,0.75)', textDecoration: 'none',
                                            border: `1px solid ${rgba(accent, 0.22)}`, background: 'rgba(255,255,255,0.04)',
                                            transition: 'all 0.2s',
                                            '&:hover, &:focus-visible': { outline: 'none', color: '#fff', borderColor: rgba(accent, 0.6), background: rgba(accent, 0.16) }
                                        }}
                                    >
                                        {u.Name}
                                    </Box>
                                ))}
                            </Box>
                        </>
                    )}
                    <Tooltip title={globalize.translate('NavCustomize')} placement='bottom'>
                        <Box
                            component='button'
                            type='button'
                            className='jfNavGear'
                            aria-label={globalize.translate('NavCustomize')}
                            onClick={() => setDraft({ ...saved })}
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
                    onCancel={() => setDraft(null)}
                    onSave={() => {
                        saveNavSettings(draft);
                        setSaved(draft);
                        setDraft(null);
                    }}
                />
            )}
        </>
    );
};

export default HomeLibraryNav;
