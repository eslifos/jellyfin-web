import Warning from '@mui/icons-material/Warning';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu, { type MenuProps } from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import React, { FC, useEffect, useState } from 'react';

import globalize from 'lib/globalize';
import { playbackManager } from 'components/playback/playbackmanager';
import { pluginManager } from 'components/pluginManager';
import type { PlayTarget } from 'types/playTarget';

import PlayTargetIcon from '../../PlayTargetIcon';

interface RemotePlayMenuProps extends MenuProps {
    onMenuClose: () => void
}

export const ID = 'app-remote-play-menu';

const RemotePlayMenu: FC<RemotePlayMenuProps> = ({
    anchorEl,
    open,
    onMenuClose
}) => {
    // TODO: Add other checks for support (Android app, secure context, etc)
    const isChromecastPluginLoaded = !!pluginManager.plugins.find(plugin => plugin.id === 'chromecast');

    const [ playbackTargets, setPlaybackTargets ] = useState<PlayTarget[]>([]);

    const onPlayTargetClick = (target: PlayTarget) => {
        playbackManager.trySetActivePlayer(target.playerName, target);
        onMenuClose();
    };

    useEffect(() => {
        const fetchPlaybackTargets = async () => {
            setPlaybackTargets(
                await playbackManager.getTargets()
            );
        };

        if (open) {
            fetchPlaybackTargets()
                .catch(err => {
                    console.error('[AppRemotePlayMenu] unable to get playback targets', err);
                });
        }
    }, [ open, setPlaybackTargets ]);

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
            content: '""',
            position: 'absolute',
            top: 0, left: '1.5rem', right: '1.5rem',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #00a4dc 40%, #aa5cc3 60%, transparent)',
            borderRadius: '0 0 4px 4px', zIndex: 1
        },
        '& .MuiMenuItem-root': {
            borderRadius: '10px', mx: 0.8, mb: 0.3, px: 1.5,
            color: 'rgba(255,255,255,0.75)', transition: 'all 0.15s',
            '&:hover': { background: 'rgba(0,164,220,0.12)', color: '#00a4dc',
                '& .MuiListItemIcon-root': { color: '#00a4dc' } },
            '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.45)', minWidth: 36, transition: 'color 0.15s' },
            '& .MuiListItemText-primary': { fontSize: '0.9rem', fontWeight: 500 },
            '& .MuiListItemText-secondary': { fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }
        },
        '& .MuiDivider-root': { borderColor: 'rgba(0,164,220,0.12)', mx: 1, my: 0.5 }
    };

    return (
        <Menu
            anchorEl={anchorEl}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            id={ID}
            keepMounted
            open={open}
            onClose={onMenuClose}
            PaperProps={{ sx: glassPaperSx }}
        >
            {!isChromecastPluginLoaded && (
                <MenuItem disabled>
                    <ListItemIcon>
                        <Warning />
                    </ListItemIcon>
                    <ListItemText>
                        {globalize.translate('GoogleCastUnsupported')}
                    </ListItemText>
                </MenuItem>
            )}

            {!isChromecastPluginLoaded && playbackTargets.length > 0 && (
                <Divider />
            )}

            {playbackTargets.map(target => (
                <MenuItem
                    key={target.id}
                    // Since we are looping over targets there is no good way to avoid creating a new function here
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={() => onPlayTargetClick(target)}
                >
                    <ListItemIcon>
                        <PlayTargetIcon target={target} />
                    </ListItemIcon>
                    <ListItemText
                        primary={ target.appName ? `${target.name} - ${target.appName}` : target.name }
                        secondary={ target.user?.Name }
                    />
                </MenuItem>
            ))}

            {isChromecastPluginLoaded && playbackTargets.length === 0 && (
                <MenuItem disabled>
                    <ListItemText>
                        {globalize.translate('NoCastTargets')}
                    </ListItemText>
                </MenuItem>
            )}
        </Menu>
    );
};

export default RemotePlayMenu;
