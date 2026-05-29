import React from 'react';
import Box from '@mui/material/Box';

/**
 * Full-viewport animated SVG background with blob gradients and floating particles.
 * Rendered as `position: fixed` with `pointer-events: none` so it never blocks interaction.
 * Intended to be used inside pages that have `position: relative; z-index: 1`.
 */
const WizardBackground = () => (
    <>
        <Box
            aria-hidden
            sx={{
                position: 'fixed',
                inset: 0,
                zIndex: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
                background: `
                    radial-gradient(ellipse at 18% 45%, rgba(0,55,85,0.65) 0%, transparent 55%),
                    radial-gradient(ellipse at 82% 18%, rgba(75,0,105,0.55) 0%, transparent 55%),
                    #080810`
            }}
        >
            <svg
                viewBox='0 0 1440 900'
                preserveAspectRatio='xMidYMid slice'
                xmlns='http://www.w3.org/2000/svg'
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
                <defs>
                    <filter id='jf-f1' x='-40%' y='-40%' width='180%' height='180%'>
                        <feGaussianBlur stdDeviation='75' />
                    </filter>
                    <filter id='jf-f2' x='-40%' y='-40%' width='180%' height='180%'>
                        <feGaussianBlur stdDeviation='95' />
                    </filter>
                    <filter id='jf-f3' x='-40%' y='-40%' width='180%' height='180%'>
                        <feGaussianBlur stdDeviation='80' />
                    </filter>
                    <radialGradient id='jf-ga' cx='50%' cy='50%' r='50%'>
                        <stop offset='0%' stopColor='#00a4dc' stopOpacity='0.55' />
                        <stop offset='100%' stopColor='#00a4dc' stopOpacity='0' />
                    </radialGradient>
                    <radialGradient id='jf-gb' cx='50%' cy='50%' r='50%'>
                        <stop offset='0%' stopColor='#aa5cc3' stopOpacity='0.5' />
                        <stop offset='100%' stopColor='#aa5cc3' stopOpacity='0' />
                    </radialGradient>
                    <radialGradient id='jf-gc' cx='50%' cy='50%' r='50%'>
                        <stop offset='0%' stopColor='#0077b6' stopOpacity='0.38' />
                        <stop offset='100%' stopColor='#0077b6' stopOpacity='0' />
                    </radialGradient>
                    <pattern id='jf-dp' x='0' y='0' width='40' height='40' patternUnits='userSpaceOnUse'>
                        <circle cx='2' cy='2' r='1' fill='rgba(255,255,255,0.05)' />
                    </pattern>
                </defs>
                <ellipse className='jf-blob-1' cx='220' cy='240' rx='340' ry='280' fill='url(#jf-ga)' filter='url(#jf-f1)' />
                <ellipse className='jf-blob-2' cx='1200' cy='680' rx='380' ry='300' fill='url(#jf-gb)' filter='url(#jf-f2)' />
                <ellipse className='jf-blob-3' cx='780' cy='420' rx='300' ry='240' fill='url(#jf-gc)' filter='url(#jf-f3)' />
                <circle className='jf-ring' cx='1340' cy='100' r='180' fill='none' stroke='#00a4dc' strokeWidth='1.5' />
                <circle className='jf-ring-2' cx='100' cy='800' r='140' fill='none' stroke='#aa5cc3' strokeWidth='1' />
                <rect width='100%' height='100%' fill='url(#jf-dp)' />
            </svg>
        </Box>

        <Box aria-hidden sx={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {[
                { w: 4,  l: '10%', t: '20%', d: '4s',   bg: 'rgba(0,164,220,0.35)' },
                { w: 6,  l: '25%', t: '70%', d: '5s',   delay: '1s',   bg: 'rgba(170,92,195,0.4)' },
                { w: 3,  l: '40%', t: '15%', d: '3.5s', delay: '0.5s', bg: 'rgba(0,164,220,0.35)' },
                { w: 5,  l: '60%', t: '80%', d: '6s',   delay: '2s',   bg: 'rgba(170,92,195,0.3)' },
                { w: 4,  l: '75%', t: '35%', d: '4.5s', delay: '1.5s', bg: 'rgba(0,164,220,0.35)' },
                { w: 7,  l: '85%', t: '60%', d: '5.5s', delay: '0.8s', bg: 'rgba(0,164,220,0.35)' },
                { w: 3,  l: '50%', t: '45%', d: '3s',   delay: '2.5s', bg: 'rgba(0,164,220,0.35)' },
                { w: 5,  l: '15%', t: '55%', d: '7s',   delay: '1s',   bg: 'rgba(170,92,195,0.35)' }
            ].map((p, i) => (
                <Box
                    key={i}
                    sx={{
                        position: 'absolute',
                        width: p.w,
                        height: p.w,
                        left: p.l,
                        top: p.t,
                        borderRadius: '50%',
                        background: p.bg,
                        animation: `jf-float-particle ${p.d} ease-in-out infinite`,
                        animationDelay: p.delay ?? '0s'
                    }}
                />
            ))}
        </Box>
    </>
);

export default WizardBackground;
