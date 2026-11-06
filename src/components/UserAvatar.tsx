import React, { type FC } from 'react';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import Avatar, { type AvatarProps } from '@mui/material/Avatar';
import type {} from '@mui/material/themeCssVarsAugmentation';

import { getAvatarGradient, getInitial } from 'components/profiles/avatarColors';
import { useApi } from 'hooks/useApi';

interface UserAvatarProps extends AvatarProps {
    user?: UserDto,
    size?: number
}

const UserAvatar: FC<UserAvatarProps> = ({
    user,
    size
}) => {
    const { api } = useApi();
    const imageUrl = api && user?.Id && user.PrimaryImageTag ?
        `${api.basePath}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}` :
        undefined;

    return user ? (
        <Avatar
            alt={user.Name ?? undefined}
            src={imageUrl}
            // eslint-disable-next-line react/jsx-no-bind
            sx={(theme) => ({
                // Without an image: initial on the same gradient as the profile picker
                background: imageUrl ? theme.vars.palette.background.paper : getAvatarGradient(user.Name),
                color: '#fff !important',
                fontWeight: 700,
                fontSize: size ? size * 0.45 : '1rem',
                width: size,
                height: size
            })}
        >
            {getInitial(user.Name)}
        </Avatar>
    ) : null;
};

export default UserAvatar;
