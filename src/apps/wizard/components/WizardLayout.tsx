import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

import { useCustomLogo } from 'utils/customLogo';

import WizardBackground from './WizardBackground';

interface WizardLayoutProps {
    children: React.ReactNode;
    /** Maximum card width in pixels. Defaults to 640. */
    maxWidth?: number | string;
}

/**
 * Shared layout wrapper for all wizard steps.
 * Renders the animated background, the Jellyfin logo, and a glassmorphism card
 * containing the step-specific content.
 */
const WizardLayout = ({ children, maxWidth = 640 }: WizardLayoutProps) => {
    const { bannerUrl: bannerLight } = useCustomLogo();
    return (<Box
        sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
            p: 2
        }}
    >
        <WizardBackground />

        <Box
            aria-label='Jellyfin'
            sx={{
                width: 220,
                height: 56,
                backgroundImage: `url(${bannerLight as string})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                mb: 2,
                flexShrink: 0,
                position: 'relative',
                zIndex: 2,
                animation: 'jf-logo-glow 3s ease-in-out infinite, jf-float-logo 4s ease-in-out infinite'
            }}
        />

        <Paper
            elevation={0}
            sx={{
                width: '100%',
                maxWidth,
                position: 'relative',
                zIndex: 2,
                background: 'rgba(10,12,22,0.78)',
                backdropFilter: 'blur(28px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
                border: '1px solid rgba(0,164,220,0.2)',
                borderRadius: 3,
                p: { xs: 3, sm: 4 },
                animation: 'jf-glow-pulse 4s ease-in-out infinite',
                overflow: 'visible',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '2rem',
                    right: '2rem',
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, #00a4dc 40%, #aa5cc3 60%, transparent)',
                    borderRadius: '0 0 4px 4px'
                }
            }}
        >
            {children}
        </Paper>
    </Box>);
};

export default WizardLayout;
