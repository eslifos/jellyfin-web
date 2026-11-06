/**
 * "Who's watching?" profile picker: avatars of the account profiles, add a
 * profile (up to the server limit) and manage mode to delete profiles.
 */
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import React, { type FC, useCallback, useState } from 'react';

import ConfirmDialog from 'components/ConfirmDialog';
import globalize from 'lib/globalize';
import { getAvatarGradient, getInitial } from './avatarColors';
import { createProfile, deleteProfile, getProfileImageUrl, type Profile, type ProfileList } from 'utils/profiles';

const ProfileAvatar: FC<{ profile: Profile; size: number; highlighted?: boolean }> = ({ profile, size, highlighted }) => {
    return (
        <Avatar
            src={getProfileImageUrl(profile, size * 2)}
            alt={profile.Name}
            variant='rounded'
            sx={{
                width: size, height: size, borderRadius: '22%', fontSize: size * 0.4, fontWeight: 700, color: '#fff',
                background: getAvatarGradient(profile.Name),
                border: highlighted ? '3px solid #00a4dc' : '3px solid transparent',
                boxShadow: highlighted ? '0 0 28px rgba(0,164,220,0.55)' : '0 10px 30px rgba(0,0,0,0.45)',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                filter: profile.IsDisabled ? 'grayscale(1)' : 'none'
            }}
        >
            {getInitial(profile.Name)}
        </Avatar>
    );
};

interface ProfilePickerProps {
    list: ProfileList;
    /** Size of the avatars in px. */
    size?: number;
    onSelect: (profile: Profile) => void;
    /** Called after a profile was created or deleted. */
    onChanged: () => void;
    busyId?: string | null;
}

const tileSx = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25, cursor: 'pointer', position: 'relative',
    background: 'none', border: 'none', p: 0, color: 'inherit', font: 'inherit',
    '&:hover .profile-avatar > *, &:focus-visible .profile-avatar > *': { transform: 'scale(1.06)', borderColor: '#00a4dc' },
    '&:hover .profile-name, &:focus-visible .profile-name': { color: '#fff' },
    '&:focus-visible': { outline: 'none' }
};

const ProfilePicker: FC<ProfilePickerProps> = ({ list, size = 132, onSelect, onChanged, busyId }) => {
    const [ managing, setManaging ] = useState(false);
    const [ adding, setAdding ] = useState(false);
    const [ name, setName ] = useState('');
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState('');
    const [ toDelete, setToDelete ] = useState<Profile | null>(null);

    const canAdd = list.CanManage && list.Profiles.length < list.MaxProfiles;
    const hasRemovable = list.CanManage && list.Profiles.some(p => !p.IsMaster);

    const onCreate = useCallback(async () => {
        const value = name.trim();
        if (!value) return;
        setSaving(true);
        setError('');
        try {
            await createProfile(value, list.MasterId);
            setName('');
            setAdding(false);
            onChanged();
        } catch (err) {
            console.error('[ProfilePicker] create failed', err);
            setError(globalize.translate('ProfilesCreateError'));
        } finally {
            setSaving(false);
        }
    }, [ name, list.MasterId, onChanged ]);

    const onConfirmDelete = useCallback(async () => {
        if (!toDelete) return;
        const profile = toDelete;
        setToDelete(null);
        try {
            await deleteProfile(profile.Id);
            onChanged();
        } catch (err) {
            console.error('[ProfilePicker] delete failed', err);
            setError(globalize.translate('ProfilesDeleteError'));
        }
    }, [ toDelete, onChanged ]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}>
            <ConfirmDialog
                open={Boolean(toDelete)}
                title={toDelete ? globalize.translate('DeleteName', toDelete.Name) : ''}
                text={globalize.translate('ProfilesDeleteConfirm')}
                confirmButtonText={globalize.translate('Delete')}
                confirmButtonColor='error'
                onConfirm={onConfirmDelete}
                onCancel={() => setToDelete(null)}
            />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: { xs: 3, sm: 4 } }}>
                {list.Profiles.map(profile => (
                    <Box
                        key={profile.Id}
                        component={managing ? 'div' : 'button'}
                        {...(managing ? {} : { type: 'button' })}
                        onClick={() => (managing ? undefined : onSelect(profile))}
                        disabled={profile.IsDisabled || Boolean(busyId)}
                        sx={{ ...tileSx, cursor: managing ? 'default' : 'pointer', opacity: busyId && busyId !== profile.Id ? 0.4 : 1 }}
                    >
                        <Box className='profile-avatar' sx={{ position: 'relative' }}>
                            <ProfileAvatar profile={profile} size={size} highlighted={profile.IsCurrent} />
                            {busyId === profile.Id && (
                                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', borderRadius: '22%' }}>
                                    <CircularProgress sx={{ color: '#00a4dc' }} />
                                </Box>
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: size + 20 }}>
                            {profile.IsMaster && <StarIcon sx={{ fontSize: '0.95rem', color: '#ffca28' }} />}
                            <Typography className='profile-name' noWrap sx={{ fontSize: '1rem', fontWeight: 600, color: profile.IsCurrent ? '#00a4dc' : 'rgba(255,255,255,0.65)', transition: 'color 0.2s' }}>
                                {profile.Name}
                            </Typography>
                        </Box>
                        {managing && !profile.IsMaster && (
                            <Button
                                size='small'
                                variant='outlined'
                                startIcon={<DeleteIcon />}
                                onClick={e => { e.stopPropagation(); setToDelete(profile); }}
                                sx={{
                                    borderRadius: '10px', px: 1.75, fontWeight: 600, color: '#ef5350',
                                    borderColor: 'rgba(239,83,80,0.45)', background: 'rgba(239,83,80,0.08)',
                                    '&:hover': { borderColor: '#ef5350', background: 'rgba(239,83,80,0.18)' }
                                }}
                            >
                                {globalize.translate('Delete')}
                            </Button>
                        )}
                    </Box>
                ))}

                {/* Add profile */}
                {canAdd && !managing && (
                    adding ? (
                        <Box sx={{ width: Math.max(size + 40, 200), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
                            <Box sx={{
                                width: size, height: size, borderRadius: '22%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '2px dashed rgba(0,164,220,0.6)', background: 'rgba(0,164,220,0.08)'
                            }}>
                                <AddIcon sx={{ fontSize: size * 0.35, color: '#00a4dc' }} />
                            </Box>
                            <TextField
                                autoFocus
                                size='small'
                                value={name}
                                onChange={e => setName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') void onCreate(); if (e.key === 'Escape') setAdding(false); }}
                                placeholder={globalize.translate('ProfilesNamePlaceholder')}
                                slotProps={{ htmlInput: { maxLength: 32 } }}
                                sx={{
                                    width: '100%',
                                    '& .MuiOutlinedInput-root': { borderRadius: '12px', background: 'rgba(255,255,255,0.05)' },
                                    '& fieldset': { borderColor: 'rgba(0,164,220,0.35)' }
                                }}
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton onClick={() => void onCreate()} disabled={saving || !name.trim()} sx={{ color: '#4caf50', background: 'rgba(76,175,80,0.12)' }}>
                                    {saving ? <CircularProgress size={20} /> : <CheckIcon />}
                                </IconButton>
                                <IconButton onClick={() => { setAdding(false); setName(''); }} sx={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)' }}>
                                    <CloseIcon />
                                </IconButton>
                            </Box>
                        </Box>
                    ) : (
                        <Box component='button' type='button' onClick={() => setAdding(true)} sx={tileSx}>
                            <Box className='profile-avatar'>
                                <Box sx={{
                                    width: size, height: size, borderRadius: '22%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '2px dashed rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.03)', transition: 'transform 0.2s, border-color 0.2s'
                                }}>
                                    <AddIcon sx={{ fontSize: size * 0.4, color: 'rgba(255,255,255,0.55)' }} />
                                </Box>
                            </Box>
                            <Typography className='profile-name' sx={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                                {globalize.translate('ProfilesAdd')}
                            </Typography>
                        </Box>
                    )
                )}
            </Box>

            {error && <Typography sx={{ color: '#ef5350', fontSize: '0.88rem' }}>{error}</Typography>}

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                {hasRemovable && (
                    <Button
                        variant='outlined'
                        startIcon={managing ? <CheckIcon /> : <EditIcon />}
                        onClick={() => setManaging(value => !value)}
                        sx={{
                            borderRadius: '12px', px: 3, color: managing ? '#00a4dc' : 'rgba(255,255,255,0.7)',
                            borderColor: managing ? '#00a4dc' : 'rgba(255,255,255,0.25)',
                            '&:hover': { borderColor: '#00a4dc', color: '#00a4dc', background: 'rgba(0,164,220,0.08)' }
                        }}
                    >
                        {globalize.translate(managing ? 'ButtonDone' : 'ProfilesManage')}
                    </Button>
                )}
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                    {globalize.translate('ProfilesLimit', list.Profiles.length, list.MaxProfiles)}
                </Typography>
            </Box>
        </Box>
    );
};

export default ProfilePicker;
