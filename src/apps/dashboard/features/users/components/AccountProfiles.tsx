/**
 * Dashboard "Profiles" tab of a user: lists the viewing profiles of the
 * account, lets the administrator add (up to the limit) and delete them.
 */
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import GroupsIcon from '@mui/icons-material/Groups';
import StarIcon from '@mui/icons-material/Star';
import React, { type FC, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ConfirmDialog from 'components/ConfirmDialog';
import globalize from 'lib/globalize';
import { createProfile, deleteProfile, fetchProfiles, getProfileImageUrl, type Profile, type ProfileList } from 'utils/profiles';
import { queryClient } from 'utils/query/queryClient';

import { SectionCard } from '../../../components/cosmic';
import { UserTab } from '../constants/userTab';

const ACCENT = '#aa5cc3';

const AccountProfiles: FC<{ userId: string }> = ({ userId }) => {
    const [ list, setList ] = useState<ProfileList>();
    const [ loading, setLoading ] = useState(true);
    const [ error, setError ] = useState('');
    const [ name, setName ] = useState('');
    const [ saving, setSaving ] = useState(false);
    const [ toDelete, setToDelete ] = useState<Profile | null>(null);

    const load = useCallback(async () => {
        try {
            setList(await fetchProfiles(userId));
        } catch (err) {
            console.error('[AccountProfiles] load failed', err);
            setError(globalize.translate('ProfilesLoadError'));
        } finally {
            setLoading(false);
        }
    }, [ userId ]);

    useEffect(() => {
        void load();
    }, [ load ]);

    const refreshAll = useCallback(async () => {
        await load();
        void queryClient.invalidateQueries({ queryKey: [ 'Users' ] });
    }, [ load ]);

    const onCreate = useCallback(async () => {
        if (!list || !name.trim()) return;
        setSaving(true);
        setError('');
        try {
            await createProfile(name.trim(), list.MasterId);
            setName('');
            await refreshAll();
        } catch (err) {
            console.error('[AccountProfiles] create failed', err);
            setError(globalize.translate('ProfilesCreateError'));
        } finally {
            setSaving(false);
        }
    }, [ list, name, refreshAll ]);

    const onConfirmDelete = useCallback(async () => {
        const profile = toDelete;
        setToDelete(null);
        if (!profile) return;
        try {
            await deleteProfile(profile.Id);
            await refreshAll();
        } catch (err) {
            console.error('[AccountProfiles] delete failed', err);
            setError(globalize.translate('ProfilesDeleteError'));
        }
    }, [ toDelete, refreshAll ]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
    if (!list) return <Alert severity='error'>{error}</Alert>;

    const isProfileUser = list.MasterId !== userId;
    const master = list.Profiles.find(p => p.IsMaster);
    const canAdd = list.Profiles.length < list.MaxProfiles;

    return (
        <SectionCard
            title={globalize.translate('ProfilesTitle')}
            icon={<GroupsIcon />}
            accentColor={ACCENT}
            description={globalize.translate('ProfilesHelp', list.MaxProfiles)}
        >
            <ConfirmDialog
                open={Boolean(toDelete)}
                title={toDelete ? globalize.translate('DeleteName', toDelete.Name) : ''}
                text={globalize.translate('ProfilesDeleteConfirm')}
                confirmButtonText={globalize.translate('Delete')}
                confirmButtonColor='error'
                onConfirm={onConfirmDelete}
                onCancel={() => setToDelete(null)}
            />

            {isProfileUser && master && (
                <Alert severity='info' sx={{ mb: 2 }}>
                    {globalize.translate('ProfilesIsProfileOf', master.Name)}{' '}
                    <Link to={`/dashboard/users/${master.Id}/profiles`} style={{ color: '#00a4dc' }}>{globalize.translate('ProfilesOpenMaster')}</Link>
                </Alert>
            )}

            {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
                {list.Profiles.map(profile => (
                    <Paper key={profile.Id} elevation={0} sx={{
                        p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5,
                        borderColor: profile.Id === userId ? `${ACCENT}88 !important` : undefined
                    }}>
                        <Avatar src={getProfileImageUrl(profile, 96)} variant='rounded' sx={{
                            width: 48, height: 48, borderRadius: '14px', fontWeight: 700,
                            background: profile.IsMaster ? 'linear-gradient(135deg, #00a4dc, #0077b6)' : `linear-gradient(135deg, ${ACCENT}, #7b3f92)`
                        }}>
                            {profile.Name.slice(0, 1).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontWeight: 600, color: '#fff' }}>{profile.Name}</Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: profile.IsMaster ? '#ffca28' : 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {profile.IsMaster && <StarIcon sx={{ fontSize: '0.85rem' }} />}
                                {globalize.translate(profile.IsMaster ? 'ProfilesMaster' : 'ProfilesProfile')}
                            </Typography>
                        </Box>
                        {profile.Id !== userId && !isProfileUser && (
                            <Tooltip title={globalize.translate('ButtonEditUser')}>
                                <IconButton component={Link} to={`/dashboard/users/${profile.Id}/${UserTab.Profile}`} size='small' sx={{ color: 'rgba(255,255,255,0.55)' }}>
                                    <EditIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                        )}
                        {!profile.IsMaster && !isProfileUser && (
                            <Tooltip title={globalize.translate('Delete')}>
                                <IconButton size='small' onClick={() => setToDelete(profile)} sx={{ color: '#ef5350' }}>
                                    <DeleteIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Paper>
                ))}
            </Box>

            {/* Only the main account page can add profiles */}
            {isProfileUser ? (
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', mt: 2.5 }}>
                    {globalize.translate('ProfilesLimit', list.Profiles.length, list.MaxProfiles)} · {globalize.translate('ProfilesManagedFromMaster')}
                </Typography>
            ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mt: 2.5 }}>
                <TextField
                    size='small'
                    value={name}
                    disabled={!canAdd || saving}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void onCreate(); } }}
                    placeholder={globalize.translate('ProfilesNamePlaceholder')}
                    slotProps={{ htmlInput: { maxLength: 32 } }}
                    sx={{ flex: '1 1 240px', maxWidth: 360 }}
                />
                <Button variant='contained' startIcon={saving ? <CircularProgress size={16} color='inherit' /> : <AddIcon />}
                    disabled={!canAdd || saving || !name.trim()} onClick={() => void onCreate()} sx={{ fontWeight: 600 }}>
                    {globalize.translate('ProfilesAdd')}
                </Button>
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
                    {globalize.translate('ProfilesLimit', list.Profiles.length, list.MaxProfiles)}
                </Typography>
            </Box>
            )}
        </SectionCard>
    );
};

export default AccountProfiles;
