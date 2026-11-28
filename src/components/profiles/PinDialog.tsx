/**
 * The PIN of the account on a keypad: typed with the arrows and OK of the remote, its number keys, a keyboard or a
 * touch screen. Leaving a kids profile asks for it (askPin), and the account sets it from Manage profiles.
 */
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import React, { type FC, useCallback, useEffect, useRef, useState } from 'react';

import globalize from 'lib/globalize';
import { isValidPin } from 'utils/profiles';
import { renderComponent } from 'utils/reactUtils';

const MAX_DIGITS = 8;
const MIN_DIGITS = 4;
const ACCENT = '#00a4dc';
const KEYS = [ '1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok' ];

export interface PinDialogProps {
    open: boolean;
    title: string;
    description?: string;
    /** The description is a problem (a wrong PIN): in red. */
    error?: boolean;
    onSubmit: (pin: string) => void;
    onCancel: () => void;
}

const keySx = {
    width: 88, height: 72, borderRadius: '18px', fontSize: '28px', fontWeight: 700, color: '#fff',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    transition: 'background 0.15s, transform 0.15s',
    '&:hover': { background: 'rgba(0,164,220,0.25)' },
    // Where the focus of the remote is, seen from the couch
    '&:focus-visible, &:focus': { outline: 'none', background: '#fff', color: '#000', transform: 'scale(1.06)' },
    '&.Mui-disabled': { opacity: 0.35 }
};

export const PinDialog: FC<PinDialogProps> = ({ open, title, description, error, onSubmit, onCancel }) => {
    const [ pin, setPin ] = useState('');
    const firstKey = useRef<HTMLButtonElement>(null);
    const okKey = useRef<HTMLButtonElement>(null);
    /** The keys that are reached from code: 1 (the first focus) and OK. */
    const keyRefs: Partial<Record<string, React.Ref<HTMLButtonElement>>> = { '1': firstKey, ok: okKey };
    const ready = isValidPin(pin);

    useEffect(() => {
        if (open) setPin('');
    }, [ open, description ]);

    const press = useCallback((key: string) => {
        if (key === 'back') {
            setPin(value => value.slice(0, -1));
        } else if (key === 'ok') {
            if (isValidPin(pin)) onSubmit(pin);
        } else {
            setPin(value => (value.length < MAX_DIGITS ? value + key : value));
        }
    }, [ pin, onSubmit ]);

    // The number keys of a remote or a keyboard, and its delete key; with enough digits the focus goes to OK, so
    // Enter (or the OK of the remote) confirms instead of typing the key in focus
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (/^\d$/.test(e.key)) {
                press(e.key);
                if (pin.length + 1 >= MIN_DIGITS) setTimeout(() => okKey.current?.focus());
            } else if (e.key === 'Backspace') {
                press('back');
            } else {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [ open, press, pin ]);

    const slots = Math.max(MIN_DIGITS, pin.length);

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            TransitionProps={{ onEntered: () => firstKey.current?.focus() }}
            PaperProps={{
                sx: {
                    // The key in focus grows: room for it, without scroll bars
                    overflow: 'visible',
                    p: { xs: 3, sm: 4 }, borderRadius: '24px', color: '#fff', textAlign: 'center',
                    background: 'rgba(10,12,24,0.96)', border: '1px solid rgba(0,164,220,0.25)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(0,164,220,0.12)'
                }
            }}
            slotProps={{ backdrop: { sx: { background: 'rgba(4,4,12,0.75)', backdropFilter: 'blur(6px)' } } }}
        >
            <Typography component='h2' sx={{ fontSize: '26px', fontWeight: 800 }}>{title}</Typography>
            {description && (
                <Typography sx={{ mt: 1, maxWidth: 340, mx: 'auto', fontSize: '16px', color: error ? '#ef5350' : 'rgba(255,255,255,0.7)' }}>
                    {description}
                </Typography>
            )}

            <Box aria-hidden='true' sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, my: 3 }}>
                {Array.from({ length: slots }, (_, i) => (
                    <Box
                        key={i}
                        sx={{
                            width: 18, height: 18, borderRadius: '50%',
                            border: `2px solid ${i < pin.length ? ACCENT : 'rgba(255,255,255,0.35)'}`,
                            background: i < pin.length ? ACCENT : 'transparent'
                        }}
                    />
                ))}
            </Box>
            <Typography sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} role='status'>
                {globalize.translate('ProfilePinDigits', pin.length)}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 88px)', gap: 1.5, justifyContent: 'center' }}>
                {KEYS.map(key => {
                    let label: React.ReactNode = key;
                    if (key === 'back') label = <BackspaceOutlinedIcon />;
                    if (key === 'ok') label = <CheckRoundedIcon />;
                    let name: string | undefined;
                    if (key === 'back') name = globalize.translate('Delete');
                    if (key === 'ok') name = globalize.translate('ButtonOk');
                    return (
                        <ButtonBase
                            key={key}
                            ref={keyRefs[key]}
                            onClick={() => press(key)}
                            disabled={key === 'ok' && !ready}
                            aria-label={name}
                            sx={key === 'ok' ? { ...keySx, background: ready ? ACCENT : keySx.background } : keySx}
                        >
                            {label}
                        </ButtonBase>
                    );
                })}
            </Box>
        </Dialog>
    );
};

/** Asks for a PIN on the keypad; null when it is cancelled. */
export const askPin = (options: { title: string; description?: string; error?: boolean }) =>
    new Promise<string | null>(resolve => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        let unmount: () => void = () => undefined;
        const done = (pin: string | null) => {
            unmount();
            host.remove();
            resolve(pin);
        };
        unmount = renderComponent(PinDialog, {
            open: true,
            ...options,
            onSubmit: pin => done(pin),
            onCancel: () => done(null)
        }, host);
    });
