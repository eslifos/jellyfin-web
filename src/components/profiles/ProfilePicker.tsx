/**
 * "Who's watching?" profile picker: avatars of the account profiles, add a
 * profile (up to the server limit) and manage mode to delete profiles, make one
 * a kids profile and set the PIN that leaves them.
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
import ChildCareIcon from '@mui/icons-material/ChildCare';
import PinIcon from '@mui/icons-material/Pin';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import React, { type FC, useCallback, useEffect, useRef, useState } from 'react';

import ConfirmDialog from 'components/ConfirmDialog';
import layoutManager from 'components/layoutManager';
import { appRouter } from 'components/router/appRouter';
import globalize from 'lib/globalize';
import { getAvatarGradient, getInitial } from './avatarColors';
import KidsProfileDialog from './KidsProfileDialog';
import { askPin } from './PinDialog';
import { createProfile, deleteProfile, getProfileImageUrl, type Profile, type ProfileList, setProfilePin } from 'utils/profiles';

/** The mark of a kids profile on its avatar. */
const KidsBadge: FC<{ size: number }> = ({ size }) => (
    <Box
        aria-hidden='true'
        sx={{
            position: 'absolute', left: '50%', bottom: -10, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1, py: 0.25, borderRadius: '999px', fontSize: Math.max(11, size * 0.09), fontWeight: 800, color: '#1a1300',
            background: 'linear-gradient(135deg, #ffd54f, #ffb300)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', whiteSpace: 'nowrap'
        }}
    >
        <ChildCareIcon sx={{ fontSize: '1.1em' }} />
        {globalize.translate('ProfileKidsBadge')}
    </Box>
);

const manageButtonSx = {
    borderRadius: '10px', px: 1.75, fontWeight: 600, color: '#ffca28',
    borderColor: 'rgba(255,202,40,0.45)', background: 'rgba(255,202,40,0.08)',
    '&:hover': { borderColor: '#ffca28', background: 'rgba(255,202,40,0.18)' }
};

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

/** TV: read from the couch (avatars of 160 px, names of 28 px). */
const TV_AVATAR = 160;

const ProfilePicker: FC<ProfilePickerProps> = ({ list, size: givenSize, onSelect, onChanged, busyId }) => {
    const tv = layoutManager.tv;
    const size = tv ? TV_AVATAR : givenSize ?? 132;
    // TV: the remote starts on the current profile (else the first one)
    const tiles = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!tv) return;
        const buttons = tiles.current?.querySelectorAll<HTMLButtonElement>('button[data-profile-id]');
        const current = list.Profiles.find(p => p.IsCurrent)?.Id;
        ([ ...(buttons ?? []) ].find(b => b.dataset.profileId === current) ?? buttons?.[0])?.focus();
    }, [ tv, list ]);
    const [ managing, setManaging ] = useState(false);
    const [ adding, setAdding ] = useState(false);
    const [ name, setName ] = useState('');
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState('');
    const [ toDelete, setToDelete ] = useState<Profile | null>(null);
    const [ kidsProfile, setKidsProfile ] = useState<Profile | null>(null);
    const [ notice, setNotice ] = useState('');
    const addButton = useRef<HTMLButtonElement>(null);
    const manageButton = useRef<HTMLButtonElement>(null);

    // Back (the remote, Escape) first stops adding a profile or managing them, with the focus back on its button;
    // without this it left the screen (on a TV, "Who is watching?" closes the app)
    useEffect(() => {
        if (!adding && !managing) return;
        appRouter.setBackHandler(() => {
            if (adding) {
                setAdding(false);
                setName('');
                window.setTimeout(() => addButton.current?.focus());
            } else {
                setManaging(false);
                window.setTimeout(() => manageButton.current?.focus());
            }
            return true;
        });
        return () => appRouter.setBackHandler(null);
    }, [ adding, managing ]);

    const canAdd = list.CanManage && list.Profiles.length < list.MaxProfiles;
    const hasRemovable = list.CanManage && list.Profiles.some(p => !p.IsMaster);
    // Kids profiles and the PIN need a server that has them (it always says whether there is a PIN)
    const supportsKids = list.HasPin !== undefined;

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

    /** A new PIN, typed twice, or removed. */
    const onChangePin = useCallback(async (remove: boolean) => {
        setError('');
        setNotice('');
        let pin: string | null = null;
        if (!remove) {
            pin = await askPin({ title: globalize.translate('ProfilePinNewTitle'), description: globalize.translate('ProfilePinNewHelp') });
            if (!pin) return;
            const again = await askPin({ title: globalize.translate('ProfilePinConfirmTitle') });
            if (again === null) return;
            if (again !== pin) {
                setError(globalize.translate('ProfilePinMismatch'));
                return;
            }
        }
        try {
            await setProfilePin(pin);
            setNotice(globalize.translate(remove ? 'ProfilePinRemoved' : 'ProfilePinSaved'));
            onChanged();
        } catch (err) {
            console.error('[ProfilePicker] PIN change failed', err);
            setError(globalize.translate('ProfilePinSaveError'));
        }
    }, [ onChanged ]);

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
            <KidsProfileDialog profile={kidsProfile} onClose={() => setKidsProfile(null)} onSaved={onChanged} />

            <Box ref={tiles} sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: tv ? 6 : { xs: 3, sm: 4 } }}>
                {list.Profiles.map(profile => (
                    <Box
                        key={profile.Id}
                        component={managing ? 'div' : 'button'}
                        {...(managing ? {} : { type: 'button', 'data-profile-id': profile.Id })}
                        onClick={() => (managing ? undefined : onSelect(profile))}
                        disabled={profile.IsDisabled || Boolean(busyId)}
                        sx={{ ...tileSx, cursor: managing ? 'default' : 'pointer', opacity: busyId && busyId !== profile.Id ? 0.4 : 1 }}
                    >
                        <Box className='profile-avatar' sx={{ position: 'relative' }}>
                            <ProfileAvatar profile={profile} size={size} highlighted={profile.IsCurrent} />
                            {profile.IsKids && <KidsBadge size={size} />}
                            {busyId === profile.Id && (
                                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', borderRadius: '22%' }}>
                                    <CircularProgress sx={{ color: '#00a4dc' }} />
                                </Box>
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: size + (tv ? 60 : 20) }}>
                            {profile.IsMaster && <StarIcon sx={{ fontSize: '0.95rem', color: '#ffca28' }} />}
                            <Typography className='profile-name' noWrap sx={{ fontSize: tv ? '28px' : '1rem', fontWeight: 600, color: profile.IsCurrent ? '#00a4dc' : 'rgba(255,255,255,0.65)', transition: 'color 0.2s' }}>
                                {profile.Name}
                            </Typography>
                        </Box>
                        {managing && supportsKids && !profile.IsMaster && (
                            <Button
                                size='small'
                                variant='outlined'
                                startIcon={<ChildCareIcon />}
                                onClick={e => {
                                    e.stopPropagation();
                                    setKidsProfile(profile);
                                }}
                                sx={manageButtonSx}
                            >
                                {globalize.translate(profile.IsKids ? 'ProfileKidsEdit' : 'ProfileKidsMake')}
                            </Button>
                        )}
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
                                onKeyDown={e => {
                                    if (e.key === 'Enter') void onCreate();
                                    // TV: Escape is Back, which the back handler above takes (with the focus back)
                                    if (e.key === 'Escape' && !tv) setAdding(false);
                                }}
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
                        <Box component='button' type='button' ref={addButton} onClick={() => setAdding(true)} sx={tileSx}>
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
            {notice && <Typography sx={{ color: '#4caf50', fontSize: '0.88rem' }}>{notice}</Typography>}

            {/* The PIN of the account: it leaves the secondary profiles (a kids profile) with the remote */}
            {managing && supportsKids && list.CanManage && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
                    <Button variant='outlined' startIcon={<PinIcon />} onClick={() => void onChangePin(false)} sx={manageButtonSx}>
                        {globalize.translate(list.HasPin ? 'ProfilePinChange' : 'ProfilePinCreate')}
                    </Button>
                    {list.HasPin && (
                        <Button variant='outlined' onClick={() => void onChangePin(true)} sx={{ ...manageButtonSx, color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.25)', background: 'transparent' }}>
                            {globalize.translate('ProfilePinRemove')}
                        </Button>
                    )}
                </Box>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                {hasRemovable && (
                    <Button
                        variant='outlined'
                        startIcon={managing ? <CheckIcon /> : <EditIcon />}
                        ref={manageButton}
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
