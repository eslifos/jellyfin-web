import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import Snackbar, { SnackbarProps } from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';

type ToastProps = SnackbarProps & {
    /** Visual style: green check (default) or red error. */
    severity?: 'success' | 'error';
};

const COLORS = {
    success: '#4caf50',
    error: '#ef5350'
};

/** Cosmic Dark snackbar, same look as the preferences "saved" toast. */
const Toast = ({ severity = 'success', message, ContentProps, ...props }: ToastProps) => {
    const color = COLORS[severity];

    const onCloseClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        props.onClose?.(e, 'clickaway');
    }, [ props ]);

    const action = (
        <IconButton
            size='small'
            onClick={onCloseClick}
            sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.08)' } }}
        >
            <CloseIcon fontSize='small' />
        </IconButton>
    );

    return (
        <Snackbar
            autoHideDuration={3300}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            action={action}
            message={(
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {severity === 'error' ?
                        <ErrorIcon sx={{ color, fontSize: '1.1rem' }} /> :
                        <CheckCircleIcon sx={{ color, fontSize: '1.1rem' }} />}
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>{message}</Typography>
                </Box>
            )}
            ContentProps={{
                ...ContentProps,
                sx: {
                    background: 'rgba(8,10,22,0.95)',
                    color: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${color}59`,
                    borderRadius: 2,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }
            }}
            {...props}
        />
    );
};

export default Toast;
