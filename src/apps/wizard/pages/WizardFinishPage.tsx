import React from 'react';
import globalize from 'lib/globalize';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';

import { useCompleteWizard } from '../api/useStartupConfig';
import WizardLayout from '../components/WizardLayout';

const WizardFinishPage = () => {
    const navigate = useNavigate();
    const { mutateAsync: completeWizard, isPending: completing } = useCompleteWizard();

    const handleFinish = async () => {
        await completeWizard();
        navigate('/');
    };

    return (
        <WizardLayout>
            <Box sx={{ textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: '4rem', color: '#00a4dc', mb: 2, filter: 'drop-shadow(0 0 16px rgba(0,164,220,0.5))' }} />

                <Typography
                    variant='h5'
                    sx={{
                        fontWeight: 700,
                        mb: 2,
                        background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}
                >
                    {globalize.translate('LabelYoureDone')}
                </Typography>

                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem', mb: 4, lineHeight: 1.7 }}>
                    Tu servidor Jellyfin está configurado y listo para usar.
                    Haz clic en <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Finalizar</strong> para entrar al panel de control
                    y empezar a disfrutar de tu colección multimedia.
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                        onClick={() => navigate('/wizard/remoteaccess')}
                        startIcon={<ArrowBackIcon />}
                        sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, '&:hover': { borderColor: 'rgba(0,164,220,0.35)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' } }}
                    >
                        {globalize.translate('Previous')}
                    </Button>
                    <Button
                        onClick={handleFinish}
                        variant='contained'
                        disabled={completing}
                        startIcon={completing ? <CircularProgress size={16} color='inherit' /> : <CheckCircleIcon />}
                        sx={{
                            background: 'linear-gradient(135deg, #00a4dc, #0077b6)',
                            borderRadius: 2,
                            px: 4,
                            fontWeight: 700,
                            fontSize: '1rem',
                            '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' }
                        }}
                    >
                        {globalize.translate('LabelFinish')}
                    </Button>
                </Box>
            </Box>
        </WizardLayout>
    );
};

export default WizardFinishPage;