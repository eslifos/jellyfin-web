import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';

import globalize from 'lib/globalize';

import { useSetRemoteAccess } from '../api/useStartupConfig';
import WizardLayout from '../components/WizardLayout';
import { TEXT_TERTIARY } from 'themes/cosmic/textColors';

const WizardRemotePage = () => {
    const navigate = useNavigate();
    const { mutateAsync: setRemoteAccess, isPending: saving } = useSetRemoteAccess();
    const [ enableRemote, setEnableRemote ] = useState(true);
    const [ enableUpnp, setEnableUpnp ] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await setRemoteAccess({ EnableRemoteAccess: enableRemote, EnableAutomaticPortMapping: enableUpnp });
        navigate('/wizard/finish');
    };

    return (
        <WizardLayout>
            <Box component='form' onSubmit={handleSubmit}>
                <Typography
                    variant='h5'
                    sx={{
                        fontWeight: 700,
                        mb: 1,
                        background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}
                >
                    {globalize.translate('HeaderConfigureRemoteAccess')}
                </Typography>

                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', mb: 3 }}>
                    {globalize.translate('WizardRemoteAccessHelp')}
                </Typography>

                <Box sx={{
                    p: 2,
                    mb: 2,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(0,164,220,0.15)',
                    borderRadius: 2
                }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={enableRemote}
                                onChange={e => setEnableRemote(e.target.checked)}
                                sx={{ '& .MuiSwitch-thumb': { bgcolor: enableRemote ? '#00a4dc' : undefined } }}
                            />
                        }
                        label={
                            <Box>
                                <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>
                                    {globalize.translate('AllowRemoteAccess')}
                                </Typography>
                                <Typography sx={{ color: TEXT_TERTIARY, fontSize: '0.75rem' }}>
                                    {globalize.translate('AllowRemoteAccessHelp')}
                                </Typography>
                            </Box>
                        }
                    />
                </Box>

                <Box sx={{
                    p: 2,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(0,164,220,0.15)',
                    borderRadius: 2,
                    opacity: enableRemote ? 1 : 0.5
                }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={enableUpnp}
                                onChange={e => setEnableUpnp(e.target.checked)}
                                disabled={!enableRemote}
                                sx={{ '& .MuiSwitch-thumb': { bgcolor: enableUpnp ? '#00a4dc' : undefined } }}
                            />
                        }
                        label={
                            <Box>
                                <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>
                                    {globalize.translate('WizardUpnp')}
                                </Typography>
                                <Typography sx={{ color: TEXT_TERTIARY, fontSize: '0.75rem' }}>
                                    {globalize.translate('WizardUpnpHelp')}
                                </Typography>
                            </Box>
                        }
                    />
                </Box>

                <Box className='wizardNav' sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                    <Button variant='text'
                        onClick={() => navigate('/wizard/settings')}
                        startIcon={<ArrowBackIcon />}
                        sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, '&:hover': { borderColor: 'rgba(0,164,220,0.35)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' } }}
                    >
                        {globalize.translate('Previous')}
                    </Button>
                    <Button
                        type='submit'
                        variant='contained'
                        disabled={saving}
                        endIcon={saving ? <CircularProgress size={16} color='inherit' /> : <ArrowForwardIcon />}
                        sx={{ background: 'linear-gradient(135deg, #00a4dc, #0077b6)', borderRadius: 2, px: 3, fontWeight: 600, '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' } }}
                    >
                        {globalize.translate('Next')}
                    </Button>
                </Box>
            </Box>
        </WizardLayout>
    );
};

export default WizardRemotePage;
