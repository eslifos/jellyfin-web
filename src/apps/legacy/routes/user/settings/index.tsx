import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import React, { useEffect, useMemo, useState, type FC } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import TvIcon from '@mui/icons-material/Tv';
import HomeIcon from '@mui/icons-material/Home';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import ClosedCaptionIcon from '@mui/icons-material/ClosedCaption';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PhonelinkLockIcon from '@mui/icons-material/PhonelinkLock';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditIcon from '@mui/icons-material/Edit';
import StorageIcon from '@mui/icons-material/Storage';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import DevicesOtherIcon from '@mui/icons-material/DevicesOther';
import CloseIcon from '@mui/icons-material/Close';

import { appHost } from 'components/apphost';
import { getAvatarGradient, getInitial } from 'components/profiles/avatarColors';
import layoutManager from 'components/layoutManager';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { AppFeature } from 'constants/appFeature';
import { useApi } from 'hooks/useApi';
import { useQuickConnectEnabled } from 'hooks/useQuickConnect';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';
import browser from 'scripts/browser';
import Dashboard from 'utils/dashboard';
import shell from 'scripts/shell';
import keyboardNavigation from 'scripts/keyboardNavigation';

interface SettingsItemProps {
    icon: React.ReactNode;
    label: string;
    color?: string;
    onClick?: () => void;
    href?: string;
    danger?: boolean;
}

const SettingsItem: FC<SettingsItemProps> = ({ icon, label, color = '#00a4dc', onClick, href, danger }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if (onClick) { onClick(); return; }
        if (href) navigate(href.replace('#/', '/'));
    };

    return (
        <ListItemButton
            onClick={handleClick}
            sx={{
                borderRadius: '12px',
                mb: 0.5,
                px: 1.5,
                py: 1.2,
                transition: 'all 0.18s',
                '&:hover': {
                    background: danger
                        ? 'rgba(239,83,80,0.1)'
                        : 'rgba(0,164,220,0.1)',
                    '& .item-icon-box': { transform: 'scale(1.05)' }
                }
            }}
        >
            <ListItemIcon sx={{ minWidth: 48 }}>
                <Box
                    className='item-icon-box'
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: danger
                            ? 'rgba(239,83,80,0.18)'
                            : `rgba(${color === '#00a4dc' ? '0,164,220' : color === '#aa5cc3' ? '170,92,195' : '0,119,182'},0.18)`,
                        border: `1px solid ${danger ? 'rgba(239,83,80,0.3)' : `${color}33`}`,
                        transition: 'transform 0.18s',
                        '& svg': { fontSize: '1.1rem', color: danger ? '#ef5350' : color }
                    }}
                >
                    {icon}
                </Box>
            </ListItemIcon>
            <ListItemText
                primary={label}
                primaryTypographyProps={{
                    fontSize: '0.93rem',
                    fontWeight: 500,
                    color: danger ? '#ef5350' : 'rgba(255,255,255,0.85)'
                }}
            />
            <ChevronRightIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '1.1rem' }} />
        </ListItemButton>
    );
};

interface SectionCardProps {
    title: string;
    accentColor?: string;
    children: React.ReactNode;
}

const SectionCard: FC<SectionCardProps> = ({ title, accentColor = '#00a4dc', children }) => (
    <Paper
        elevation={0}
        sx={{
            background: 'rgba(10,12,22,0.72)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid rgba(0,164,220,0.18)',
            borderRadius: '20px',
            mb: 2.5,
            overflow: 'hidden',
            position: 'relative',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '1.5rem',
                right: '1.5rem',
                height: '2px',
                background: `linear-gradient(90deg, transparent, ${accentColor} 40%, ${accentColor === '#00a4dc' ? '#aa5cc3' : '#00a4dc'} 60%, transparent)`,
                borderRadius: '0 0 4px 4px'
            }
        }}
    >
        <Box sx={{ px: 2, pt: 2, pb: 0.5 }}>
            <Typography
                variant='overline'
                sx={{
                    fontSize: '0.7rem',
                    letterSpacing: '1.5px',
                    color: accentColor,
                    fontWeight: 700
                }}
            >
                {title}
            </Typography>
        </Box>
        <List sx={{ px: 1, pb: 1 }}>
            {children}
        </List>
    </Paper>
);

const UserSettingsPage: FC = () => {
    const { api, user: currentUser } = useApi();
    const [ searchParams ] = useSearchParams();
    const { data: isQuickConnectEnabled, isPending: isQuickConnectEnabledPending } = useQuickConnectEnabled();
    const { data: users } = useUsers();
    const [ user, setUser ] = useState<UserDto>();

    const userId = useMemo(() => (
        searchParams.get('userId') || currentUser?.Id
    ), [ currentUser, searchParams ]);
    const isLoggedInUser = useMemo(() => (
        userId && userId === currentUser?.Id
    ), [ currentUser, userId ]);

    useEffect(() => {
        if (userId) {
            if (userId === currentUser?.Id) setUser(currentUser);
            else setUser(users?.find(({ Id }) => userId === Id));
        }
    }, [ currentUser, userId, users ]);

    if (!userId || !user || isQuickConnectEnabledPending) return <Loading />;

    const isControlsPageEmpty = !keyboardNavigation.canEnableGamepad() && !layoutManager.tv;
    const avatarUrl = api && user.Id && user.PrimaryImageTag ?
        `${api.basePath}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}` :
        undefined;

    return (
        <Page
            id='myPreferencesMenuPage'
            className='libraryPage userPreferencesPage noSecondaryNavPage mainAnimatedPage'
            title={globalize.translate('Settings')}
            shouldAutoFocus
        >
            <Box sx={{ maxWidth: 560, mx: 'auto', px: 2, pt: 3, pb: 12 }}>

                {/* Avatar + nombre del usuario */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3.5 }}>
                    <Avatar
                        src={avatarUrl}
                        alt={user.Name ?? undefined}
                        sx={{
                            width: 56, height: 56,
                            border: '2px solid rgba(0,164,220,0.4)',
                            boxShadow: '0 0 16px rgba(0,164,220,0.25)',
                            background: avatarUrl ? 'rgba(0,164,220,0.2)' : getAvatarGradient(user.Name),
                            color: '#fff', fontWeight: 700, fontSize: '1.5rem'
                        }}
                    >
                        {getInitial(user.Name)}
                    </Avatar>
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                            {user.Name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                            {user.Policy?.IsAdministrator ? globalize.translate('Administrator') : globalize.translate('User')}
                        </Typography>
                    </Box>
                </Box>

                {/* Sección preferencias de usuario */}
                <SectionCard title={globalize.translate('SectionPreferences')}>
                    <SettingsItem icon={<AccountCircleIcon />} label={globalize.translate('Profile')} href={`#/userprofile?userId=${userId}`} />
                    {isQuickConnectEnabled && (
                        <SettingsItem icon={<PhonelinkLockIcon />} label={globalize.translate('QuickConnect')} href={`#/quickconnect?userId=${userId}`} color='#aa5cc3' />
                    )}
                    <SettingsItem icon={<TvIcon />} label={globalize.translate('Display')} href={`#/mypreferencesdisplay?userId=${userId}`} />
                    <SettingsItem icon={<HomeIcon />} label={globalize.translate('Home')} href={`#/mypreferenceshome?userId=${userId}`} />
                    <SettingsItem icon={<PlayCircleFilledIcon />} label={globalize.translate('TitlePlayback')} href={`#/mypreferencesplayback?userId=${userId}`} />
                    <SettingsItem icon={<ClosedCaptionIcon />} label={globalize.translate('Subtitles')} href={`#/mypreferencessubtitles?userId=${userId}`} />
                    {appHost.supports(AppFeature.DownloadManagement) && (
                        <SettingsItem icon={<DownloadIcon />} label={globalize.translate('DownloadManager')} onClick={shell.openDownloadManager} />
                    )}
                    {appHost.supports(AppFeature.ClientSettings) && (
                        <SettingsItem icon={<DevicesOtherIcon />} label={globalize.translate('ClientSettings')} onClick={shell.openClientSettings} />
                    )}
                    {isLoggedInUser && !browser.mobile && !isControlsPageEmpty && (
                        <SettingsItem icon={<KeyboardIcon />} label={globalize.translate('Controls')} href={`#/mypreferencescontrols?userId=${userId}`} />
                    )}
                </SectionCard>

                {/* Sección admin */}
                {isLoggedInUser && user.Policy?.IsAdministrator && !layoutManager.tv && (
                    <SectionCard title={globalize.translate('HeaderAdmin')} accentColor='#aa5cc3'>
                        <SettingsItem icon={<DashboardIcon />} label={globalize.translate('TabDashboard')} href='#/dashboard' color='#aa5cc3' />
                        <SettingsItem icon={<EditIcon />} label={globalize.translate('MetadataManager')} href='#/metadata' color='#aa5cc3' />
                    </SectionCard>
                )}

                {/* Sección sesión */}
                {isLoggedInUser && (
                    <SectionCard title={globalize.translate('SectionSession')} accentColor='#ef5350'>
                        {appHost.supports(AppFeature.MultiServer) && (
                            <SettingsItem icon={<StorageIcon />} label={globalize.translate('SelectServer')} onClick={Dashboard.selectServer} />
                        )}
                        <SettingsItem icon={<LogoutIcon />} label={globalize.translate('ButtonSignOut')} onClick={Dashboard.logout} danger />
                        {appHost.supports(AppFeature.ExitMenu) && (
                            <SettingsItem icon={<CloseIcon />} label={globalize.translate('ButtonExitApp')} onClick={appHost.exit} danger />
                        )}
                    </SectionCard>
                )}
            </Box>
        </Page>
    );
};

export default UserSettingsPage;