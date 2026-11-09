/**
 * HomeLibraryNav — the "My media" libraries as a floating glass pill on top of the
 * home screen (same look as the bottom FloatingNav). It sticks to the top while
 * scrolling and shrinks to icons only once the page has scrolled.
 * Each user can reorder / hide items and change colors and labels (gear button).
 */
import React, { type FC, type ReactNode, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Link } from 'react-router-dom';

import { appRouter } from 'components/router/appRouter';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import LibraryIcon from '../LibraryIcon';
import NavCustomizeDialog, { type NavEntry } from './NavCustomizeDialog';
import { UNIVERSES_KEY, type NavSettings, backgroundCss, loadNavSettings, orderKeys, rgba, saveNavSettings } from './navSettings';

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

    if (!views?.length) return null;

    const visible = entries.filter(e => !settings.hidden.includes(e.key));
    const accent = settings.accent;
    const showLabels = settings.labels === 'always' || (settings.labels === 'auto' && !compact);
    const iconsOnly = settings.labels === 'icons' || (settings.labels === 'auto' && compact);

    const itemSx = (special: boolean) => ({
        display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
        px: iconsOnly ? 1.5 : { xs: 1.5, sm: 2 }, py: 1, borderRadius: '50px',
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

    const label = (text: ReactNode, bold = false) => (
        <Box component='span' sx={{
            fontSize: '0.9rem', fontWeight: bold ? 700 : 600,
            display: showLabels ? { xs: settings.labels === 'always' ? 'inline' : 'none', sm: 'inline' } : 'none'
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
                    component='nav'
                    aria-label={globalize.translate('HeaderMyMedia')}
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
                        transition: 'padding 0.25s',
                        '&:hover .jfNavGear, &:focus-within .jfNavGear': { opacity: 1 }
                    }}
                >
                    {visible.map((e, i) => {
                        const special = e.key === UNIVERSES_KEY;
                        const divider = special && i > 0 && i === visible.length - 1;
                        return (
                            <React.Fragment key={e.key}>
                                {divider && <Box sx={{ width: '1px', alignSelf: 'stretch', my: 0.8, mx: 0.5, flexShrink: 0, background: 'rgba(255,255,255,0.14)' }} />}
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
