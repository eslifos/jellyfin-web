import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockResetIcon from '@mui/icons-material/LockReset';
import { useNavigate } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import bannerLight from '@jellyfin/ux-web/banner-light.png';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import WizardBackground from 'apps/wizard/components/WizardBackground';

const ForgotPasswordPinPage = () => {
    const navigate = useNavigate();
    const [ pin, setPin ] = useState('');
    const [ submitting, setSubmitting ] = useState(false);
    const [ error, setError ] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const client = ServerConnections.currentApiClient();
            if (!client) throw new Error('No API client');

            const result = await client.ajax({
                type: 'POST',
                url: client.getUrl('Users/ForgotPassword/Pin'),
                data: JSON.stringify({ Pin: pin }),
                contentType: 'application/json'
            }) as { Success?: boolean; UsersReset?: string[] };

            if (result?.Success) {
                const users = result.UsersReset?.join(', ') ?? '';
                alert(`Contraseña restablecida correctamente.\nUsuarios: ${users}`);
                navigate('/');
            } else {
                setError('PIN inválido. Por favor intenta de nuevo.');
            }
        } catch {
            setError('No se pudo procesar la solicitud. Verifica el PIN.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', p: 2 }}>
            <WizardBackground />

            <Box sx={{
                width: 220, height: 56, mb: 2.5, zIndex: 2, position: 'relative',
                backgroundImage: `url(${bannerLight as string})`,
                backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
                animation: 'jf-logo-glow 3s ease-in-out infinite, jf-float-logo 4s ease-in-out infinite'
            }} />

            <Paper elevation={0} sx={{
                width: '100%', maxWidth: 440, zIndex: 2, position: 'relative',
                background: 'rgba(10,12,22,0.80)', backdropFilter: 'blur(28px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(28px) saturate(1.5)', border: '1px solid rgba(0,164,220,0.2)',
                borderRadius: 3, p: { xs: 3, sm: 4 }, animation: 'jf-glow-pulse 4s ease-in-out infinite',
                '&::before': { content: '""', position: 'absolute', top: 0, left: '2rem', right: '2rem', height: '2px', background: 'linear-gradient(90deg, transparent, #aa5cc3 40%, #00a4dc 60%, transparent)', borderRadius: '0 0 4px 4px' }
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <LockResetIcon sx={{ color: '#aa5cc3', fontSize: '2rem' }} />
                    <Typography variant='h5' sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #fff 30%, #aa5cc3 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        Restablecer contraseña
                    </Typography>
                </Box>

                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', mb: 3 }}>
                    Ingresa el PIN de recuperación que recibiste.
                </Typography>

                <Box component='form' onSubmit={handleSubmit}>
                    <TextField
                        label='Código PIN'
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        required
                        fullWidth
                        variant='filled'
                        autoComplete='off'
                        error={!!error}
                        helperText={error || ' '}
                        sx={{ mb: 2 }}
                    />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                        <Button
                            type='submit'
                            variant='contained'
                            disabled={submitting}
                            endIcon={submitting ? <CircularProgress size={16} color='inherit' /> : undefined}
                            sx={{ background: 'linear-gradient(135deg, #aa5cc3, #7b3f92)', borderRadius: 2, py: 1.2, fontWeight: 600, '&:hover': { background: 'linear-gradient(135deg, #c47fd9, #9b5cb2)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(170,92,195,0.4)' } }}
                        >
                            Enviar
                        </Button>
                        <Button
                            onClick={() => navigate(-1)}
                            startIcon={<ArrowBackIcon />}
                            sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, '&:hover': { borderColor: 'rgba(0,164,220,0.35)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' } }}
                        >
                            Cancelar
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default ForgotPasswordPinPage;