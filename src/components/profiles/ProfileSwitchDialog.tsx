import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import React, { type FC } from 'react';

import globalize from 'lib/globalize';

import ProfilePicker from './ProfilePicker';
import { useProfiles } from './useProfiles';

/** "Switch profile" dialog opened from the floating user menu. */
const ProfileSwitchDialog: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const { list, isLoading, isError, busyId, refresh, select } = useProfiles(open);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth='md'
            fullWidth
            PaperProps={{
                sx: {
                    position: 'relative', overflow: 'hidden', py: 5, px: { xs: 2, sm: 4 },
                    background: 'rgba(10,12,24,0.94)', backdropFilter: 'blur(28px) saturate(1.5)', WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
                    border: '1px solid rgba(0,164,220,0.22)', borderRadius: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(0,164,220,0.12)',
                    '&::before': {
                        content: '""', position: 'absolute', top: 0, left: '2rem', right: '2rem', height: '2px',
                        background: 'linear-gradient(90deg, transparent, #00a4dc 40%, #aa5cc3 60%, transparent)'
                    }
                }
            }}
            slotProps={{ backdrop: { sx: { background: 'rgba(4,4,12,0.7)', backdropFilter: 'blur(6px)' } } }}
        >
            <IconButton onClick={onClose} aria-label={globalize.translate('ButtonClose')} sx={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.6)' }}>
                <CloseIcon />
            </IconButton>

            <Typography component='h2' sx={{
                textAlign: 'center', mb: 4, fontSize: { xs: '1.6rem', md: '2.2rem' }, fontWeight: 800,
                background: 'linear-gradient(135deg, #fff 25%, #00a4dc 65%, #aa5cc3 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
            }}>
                {globalize.translate('ProfilesWhoIsWatching')}
            </Typography>

            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: '#00a4dc' }} /></Box>
            )}
            {!isLoading && list && (
                <ProfilePicker
                    list={list}
                    size={110}
                    onSelect={profile => void select(profile, '/home', onClose)}
                    onChanged={() => void refresh()}
                    busyId={busyId}
                />
            )}
            {isError && (
                <Typography sx={{ textAlign: 'center', color: '#ef5350', mt: 2 }}>{globalize.translate('ProfilesLoadError')}</Typography>
            )}
        </Dialog>
    );
};

export default ProfileSwitchDialog;
