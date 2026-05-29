import React, { useEffect, useState } from 'react';
import globalize from 'lib/globalize';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';

import { useLocalizationOptions } from '../api/useLocalizationOptions';
import { useStartupConfig, useUpdateStartupConfig } from '../api/useStartupConfig';
import WizardLayout from '../components/WizardLayout';

const WizardStartPage = () => {
    const navigate = useNavigate();
    const { data: config, isPending: configLoading } = useStartupConfig();
    const { data: languages, isPending: langLoading } = useLocalizationOptions();
    const { mutateAsync: updateConfig, isPending: saving } = useUpdateStartupConfig();

    const [ serverName, setServerName ] = useState('');
    const [ language, setLanguage ] = useState('en-US');

    useEffect(() => {
        if (config) {
            setServerName(config.ServerName ?? '');
            setLanguage(config.UICulture ?? 'en-US');
        }
    }, [ config ]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateConfig({ ServerName: serverName, UICulture: language });
        navigate('/wizard/user');
    };

    const isLoading = configLoading || langLoading;

    return (
        <WizardLayout>
            <Box component='form' onSubmit={handleSubmit}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Typography
                        variant='h5'
                        sx={{
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}
                    >
                        {globalize.translate('WelcomeToProject')}
                    </Typography>
                    <Button
                        href='https://jellyfin.org/docs/general/post-install/setup-wizard/'
                        target='_blank'
                        rel='noopener noreferrer'
                        size='small'
                        endIcon={<OpenInNewIcon fontSize='small' />}
                        sx={{
                            color: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(255,255,255,0.13)',
                            borderRadius: 2,
                            fontSize: '0.78rem',
                            '&:hover': { borderColor: 'rgba(0,164,220,0.4)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' }
                        }}
                    >
                        {globalize.translate('ButtonQuickStartGuide')}
                    </Button>
                </Box>

                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', mb: 3 }}>
                    {globalize.translate('ThisWizardWillGuideYou')}
                </Typography>

                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress sx={{ color: '#00a4dc' }} />
                    </Box>
                ) : (
                    <>
                        <TextField
                            label={globalize.translate('LabelServerName')}
                            value={serverName}
                            onChange={e => setServerName(e.target.value)}
                            required
                            fullWidth
                            variant='filled'
                            helperText={globalize.translate('LabelServerNameHelp')}
                            sx={{ mb: 2 }}
                        />

                        <TextField
                            select
                            label={globalize.translate('LabelPreferredDisplayLanguage')}
                            value={language}
                            onChange={e => setLanguage(e.target.value)}
                            fullWidth
                            variant='filled'
                        >
                            {(languages ?? []).map(l => (
                                <MenuItem key={l.Value} value={l.Value ?? ''}>
                                    {l.Name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                    <Button
                        type='submit'
                        variant='contained'
                        disabled={saving || isLoading}
                        endIcon={saving ? <CircularProgress size={16} color='inherit' /> : <ArrowForwardIcon />}
                        sx={{
                            background: 'linear-gradient(135deg, #00a4dc, #0077b6)',
                            borderRadius: 2,
                            px: 3,
                            fontWeight: 600,
                            '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' }
                        }}
                    >
                        {globalize.translate('Next')}
                    </Button>
                </Box>
            </Box>
        </WizardLayout>
    );
};

export default WizardStartPage;