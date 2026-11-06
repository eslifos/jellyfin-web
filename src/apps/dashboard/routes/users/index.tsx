import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BlockIcon from '@mui/icons-material/Block';
import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SearchIcon from '@mui/icons-material/Search';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Toast from 'apps/dashboard/components/Toast';
import { useDeleteUser } from 'apps/dashboard/features/users/api/useDeleteUser';
import {
    isOnline,
    type UserSort,
    UserCardsView,
    UserProfilesView,
    UserTableView
} from 'apps/dashboard/features/users/components/UserViews';
import ConfirmDialog from 'components/ConfirmDialog';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useUsers } from 'hooks/useUsers';
import { deleteProfile, fetchProfileLinks } from 'utils/profiles';
import globalize from 'lib/globalize';

import { PageHeader } from '../../components/cosmic';

type ViewMode = 'cards' | 'table' | 'profiles';
type Filter = 'all' | 'admins' | 'disabled' | 'hidden' | 'accounts' | 'profiles';

const VIEW_KEY = 'dashboardUsersView';
const DAY_MS = 24 * 60 * 60 * 1000;

const readView = (): ViewMode => {
    try {
        const value = localStorage.getItem(VIEW_KEY);
        return value === 'table' || value === 'profiles' ? value : 'cards';
    } catch {
        return 'cards';
    }
};

const time = (date?: string | null) => (date ? Date.parse(date) : 0);

const StatTile: FC<{ icon: React.ReactNode; label: string; value: number; color: string; active?: boolean; onClick?: () => void }> = ({ icon, label, value, color, active, onClick }) => (
    <Paper elevation={0} onClick={onClick} sx={{
        position: 'relative', overflow: 'hidden', p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5,
        cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        borderColor: active ? `${color}99 !important` : undefined,
        boxShadow: active ? `0 0 22px ${color}33` : 'none',
        '&:hover': onClick ? { transform: 'translateY(-2px)', borderColor: `${color}66 !important` } : {}
    }}>
        <Box sx={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <Box sx={{
            width: 42, height: 42, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: `${color}1f`, border: `1px solid ${color}44`, '& svg': { color, fontSize: '1.35rem' }
        }}>
            {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '1.45rem', fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{value}</Typography>
            <Typography noWrap sx={{ fontSize: '0.7rem', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>{label}</Typography>
        </Box>
    </Paper>
);

const toggleSx = {
    '& .MuiToggleButton-root': {
        border: '1px solid rgba(0,164,220,0.2)', color: 'rgba(255,255,255,0.55)', px: 1.5, gap: 0.75, textTransform: 'none', fontSize: '0.82rem',
        '&.Mui-selected': { color: '#00a4dc', background: 'rgba(0,164,220,0.16)', borderColor: 'rgba(0,164,220,0.45)' },
        '&:hover': { background: 'rgba(0,164,220,0.1)' }
    },
    '& .MuiToggleButtonGroup-grouped:first-of-type': { borderRadius: '12px 0 0 12px' },
    '& .MuiToggleButtonGroup-grouped:last-of-type': { borderRadius: '0 12px 12px 0' }
};

const UserProfiles = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { data: users, isPending } = useUsers(undefined, { forceRefresh: true });
    const deleteUser = useDeleteUser();

    const [ isSettingsSavedToastOpen, setIsSettingsSavedToastOpen ] = useState(false);
    const [ view, setView ] = useState<ViewMode>(readView);
    const [ search, setSearch ] = useState('');
    const [ filter, setFilter ] = useState<Filter>('all');
    const [ sort, setSort ] = useState<UserSort>('name');
    const [ userToDelete, setUserToDelete ] = useState<UserDto | null>(null);
    const [ profileMasters, setProfileMasters ] = useState<Record<string, string>>({});

    // Profile user id -> master id (viewing profiles, see utils/profiles)
    useEffect(() => {
        fetchProfileLinks()
            .then(links => setProfileMasters(Object.fromEntries(links.map(l => [ l.ProfileId, l.MasterId ]))))
            .catch(err => console.warn('[users] could not load profile links', err));
    }, [ users ]);

    const profileOf = useMemo(() => {
        const names = Object.fromEntries((users ?? []).map(u => [ u.Id ?? '', u.Name ?? '' ]));
        return Object.fromEntries(Object.entries(profileMasters).map(([ profileId, masterId ]) => [ profileId, names[masterId] ?? '' ]));
    }, [ users, profileMasters ]);

    useEffect(() => {
        if (location.state?.openSavedToast) {
            setIsSettingsSavedToastOpen(true);
            window.history.replaceState({}, '');
        }
    }, [ location.state?.openSavedToast ]);

    const onViewChange = useCallback((_: unknown, value: ViewMode | null) => {
        if (!value) return;
        setView(value);
        try {
            localStorage.setItem(VIEW_KEY, value);
        } catch {
            // ignore storage errors
        }
    }, []);

    const stats = useMemo(() => {
        const list = users ?? [];
        return {
            total: list.length,
            admins: list.filter(u => u.Policy?.IsAdministrator).length,
            disabled: list.filter(u => u.Policy?.IsDisabled).length,
            today: list.filter(u => Date.now() - time(u.LastActivityDate) < DAY_MS).length,
            online: list.filter(isOnline).length
        };
    }, [ users ]);

    const visibleUsers = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return (users ?? [])
            .filter(u => !query || (u.Name ?? '').toLocaleLowerCase().includes(query))
            .filter(u => {
                switch (filter) {
                    case 'admins': return Boolean(u.Policy?.IsAdministrator);
                    case 'disabled': return Boolean(u.Policy?.IsDisabled);
                    case 'hidden': return Boolean(u.Policy?.IsHidden);
                    case 'accounts': return !profileMasters[u.Id ?? ''];
                    case 'profiles': return Boolean(profileMasters[u.Id ?? '']);
                    default: return true;
                }
            })
            .sort((a, b) => {
                if (sort === 'activity') return time(b.LastActivityDate) - time(a.LastActivityDate);
                if (sort === 'login') return time(b.LastLoginDate) - time(a.LastLoginDate);
                return (a.Name ?? '').localeCompare(b.Name ?? '');
            });
    }, [ users, search, filter, sort, profileMasters ]);

    const onConfirmDelete = useCallback(async () => {
        const id = userToDelete?.Id;
        setUserToDelete(null);
        if (!id) return;

        // Deleting a master account also deletes its viewing profiles
        const linkedProfiles = Object.entries(profileMasters).filter(([ , masterId ]) => masterId === id).map(([ profileId ]) => profileId);
        for (const profileId of linkedProfiles) {
            try {
                await deleteProfile(profileId);
            } catch (err) {
                console.error('[users] failed to delete profile', profileId, err);
            }
        }

        deleteUser.mutate({ userId: id });
    }, [ deleteUser, userToDelete, profileMasters ]);

    const deleteText = useMemo(() => {
        const count = userToDelete?.Id ? Object.values(profileMasters).filter(m => m === userToDelete.Id).length : 0;
        return globalize.translate('DeleteUserConfirmation') + (count ? `\n\n${globalize.translate('ProfilesDeleteMasterWarning', count)}` : '');
    }, [ userToDelete, profileMasters ]);

    const toggleFilter = (value: Filter) => () => setFilter(current => (current === value ? 'all' : value));

    if (isPending) {
        return <Loading />;
    }

    return (
        <Page
            id='userProfilesPage'
            className='mainAnimatedPage type-interior userProfilesPage fullWidthContent'
            title={globalize.translate('HeaderUsers')}
        >
            <Toast
                open={isSettingsSavedToastOpen}
                onClose={() => setIsSettingsSavedToastOpen(false)}
                message={globalize.translate('SettingsSaved')}
            />
            <ConfirmDialog
                open={Boolean(userToDelete)}
                title={userToDelete?.Name ? globalize.translate('DeleteName', userToDelete.Name) : globalize.translate('DeleteUser')}
                text={deleteText}
                confirmButtonText={globalize.translate('Delete')}
                confirmButtonColor='error'
                onConfirm={() => void onConfirmDelete()}
                onCancel={() => setUserToDelete(null)}
            />

            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('HeaderUsers')}
                    subtitle={globalize.translate('UsersCount', stats.total)}
                    actions={(
                        <Button variant='contained' startIcon={<PersonAddIcon />} onClick={() => navigate('/dashboard/users/add')}
                            sx={{ fontWeight: 600, px: 3, py: 1.1 }}>
                            {globalize.translate('ButtonAddUser')}
                        </Button>
                    )}
                />

                {/* ── Resumen ── */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2.5 }}>
                    <StatTile icon={<GroupIcon />} label={globalize.translate('UsersTotal')} value={stats.total} color='#00a4dc'
                        active={filter === 'all'} onClick={() => setFilter('all')} />
                    <StatTile icon={<AdminPanelSettingsIcon />} label={globalize.translate('UsersFilterAdmins')} value={stats.admins} color='#aa5cc3'
                        active={filter === 'admins'} onClick={toggleFilter('admins')} />
                    <StatTile icon={<WifiTetheringIcon />} label={globalize.translate('UsersActiveToday')} value={stats.today} color='#4caf50' />
                    <StatTile icon={<BlockIcon />} label={globalize.translate('UsersFilterDisabled')} value={stats.disabled} color='#ef5350'
                        active={filter === 'disabled'} onClick={toggleFilter('disabled')} />
                </Box>

                {/* ── Barra de herramientas ── */}
                <Paper elevation={0} sx={{ p: 1.5, mb: 2.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                    <TextField
                        size='small'
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={globalize.translate('UsersSearchPlaceholder')}
                        sx={{ flex: '1 1 260px', minWidth: 200 }}
                        slotProps={{
                            input: {
                                startAdornment: <InputAdornment position='start'><SearchIcon sx={{ color: '#00a4dc' }} /></InputAdornment>,
                                endAdornment: search ? (
                                    <InputAdornment position='end'>
                                        <CloseIcon onClick={() => setSearch('')} sx={{ cursor: 'pointer', fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)' }} />
                                    </InputAdornment>
                                ) : undefined
                            }
                        }}
                    />

                    <TextField select size='small' value={filter} onChange={e => setFilter(e.target.value as Filter)} sx={{ minWidth: 170 }}
                        label={globalize.translate('Filters')}>
                        <MenuItem value='all'>{globalize.translate('UsersFilterAll')}</MenuItem>
                        <MenuItem value='admins'>{globalize.translate('UsersFilterAdmins')}</MenuItem>
                        <MenuItem value='disabled'>{globalize.translate('UsersFilterDisabled')}</MenuItem>
                        <MenuItem value='hidden'>{globalize.translate('UsersFilterHidden')}</MenuItem>
                        <MenuItem value='accounts'>{globalize.translate('ProfilesFilterAccounts')}</MenuItem>
                        <MenuItem value='profiles'>{globalize.translate('ProfilesFilterProfiles')}</MenuItem>
                    </TextField>

                    <TextField select size='small' value={sort} onChange={e => setSort(e.target.value as UserSort)} sx={{ minWidth: 200 }}
                        label={globalize.translate('LabelSortBy')}>
                        <MenuItem value='name'>{globalize.translate('LabelName')}</MenuItem>
                        <MenuItem value='activity'>{globalize.translate('UsersSortActivity')}</MenuItem>
                        <MenuItem value='login'>{globalize.translate('UsersSortLogin')}</MenuItem>
                    </TextField>

                    <ToggleButtonGroup exclusive size='small' value={view} onChange={onViewChange} sx={{ ...toggleSx, ml: { md: 'auto' } }}>
                        <ToggleButton value='cards'>
                            <Tooltip title={globalize.translate('UsersViewCards')}><ViewModuleIcon fontSize='small' /></Tooltip>
                            <Box component='span' sx={{ display: { xs: 'none', lg: 'inline' } }}>{globalize.translate('UsersViewCards')}</Box>
                        </ToggleButton>
                        <ToggleButton value='table'>
                            <Tooltip title={globalize.translate('UsersViewTable')}><TableRowsIcon fontSize='small' /></Tooltip>
                            <Box component='span' sx={{ display: { xs: 'none', lg: 'inline' } }}>{globalize.translate('UsersViewTable')}</Box>
                        </ToggleButton>
                        <ToggleButton value='profiles'>
                            <Tooltip title={globalize.translate('UsersViewProfiles')}><AccountCircleIcon fontSize='small' /></Tooltip>
                            <Box component='span' sx={{ display: { xs: 'none', lg: 'inline' } }}>{globalize.translate('UsersViewProfiles')}</Box>
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Paper>

                {(search || filter !== 'all') && (
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', mb: 1.5, px: 0.5 }}>
                        {globalize.translate('UsersShowing', visibleUsers.length, stats.total)}
                    </Typography>
                )}

                {visibleUsers.length === 0 ? (
                    <Paper elevation={0} sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                        <PersonSearchIcon sx={{ fontSize: '3rem', color: 'rgba(0,164,220,0.5)' }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.55)' }}>{globalize.translate('UsersNoResults')}</Typography>
                        <Button variant='outlined' onClick={() => { setSearch(''); setFilter('all'); }}>{globalize.translate('UsersClearFilters')}</Button>
                    </Paper>
                ) : (
                    <>
                        {view === 'cards' && <UserCardsView users={visibleUsers} onDelete={setUserToDelete} profileOf={profileOf} />}
                        {view === 'table' && <UserTableView users={visibleUsers} onDelete={setUserToDelete} sort={sort} onSort={setSort} profileOf={profileOf} />}
                        {view === 'profiles' && <UserProfilesView users={visibleUsers} onDelete={setUserToDelete} profileOf={profileOf} />}
                    </>
                )}
            </Box>
        </Page>
    );
};

export default UserProfiles;
