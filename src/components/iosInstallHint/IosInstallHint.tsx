/**
 * A small notice, once, for Safari on an iPhone or iPad: how to add Jellyfin to the Home Screen
 * (Share → Add to Home Screen). It sits above the bottom bar and closes with its ×.
 */
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback, useEffect, useState } from 'react';

import globalize from 'lib/globalize';
import browser from 'scripts/browser';
import { TEXT_SECONDARY } from 'themes/cosmic/textColors';

import { IOS_INSTALL_HINT_KEY, shouldShowIosInstallHint } from './installHintRules';

const readShown = () => {
    try {
        return localStorage.getItem(IOS_INSTALL_HINT_KEY) === '1';
    } catch {
        return true; // Storage blocked: better never than every time
    }
};

const markShown = () => {
    try {
        localStorage.setItem(IOS_INSTALL_HINT_KEY, '1');
    } catch {
        // Storage blocked
    }
};

const isStandalone = () => (navigator as Navigator & { standalone?: boolean }).standalone === true
    || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);

/** The share icon of Safari: a box with an arrow going up. */
const ShareIcon = () => (
    <Box component='svg' viewBox='0 0 24 24' aria-hidden='true' sx={{ width: 20, height: 20, verticalAlign: '-4px', mx: 0.25, fill: 'none', stroke: '#00a4dc', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d='M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1' />
    </Box>
);

const IosInstallHint: FC = () => {
    const [ open, setOpen ] = useState(false);

    useEffect(() => {
        const b = browser as Record<string, unknown>;
        if (!shouldShowIosInstallHint({
            iOS: !!b.iOS,
            safari: !!b.safari,
            userAgent: navigator.userAgent,
            standalone: isStandalone(),
            shownBefore: readShown()
        })) return;
        setOpen(true);
        // Once: it is not shown again, even if it is not closed
        markShown();
    }, []);

    const close = useCallback(() => setOpen(false), []);
    if (!open) return null;

    return (
        <Box
            role='status'
            sx={{
                position: 'fixed', zIndex: 1200, left: 12, right: 12, mx: 'auto', maxWidth: 420,
                // Above the floating bottom bar
                bottom: 'calc(var(--jf-bottom-bar-space, 24px) + 8px)',
                display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.75, pr: 0.75,
                borderRadius: '16px', border: '1px solid rgba(0,164,220,0.35)',
                background: 'rgba(10,12,24,0.96)', backdropFilter: 'blur(16px)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', mb: 0.5 }}>{globalize.translate('IosHintTitle')}</Typography>
                <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.5, color: TEXT_SECONDARY }}>
                    {globalize.translate('IosHintShare')} <ShareIcon /> {globalize.translate('IosHintAdd')}
                </Typography>
            </Box>
            <IconButton onClick={close} aria-label={globalize.translate('ButtonClose')} sx={{ width: 44, height: 44, color: TEXT_SECONDARY }}>
                <CloseRoundedIcon />
            </IconButton>
        </Box>
    );
};

export default IosInstallHint;
