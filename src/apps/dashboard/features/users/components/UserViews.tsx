/**
 * Cosmic Dark views for the dashboard users list: cards, table and profiles,
 * plus the shared avatar, status chips and actions menu.
 */
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PublicIcon from '@mui/icons-material/Public';
import PublicOffIcon from '@mui/icons-material/PublicOff';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { formatDistanceToNow } from 'date-fns';
import React, { type FC, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';

import { UserTab } from '../constants/userTab';

export type UserSort = 'name' | 'activity' | 'login';

const COLORS = {
    admin: '#aa5cc3',
    user: '#00a4dc',
    disabled: '#ef5350',
    hidden: '#90a4ae',
    online: '#4caf50'
};

const AVATAR_GRADIENTS = [
    [ '#00a4dc', '#0077b6' ], [ '#aa5cc3', '#7b3f92' ], [ '#4caf50', '#2e7d32' ], [ '#ff9800', '#e65100' ],
    [ '#e91e63', '#ad1457' ], [ '#26c6da', '#00838f' ], [ '#ffca28', '#ff8f00' ], [ '#7e57c2', '#4527a0' ]
];

const hash = (text: string) => [ ...text ].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const getAccentFor = (user: UserDto) => {
    if (user.Policy?.IsDisabled) return COLORS.disabled;
    return user.Policy?.IsAdministrator ? COLORS.admin : COLORS.user;
};

export const formatRelative = (date?: string | null) => (
    date ? formatDistanceToNow(Date.parse(date), getLocaleWithSuffix()) : globalize.translate('UsersNever')
);

/** Active in the last 10 minutes. */
export const isOnline = (user: UserDto) => (
    Boolean(user.LastActivityDate) && Date.now() - Date.parse(user.LastActivityDate as string) < 10 * 60 * 1000
);

export const UserAvatar: FC<{ user: UserDto; size: number; ring?: boolean }> = ({ user, size, ring = true }) => {
    const { api } = useApi();
    const url = api && user.Id && user.PrimaryImageTag ?
        `${api.basePath}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}&width=${size * 2}&quality=90` :
        undefined;
    const [ from, to ] = AVATAR_GRADIENTS[hash(user.Name ?? '') % AVATAR_GRADIENTS.length];
    const accent = getAccentFor(user);
    const initials = (user.Name ?? '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

    return (
        <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <Avatar
                src={url}
                alt={user.Name ?? ''}
                sx={{
                    width: size, height: size, fontSize: size * 0.38, fontWeight: 700, color: '#fff',
                    background: `linear-gradient(135deg, ${from}, ${to})`,
                    border: ring ? `2px solid ${accent}88` : 'none',
                    boxShadow: ring ? `0 0 ${Math.round(size / 4)}px ${accent}40` : 'none',
                    filter: user.Policy?.IsDisabled ? 'grayscale(1)' : 'none',
                    opacity: user.Policy?.IsDisabled ? 0.6 : 1
                }}
            >
                {initials}
            </Avatar>
            {isOnline(user) && (
                <Tooltip title={globalize.translate('UsersOnline')}>
                    <Box sx={{
                        position: 'absolute', right: size * 0.04, bottom: size * 0.04, width: Math.max(10, size * 0.18), height: Math.max(10, size * 0.18),
                        borderRadius: '50%', background: COLORS.online, border: '2px solid #0a0c18', boxShadow: `0 0 8px ${COLORS.online}`
                    }} />
                </Tooltip>
            )}
        </Box>
    );
};

const Chip: FC<{ color: string; icon?: React.ReactNode; label: string }> = ({ color, icon, label }) => (
    <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.25, borderRadius: '8px',
        fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap', color, background: `${color}1a`, border: `1px solid ${color}4d`,
        '& svg': { fontSize: '0.85rem' }
    }}>
        {icon}{label}
    </Box>
);

export const UserChips: FC<{ user: UserDto; compact?: boolean; profileOf?: string }> = ({ user, compact, profileOf }) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {user.Policy?.IsAdministrator ?
            <Chip color={COLORS.admin} icon={<AdminPanelSettingsIcon />} label={globalize.translate('UsersRoleAdmin')} /> :
            <Chip color={COLORS.user} label={globalize.translate('UsersRoleUser')} />}
        {profileOf && <Chip color='#ffca28' icon={<SupervisorAccountIcon />} label={globalize.translate('ProfilesProfileOf', profileOf)} />}
        {user.Policy?.IsDisabled && <Chip color={COLORS.disabled} icon={<BlockIcon />} label={globalize.translate('UsersStatusDisabled')} />}
        {!compact && !profileOf && user.Policy?.IsHidden && <Chip color={COLORS.hidden} icon={<VisibilityOffIcon />} label={globalize.translate('UsersStatusHidden')} />}
    </Box>
);

/** Small icons for remote access and password. */
const UserFlags: FC<{ user: UserDto }> = ({ user }) => (
    <Box sx={{ display: 'flex', gap: 0.75, color: 'rgba(255,255,255,0.45)', '& svg': { fontSize: '1rem' } }}>
        <Tooltip title={globalize.translate(user.Policy?.EnableRemoteAccess ? 'UsersRemoteAccess' : 'UsersLocalOnly')}>
            {user.Policy?.EnableRemoteAccess ? <PublicIcon /> : <PublicOffIcon />}
        </Tooltip>
        <Tooltip title={globalize.translate(user.HasPassword ? 'UsersHasPassword' : 'UsersNoPassword')}>
            {user.HasPassword ? <LockIcon /> : <LockOpenIcon sx={{ color: '#ffca28' }} />}
        </Tooltip>
    </Box>
);

interface ActionsProps {
    user: UserDto;
    onDelete: (user: UserDto) => void;
}

export const UserActionsMenu: FC<ActionsProps> = ({ user, onDelete }) => {
    const navigate = useNavigate();
    const [ anchor, setAnchor ] = useState<HTMLElement | null>(null);

    const open = useCallback((e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
        setAnchor(e.currentTarget);
    }, []);
    const close = useCallback(() => setAnchor(null), []);
    const go = (tab: string) => () => {
        setAnchor(null);
        navigate(`/dashboard/users/${user.Id}/${tab}`);
    };

    return (
        <>
            <IconButton size='small' onClick={open} aria-label={globalize.translate('ButtonMore')}
                sx={{ color: 'rgba(255,255,255,0.55)', '&:hover': { color: '#00a4dc', background: 'rgba(0,164,220,0.12)' } }}>
                <MoreVertIcon fontSize='small' />
            </IconButton>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close} onClick={e => e.stopPropagation()}>
                <MenuItem onClick={go(UserTab.Profile)}>
                    <ListItemIcon><EditIcon fontSize='small' /></ListItemIcon>
                    <ListItemText>{globalize.translate('ButtonEditUser')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={go(UserTab.Access)}>
                    <ListItemIcon><LockIcon fontSize='small' /></ListItemIcon>
                    <ListItemText>{globalize.translate('ButtonLibraryAccess')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={go(UserTab.ParentalControl)}>
                    <ListItemIcon><FamilyRestroomIcon fontSize='small' /></ListItemIcon>
                    <ListItemText>{globalize.translate('ButtonParentalControl')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { setAnchor(null); onDelete(user); }} sx={{ color: '#ef5350 !important' }}>
                    <ListItemIcon><DeleteIcon fontSize='small' sx={{ color: '#ef5350' }} /></ListItemIcon>
                    <ListItemText>{globalize.translate('Delete')}</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
};

interface ViewProps {
    users: UserDto[];
    /** Master account name by profile user id. */
    profileOf?: Record<string, string>;
    onDelete: (user: UserDto) => void;
}

const useOpenUser = () => {
    const navigate = useNavigate();
    return useCallback((user: UserDto) => navigate(`/dashboard/users/${user.Id}/${UserTab.Profile}`), [ navigate ]);
};

/** Glass cards with avatar, chips and activity. */
export const UserCardsView: FC<ViewProps> = ({ users, onDelete, profileOf }) => {
    const openUser = useOpenUser();

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 2 }}>
            {users.map(user => {
                const accent = getAccentFor(user);
                return (
                    <Paper key={user.Id} elevation={0} onClick={() => openUser(user)} sx={{
                        position: 'relative', overflow: 'hidden', cursor: 'pointer', p: 2, pt: 2.5,
                        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 14px 36px rgba(0,0,0,0.45), 0 0 22px ${accent}26`, borderColor: `${accent}66 !important` }
                    }}>
                        <Box sx={{
                            position: 'absolute', top: 0, left: '1.2rem', right: '1.2rem', height: '2px',
                            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`
                        }} />
                        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                            <UserActionsMenu user={user} onDelete={onDelete} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                            <UserAvatar user={user} size={64} />
                            <Box sx={{ minWidth: 0, pr: 3 }}>
                                <Typography noWrap sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>{user.Name}</Typography>
                                <Box sx={{ mt: 0.5 }}><UserChips user={user} profileOf={profileOf?.[user.Id ?? '']} /></Box>
                            </Box>
                        </Box>
                        <Box sx={{
                            mt: 2, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1
                        }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: '0.64rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                                    {globalize.translate('UsersSortActivity')}
                                </Typography>
                                <Typography noWrap sx={{ fontSize: '0.8rem', color: isOnline(user) ? '#4caf50' : 'rgba(255,255,255,0.7)' }}>
                                    {isOnline(user) ? globalize.translate('UsersOnline') : formatRelative(user.LastActivityDate)}
                                </Typography>
                            </Box>
                            <UserFlags user={user} />
                        </Box>
                    </Paper>
                );
            })}
        </Box>
    );
};

/** Sortable table. */
export const UserTableView: FC<ViewProps & { sort: UserSort; onSort: (sort: UserSort) => void }> = ({ users, onDelete, sort, onSort, profileOf }) => {
    const openUser = useOpenUser();
    const header = (key: UserSort | null, label: string) => (
        <TableCell>
            {key ? (
                <TableSortLabel active={sort === key} direction={key === 'name' ? 'asc' : 'desc'} onClick={() => onSort(key)}
                    sx={{ '&.Mui-active, &:hover': { color: '#00a4dc !important' }, '& .MuiTableSortLabel-icon': { color: '#00a4dc !important' } }}>
                    {label}
                </TableSortLabel>
            ) : label}
        </TableCell>
    );

    return (
        <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
            <Table size='medium'>
                <TableHead>
                    <TableRow>
                        {header('name', globalize.translate('LabelName'))}
                        {header(null, globalize.translate('UsersRole'))}
                        {header('activity', globalize.translate('UsersSortActivity'))}
                        {header('login', globalize.translate('UsersSortLogin'))}
                        {header(null, globalize.translate('UsersAccess'))}
                        <TableCell align='right' />
                    </TableRow>
                </TableHead>
                <TableBody>
                    {users.map(user => (
                        <TableRow key={user.Id} hover onClick={() => openUser(user)} sx={{ cursor: 'pointer' }}>
                            <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <UserAvatar user={user} size={38} />
                                    <Typography sx={{ fontWeight: 600, color: '#fff' }}>{user.Name}</Typography>
                                </Box>
                            </TableCell>
                            <TableCell><UserChips user={user} profileOf={profileOf?.[user.Id ?? '']} /></TableCell>
                            <TableCell sx={{ color: isOnline(user) ? '#4caf50' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                                {isOnline(user) ? globalize.translate('UsersOnline') : formatRelative(user.LastActivityDate)}
                            </TableCell>
                            <TableCell sx={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{formatRelative(user.LastLoginDate)}</TableCell>
                            <TableCell><UserFlags user={user} /></TableCell>
                            <TableCell align='right' onClick={e => e.stopPropagation()}>
                                <UserActionsMenu user={user} onDelete={onDelete} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

/** Large avatars, like a profile picker. */
export const UserProfilesView: FC<ViewProps> = ({ users, onDelete, profileOf }) => {
    const openUser = useOpenUser();

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2.5 }}>
            {users.map(user => (
                <Box key={user.Id} onClick={() => openUser(user)} sx={{
                    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 2, borderRadius: '20px',
                    cursor: 'pointer', transition: 'background 0.2s, transform 0.2s',
                    '&:hover': { background: 'rgba(0,164,220,0.08)', transform: 'translateY(-3px)' },
                    '&:hover .profile-menu': { opacity: 1 }
                }}>
                    <Box className='profile-menu' sx={{ position: 'absolute', top: 6, right: 6, opacity: 0, transition: 'opacity 0.2s' }}>
                        <UserActionsMenu user={user} onDelete={onDelete} />
                    </Box>
                    <UserAvatar user={user} size={104} />
                    <Typography noWrap sx={{ maxWidth: '100%', fontWeight: 700, color: '#fff', mt: 0.5 }}>{user.Name}</Typography>
                    <UserChips user={user} compact profileOf={profileOf?.[user.Id ?? '']} />
                </Box>
            ))}
        </Box>
    );
};
