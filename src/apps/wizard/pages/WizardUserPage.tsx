import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';

import globalize from 'lib/globalize';
import { useUpdateStartupUser } from '../api/useStartupConfig';
import WizardLayout from '../components/WizardLayout';

const WizardUserPage = () => {
    const navigate = useNavigate();
    const { mutateAsync: updateUser, isPending: saving } = useUpdateStartupUser();

    const [ username, setUsername ] = useState('');
    const [ password, setPassword ] = useState('');
    const [ passwordConfirm, setPasswordConfirm ] = useState('');
    const [ error, setError ] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== passwordConfirm) {
            setError(globalize.translate('PasswordMatchError'));
            return;
        }
        await updateUser({ Name: username, Password: password });
        navigate('/wizard/library');
    };

    const btnSx = { borderRadius: 2, px: 3, fontWeight: 600 };

    return (
        <WizardLayout>
            <Box component='form' onSubmit={handleSubmit}>
                <Typography variant='h5' sx={{ fontWeight: 700, mb: 1, background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    {globalize.translate('TellUsAboutYourself')}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', mb: 3 }}>
                    {globalize.translate('UserProfilesIntro')}
                </Typography>

                <TextField label={globalize.translate('LabelUsername')} value={username} onChange={e => setUsername(e.target.value)}
                    required fullWidth variant='filled' helperText={globalize.translate('SelectAdminUsername')} sx={{ mb: 2 }} />
                <TextField label={globalize.translate('LabelPassword')} type='password' value={password} onChange={e => setPassword(e.target.value)}
                    required fullWidth variant='filled' helperText={globalize.translate('PasswordRequiredForAdmin')} sx={{ mb: 2 }} />
                <TextField label={globalize.translate('LabelPasswordConfirm')} type='password' value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
                    required fullWidth variant='filled' error={!!error} helperText={error || ' '} sx={{ mb: 1 }} />

                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', mb: 2 }}>
                    {globalize.translate('MoreUsersCanBeAddedLater')}
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                    <Button onClick={() => navigate('/wizard/start')} startIcon={<ArrowBackIcon />}
                        sx={{ ...btnSx, color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.14)', '&:hover': { borderColor: 'rgba(0,164,220,0.35)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' } }}>
                        {globalize.translate('Previous')}
                    </Button>
                    <Button type='submit' variant='contained' disabled={saving}
                        endIcon={saving ? <CircularProgress size={16} color='inherit' /> : <ArrowForwardIcon />}
                        sx={{ ...btnSx, background: 'linear-gradient(135deg, #00a4dc, #0077b6)', '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' } }}>
                        {globalize.translate('Next')}
                    </Button>
                </Box>
            </Box>
        </WizardLayout>
    );
};

export default WizardUserPage;