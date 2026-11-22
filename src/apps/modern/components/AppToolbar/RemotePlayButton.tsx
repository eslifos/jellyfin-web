import React, { useCallback, useEffect, useState } from 'react';
import CastConnected from '@mui/icons-material/CastConnected';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Cast from '@mui/icons-material/Cast';
import IconButton from '@mui/material/IconButton';
import type {} from '@mui/material/themeCssVarsAugmentation';
import Tooltip from '@mui/material/Tooltip';

import { playbackManager } from 'components/playback/playbackmanager';
import globalize from 'lib/globalize';
import Events from 'utils/events';

import RemotePlayMenu, { ID } from './menus/RemotePlayMenu';
import RemotePlayActiveMenu, { ID as ACTIVE_ID } from './menus/RemotePlayActiveMenu';

const RemotePlayButton = () => {
    const [ playerInfo, setPlayerInfo ] = useState(playbackManager.getPlayerInfo());

    const updatePlayerInfo = useCallback(() => {
        setPlayerInfo(playbackManager.getPlayerInfo());
    }, [ setPlayerInfo ]);

    useEffect(() => {
        Events.on(playbackManager, 'playerchange', updatePlayerInfo);

        return () => {
            Events.off(playbackManager, 'playerchange', updatePlayerInfo);
        };
    }, [ updatePlayerInfo ]);

    const [ remotePlayMenuAnchorEl, setRemotePlayMenuAnchorEl ] = useState<null | HTMLElement>(null);
    const isRemotePlayMenuOpen = Boolean(remotePlayMenuAnchorEl);

    const onRemotePlayButtonClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setRemotePlayMenuAnchorEl(event.currentTarget);
    }, [ setRemotePlayMenuAnchorEl ]);

    const onRemotePlayMenuClose = useCallback(() => {
        setRemotePlayMenuAnchorEl(null);
    }, [ setRemotePlayMenuAnchorEl ]);

    const [ remotePlayActiveMenuAnchorEl, setRemotePlayActiveMenuAnchorEl ] = useState<null | HTMLElement>(null);
    const isRemotePlayActiveMenuOpen = Boolean(remotePlayActiveMenuAnchorEl);

    const onRemotePlayActiveButtonClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setRemotePlayActiveMenuAnchorEl(event.currentTarget);
    }, [ setRemotePlayActiveMenuAnchorEl ]);

    const onRemotePlayActiveMenuClose = useCallback(() => {
        setRemotePlayActiveMenuAnchorEl(null);
    }, [ setRemotePlayActiveMenuAnchorEl ]);

    return (
        <>
            {(playerInfo && !playerInfo.isLocalPlayer) ? (
                <Box
                    sx={{
                        alignSelf: 'center'
                    }}
                >
                    <Tooltip title={globalize.translate('ButtonCast')}>
                        <Button
                            variant='text'
                            size='large'
                            startIcon={<CastConnected />}
                            aria-label={globalize.translate('ButtonCast')}
                            aria-controls={ACTIVE_ID}
                            aria-haspopup='true'
                            onClick={onRemotePlayActiveButtonClick}
                            color='inherit'
                            // eslint-disable-next-line react/jsx-no-bind
                            sx={(theme) => ({
                                color: theme.vars.palette.primary.main,
                                minWidth: 0,
                                // On a phone only the icon: the name would make the bar taller and cover the player
                                '& .MuiButton-startIcon': { [theme.breakpoints.down('sm')]: { margin: 0 } }
                            })}
                        >
                            {/* One line, cut with "…" when long */}
                            <Box
                                component='span'
                                sx={{
                                    display: { xs: 'none', sm: 'inline-block' },
                                    maxWidth: '9em',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {playerInfo.deviceName || playerInfo.name}
                            </Box>
                        </Button>
                    </Tooltip>
                </Box>
            ) : (
                <Tooltip title={globalize.translate('ButtonCast')}>
                    <IconButton
                        size='large'
                        aria-label={globalize.translate('ButtonCast')}
                        aria-controls={ID}
                        aria-haspopup='true'
                        onClick={onRemotePlayButtonClick}
                        color='inherit'
                    >
                        <Cast />
                    </IconButton>
                </Tooltip>
            )}

            <RemotePlayMenu
                open={isRemotePlayMenuOpen}
                anchorEl={remotePlayMenuAnchorEl}
                onMenuClose={onRemotePlayMenuClose}
            />

            <RemotePlayActiveMenu
                open={isRemotePlayActiveMenuOpen}
                anchorEl={remotePlayActiveMenuAnchorEl}
                onMenuClose={onRemotePlayActiveMenuClose}
                playerInfo={playerInfo}
            />
        </>
    );
};

export default RemotePlayButton;
