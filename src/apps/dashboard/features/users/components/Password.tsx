import React from 'react';
import UserPasswordForm from 'components/dashboard/users/UserPasswordForm';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import KeyIcon from '@mui/icons-material/Key';
import globalize from 'lib/globalize';
import UserEditCard from './UserEditCard';

interface PasswordProps {
    user: UserDto;
}

const Password = ({ user }: PasswordProps) => {
    return (
        <div className='userEditCards'>
            <div style={{ maxWidth: 720 }}>
                <UserEditCard title={globalize.translate('HeaderPassword')} icon={<KeyIcon />} accent='#ff9800'>
                    <UserPasswordForm
                        user={user}
                    />
                </UserEditCard>
            </div>
        </div>
    );
};

export default Password;
