/**
 * A strip fixed at the top while the device has no network or the server does not answer: "No connection to
 * the server — retrying…". It goes away by itself when the connection is back (utils/connection/monitor).
 */
import Box from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';
import React, { type FC } from 'react';

import { useConnection } from 'hooks/useConnection';
import globalize from 'lib/globalize';
import { prefersReducedMotion } from 'utils/reducedMotion';

const pulse = keyframes`
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
`;

const ConnectionBanner: FC = () => {
    const { offline, serverDown } = useConnection();
    if (!offline && !serverDown) return null;

    return (
        <Box
            role='status'
            aria-live='polite'
            className='jf-connection-banner'
            sx={{
                position: 'fixed', zIndex: 2100, top: 0, left: 0, right: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
                minHeight: 36, px: 2, pt: 'env(safe-area-inset-top, 0px)',
                background: 'rgba(28,22,6,0.95)', borderBottom: '1px solid rgba(255,183,77,0.45)',
                color: '#ffe0a3', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center',
                backdropFilter: 'blur(10px)', pointerEvents: 'none'
            }}
        >
            <Box
                component='span'
                aria-hidden='true'
                sx={{
                    width: 8, height: 8, borderRadius: '50%', background: '#ffb74d', flex: '0 0 auto',
                    animation: prefersReducedMotion() ? undefined : `${pulse} 1.4s ease-in-out infinite`
                }}
            />
            {globalize.translate('ConnectionBannerRetrying')}
        </Box>
    );
};

export default ConnectionBanner;
