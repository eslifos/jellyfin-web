/**
 * Shared glassmorphism UI pieces for the user preferences pages
 * (display, home, ...): collapsible cards, selects, number fields,
 * checkboxes, save button and "saved" snackbar.
 */
import React, { type FC } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';

import globalize from 'lib/globalize';

/**
 * appSettings / UserSettings are untyped JS whose accessors take an optional
 * value (getter when omitted), so TS infers the argument as required.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Accessors = Record<string, (...args: any[]) => any>;

export const menuPaper = {
    background: 'rgba(8,10,22,0.96)',
    backdropFilter: 'blur(24px) saturate(1.5)',
    border: '1px solid rgba(0,164,220,0.2)',
    borderRadius: '14px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    '& .MuiMenuItem-root': {
        color: 'rgba(255,255,255,0.75)', borderRadius: '8px', mx: 0.5, my: 0.15, fontSize: '0.88rem',
        '&:hover': { background: 'rgba(0,164,220,0.12)', color: '#00a4dc' },
        '&.Mui-selected': { background: 'rgba(0,164,220,0.2)', color: '#00a4dc' }
    }
};

export const fieldSx = {
    mb: 1.5,
    '& .MuiFilledInput-root': {
        background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
        border: '1px solid rgba(0,164,220,0.18)', transition: 'all 0.2s',
        '&:before, &:after': { display: 'none' },
        '&:hover': { background: 'rgba(0,164,220,0.07)', borderColor: 'rgba(0,164,220,0.35)' },
        '&.Mui-focused': { background: 'rgba(0,164,220,0.08)', borderColor: '#00a4dc', boxShadow: '0 0 0 3px rgba(0,164,220,0.12)' }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', letterSpacing: '0.6px', textTransform: 'uppercase' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#00a4dc' },
    '& .MuiSelect-select, & .MuiInputBase-input': { color: 'rgba(255,255,255,0.9)' },
    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' },
    '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', lineHeight: 1.4 }
};

/** displayEmpty: options whose value is '' (Auto, Any language...) must still render as selected. */
export const selectProps = { displayEmpty: true, MenuProps: { PaperProps: { sx: menuPaper } } };

interface CardProps {
    id: string;
    title: string;
    icon: React.ReactNode;
    accentColor?: string;
    open: boolean;
    onToggle: (id: string) => void;
    children: React.ReactNode;
}

/** Custom collapsible card — uses onClick directly on the header, no MUI Accordion. */
export const Card: FC<CardProps> = ({ id, title, icon, accentColor = '#00a4dc', open, onToggle, children }) => (
    <Paper elevation={0} sx={{
        background: 'rgba(10,12,22,0.78)', backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)', border: `1px solid ${open ? `${accentColor}40` : 'rgba(0,164,220,0.18)'}`,
        borderRadius: '18px', mb: 2, overflow: 'hidden', position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: open ? `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${accentColor}15` : 'none'
    }}>
        {/* Accent line */}
        <Box sx={{ position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem', height: '2px', pointerEvents: 'none', background: `linear-gradient(90deg, transparent, ${accentColor} 40%, ${accentColor === '#00a4dc' ? '#aa5cc3' : '#00a4dc'} 60%, transparent)`, borderRadius: '0 0 4px 4px' }} />

        {/* Header — clickable */}
        <Box
            onClick={() => onToggle(id)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5, cursor: 'pointer', userSelect: 'none', '&:hover': { background: 'rgba(255,255,255,0.03)' } }}
        >
            <Box sx={{ color: accentColor, display: 'flex', '& svg': { fontSize: '1rem' } }}>{icon}</Box>
            <Typography variant='overline' sx={{ flex: 1, fontSize: '0.7rem', letterSpacing: '1.5px', color: accentColor, fontWeight: 700 }}>{title}</Typography>
            <ExpandMoreIcon sx={{ color: accentColor, fontSize: '1.2rem', transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </Box>

        {/* Content */}
        <Box sx={{ overflow: 'hidden', maxHeight: open ? '4000px' : 0, transition: 'max-height 0.35s ease', px: 2.5, pb: open ? 2.5 : 0 }}>
            {children}
        </Box>
    </Paper>
);

export const Sel: FC<{ label: string; value: string; onChange: (v: string) => void; helper?: string; children: React.ReactNode }> =
    ({ label, value, onChange, helper, children }) => (
        <TextField select label={label} value={value} onChange={e => onChange(e.target.value)} fullWidth variant='filled' helperText={helper} SelectProps={selectProps} InputLabelProps={{ shrink: true }} sx={fieldSx}>{children}</TextField>
    );

export const Num: FC<{ label: string; value: string; onChange: (v: string) => void; helper?: string; min?: number; max?: number }> =
    ({ label, value, onChange, helper, min = 0, max = 9999 }) => (
        <TextField label={label} type='number' value={value} onChange={e => onChange(e.target.value)} fullWidth variant='filled' helperText={helper} inputProps={{ min, max, step: 1 }} sx={fieldSx} />
    );

export const Check: FC<{ label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; color?: string }> =
    ({ label, desc, checked, onChange, color = '#00a4dc' }) => (
        <Box sx={{ py: 0.4 }}>
            <FormControlLabel
                control={<Checkbox checked={checked} onChange={e => onChange(e.target.checked)} sx={{ color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color } }} />}
                label={<Box><Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.82)' }}>{label}</Typography>{desc && <Typography sx={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{desc}</Typography>}</Box>}
            />
        </Box>
    );

export const SaveButton: FC<{ saving: boolean; onClick: () => void; disabled?: boolean }> = ({ saving, onClick, disabled }) => (
    <Button onClick={onClick} variant='contained' disabled={saving || disabled}
        startIcon={saving ? <CircularProgress size={16} color='inherit' /> : <SaveIcon />}
        sx={{ mt: 1, background: 'linear-gradient(135deg, #00a4dc, #0077b6)', borderRadius: 2, py: 1.4, px: 8, fontWeight: 600, fontSize: '0.95rem', display: 'block', mx: 'auto', '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' } }}>
        {globalize.translate('Save')}
    </Button>
);

export const SavedSnackbar: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
    <Snackbar open={open} autoHideDuration={3000} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CheckCircleIcon sx={{ color: '#4caf50', fontSize: '1.1rem' }} /><Typography sx={{ fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>{globalize.translate('SettingsSaved')}</Typography></Box>}
        ContentProps={{ sx: { background: 'rgba(8,10,22,0.95)', color: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(76,175,80,0.35)', borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' } }} />
);
