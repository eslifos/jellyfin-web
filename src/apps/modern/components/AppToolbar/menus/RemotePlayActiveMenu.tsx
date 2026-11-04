import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import SettingsRemote from '@mui/icons-material/SettingsRemote';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu, { MenuProps } from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import dialog from 'components/dialog/dialog';
import { playbackManager } from 'components/playback/playbackmanager';
import React, { FC, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import { enable, isEnabled } from 'scripts/autocast';
import globalize from 'lib/globalize';

interface RemotePlayActiveMenuProps extends MenuProps {
    onMenuClose: () => void
    playerInfo: {
        name: string
        isLocalPlayer: boolean
        id?: string
        deviceName?: string
        playableMediaTypes?: string[]
        supportedCommands?: string[]
    } | null
}

export const ID = 'app-remote-play-active-menu';

const RemotePlayActiveMenu: FC<RemotePlayActiveMenuProps> = ({
    anchorEl,
    open,
    onMenuClose,
    playerInfo
}) => {
    const [ isDisplayMirrorEnabled, setIsDisplayMirrorEnabled ] = useState(playbackManager.enableDisplayMirroring());
    const isDisplayMirrorSupported = playerInfo?.supportedCommands && playerInfo.supportedCommands.indexOf('DisplayContent') !== -1;
    const toggleDisplayMirror = useCallback(() => {
        playbackManager.enableDisplayMirroring(!isDisplayMirrorEnabled);
        setIsDisplayMirrorEnabled(!isDisplayMirrorEnabled);
    }, [ isDisplayMirrorEnabled, setIsDisplayMirrorEnabled ]);

    const [ isAutoCastEnabled, setIsAutoCastEnabled ] = useState(isEnabled());
    const toggleAutoCast = useCallback(() => {
        enable(!isAutoCastEnabled);
        setIsAutoCastEnabled(!isAutoCastEnabled);
    }, [ isAutoCastEnabled ]);

    const remotePlayerName = playerInfo?.deviceName || playerInfo?.name;

    const disconnectRemotePlayer = useCallback(() => {
        if (playbackManager.getSupportedCommands().indexOf('EndSession') !== -1) {
            dialog.show({
                buttons: [
                    {
                        name: globalize.translate('Yes'),
                        id: 'yes'
                    }, {
                        name: globalize.translate('No'),
                        id: 'no'
                    }
                ],
                text: globalize.translate('ConfirmEndPlayerSession', remotePlayerName)
            }).then(id => {
                onMenuClose();

                if (id === 'yes') {
                    playbackManager.getCurrentPlayer().endSession();
                }
                playbackManager.setDefaultPlayerActive();
            }).catch(() => {
            // Dialog closed
            });
        } else {
            onMenuClose();
            playbackManager.setDefaultPlayerActive();
        }
    }, [ onMenuClose, remotePlayerName ]);

    const glassPaperSx = {
        background: 'rgba(8, 10, 22, 0.90)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        border: '1px solid rgba(0, 164, 220, 0.2)',
        borderRadius: '16px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
        minWidth: 220,
        overflow: 'hidden',
        '&::before': {
            content: '""', position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem',
            height: '2px', background: 'linear-gradient(90deg, transparent, #00a4dc 40%, #aa5cc3 60%, transparent)',
            borderRadius: '0 0 4px 4px', zIndex: 1
        },
        '& .MuiMenuItem-root': {
            borderRadius: '10px', mx: 0.8, mb: 0.3, px: 1.5,
            color: 'rgba(255,255,255,0.75)', transition: 'all 0.15s',
            '&:hover': { background: 'rgba(0,164,220,0.12)', color: '#00a4dc',
                '& .MuiListItemIcon-root': { color: '#00a4dc' } },
            '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.45)', minWidth: 36 },
            '& .MuiListItemText-primary': { fontSize: '0.9rem', fontWeight: 500 }
        },
        '& .MuiListSubheader-root': { background: 'transparent', color: '#00a4dc', fontSize: '0.72rem', letterSpacing: '0.8px', textTransform: 'uppercase', lineHeight: '2rem' },
        '& .MuiDivider-root': { borderColor: 'rgba(0,164,220,0.12)', mx: 1, my: 0.5 }
    };

    return (
        <Menu
            anchorEl={anchorEl}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right'
            }}
            id={ID}
            keepMounted
            open={open}
            onClose={onMenuClose}
            PaperProps={{ sx: glassPaperSx }}
            slotProps={{
                list: {
                    'aria-labelledby': 'remote-play-active-subheader',
                    subheader: (
                        <ListSubheader component='div' id='remote-play-active-subheader'>
                            {remotePlayerName}
                        </ListSubheader>
                    )
                }
            }}
        >
            {isDisplayMirrorSupported && (
                <MenuItem onClick={toggleDisplayMirror}>
                    {isDisplayMirrorEnabled && (
                        <ListItemIcon>
                            <Check />
                        </ListItemIcon>
                    )}
                    <ListItemText inset={!isDisplayMirrorEnabled}>
                        {globalize.translate('EnableDisplayMirroring')}
                    </ListItemText>
                </MenuItem>
            )}

            <MenuItem onClick={toggleAutoCast}>
                {isAutoCastEnabled && (
                    <ListItemIcon>
                        <Check />
                    </ListItemIcon>
                )}
                <ListItemText inset={!isAutoCastEnabled}>
                    {globalize.translate('EnableAutoCast')}
                </ListItemText>
            </MenuItem>

            <Divider />

            <MenuItem
                component={Link}
                to='/queue'
                onClick={onMenuClose}
            >
                <ListItemIcon>
                    <SettingsRemote />
                </ListItemIcon>
                <ListItemText>
                    {globalize.translate('HeaderRemoteControl')}
                </ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={disconnectRemotePlayer}>
                <ListItemIcon>
                    <Close />
                </ListItemIcon>
                <ListItemText>
                    {globalize.translate('Disconnect')}
                </ListItemText>
            </MenuItem>
        </Menu>
    );
};

export default RemotePlayActiveMenu;
