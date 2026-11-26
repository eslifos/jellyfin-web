/**
 * Shared Cosmic Dark building blocks for the admin dashboard pages:
 * page header with gradient title, glass section cards and a toggle row.
 */
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import React, { type FC } from 'react';
import { TEXT_TERTIARY } from 'themes/cosmic/textColors';

/**
 * Title, accent line and description, with the page actions beside them. On phones (under 600 px) the actions always
 * go below: sharing the row, the title would shrink to a couple of letters and the description fall word by word.
 * Wider, they stay beside it while the title keeps room for itself (else they wrap below too).
 */
export const PageHeader: FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 2, rowGap: 1.5, mb: 3, mt: 1 }}>
        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 280px' }, minWidth: 0 }}>
            <Typography component='h1' sx={{
                fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.2,
                background: 'linear-gradient(135deg, #fff 20%, #00a4dc 60%, #aa5cc3 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
            }}>
                {title}
            </Typography>
            <Box sx={{ mt: 1, width: 72, height: 3, borderRadius: 3, background: 'linear-gradient(90deg, #00a4dc, #aa5cc3)' }} />
            {subtitle && (
                <Typography sx={{ mt: 1.25, fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)' }}>{subtitle}</Typography>
            )}
        </Box>
        {actions}
    </Box>
);

interface StatTileProps {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    color: string;
    active?: boolean;
    onClick?: () => void;
}

/**
 * A figure with its icon and label (the rows of counters at the top of the pages). On phones the label may take two
 * smaller lines instead of being cut ("ADMINISTRAD…"); the full label is also its tooltip.
 */
export const StatTile: FC<StatTileProps> = ({ icon, label, value, color, active, onClick }) => (
    <Paper elevation={0} onClick={onClick} title={label} sx={{
        position: 'relative', overflow: 'hidden', p: { xs: 1.5, sm: 1.75 }, display: 'flex', alignItems: 'center', gap: { xs: 1.25, sm: 1.5 }, minWidth: 0,
        cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        borderColor: active ? `${color}99 !important` : undefined,
        boxShadow: active ? `0 0 22px ${color}33` : 'none',
        '&:hover': onClick ? { transform: 'translateY(-2px)', borderColor: `${color}66 !important` } : {}
    }}>
        <Box sx={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <Box sx={{
            width: { xs: 36, sm: 42 }, height: { xs: 36, sm: 42 }, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: `${color}1f`, border: `1px solid ${color}44`, '& svg': { color, fontSize: { xs: '1.2rem', sm: '1.35rem' } }
        }}>
            {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
            <Typography component='div' sx={{ fontSize: { xs: '1.25rem', sm: '1.45rem' }, fontWeight: 700, color: '#fff', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
                {value}
            </Typography>
            <Typography sx={{
                fontSize: { xs: '0.62rem', sm: '0.7rem' }, letterSpacing: { xs: '0.4px', sm: '0.8px' }, lineHeight: 1.3,
                textTransform: 'uppercase', color: TEXT_TERTIARY, overflowWrap: 'anywhere',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
                {label}
            </Typography>
        </Box>
    </Paper>
);

interface SectionCardProps {
    title: string;
    icon?: React.ReactNode;
    accentColor?: string;
    description?: React.ReactNode;
    children: React.ReactNode;
}

/** Glass card with accent line, icon and overline title. */
export const SectionCard: FC<SectionCardProps> = ({ title, icon, accentColor = '#00a4dc', description, children }) => (
    <Paper elevation={0} sx={{
        position: 'relative', overflow: 'hidden', p: 2.5, pt: 2,
        boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 20px ${accentColor}10`
    }}>
        <Box sx={{
            position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem', height: '2px', pointerEvents: 'none', borderRadius: '0 0 4px 4px',
            background: `linear-gradient(90deg, transparent, ${accentColor} 40%, ${accentColor === '#00a4dc' ? '#aa5cc3' : '#00a4dc'} 60%, transparent)`
        }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: description ? 0.75 : 2, color: accentColor }}>
            {icon && (
                <Box sx={{
                    width: 32, height: 32, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: `${accentColor}22`, border: `1px solid ${accentColor}40`, '& svg': { fontSize: '1.1rem', color: accentColor }
                }}>
                    {icon}
                </Box>
            )}
            <Typography variant='overline' component='h2' sx={{ fontSize: '0.74rem', letterSpacing: '1.5px', fontWeight: 700, lineHeight: 1.4 }}>
                {title}
            </Typography>
        </Box>
        {description && (
            <Typography sx={{ fontSize: '0.8rem', color: TEXT_TERTIARY, mb: 2, lineHeight: 1.5 }}>{description}</Typography>
        )}
        {children}
    </Paper>
);

interface ToggleRowProps {
    name?: string;
    label: string;
    description?: string;
    checked?: boolean;
    defaultChecked?: boolean;
    onChange?: (checked: boolean) => void;
    color?: string;
}

/** Full-width switch row inside a card (works with uncontrolled forms through `name`). */
export const ToggleRow: FC<ToggleRowProps> = ({ name, label, description, checked, defaultChecked, onChange, color = '#00a4dc' }) => (
    <Box component='label' sx={{
        display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: '14px', cursor: 'pointer',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.2s, border-color 0.2s',
        '&:hover': { background: `${color}0f`, borderColor: `${color}40` }
    }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{label}</Typography>
            {description && (
                <Typography sx={{ fontSize: '0.75rem', color: TEXT_TERTIARY, lineHeight: 1.45, mt: 0.25 }}>{description}</Typography>
            )}
        </Box>
        <Switch
            name={name}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={onChange ? (_, v) => onChange(v) : undefined}
            sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: color, opacity: 0.5 }
            }}
        />
    </Box>
);
