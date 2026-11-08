/**
 * Shared pieces for the Live TV setup pages (tuner and guide providers).
 */
import React, { type FC, useCallback } from 'react';
import type { TunerHostInfo } from '@jellyfin/sdk/lib/generated-client/models/tuner-host-info';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ListAltIcon from '@mui/icons-material/ListAlt';
import RouterIcon from '@mui/icons-material/Router';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import SaveIcon from '@mui/icons-material/Save';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import { useNavigate } from 'react-router-dom';

import { ToggleRow } from 'apps/dashboard/components/cosmic';
import getTunerName from 'apps/dashboard/features/livetv/utils/getTunerName';
import DirectoryBrowser from 'components/directorybrowser/directorybrowser';
import globalize from 'lib/globalize';

const TUNER_COLORS: Record<string, string> = { m3u: '#00a4dc', nextpvr: '#26c6da', hdhomerun: '#4caf50', hauppauge: '#ff9800', satip: '#aa5cc3' };
export const tunerColor = (type?: string | null) => TUNER_COLORS[(type || '').toLowerCase()] || '#90a4ae';

export const TunerTypeIcon: FC<{ type?: string | null }> = ({ type }) => {
    switch ((type || '').toLowerCase()) {
        case 'hdhomerun': return <RouterIcon />;
        case 'satip': return <SatelliteAltIcon />;
        case 'm3u': return <ListAltIcon />;
        case 'nextpvr': return <SettingsInputComponentIcon />;
        default: return <SettingsInputAntennaIcon />;
    }
};

export const IconBox: FC<{ color: string; children: React.ReactNode; size?: number }> = ({ color, children, size = 44 }) => (
    <Box sx={{
        width: size, height: size, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1f`, border: `1px solid ${color}44`, '& svg': { color, fontSize: size * 0.5 }
    }}>
        {children}
    </Box>
);

/** Selectable tile, used to pick the tuner type. */
export const ChoiceTile: FC<{ selected: boolean; disabled?: boolean; color: string; icon: React.ReactNode; title: string; description?: string; onClick: () => void }> = ({ selected, disabled, color, icon, title, description, onClick }) => (
    <Box
        component='button'
        type='button'
        onClick={onClick}
        disabled={disabled}
        sx={{
            all: 'unset', boxSizing: 'border-box', cursor: disabled ? 'default' : 'pointer', opacity: disabled && !selected ? 0.35 : 1,
            display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '14px',
            background: selected ? `${color}1a` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${selected ? color : 'rgba(255,255,255,0.08)'}`,
            boxShadow: selected ? `0 0 18px ${color}33` : 'none',
            transition: 'background 0.2s, border-color 0.2s',
            '&:hover': disabled ? undefined : { borderColor: `${color}88` },
            '&:focus-visible': { outline: `2px solid ${color}`, outlineOffset: 2 }
        }}
    >
        <IconBox color={color} size={40}>{icon}</IconBox>
        <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>{title}</Typography>
            {description && <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{description}</Typography>}
        </Box>
    </Box>
);

/** Text field with a button that opens the server file browser. */
export const BrowseField: FC<{ label: string; value: string; onChange: (v: string) => void; helperText?: React.ReactNode; placeholder?: string; required?: boolean; browse?: boolean; includeFiles?: boolean }> = ({ label, value, onChange, helperText, placeholder, required, browse = true, includeFiles = true }) => {
    const open = useCallback(() => {
        const picker = new DirectoryBrowser();
        picker.show({
            includeFiles,
            callback: (path: string) => {
                if (path) onChange(path);
                picker.close();
            }
        });
    }, [ includeFiles, onChange ]);

    return (
        <TextField
            label={label}
            value={value}
            onChange={e => onChange(e.target.value)}
            helperText={helperText}
            placeholder={placeholder}
            required={required}
            fullWidth
            slotProps={{
                input: {
                    sx: { fontFamily: value ? 'monospace' : undefined, fontSize: '0.88rem' },
                    endAdornment: browse ? (
                        <InputAdornment position='end'>
                            <IconButton edge='end' onClick={open} title={globalize.translate('ButtonSelectDirectory')}>
                                <FolderOpenIcon />
                            </IconButton>
                        </InputAdornment>
                    ) : undefined
                },
                inputLabel: { shrink: true }
            }}
        />
    );
};

/** Free text list of categories shown as chips (stored as string arrays). */
export const CategoryInput: FC<{ label: string; helperText?: string; value: string[]; onChange: (v: string[]) => void; color: string }> = ({ label, helperText, value, onChange, color }) => (
    <Autocomplete
        multiple
        freeSolo
        options={[] as string[]}
        value={value}
        onChange={(_, v) => onChange((v as string[]).map(s => s.trim()).filter(Boolean))}
        renderTags={(items, getTagProps) => items.map((item, index) => {
            const { key, ...props } = getTagProps({ index });
            return <Chip key={key} {...props} size='small' label={item} sx={{ background: `${color}22`, border: `1px solid ${color}55`, color: 'rgba(255,255,255,0.9)' }} />;
        })}
        renderInput={params => (
            <TextField
                {...params}
                label={label}
                helperText={helperText}
                placeholder={value.length ? '' : globalize.translate('LtfTypeAndEnter')}
                slotProps={{ inputLabel: { shrink: true } }}
            />
        )}
    />
);

/** "All tuners" switch plus one checkbox per tuner. */
export const TunerSelector: FC<{ tuners: TunerHostInfo[]; all: boolean; selected: string[]; onAllChange: (v: boolean) => void; onSelectedChange: (v: string[]) => void }> = ({ tuners, all, selected, onAllChange, onSelectedChange }) => {
    const toggle = (id: string) => onSelectedChange(selected.includes(id) ? selected.filter(s => s !== id) : [ ...selected, id ]);

    return (
        <Stack spacing={1.25}>
            <ToggleRow label={globalize.translate('OptionEnableForAllTuners')} description={globalize.translate('LtfAllTunersHelp')} checked={all} onChange={onAllChange} color='#26c6da' />
            {!all && (tuners.length ? tuners.map(t => {
                const color = tunerColor(t.Type);
                const id = t.Id || '';
                return (
                    <Box key={id} component='label' sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, pr: 1.5, borderRadius: '12px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <Checkbox checked={selected.includes(id)} onChange={() => toggle(id)} />
                        <IconBox color={color} size={34}><TunerTypeIcon type={t.Type} /></IconBox>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.9)' }}>{t.FriendlyName || getTunerName(t.Type || '')}</Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.Url}</Typography>
                        </Box>
                    </Box>
                );
            }) : (
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('LtvNoTuners')}</Typography>
            ))}
        </Stack>
    );
};

/** Cancel + save buttons at the bottom of a setup page. */
export const FormActions: FC<{ saving: boolean; disabled?: boolean; saveLabel?: string }> = ({ saving, disabled, saveLabel }) => {
    const navigate = useNavigate();
    const back = useCallback(() => navigate('/dashboard/livetv'), [ navigate ]);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3, flexWrap: 'wrap' }}>
            <Button variant='outlined' size='large' startIcon={<ArrowBackIcon />} onClick={back} sx={{ px: 4, py: 1.4 }}>
                {globalize.translate('ButtonCancel')}
            </Button>
            <Button
                type='submit'
                variant='contained'
                size='large'
                disabled={saving || disabled}
                startIcon={saving ? <CircularProgress size={16} color='inherit' /> : <SaveIcon />}
                sx={{ px: 8, py: 1.4, fontWeight: 600 }}
            >
                {saveLabel || globalize.translate('Save')}
            </Button>
        </Box>
    );
};

/** Numbered step header used by the Schedules Direct page. */
export const StepBadge: FC<{ n: number; done?: boolean }> = ({ n, done }) => (
    <Box sx={{
        width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontSize: '0.8rem', fontWeight: 700, color: '#fff', background: done ? '#4caf50' : 'rgba(0,164,220,0.7)'
    }}>
        {done ? '✓' : n}
    </Box>
);
