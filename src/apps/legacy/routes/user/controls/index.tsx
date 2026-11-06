/**
 * ControlsPreferencesPage — React migration of the legacy controls settings
 * (gamepad and smooth scroll), using the shared glassmorphism cards.
 */
import React, { type FC, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import SwipeVerticalIcon from '@mui/icons-material/SwipeVertical';

import layoutManager from 'components/layoutManager';
import Page from 'components/Page';
import globalize from 'lib/globalize';
import keyboardNavigation from 'scripts/keyboardNavigation';
import rawAppSettings from 'scripts/settings/appSettings';

import { type Accessors, Card, Check, SaveButton, SavedSnackbar } from '../components/PreferencesUi';

const appSettings = rawAppSettings as unknown as Accessors;

const ControlsPreferencesPage: FC = () => {
    const [ expanded, setExpanded ] = useState<Record<string, boolean>>({ gamepad: true, navigation: true });
    const toggle = useCallback((id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] })), []);

    const [ gamepad, setGamepad ] = useState<boolean>(() => Boolean(appSettings.enableGamepad()));
    const [ smoothScroll, setSmoothScroll ] = useState<boolean>(() => Boolean(appSettings.enableSmoothScroll()));
    const [ saved, setSaved ] = useState(false);

    const showGamepad = keyboardNavigation.canEnableGamepad();
    const showSmoothScroll = layoutManager.tv;

    const handleSave = useCallback(() => {
        appSettings.enableGamepad(gamepad);
        appSettings.enableSmoothScroll(smoothScroll);
        setSaved(true);
    }, [ gamepad, smoothScroll ]);

    return (
        <Page id='controlsPreferencesPage' className='libraryPage userPreferencesPage noSecondaryNavPage mainAnimatedPage' title={globalize.translate('Controls')}>
            <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, pt: 3, pb: 14 }}>
                {showGamepad && (
                    <Card id='gamepad' title={globalize.translate('LabelEnableGamepad')} icon={<SportsEsportsIcon />} accentColor='#4caf50' open={expanded.gamepad} onToggle={toggle}>
                        <Check label={globalize.translate('LabelEnableGamepad')} desc={globalize.translate('EnableGamepadHelp')}
                            checked={gamepad} onChange={setGamepad} color='#4caf50' />
                        <Typography sx={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)', pl: 4 }}>{globalize.translate('LabelPleaseRestart')}</Typography>
                    </Card>
                )}

                {showSmoothScroll && (
                    <Card id='navigation' title={globalize.translate('Controls')} icon={<SwipeVerticalIcon />} accentColor='#ff9800' open={expanded.navigation} onToggle={toggle}>
                        <Check label={globalize.translate('EnableSmoothScroll')} checked={smoothScroll} onChange={setSmoothScroll} color='#ff9800' />
                    </Card>
                )}

                {!showGamepad && !showSmoothScroll && (
                    <Typography sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', py: 6 }}>
                        {globalize.translate('MessageNoItemsAvailable')}
                    </Typography>
                )}

                {(showGamepad || showSmoothScroll) && <SaveButton saving={false} onClick={handleSave} />}
            </Box>

            <SavedSnackbar open={saved} onClose={() => setSaved(false)} />
        </Page>
    );
};

export default ControlsPreferencesPage;
