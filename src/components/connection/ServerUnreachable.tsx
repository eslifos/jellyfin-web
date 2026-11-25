/**
 * "Can't connect to <server>": the server of this app does not answer (or the device has no network), with
 * "Retry" and "Change server". Used while the app starts (bootCheck) and by the connection error page.
 */
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import React, { type FC } from 'react';

import { useConnection } from 'hooks/useConnection';
import globalize from 'lib/globalize';
import { TEXT_SECONDARY, TEXT_TERTIARY } from 'themes/cosmic/textColors';

export interface ServerUnreachableProps {
    serverName: string;
    /** A check is running (the retry button waits). */
    checking?: boolean;
    onRetry: () => void;
    onChangeServer?: () => void;
}

const ServerUnreachable: FC<ServerUnreachableProps> = ({ serverName, checking = false, onRetry, onChangeServer }) => {
    const { offline } = useConnection();
    const Icon = offline ? CloudOffRoundedIcon : DnsRoundedIcon;

    return (
        <Box
            role='alert'
            sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                gap: 1.5, mx: 'auto', maxWidth: 520, minHeight: '100%', px: 3, py: 6
            }}
        >
            <Box sx={{
                width: 76, height: 76, borderRadius: '50%', display: 'grid', placeItems: 'center', mb: 0.5,
                background: 'rgba(0,164,220,0.12)', border: '1px solid rgba(0,164,220,0.35)', color: '#4fc3f7'
            }}>
                <Icon sx={{ fontSize: 38 }} />
            </Box>
            <Typography component='h1' sx={{ fontWeight: 800, fontSize: { xs: '1.35rem', sm: '1.6rem' }, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
                {globalize.translate('BootCannotConnect', serverName)}
            </Typography>
            <Typography sx={{ color: TEXT_SECONDARY, fontSize: '1rem', lineHeight: 1.5 }}>
                {globalize.translate(offline ? 'LoadErrorReasonOffline' : 'LoadErrorReasonServer')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, justifyContent: 'center', mt: 1 }}>
                <Button
                    variant='contained'
                    onClick={onRetry}
                    disabled={checking}
                    startIcon={checking ? <CircularProgress size={18} color='inherit' /> : <RefreshRoundedIcon />}
                    sx={{ minHeight: 44, borderRadius: '999px', px: 2.5, fontWeight: 800 }}
                >
                    {globalize.translate(checking ? 'BootChecking' : 'Retry')}
                </Button>
                {onChangeServer && (
                    <Button
                        variant='outlined'
                        onClick={onChangeServer}
                        sx={{ minHeight: 44, borderRadius: '999px', px: 2.5, fontWeight: 800 }}
                    >
                        {globalize.translate('ButtonChangeServer')}
                    </Button>
                )}
            </Box>
            <Typography sx={{ color: TEXT_TERTIARY, fontSize: '0.82rem', mt: 0.5 }}>
                {globalize.translate('LoadErrorAutoRetry')}
            </Typography>
        </Box>
    );
};

export default ServerUnreachable;
