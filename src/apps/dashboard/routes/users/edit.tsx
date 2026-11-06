import React, { useCallback } from 'react';
import { useUser } from 'hooks/api/useUser';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Paper from '@mui/material/Paper';
import globalize from 'lib/globalize';
import Stack from '@mui/material/Stack';
import { UserTab } from 'apps/dashboard/features/users/constants/userTab';
import Profile from 'apps/dashboard/features/users/components/Profile';
import Access from 'apps/dashboard/features/users/components/Access';
import ParentalControl from 'apps/dashboard/features/users/components/ParentalControl';
import Password from 'apps/dashboard/features/users/components/Password';
import AccountProfiles from 'apps/dashboard/features/users/components/AccountProfiles';
import { formatRelative, UserAvatar, UserChips } from 'apps/dashboard/features/users/components/UserViews';
import Alert from '@mui/material/Alert';
import { useIsProfileUser } from 'components/profiles/useProfiles';

export const Component = () => {
    const navigate = useNavigate();
    const { userId, tab } = useParams();
    const { data: user, isPending, isError } = useUser({ userId });
    const isProfileUser = useIsProfileUser(userId);

    const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: UserTab) => {
        navigate(`/dashboard/users/${userId}/${newValue}`);
    }, [ navigate, userId ]);

    if (isPending) return <Loading />;

    return (
        <Page
            id='usersEditPage'
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary' sx={{ pb: 6 }}>
                {isError ? (
                    <Alert
                        severity='error'
                        sx={{ marginBottom: 2 }}
                    >
                        {globalize.translate('UsersEditPageError')}
                    </Alert>
                ) : (
                    <Stack spacing={2.5}>
                        {/* Header: avatar, name, role and activity */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mt: 1 }}>
                            <UserAvatar user={user} size={76} />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography component='h1' noWrap sx={{
                                    fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.2,
                                    background: 'linear-gradient(135deg, #fff 20%, #00a4dc 60%, #aa5cc3 100%)',
                                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                                }}>
                                    {user.Name}
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mt: 0.75 }}>
                                    <UserChips user={user} />
                                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                                        {globalize.translate('UsersSortActivity')}: {formatRelative(user.LastActivityDate)}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        <Paper elevation={0} sx={{ px: 1, borderRadius: '16px' }}>
                            <Tabs value={tab} onChange={handleTabChange} variant='scrollable' allowScrollButtonsMobile>
                                <Tab label={globalize.translate('Profile')} value={UserTab.Profile} />
                                <Tab label={globalize.translate('ProfilesTitle')} value={UserTab.Profiles} />
                                <Tab label={globalize.translate('TabAccess')} value={UserTab.Access} />
                                <Tab label={globalize.translate('TabParentalControl')} value={UserTab.ParentalControl} />
                                {isProfileUser === false && (
                                    <Tab label={globalize.translate('HeaderPassword')} value={UserTab.Password} />
                                )}
                            </Tabs>
                        </Paper>

                        {tab == UserTab.Profile && (
                            <Profile userDto={user} isProfileUser={isProfileUser === true} />
                        )}
                        {tab == UserTab.Profiles && (
                            <AccountProfiles userId={user.Id || ''} />
                        )}
                        {tab == UserTab.Access && (
                            <Access userId={user.Id || ''} />
                        )}
                        {tab == UserTab.ParentalControl && (
                            <ParentalControl userId={user.Id || ''} />
                        )}
                        {tab == UserTab.Password && isProfileUser === false && (
                            <Password user={user} />
                        )}
                        {tab == UserTab.Password && isProfileUser && (
                            <Alert severity='info'>{globalize.translate('ProfilesPasswordManagedByMaster')}</Alert>
                        )}
                    </Stack>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'UsersEditPage';
