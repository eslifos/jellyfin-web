/**
 * The password of the account, asked to leave a secondary profile when the account has no PIN. A dialog of the same
 * kind as the profile one (Material UI): with the old full screen prompt, the profile dialog kept taking the focus
 * back and nothing could be typed on a TV. The field takes the focus (OK on the remote brings up the keyboard), Enter
 * accepts, and Back (Escape) or Cancel leaves it.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback, useRef, useState } from 'react';

import globalize from 'lib/globalize';
import { renderComponent } from 'utils/reactUtils';

export interface PasswordDialogProps {
    open: boolean;
    title: string;
    description?: string;
    /** The description is a problem (a wrong password): in red. */
    error?: boolean;
    onSubmit: (password: string) => void;
    onCancel: () => void;
}

export const PasswordDialog: FC<PasswordDialogProps> = ({ open, title, description, error, onSubmit, onCancel }) => {
    const [ password, setPassword ] = useState('');
    const field = useRef<HTMLInputElement>(null);

    const submit = useCallback(() => {
        if (password) onSubmit(password);
    }, [ password, onSubmit ]);

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            maxWidth='xs'
            fullWidth
            TransitionProps={{ onEntered: () => field.current?.focus() }}
            PaperProps={{
                sx: {
                    p: { xs: 3, sm: 4 }, borderRadius: '24px', color: '#fff',
                    background: 'rgba(10,12,24,0.96)', border: '1px solid rgba(0,164,220,0.25)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(0,164,220,0.12)'
                }
            }}
            slotProps={{ backdrop: { sx: { background: 'rgba(4,4,12,0.75)', backdropFilter: 'blur(6px)' } } }}
        >
            <Typography component='h2' sx={{ fontSize: '24px', fontWeight: 800 }}>{title}</Typography>
            {description && (
                <Typography sx={{ mt: 1, fontSize: '16px', color: error ? '#ef5350' : 'rgba(255,255,255,0.7)' }}>
                    {description}
                </Typography>
            )}
            <TextField
                inputRef={field}
                type='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submit();
                    }
                }}
                label={globalize.translate('LabelPassword')}
                autoComplete='current-password'
                fullWidth
                sx={{ mt: 3 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
                <Button onClick={onCancel} sx={{ color: 'rgba(255,255,255,0.75)' }}>{globalize.translate('ButtonCancel')}</Button>
                <Button variant='contained' onClick={submit} disabled={!password}>{globalize.translate('ButtonOk')}</Button>
            </Box>
        </Dialog>
    );
};

/** Asks for the password of the account; null when it is cancelled. */
export const askPassword = (options: { title: string; description?: string; error?: boolean }) =>
    new Promise<string | null>(resolve => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        let unmount: () => void = () => undefined;
        const done = (password: string | null) => {
            unmount();
            host.remove();
            resolve(password);
        };
        unmount = renderComponent(PasswordDialog, {
            open: true,
            ...options,
            onSubmit: password => done(password),
            onCancel: () => done(null)
        }, host);
    });
