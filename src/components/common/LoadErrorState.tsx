/**
 * What is shown instead of a blank page or an endless spinner when something could not be loaded: what failed,
 * why in plain words (no network, the server does not answer, a piece of the app did not download), and what to
 * do. It retries by itself when the connection comes back.
 *  - variant 'page': a whole section of the app (route error screens);
 *  - variant 'inline': a list or a row (libraries, rows of the home screen).
 */
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import DownloadForOfflineRoundedIcon from '@mui/icons-material/DownloadForOfflineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback } from 'react';

import { useConnection, useConnectionRestored } from 'hooks/useConnection';
import globalize from 'lib/globalize';
import { TEXT_SECONDARY, TEXT_TERTIARY } from 'themes/cosmic/textColors';
import { classifyLoadError, type LoadErrorKind } from 'utils/connection/loadError';

const REASONS: Record<LoadErrorKind, string> = {
    offline: 'LoadErrorReasonOffline',
    server: 'LoadErrorReasonServer',
    update: 'LoadErrorReasonUpdate',
    other: 'LoadErrorReasonOther'
};

const ICONS: Record<LoadErrorKind, typeof CloudOffRoundedIcon> = {
    offline: CloudOffRoundedIcon,
    server: CloudOffRoundedIcon,
    update: SystemUpdateAltRoundedIcon,
    other: ErrorOutlineRoundedIcon
};

const ROUND_BUTTON = { minHeight: 44, borderRadius: '999px', px: 2.5, fontWeight: 800 };

const reloadPage = () => window.location.reload();

/** Why it failed, knowing what the whole app knows about the connection. */
const useLoadErrorKind = (error: unknown): LoadErrorKind => {
    const { offline, serverDown } = useConnection();
    const kind = classifyLoadError(error, !offline);
    // The app already knows the server is not answering: say so, whatever this request said
    return kind === 'other' && serverDown ? 'server' : kind;
};

/** The technical details of an unexpected error, folded. */
const ErrorDetails: FC<{ error: Error }> = ({ error }) => (
    <Box component='details' sx={{ mt: 2, width: '100%', textAlign: 'left', color: TEXT_TERTIARY }}>
        <Box component='summary' sx={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {globalize.translate('LoadErrorDetails')}
        </Box>
        <Box component='pre' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem', maxHeight: '20rem', overflow: 'auto', m: 0 }}>
            {`${error.name}: ${error.message}\n\n${error.stack ?? ''}`}
        </Box>
    </Box>
);

interface LoadErrorStateProps {
    error?: unknown;
    /** Tries again (the query, the route). A piece of the app that did not download reloads the page instead. */
    onRetry: () => void;
    variant?: 'page' | 'inline';
    /** Shows "Go to Downloads" (where the downloads page exists). */
    onDownloads?: () => void;
}

const LoadErrorState: FC<LoadErrorStateProps> = ({ error, onRetry, variant = 'inline', onDownloads }) => {
    const kind = useLoadErrorKind(error);
    const reload = kind === 'update';
    const Icon = ICONS[kind];
    const page = variant === 'page';

    // Back online: try again without waiting for a tap (a new version needs the reload button)
    useConnectionRestored(useCallback(() => {
        if (!reload) onRetry();
    }, [ onRetry, reload ]));

    return (
        <Box
            role='alert'
            sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                gap: page ? 1.5 : 1, mx: 'auto', maxWidth: page ? 520 : 440,
                px: 2, py: page ? { xs: 8, sm: 12 } : 4,
                minHeight: page ? '60vh' : undefined, justifyContent: page ? 'center' : undefined
            }}
        >
            <Box sx={{
                width: page ? 72 : 52, height: page ? 72 : 52, borderRadius: '50%',
                display: 'grid', placeItems: 'center', mb: 0.5,
                background: 'rgba(0,164,220,0.12)', border: '1px solid rgba(0,164,220,0.35)', color: '#4fc3f7'
            }}>
                <Icon sx={{ fontSize: page ? 36 : 26 }} />
            </Box>
            <Typography component={page ? 'h1' : 'h2'} sx={{ fontWeight: 800, fontSize: page ? { xs: '1.35rem', sm: '1.6rem' } : '1.1rem', lineHeight: 1.25 }}>
                {globalize.translate(page ? 'LoadErrorTitle' : 'LoadErrorInlineTitle')}
            </Typography>
            <Typography sx={{ color: TEXT_SECONDARY, fontSize: page ? '1rem' : '0.92rem', lineHeight: 1.5 }}>
                {globalize.translate(REASONS[kind])}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, justifyContent: 'center', mt: 1 }}>
                <Button variant='contained' onClick={reload ? reloadPage : onRetry} startIcon={<RefreshRoundedIcon />} sx={ROUND_BUTTON}>
                    {globalize.translate(reload ? 'LoadErrorReload' : 'Retry')}
                </Button>
                {onDownloads && (
                    <Button variant='outlined' onClick={onDownloads} startIcon={<DownloadForOfflineRoundedIcon />} sx={ROUND_BUTTON}>
                        {globalize.translate('LoadErrorGoDownloads')}
                    </Button>
                )}
            </Box>
            {(kind === 'offline' || kind === 'server') && (
                <Typography sx={{ color: TEXT_TERTIARY, fontSize: '0.82rem', mt: 0.5 }}>
                    {globalize.translate('LoadErrorAutoRetry')}
                </Typography>
            )}
            {kind === 'other' && error instanceof Error && <ErrorDetails error={error} />}
        </Box>
    );
};

export default LoadErrorState;
