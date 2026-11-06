/**
 * Shared Cosmic Dark building blocks for the admin dashboard pages:
 * page header with gradient title, glass section cards and a toggle row.
 */
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import React, { type FC } from 'react';

export const PageHeader: FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2, mb: 3, mt: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
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
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', mb: 2, lineHeight: 1.5 }}>{description}</Typography>
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
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.45, mt: 0.25 }}>{description}</Typography>
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
