import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChevronRight from '@mui/icons-material/ChevronRight';
import ExpandMore from '@mui/icons-material/ExpandMore';
import OpenInNew from '@mui/icons-material/OpenInNew';
import React, { useCallback, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

type WidgetProps = {
    title: string;
    href?: string;
    icon?: React.ReactNode;
    accentColor?: string;
    /** Render children without the glass card (e.g. for grids of their own cards). */
    bare?: boolean;
    /** Header toggles the content; the page link moves to a small button. */
    collapsible?: boolean;
    defaultOpen?: boolean;
    /** Extra element shown at the right of the header (e.g. a status chip). */
    headerExtra?: React.ReactNode;
    children: React.ReactNode;
};

/** Cosmic Dark dashboard widget: glass card with accent line, icon and a header linking to the full page. */
const Widget = ({ title, href, icon, accentColor = '#00a4dc', bare = false, collapsible = false, defaultOpen = true, headerExtra, children }: WidgetProps) => {
    const [ open, setOpen ] = useState(defaultOpen);
    const onToggle = useCallback(() => setOpen(value => !value), []);
    const isOpen = !collapsible || open;

    const headerContent = (
        <>
            {icon && (
                <Box sx={{
                    width: 32, height: 32, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: `${accentColor}22`, border: `1px solid ${accentColor}40`, '& svg': { fontSize: '1.1rem', color: accentColor }
                }}>
                    {icon}
                </Box>
            )}
            <Typography variant='overline' component='h3' sx={{ flex: 1, fontSize: '0.74rem', letterSpacing: '1.5px', fontWeight: 700, lineHeight: 1.4 }}>
                {title}
            </Typography>
            {headerExtra}
        </>
    );

    const headerSx = {
        display: 'flex', alignItems: 'center', gap: 1.25, px: bare ? 0.5 : 2.5, py: 1.5,
        color: accentColor, textDecoration: 'none', userSelect: 'none' as const
    };

    const header = collapsible ? (
        <Box onClick={onToggle} sx={{ ...headerSx, cursor: 'pointer', '&:hover': { background: 'rgba(255,255,255,0.03)' } }}>
            {headerContent}
            {href && (
                <Tooltip title={title}>
                    <IconButton component={RouterLink} to={href} size='small' onClick={e => e.stopPropagation()}
                        sx={{ color: accentColor, opacity: 0.7, '&:hover': { opacity: 1 } }}>
                        <OpenInNew sx={{ fontSize: '1rem' }} />
                    </IconButton>
                </Tooltip>
            )}
            <ExpandMore sx={{ fontSize: '1.3rem', transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'none' }} />
        </Box>
    ) : (
        <Box
            {...(href ? { component: RouterLink, to: href } : {})}
            sx={{
                ...headerSx,
                '& .widget-chevron': { transition: 'transform 0.2s' },
                '&:hover .widget-chevron': { transform: 'translateX(3px)' }
            }}
        >
            {headerContent}
            {href && <ChevronRight className='widget-chevron' sx={{ fontSize: '1.2rem', opacity: 0.7 }} />}
        </Box>
    );

    if (bare) {
        return (
            <Box>
                {header}
                {isOpen && children}
            </Box>
        );
    }

    return (
        <Paper elevation={0} sx={{
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 20px ${accentColor}10`
        }}>
            <Box sx={{
                position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem', height: '2px', pointerEvents: 'none', borderRadius: '0 0 4px 4px',
                background: `linear-gradient(90deg, transparent, ${accentColor} 40%, ${accentColor === '#00a4dc' ? '#aa5cc3' : '#00a4dc'} 60%, transparent)`
            }} />
            {header}
            <Box sx={{
                overflow: 'hidden', maxHeight: isOpen ? '3000px' : 0, transition: 'max-height 0.35s ease',
                px: 1.5, pb: isOpen ? 1.5 : 0
            }}>
                {children}
            </Box>
        </Paper>
    );
};

export default Widget;
