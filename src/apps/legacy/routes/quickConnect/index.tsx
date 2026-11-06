/**
 * QuickConnectPage — authorize a QuickConnect code for a user.
 *
 * Uses the same glassmorphism cards as the display preferences page.
 */
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';
import React, { FC, FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import InfoIcon from '@mui/icons-material/Info';
import PhonelinkLockIcon from '@mui/icons-material/PhonelinkLock';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';

const menuPaper = {
    background: 'rgba(8,10,22,0.96)',
    backdropFilter: 'blur(24px) saturate(1.5)',
    border: '1px solid rgba(0,164,220,0.2)',
    borderRadius: '14px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    '& .MuiMenuItem-root': {
        color: 'rgba(255,255,255,0.75)', borderRadius: '8px', mx: 0.5, my: 0.15, fontSize: '0.88rem',
        '&:hover': { background: 'rgba(0,164,220,0.12)', color: '#00a4dc' },
        '&.Mui-selected': { background: 'rgba(0,164,220,0.2)', color: '#00a4dc' }
    }
};

const fieldSx = {
    mb: 2,
    '& .MuiFilledInput-root': {
        background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
        border: '1px solid rgba(0,164,220,0.18)', transition: 'all 0.2s',
        '&:before, &:after': { display: 'none' },
        '&:hover': { background: 'rgba(0,164,220,0.07)', borderColor: 'rgba(0,164,220,0.35)' },
        '&.Mui-focused': { background: 'rgba(0,164,220,0.08)', borderColor: '#00a4dc', boxShadow: '0 0 0 3px rgba(0,164,220,0.12)' }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', letterSpacing: '0.6px', textTransform: 'uppercase' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#00a4dc' },
    '& .MuiSelect-select, & .MuiInputBase-input': { color: 'rgba(255,255,255,0.9)' },
    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' }
};

const primaryButtonSx = {
    background: 'linear-gradient(135deg, #00a4dc, #0077b6)', borderRadius: 2, py: 1.3, fontWeight: 600, fontSize: '0.95rem',
    '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' }
};

interface CardProps {
    title: string;
    icon: React.ReactNode;
    accentColor?: string;
    children: React.ReactNode;
}

/** Glassmorphism card with accent line and icon header (same look as the display page). */
const Card: FC<CardProps> = ({ title, icon, accentColor = '#00a4dc', children }) => (
    <Paper elevation={0} sx={{
        background: 'rgba(10,12,22,0.78)', backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)', border: `1px solid ${accentColor}40`,
        borderRadius: '18px', mb: 2.5, overflow: 'hidden', position: 'relative',
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${accentColor}15`
    }}>
        <Box sx={{ position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem', height: '2px', pointerEvents: 'none', background: `linear-gradient(90deg, transparent, ${accentColor} 40%, ${accentColor === '#00a4dc' ? '#aa5cc3' : '#00a4dc'} 60%, transparent)`, borderRadius: '0 0 4px 4px' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5 }}>
            <Box sx={{ color: accentColor, display: 'flex', '& svg': { fontSize: '1rem' } }}>{icon}</Box>
            <Typography variant='overline' sx={{ flex: 1, fontSize: '0.7rem', letterSpacing: '1.5px', color: accentColor, fontWeight: 700 }}>{title}</Typography>
        </Box>
        <Box sx={{ px: 2.5, pb: 2.5 }}>
            {children}
        </Box>
    </Paper>
);

const QuickConnectPage: FC = () => {
    const { api, user } = useApi();
    const navigate = useNavigate();
    const { data: users, isPending } = useUsers();
    const [ searchParams ] = useSearchParams();
    const [ selectedUserId, setSelectedUserId ] = useState(searchParams.get('userId') ?? user?.Id ?? '');
    const [ code, setCode ] = useState(searchParams.get('code') ?? '');
    const [ error, setError ] = useState<string>();
    const [ success, setSuccess ] = useState(false);
    const [ submitting, setSubmitting ] = useState(false);

    const isAdmin = Boolean(user?.Policy?.IsAdministrator);
    const activeUsers = users?.filter(u => !u.Policy?.IsDisabled) ?? [];

    // The current user may load after the first render
    useEffect(() => {
        if (!selectedUserId && user?.Id) setSelectedUserId(user.Id);
    }, [ selectedUserId, user ]);

    const onCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setCode(event.target.value);
    }, []);

    const onUserChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedUserId(event.target.value);
    }, []);

    const onSubmitCode = useCallback((e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(undefined);

        if (!e.currentTarget.checkValidity()) {
            setError('QuickConnectInvalidCode');
            return;
        }

        if (!api) {
            console.error('[QuickConnect] cannot authorize, missing api instance');
            setError('UnknownError');
            return;
        }

        const normalizedCode = code.replace(/\s/g, '');
        const userId = isAdmin ? selectedUserId : user?.Id;
        console.log('[QuickConnect] authorizing code %s as user %s', normalizedCode, userId);

        setSubmitting(true);
        getAuthenticationApi(api)
            .authorizeQuickConnect({ code: normalizedCode, userId })
            .then(() => setSuccess(true))
            .catch(() => setError('QuickConnectAuthorizeFail'))
            .finally(() => setSubmitting(false));
    }, [ api, code, isAdmin, selectedUserId, user ]);

    const onGoHome = useCallback(() => navigate('/home'), [ navigate ]);

    const onAuthorizeAnother = useCallback(() => {
        setSuccess(false);
        setCode('');
    }, []);

    if (isPending) return <Loading />;

    return (
        <Page
            id='quickConnectPreferencesPage'
            title={globalize.translate('QuickConnect')}
            className='mainAnimatedPage libraryPage userPreferencesPage noSecondaryNavPage'
            shouldAutoFocus
        >
            <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, pt: 3, pb: 14 }}>

                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Box sx={{
                        width: 56, height: 56, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(170,92,195,0.18)', border: '1px solid rgba(170,92,195,0.35)', boxShadow: '0 0 16px rgba(170,92,195,0.25)'
                    }}>
                        <PhonelinkLockIcon sx={{ fontSize: '1.8rem', color: '#aa5cc3' }} />
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', background: 'linear-gradient(135deg, #fff 30%, #aa5cc3 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        {globalize.translate('QuickConnect')}
                    </Typography>
                </Box>

                {/* What is QuickConnect */}
                <Card title={globalize.translate('QuickConnect')} icon={<InfoIcon />} accentColor='#aa5cc3'>
                    <Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                        {globalize.translate('QuickConnectDescription')}
                    </Typography>
                </Card>

                {/* Authorize */}
                <Card title={globalize.translate('Authorize')} icon={<VpnKeyIcon />}>
                    {success ? (
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                            <CheckCircleIcon sx={{ fontSize: '3rem', color: '#4caf50', mb: 1.5, filter: 'drop-shadow(0 0 12px rgba(76,175,80,0.5))' }} />
                            <Typography sx={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', mb: 3 }}>
                                {globalize.translate('QuickConnectAuthorizeSuccess')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Button variant='contained' startIcon={<HomeRoundedIcon />} onClick={onGoHome} sx={{ ...primaryButtonSx, px: 4 }}>
                                    {globalize.translate('GoHome')}
                                </Button>
                                <Button onClick={onAuthorizeAnother} sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 2, px: 3, '&:hover': { borderColor: 'rgba(0,164,220,0.4)', color: '#00a4dc' } }}>
                                    {globalize.translate('Authorize')}
                                </Button>
                            </Box>
                        </Box>
                    ) : (
                        <form onSubmit={onSubmitCode} noValidate>
                            {error && (
                                <Box sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 1.5, py: 1.2, borderRadius: '12px',
                                    background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)'
                                }}>
                                    <ErrorOutlineIcon sx={{ color: '#ef5350', fontSize: '1.1rem' }} />
                                    <Typography sx={{ fontSize: '0.85rem', color: '#ef9a9a' }}>
                                        {globalize.translate(error)}
                                    </Typography>
                                </Box>
                            )}

                            {isAdmin && (
                                <TextField
                                    select
                                    id='userId'
                                    label={globalize.translate('LabelUser')}
                                    value={selectedUserId}
                                    onChange={onUserChange}
                                    fullWidth
                                    variant='filled'
                                    SelectProps={{ MenuProps: { PaperProps: { sx: menuPaper } } }}
                                    sx={fieldSx}
                                >
                                    {activeUsers.map(u => (
                                        <MenuItem key={u.Id} value={u.Id}>{u.Name}</MenuItem>
                                    ))}
                                </TextField>
                            )}

                            <TextField
                                id='txtQuickConnectCode'
                                label={globalize.translate('LabelQuickConnectCode')}
                                value={code}
                                onChange={onCodeChange}
                                fullWidth
                                required
                                variant='filled'
                                autoComplete='off'
                                inputProps={{
                                    inputMode: 'numeric',
                                    pattern: '[0-9\\s]*',
                                    minLength: 6,
                                    style: { fontFamily: 'monospace', fontSize: '1.6rem', letterSpacing: '0.35em', textAlign: 'center' }
                                }}
                                sx={fieldSx}
                            />

                            <Button
                                type='submit'
                                variant='contained'
                                fullWidth
                                disabled={submitting}
                                startIcon={submitting ? <CircularProgress size={16} color='inherit' /> : <VpnKeyIcon />}
                                sx={primaryButtonSx}
                            >
                                {globalize.translate('Authorize')}
                            </Button>
                        </form>
                    )}
                </Card>
            </Box>
        </Page>
    );
};

export default QuickConnectPage;
