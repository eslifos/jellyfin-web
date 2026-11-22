/**
 * Building blocks of the home feed: a scrolling row with arrows, and a section with a header.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import React, { type FC, type ReactNode, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';

import globalize from 'lib/globalize';

const arrowSx = (side: 'left' | 'right') => ({
    position: 'absolute', top: '42%', [side]: -6, zIndex: 3, transform: 'translateY(-50%)',
    display: { xs: 'none', md: 'flex' }, opacity: 0, transition: 'opacity 0.2s',
    width: 40, height: 40, color: '#fff', background: 'rgba(8,10,22,0.85)', border: '1px solid rgba(255,255,255,0.15)',
    '&:hover': { background: 'rgba(0,164,220,0.85)' }
});

/** Horizontal row of cards (or anything) with scroll arrows on desktop. */
export const ScrollRow: FC<{ children: ReactNode, gap?: number }> = ({ children, gap }) => {
    const ref = useRef<HTMLDivElement>(null);
    const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });
    const left = useCallback(() => scroll(-1), []);
    const right = useCallback(() => scroll(1), []);

    return (
        <Box sx={{ position: 'relative', '&:hover .hfArrow': { opacity: 1 } }}>
            <IconButton className='hfArrow' onClick={left} sx={arrowSx('left')} aria-label='previous'><ChevronLeftRoundedIcon /></IconButton>
            <Box ref={ref} sx={{
                display: 'flex', gap: gap ?? { xs: 1.25, md: 1.75 }, overflowX: 'auto', overflowY: 'hidden', pt: 0.75, pb: 1.25, px: 0.25,
                scrollSnapType: 'x proximity', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }
            }}>
                {children}
            </Box>
            <IconButton className='hfArrow' onClick={right} sx={arrowSx('right')} aria-label='next'><ChevronRightRoundedIcon /></IconButton>
        </Box>
    );
};

/** Row title inside a section ("Top 10", "Recently added"). */
export const RowTitle: FC<{ title: string, icon?: ReactNode, to?: string }> = ({ title, icon, to }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
        {icon && <Box sx={{ display: 'flex', color: '#00a4dc', '& svg': { fontSize: '1.15rem' } }}>{icon}</Box>}
        <Typography component='h3' sx={{ fontSize: { xs: '1rem', md: '1.1rem' }, fontWeight: 800, color: '#fff' }}>{title}</Typography>
        {to && (
            <Button component={Link} to={to} size='small' sx={{ ml: 'auto', fontWeight: 700, color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#00a4dc' } }} endIcon={<ChevronRightRoundedIcon />}>
                {globalize.translate('HfSeeAll')}
            </Button>
        )}
    </Box>
);

interface FeedSectionProps {
    id: string;
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    accent?: string;
    to?: string;
    /** Glass panel around the section (library blocks). */
    panel?: boolean;
    children: ReactNode;
}

/** A section of the home feed; library blocks are drawn as a glass panel with a coloured edge. */
export const FeedSection: FC<FeedSectionProps> = ({ id, title, subtitle, icon, accent = '#00a4dc', to, panel, children }) => (
    <Box
        id={id}
        component='section'
        className='padded-left padded-right'
        sx={{ mb: { xs: 2.5, md: 3.5 }, scrollMarginTop: '90px' }}
    >
        <Box sx={panel ? {
            position: 'relative', overflow: 'hidden', borderRadius: { xs: '16px', md: '22px' }, p: { xs: 1.5, md: 2.5 },
            background: `linear-gradient(160deg, ${accent}1f 0%, rgba(12,14,30,0.72) 38%, rgba(10,12,26,0.6) 100%)`,
            border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            '&::before': { content: '""', position: 'absolute', top: 0, left: 24, right: 24, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }
        } : undefined}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                {icon && (
                    <Box sx={{
                        width: 38, height: 38, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: accent, background: `${accent}22`, border: `1px solid ${accent}44`, '& svg': { fontSize: '1.3rem' }
                    }}>
                        {icon}
                    </Box>
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography component='h2' noWrap sx={{ fontSize: { xs: '1.2rem', md: '1.45rem' }, fontWeight: 900, color: '#fff', letterSpacing: '-0.2px' }}>{title}</Typography>
                    {subtitle && <Typography noWrap sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{subtitle}</Typography>}
                </Box>
                {to && (
                    <Button component={Link} to={to} size='small' variant='outlined' endIcon={<ChevronRightRoundedIcon />} sx={{
                        flexShrink: 0, borderRadius: '50px', fontWeight: 700, color: accent, borderColor: `${accent}66`,
                        '&:hover': { borderColor: accent, background: `${accent}18` }
                    }}>
                        {globalize.translate('HfSeeAll')}
                    </Button>
                )}
            </Box>
            {children}
        </Box>
    </Box>
);
