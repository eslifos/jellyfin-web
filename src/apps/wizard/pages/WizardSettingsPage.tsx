import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';

import { useLocalizationOptions, useLocalizationCountries } from '../api/useLocalizationOptions';
import { useUpdateMetadataSettings } from '../api/useStartupConfig';
import WizardLayout from '../components/WizardLayout';

const WizardSettingsPage = () => {
    const navigate = useNavigate();
    const { data: languages, isPending: langLoading } = useLocalizationOptions();
    const { data: countries, isPending: countryLoading } = useLocalizationCountries();
    const { mutateAsync: save, isPending: saving } = useUpdateMetadataSettings();

    const [ language, setLanguage ] = useState('en-US');
    const [ country, setCountry ] = useState('US');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await save({ MetadataCountryCode: country, PreferredMetadataLanguage: language });
        navigate('/wizard/remoteaccess');
    };

    const isLoading = langLoading || countryLoading;

    return (
        <WizardLayout>
            <Box component='form' onSubmit={handleSubmit}>
                <Typography variant='h5' sx={{ fontWeight: 700, mb: 1, background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    Idioma de metadatos preferido
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', mb: 3 }}>
                    Selecciona el idioma y país para los metadatos de tus medios.
                </Typography>

                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress sx={{ color: '#00a4dc' }} />
                    </Box>
                ) : (
                    <>
                        <TextField select label='Idioma' value={language} onChange={e => setLanguage(e.target.value)} required fullWidth variant='filled' sx={{ mb: 2 }}>
                            {(languages ?? []).map(l => (
                                <MenuItem key={l.Value} value={l.Value}>{l.Name}</MenuItem>
                            ))}
                        </TextField>
                        <TextField select label='País' value={country} onChange={e => setCountry(e.target.value)} required fullWidth variant='filled'>
                            {(countries ?? []).map(c => (
                                <MenuItem key={c.TwoLetterISORegionName} value={c.TwoLetterISORegionName}>{c.DisplayName}</MenuItem>
                            ))}
                        </TextField>
                    </>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                    <Button onClick={() => navigate('/wizard/library')} startIcon={<ArrowBackIcon />} sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, '&:hover': { borderColor: 'rgba(0,164,220,0.35)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' } }}>
                        Anterior
                    </Button>
                    <Button type='submit' variant='contained' disabled={saving || isLoading} endIcon={saving ? <CircularProgress size={16} color='inherit' /> : <ArrowForwardIcon />} sx={{ background: 'linear-gradient(135deg, #00a4dc, #0077b6)', borderRadius: 2, px: 3, fontWeight: 600, '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' } }}>
                        Siguiente
                    </Button>
                </Box>
            </Box>
        </WizardLayout>
    );
};

export default WizardSettingsPage;