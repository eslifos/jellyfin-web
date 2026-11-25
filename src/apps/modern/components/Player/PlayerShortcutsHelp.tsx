/**
 * Keyboard help of the player: opened with "?" (or its button) and closed with Escape. It lists only the keys the
 * player really handles (index.tsx) plus the moves the app gives every button (Tab, Enter, the TV arrows).
 * Large type and strong contrast, so it reads from a sofa; the dialog keeps the focus inside while open.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback } from 'react';

import globalize from 'lib/globalize';
import { TEXT_SECONDARY } from 'themes/cosmic/textColors';

/** Keys (translation keys of their names, or the symbol itself) and what they do. */
const SHORTCUTS: { keys: string[], action: string }[] = [
    { keys: [ '?' ], action: 'ApKeyHelp' },
    { keys: [ 'Esc' ], action: 'ApKeyEscape' },
    { keys: [ 'Enter', 'ApKeySpace' ], action: 'ApKeyMiniOpen' },
    { keys: [ 'Enter', 'ApKeySpace' ], action: 'ApKeyButton' },
    { keys: [ 'Tab', 'ApKeyShiftTab' ], action: 'ApKeyTab' },
    { keys: [ '↑ ↓ ← →' ], action: 'ApKeyArrows' }
];

const keyName = (key: string) => (key.startsWith('ApKey') ? globalize.translate(key) : key);

interface PlayerShortcutsHelpProps {
    open: boolean;
    onClose: () => void;
}

const PlayerShortcutsHelp: FC<PlayerShortcutsHelpProps> = ({ open, onClose }) => {
    // Escape closes only this help: the player behind (which also closes with Escape) stays open
    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.nativeEvent.stopPropagation();
        onClose();
    }, [ onClose ]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            onKeyDown={onKeyDown}
            aria-labelledby='abpKeysTitle'
            maxWidth='sm'
            fullWidth
            sx={{ zIndex: 1600 }}
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: '20px', border: '1px solid rgba(0,164,220,0.3)', background: 'rgba(10,12,24,0.97)',
                        p: { xs: 2.5, sm: 3.5 },
                        // TV: read from the sofa
                        '.layout-tv &': { maxWidth: 900, fontSize: '1.35rem', p: 5 }
                    }
                }
            }}
        >
            <Typography id='abpKeysTitle' component='h2' sx={{ fontSize: '1.4em', fontWeight: 800, mb: 2 }}>
                {globalize.translate('ApKeysTitle')}
            </Typography>
            <Box component='dl' sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(9em, auto) 1fr', columnGap: 3, rowGap: 1.5, alignItems: 'center' }}>
                {SHORTCUTS.map(s => (
                    <React.Fragment key={s.action}>
                        <Box component='dt' sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, m: 0 }}>
                            {s.keys.map(k => (
                                <Box
                                    key={k}
                                    component='kbd'
                                    sx={{
                                        minWidth: '2.2em', px: '0.6em', py: '0.25em', textAlign: 'center',
                                        fontFamily: 'inherit', fontSize: '0.95em', fontWeight: 800, color: '#fff',
                                        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.35)', borderBottomWidth: 3,
                                        background: 'rgba(255,255,255,0.08)'
                                    }}
                                >
                                    {keyName(k)}
                                </Box>
                            ))}
                        </Box>
                        <Box component='dd' sx={{ m: 0, fontSize: '1em', lineHeight: 1.45, color: TEXT_SECONDARY }}>
                            {globalize.translate(s.action)}
                        </Box>
                    </React.Fragment>
                ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                {/* The dialog takes the focus when it opens and keeps Tab inside it */}
                <Button variant='contained' onClick={onClose} sx={{ minHeight: 44, px: 3, borderRadius: '12px', fontSize: '1em' }}>
                    {globalize.translate('ButtonClose')}
                </Button>
            </Box>
        </Dialog>
    );
};

export default PlayerShortcutsHelp;
