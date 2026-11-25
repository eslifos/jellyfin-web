import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DnsIcon from '@mui/icons-material/Dns';
import { useNavigate } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useCustomLogo } from 'utils/customLogo';

import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import Dashboard from 'utils/dashboard';
import WizardBackground from 'apps/wizard/components/WizardBackground';
import { ambientAnimation } from 'utils/reducedMotion';

/** How a server address looks (an example in no language). */
const URL_EXAMPLE = 'https://jellyfin.example.com:8096';
/** Where a newer server is downloaded. */
const DOWNLOADS_URL = 'https://jellyfin.org/downloads';

const AddServerPage = () => {
    const { bannerUrl: bannerLight } = useCustomLogo();
    const navigate = useNavigate();
    const [ serverUrl, setServerUrl ] = useState('');
    const [ connecting, setConnecting ] = useState(false);
    const [ error, setError ] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setConnecting(true);

        try {
            const result = await ServerConnections.connectToAddress(serverUrl);

            switch (result.State) {
                case 'SignedIn':
                    Dashboard.onServerChanged(result.User?.Id, result.AccessToken, result.ApiClient);
                    navigate('/home');
                    break;
                case 'ServerSignIn':
                    navigate(`/login?serverid=${result.ApiClient.serverId()}`);
                    break;
                case 'ServerSelection':
                    navigate('/selectserver');
                    break;
                case 'ServerUpdateNeeded':
                    setError(globalize.translate('ServerUpdateNeeded', DOWNLOADS_URL));
                    break;
                default:
                    setError(globalize.translate('MessageUnableToConnectToServer'));
            }
        } catch {
            setError(globalize.translate('MessageUnableToConnectToServer'));
        } finally {
            setConnecting(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', p: 2 }}>
            <WizardBackground />

            <Box sx={{
                width: 220, height: 56, mb: 2.5, zIndex: 2, position: 'relative',
                backgroundImage: `url(${bannerLight as string})`,
                backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
                ...ambientAnimation('jf-logo-glow 3s ease-in-out infinite, jf-float-logo 4s ease-in-out infinite')
            }} />

            <Paper elevation={0} sx={{
                width: '100%', maxWidth: 460, zIndex: 2, position: 'relative',
                background: 'rgba(10,12,22,0.80)', backdropFilter: 'blur(28px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(28px) saturate(1.5)', border: '1px solid rgba(0,164,220,0.2)',
                borderRadius: 3, p: { xs: 3, sm: 4 }, ...ambientAnimation('jf-glow-pulse 4s ease-in-out infinite'),
                '&::before': { content: '""', position: 'absolute', top: 0, left: '2rem', right: '2rem', height: '2px', background: 'linear-gradient(90deg, transparent, #00a4dc 40%, #aa5cc3 60%, transparent)', borderRadius: '0 0 4px 4px' }
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <DnsIcon sx={{ color: '#00a4dc', fontSize: '2rem' }} />
                    <Typography variant='h5' sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        {globalize.translate('HeaderConnectToServer')}
                    </Typography>
                </Box>

                <Box component='form' onSubmit={handleSubmit}>
                    <TextField
                        label={globalize.translate('LabelServerUrl')}
                        type='url'
                        value={serverUrl}
                        onChange={e => setServerUrl(e.target.value)}
                        required
                        fullWidth
                        variant='filled'
                        placeholder={URL_EXAMPLE}
                        error={!!error}
                        helperText={error || globalize.translate('LabelServerUrlHelp')}
                        sx={{ mb: 3 }}
                    />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                        <Button
                            type='submit'
                            variant='contained'
                            disabled={connecting}
                            endIcon={connecting ? <CircularProgress size={16} color='inherit' /> : undefined}
                            sx={{ background: 'linear-gradient(135deg, #00a4dc, #0077b6)', borderRadius: 2, py: 1.2, fontWeight: 600, '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' } }}
                        >
                            {globalize.translate('ButtonConnect')}
                        </Button>
                        <Button
                            onClick={() => navigate(-1)}
                            startIcon={<ArrowBackIcon />}
                            sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, '&:hover': { borderColor: 'rgba(0,164,220,0.35)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' } }}
                        >
                            {globalize.translate('ButtonCancel')}
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default AddServerPage;
