/**
 * Dialog to customize the home library bar. Changes preview live; they are saved with "Save".
 */
import React, { type FC, type ReactNode, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import globalize from 'lib/globalize';

import { ACCENTS, BACKGROUNDS, DEFAULT_SETTINGS, type LabelMode, type NavSettings, backgroundCss } from './navSettings';

export interface NavEntry {
    key: string;
    name: string;
    icon: ReactNode;
}

interface Props {
    open: boolean;
    settings: NavSettings;
    entries: NavEntry[];
    onChange: (s: NavSettings) => void;
    onSave: () => void;
    onCancel: () => void;
}

const sectionTitle = { fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', mt: 2.5, mb: 1 } as const;

const Swatch: FC<{ background: string; selected: boolean; label: string; onClick: () => void }> = ({ background, selected, label, onClick }) => (
    <Box
        component='button'
        type='button'
        title={label}
        aria-label={label}
        aria-pressed={selected}
        onClick={onClick}
        sx={{
            width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', p: 0, background,
            border: selected ? '3px solid #fff' : '2px solid rgba(255,255,255,0.18)',
            boxShadow: selected ? '0 0 0 2px rgba(0,164,220,0.8)' : 'none',
            transition: 'transform 0.15s', '&:hover': { transform: 'scale(1.08)' }
        }}
    />
);

const NavCustomizeDialog: FC<Props> = ({ open, settings, entries, onChange, onSave, onCancel }) => {
    const [ dragKey, setDragKey ] = useState<string | null>(null);
    const keys = entries.map(e => e.key);
    const set = (patch: Partial<NavSettings>) => onChange({ ...settings, ...patch });

    const move = (from: number, to: number) => {
        if (to < 0 || to >= keys.length || from === to) return;
        const next = [ ...keys ];
        const [ k ] = next.splice(from, 1);
        next.splice(to, 0, k);
        set({ order: next });
    };

    const toggleHidden = (key: string) => {
        const hidden = settings.hidden.includes(key) ?
            settings.hidden.filter(h => h !== key) :
            [ ...settings.hidden, key ];
        // Keep at least one item visible
        if (hidden.length >= keys.length) return;
        set({ hidden });
    };

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            fullWidth
            maxWidth='sm'
            PaperProps={{ sx: {
                borderRadius: '22px', color: '#fff',
                background: 'linear-gradient(160deg, rgba(20,24,44,0.97), rgba(8,10,22,0.97))',
                border: '1px solid rgba(0,164,220,0.2)', backdropFilter: 'blur(20px)'
            } }}
        >
            <DialogTitle sx={{ fontWeight: 900 }}>{globalize.translate('NavCustomize')}</DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
                {/* Preview */}
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, borderRadius: '16px', background: 'repeating-linear-gradient(45deg, #1c2236 0 12px, #232a42 12px 24px)' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, px: 1, py: 0.75, borderRadius: '50px', background: backgroundCss(settings), border: `1px solid ${settings.accent}55`, maxWidth: '100%', overflow: 'hidden' }}>
                        {entries.filter(e => !settings.hidden.includes(e.key)).map((e, i) => (
                            <Box key={e.key} sx={{
                                display: 'flex', alignItems: 'center', gap: 0.6, px: 1.2, py: 0.6, borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
                                color: i === 0 ? settings.accent : 'rgba(255,255,255,0.75)', background: i === 0 ? `${settings.accent}24` : 'none',
                                '& svg': { fontSize: '1.1rem' }
                            }}>
                                {e.icon}
                                {settings.labels !== 'icons' && <span>{e.name}</span>}
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Typography sx={sectionTitle}>{globalize.translate('NavItems')}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', mb: 1 }}>{globalize.translate('NavItemsHelp')}</Typography>
                <Box component='ul' sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.6 }}>
                    {entries.map((e, i) => {
                        const hidden = settings.hidden.includes(e.key);
                        return (
                            <Box
                                component='li'
                                key={e.key}
                                draggable
                                onDragStart={() => setDragKey(e.key)}
                                onDragEnd={() => setDragKey(null)}
                                onDragOver={(ev: React.DragEvent) => {
                                    ev.preventDefault();
                                    if (dragKey && dragKey !== e.key) move(keys.indexOf(dragKey), i);
                                }}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: '12px',
                                    background: dragKey === e.key ? 'rgba(0,164,220,0.18)' : 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)', opacity: hidden ? 0.45 : 1, cursor: 'grab'
                                }}
                            >
                                <DragIndicatorIcon sx={{ color: 'rgba(255,255,255,0.35)' }} />
                                <Box sx={{ display: 'flex', '& svg': { fontSize: '1.3rem' } }}>{e.icon}</Box>
                                <Typography sx={{ flex: 1, fontWeight: 600, minWidth: 0 }} noWrap>{e.name}</Typography>
                                <IconButton size='small' aria-label={globalize.translate('NavMoveUp')} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUpwardIcon fontSize='small' /></IconButton>
                                <IconButton size='small' aria-label={globalize.translate('NavMoveDown')} disabled={i === entries.length - 1} onClick={() => move(i, i + 1)}><ArrowDownwardIcon fontSize='small' /></IconButton>
                                <IconButton size='small' aria-label={globalize.translate(hidden ? 'NavShow' : 'NavHide')} onClick={() => toggleHidden(e.key)}>
                                    {hidden ? <VisibilityOffIcon fontSize='small' /> : <VisibilityIcon fontSize='small' />}
                                </IconButton>
                            </Box>
                        );
                    })}
                </Box>

                <Typography sx={sectionTitle}>{globalize.translate('NavBackground')}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2, alignItems: 'center' }}>
                    {BACKGROUNDS.map(b => (
                        <Swatch
                            key={b.id}
                            label={globalize.translate(`NavBg_${b.id}`)}
                            background={`linear-gradient(135deg, ${b.colors[0]}, ${b.colors[1]})`}
                            selected={settings.background === b.id}
                            onClick={() => set({ background: b.id })}
                        />
                    ))}
                    <Box component='label' title={globalize.translate('NavCustomColor')} sx={{ position: 'relative', display: 'flex' }}>
                        <Swatch
                            label={globalize.translate('NavCustomColor')}
                            background={settings.background === 'custom' ? settings.customColor : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'}
                            selected={settings.background === 'custom'}
                            onClick={() => set({ background: 'custom' })}
                        />
                        <Box component='input' type='color' value={settings.customColor}
                            onChange={(ev: React.ChangeEvent<HTMLInputElement>) => set({ background: 'custom', customColor: ev.target.value })}
                            sx={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
                    <Typography sx={{ fontSize: '0.9rem', minWidth: 110 }}>{globalize.translate('NavOpacity')}</Typography>
                    <Slider size='small' min={20} max={100} value={settings.opacity} valueLabelDisplay='auto'
                        onChange={(_, v) => set({ opacity: v as number })} sx={{ color: settings.accent }} />
                </Box>

                <Typography sx={sectionTitle}>{globalize.translate('NavAccent')}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2 }}>
                    {ACCENTS.map(c => (
                        <Swatch key={c} label={c} background={c} selected={settings.accent.toLowerCase() === c} onClick={() => set({ accent: c })} />
                    ))}
                    <Box component='label' sx={{ position: 'relative', display: 'flex' }}>
                        <Swatch
                            label={globalize.translate('NavCustomColor')}
                            background={ACCENTS.includes(settings.accent.toLowerCase()) ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : settings.accent}
                            selected={!ACCENTS.includes(settings.accent.toLowerCase())}
                            onClick={() => undefined}
                        />
                        <Box component='input' type='color' value={settings.accent}
                            onChange={(ev: React.ChangeEvent<HTMLInputElement>) => set({ accent: ev.target.value })}
                            sx={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                    </Box>
                </Box>

                <Typography sx={sectionTitle}>{globalize.translate('NavLabels')}</Typography>
                <ToggleButtonGroup exclusive size='small' value={settings.labels}
                    onChange={(_, v: LabelMode | null) => v && set({ labels: v })}
                    sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.7)', textTransform: 'none', px: 2 }, '& .Mui-selected': { color: '#fff !important', background: `${settings.accent}40 !important` } }}
                >
                    <ToggleButton value='auto'>{globalize.translate('NavLabelsAuto')}</ToggleButton>
                    <ToggleButton value='always'>{globalize.translate('NavLabelsAlways')}</ToggleButton>
                    <ToggleButton value='icons'>{globalize.translate('NavLabelsIcons')}</ToggleButton>
                </ToggleButtonGroup>

                <Box sx={{ display: 'grid', gap: 0.5, mt: 2 }}>
                    <Box component='label' sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <Typography>{globalize.translate('NavGlow')}</Typography>
                        <Switch checked={settings.glow} onChange={(_, v) => set({ glow: v })} />
                    </Box>
                    <Box component='label' sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <Typography>{globalize.translate('NavSticky')}</Typography>
                        <Switch checked={settings.sticky} onChange={(_, v) => set({ sticky: v })} />
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                <Button onClick={() => onChange({ ...DEFAULT_SETTINGS })} sx={{ mr: 'auto', color: 'rgba(255,255,255,0.7)' }}>{globalize.translate('NavReset')}</Button>
                <Button onClick={onCancel} sx={{ color: 'rgba(255,255,255,0.8)' }}>{globalize.translate('ButtonCancel')}</Button>
                <Button variant='contained' onClick={onSave} sx={{ borderRadius: '50px', px: 3, background: settings.accent, color: '#000', fontWeight: 800, '&:hover': { background: settings.accent, filter: 'brightness(1.1)' } }}>
                    {globalize.translate('Save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NavCustomizeDialog;
