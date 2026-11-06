import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import ProfileSwitchDialog from 'components/profiles/ProfileSwitchDialog';
import UserAvatar from 'components/UserAvatar';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import AppUserMenu, { ID } from './AppUserMenu';

const UserMenuButton = () => {
    const { user } = useApi();

    const [ userMenuAnchorEl, setUserMenuAnchorEl ] = useState<null | HTMLElement>(null);
    const isUserMenuOpen = Boolean(userMenuAnchorEl);

    const onUserButtonClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setUserMenuAnchorEl(event.currentTarget);
    }, [ setUserMenuAnchorEl ]);

    const onUserMenuClose = useCallback(() => {
        setUserMenuAnchorEl(null);
    }, [ setUserMenuAnchorEl ]);

    const [ isProfilesOpen, setIsProfilesOpen ] = useState(false);
    const openProfiles = useCallback(() => setIsProfilesOpen(true), []);
    const closeProfiles = useCallback(() => setIsProfilesOpen(false), []);

    return (
        <>
            <Tooltip title={globalize.translate('UserMenu')}>
                <IconButton
                    size='large'
                    aria-label={globalize.translate('UserMenu')}
                    aria-controls={ID}
                    aria-haspopup='true'
                    onClick={onUserButtonClick}
                    color='inherit'
                    sx={{ padding: 0 }}
                >
                    <UserAvatar user={user} />
                </IconButton>
            </Tooltip>

            <AppUserMenu
                open={isUserMenuOpen}
                anchorEl={userMenuAnchorEl}
                onMenuClose={onUserMenuClose}
                onSwitchProfile={openProfiles}
            />

            {createPortal(
                <ProfileSwitchDialog open={isProfilesOpen} onClose={closeProfiles} />,
                document.body
            )}
        </>
    );
};

export default UserMenuButton;
