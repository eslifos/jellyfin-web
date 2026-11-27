import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase, { type ButtonBaseActions } from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import PhonelinkLockIcon from '@mui/icons-material/PhonelinkLock';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useCustomLogo } from 'utils/customLogo';

import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import appSettings from 'scripts/settings/appSettings';
import Dashboard from 'utils/dashboard';
import { getPostLoginUrl } from 'utils/profiles';
import WizardBackground from 'apps/wizard/components/WizardBackground';
import { ambientAnimation } from 'utils/reducedMotion';
import { TEXT_TERTIARY } from 'themes/cosmic/textColors';

interface PublicUser {
    Id?: string | null;
    Name?: string | null;
    HasPassword?: boolean | null;
    PrimaryImageTag?: string | null;
}

const LoginPage = () => {
    const { bannerUrl: bannerLight } = useCustomLogo();
    const [ searchParams ] = useSearchParams();
    const navigate = useNavigate();
    const [ qcCode, setQcCode ] = useState<string | null>(null);
    const [ users, setUsers ] = useState<PublicUser[]>([]);
    const [ loading, setLoading ] = useState(true);
    const [ showManual, setShowManual ] = useState(false);
    const [ username, setUsername ] = useState('');
    const [ password, setPassword ] = useState('');
    const [ rememberMe, setRememberMe ] = useState(appSettings.enableAutoLogin());
    const [ submitting, setSubmitting ] = useState(false);
    const [ error, setError ] = useState('');
    const [ quickConnectEnabled, setQuickConnectEnabled ] = useState(false);
    const quickConnectTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const getApiClient = useCallback(() => {
        const serverId = searchParams.get('serverid');
        if (serverId) return ServerConnections.getOrCreateApiClient(serverId);
        return ServerConnections.currentApiClient();
    }, [ searchParams ]);

    const getTargetUrl = useCallback(() => {
        const url = searchParams.get('url');
        if (url) {
            try { return decodeURIComponent(url); } catch { /* ignore */ }
        }
        return '/home';
    }, [ searchParams ]);

    useEffect(() => {
        const apiClient = getApiClient();
        if (!apiClient) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (apiClient as any).getQuickConnect('Enabled')
            .then((enabled: boolean) => setQuickConnectEnabled(enabled === true))
            .catch(() => { /* not critical */ });

        apiClient.getPublicUsers()
            .then((result: PublicUser[]) => {
                setUsers(result ?? []);
                if (!result?.length) setShowManual(true);
            })
            .catch(() => setShowManual(true))
            .finally(() => setLoading(false));
    }, [ getApiClient ]);

    const login = useCallback(async (name: string, pass: string) => {
        const apiClient = getApiClient();
        if (!apiClient) return;
        setSubmitting(true);
        setError('');
        try {
            const result = await apiClient.authenticateUserByName(name, pass);
            appSettings.enableAutoLogin(rememberMe);
            Dashboard.onServerChanged(result.User?.Id, result.AccessToken, apiClient);
            Dashboard.navigate(await getPostLoginUrl(getTargetUrl(), apiClient));
        } catch (e: unknown) {
            const status = (e as { status?: number })?.status;
            if (status === 401) setError(globalize.translate('MessageInvalidUser'));
            else if (status === 403) setError(globalize.translate('MessageUnauthorizedUser'));
            else setError(globalize.translate('MessageUnableToConnectToServer'));
        } finally {
            setSubmitting(false);
        }
    }, [ getApiClient, getTargetUrl, rememberMe ]);

    const onUserCard = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const user = users.find(u => (u.Id ?? '') === e.currentTarget.dataset.userId);
        if (!user) return;
        if (!user.HasPassword) {
            void login(user.Name ?? '', '');
        } else {
            setUsername(user.Name ?? '');
            setShowManual(true);
        }
    }, [ login, users ]);

    // On opening (and when coming back from the form) the first profile has the focus: Enter signs in with it,
    // the arrows of a TV remote move from there. Shown as focused, since there was no pointer yet.
    const firstCard = useRef<ButtonBaseActions>(null);
    const showCards = !loading && !showManual && users.length > 0;
    useEffect(() => {
        if (showCards) firstCard.current?.focusVisible();
    }, [ showCards ]);

    // The form opened: a profile chosen leaves only its password to type, else the name comes first
    const usernameInput = useRef<HTMLInputElement>(null);
    const passwordInput = useRef<HTMLInputElement>(null);
    const showForm = !loading && !showCards;
    useEffect(() => {
        if (!showForm) return;
        (usernameInput.current?.value ? passwordInput.current : usernameInput.current)?.focus();
    }, [ showForm ]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void login(username, password);
    };

    const handleQuickConnect = () => {
        const apiClient = getApiClient();
        if (!apiClient) return;

        const url = apiClient.getUrl('/QuickConnect/Initiate');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (apiClient as any).ajax({ type: 'POST', url }, true)
            .then((res: Response) => res.json())
            .then((json: { Secret?: string; Code?: string }) => {
                if (!json.Secret || !json.Code) return;
                setQcCode(json.Code);
                const connectUrl = apiClient.getUrl(`/QuickConnect/Connect?Secret=${json.Secret}`);
                quickConnectTimer.current = setInterval(async () => {
                    const data = await apiClient.getJSON(connectUrl) as { Authenticated: boolean; Secret: string };
                    if (data.Authenticated) {
                        clearInterval(quickConnectTimer.current!);
                        setQcCode(null);
                        const result = await apiClient.quickConnect(data.Secret);
                        Dashboard.onServerChanged(result.User?.Id, result.AccessToken, apiClient);
                        Dashboard.navigate(await getPostLoginUrl(getTargetUrl(), apiClient));
                    }
                }, 5000);
            })
            .catch(() => setError(globalize.translate('QuickConnectNotActive')));
    };

    const buttonSx = {
        width: '100%',
        borderRadius: 2,
        py: 1.2,
        fontWeight: 600,
        fontSize: '0.95rem',
        background: 'linear-gradient(135deg, #00a4dc, #0077b6)',
        '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(0,164,220,0.4)' }
    };

    // Pointer over it or keyboard / remote focus on it: the same lift, plus a bright ring seen across a room
    const cardActive = {
        background: 'rgba(0,164,220,0.1)', borderColor: 'rgba(0,164,220,0.5)', transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
    };
    const userCardSx = {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        cursor: 'pointer', p: 2, borderRadius: 3, minWidth: 100,
        color: 'inherit', font: 'inherit',
        border: '1px solid rgba(0,164,220,0.2)',
        background: 'rgba(255,255,255,0.04)',
        transition: 'all 0.2s',
        '&:hover': cardActive,
        '&:focus-visible, &.Mui-focusVisible': {
            ...cardActive,
            outline: 'none',
            borderColor: '#00a4dc',
            boxShadow: '0 0 0 3px #00a4dc, 0 0 28px 6px rgba(0,164,220,0.65), 0 8px 24px rgba(0,0,0,0.3)',
            '& .MuiAvatar-root': { borderColor: '#00a4dc' }
        }
    };

    const ghostSx = {
        width: '100%',
        borderRadius: 2,
        py: 1.1,
        fontSize: '0.88rem',
        color: 'rgba(255,255,255,0.6)',
        border: '1px solid rgba(255,255,255,0.14)',
        '&:hover': { borderColor: 'rgba(0,164,220,0.4)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' },
        // Reached with Tab or the remote: as clear as the profiles
        '&:focus-visible, &.Mui-focusVisible': {
            outline: 'none', borderColor: '#00a4dc', color: '#fff', bgcolor: 'rgba(0,164,220,0.16)',
            boxShadow: '0 0 0 3px #00a4dc, 0 0 22px 4px rgba(0,164,220,0.55)'
        }
    };

    const bgPortal = createPortal(
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 18% 45%, rgba(0,55,85,0.65) 0%, transparent 55%), radial-gradient(ellipse at 82% 18%, rgba(75,0,105,0.55) 0%, transparent 55%), #080810'
        }}>
            <svg viewBox='0 0 1440 900' preserveAspectRatio='xMidYMid slice' xmlns='http://www.w3.org/2000/svg' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <defs>
                    <filter id='jf-lf1' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='75'/></filter>
                    <filter id='jf-lf2' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='95'/></filter>
                    <filter id='jf-lf3' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='80'/></filter>
                    <radialGradient id='jf-lga' cx='50%' cy='50%' r='50%'><stop offset='0%' stopColor='#00a4dc' stopOpacity='0.55'/><stop offset='100%' stopColor='#00a4dc' stopOpacity='0'/></radialGradient>
                    <radialGradient id='jf-lgb' cx='50%' cy='50%' r='50%'><stop offset='0%' stopColor='#aa5cc3' stopOpacity='0.5'/><stop offset='100%' stopColor='#aa5cc3' stopOpacity='0'/></radialGradient>
                    <radialGradient id='jf-lgc' cx='50%' cy='50%' r='50%'><stop offset='0%' stopColor='#0077b6' stopOpacity='0.38'/><stop offset='100%' stopColor='#0077b6' stopOpacity='0'/></radialGradient>
                    <pattern id='jf-ldp' x='0' y='0' width='40' height='40' patternUnits='userSpaceOnUse'><circle cx='2' cy='2' r='1' fill='rgba(255,255,255,0.05)'/></pattern>
                </defs>
                <ellipse className='jf-blob-1' cx='220' cy='240' rx='340' ry='280' fill='url(#jf-lga)' filter='url(#jf-lf1)'/>
                <ellipse className='jf-blob-2' cx='1200' cy='680' rx='380' ry='300' fill='url(#jf-lgb)' filter='url(#jf-lf2)'/>
                <ellipse className='jf-blob-3' cx='780' cy='420' rx='300' ry='240' fill='url(#jf-lgc)' filter='url(#jf-lf3)'/>
                <rect width='100%' height='100%' fill='url(#jf-ldp)'/>
            </svg>
        </div>,
        document.body
    );

    return (
        <>
            {bgPortal}

            {/* QuickConnect code dialog */}
            <Dialog
                open={!!qcCode}
                onClose={() => { setQcCode(null); if (quickConnectTimer.current) clearInterval(quickConnectTimer.current); }}
                sx={{ zIndex: 10001 }}
                PaperProps={{
                    sx: {
                        background: 'rgba(8,10,22,0.93)', backdropFilter: 'blur(28px) saturate(1.5)',
                        border: '1px solid rgba(0,164,220,0.25)', borderRadius: '20px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.7)', minWidth: 320, zIndex: 10000,
                        '&::before': { content: '""', position: 'absolute', top: 0, left: '2rem', right: '2rem', height: '2px', background: 'linear-gradient(90deg, transparent, #00a4dc 40%, #aa5cc3 60%, transparent)', borderRadius: '0 0 4px 4px' }
                    }
                }}
            >
                <DialogContent sx={{ textAlign: 'center', pt: 4, pb: 4, px: 4 }}>
                    <PhonelinkLockIcon sx={{ fontSize: '3rem', color: '#00a4dc', mb: 2, filter: 'drop-shadow(0 0 12px rgba(0,164,220,0.5))' }} />
                    <Typography variant='h6' sx={{ fontWeight: 700, mb: 1, background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        {globalize.translate('QuickConnect')}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem', mb: 2.5 }}>
                        {globalize.translate('LoginQuickConnectCodeHelp')}
                    </Typography>
                    <Box sx={{ background: 'rgba(0,164,220,0.1)', border: '1px solid rgba(0,164,220,0.3)', borderRadius: 2, py: 2, px: 3, mb: 2.5 }}>
                        <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '0.3em', color: '#00a4dc', fontFamily: 'monospace' }}>
                            {qcCode}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', mb: 2 }}>
                        <CircularProgress size={14} sx={{ color: '#00a4dc' }} />
                        <Typography sx={{ color: TEXT_TERTIARY, fontSize: '0.78rem' }}>
                            {globalize.translate('LoginWaitingAuthorization')}
                        </Typography>
                    </Box>
                    <Button
                        onClick={() => { setQcCode(null); if (quickConnectTimer.current) clearInterval(quickConnectTimer.current); }}
                        sx={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2, fontSize: '0.82rem', '&:hover': { borderColor: 'rgba(0,164,220,0.4)', color: '#00a4dc' } }}
                    >
                        {globalize.translate('ButtonCancel')}
                    </Button>
                </DialogContent>
            </Dialog>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 9999, p: 2, overflowY: 'auto' }}>

                {/* Logo */}
                <Box
                    sx={{
                        width: 220, height: 56, mb: 2.5, flexShrink: 0, zIndex: 9999, position: 'relative',
                        backgroundImage: `url(${bannerLight as string})`,
                        backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
                        ...ambientAnimation('jf-logo-glow 3s ease-in-out infinite, jf-float-logo 4s ease-in-out infinite')
                    }}
                    aria-label='Jellyfin Cosmic'
                />

                {/* Tarjeta */}
                <Paper
                    elevation={0}
                    sx={{
                        width: '100%', maxWidth: 480, zIndex: 9999, position: 'relative',
                        background: 'rgba(10,12,22,0.80)',
                        backdropFilter: 'blur(28px) saturate(1.5)',
                        WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
                        border: '1px solid rgba(0,164,220,0.2)',
                        borderRadius: 3,
                        p: { xs: 3, sm: 4 },
                        ...ambientAnimation('jf-glow-pulse 4s ease-in-out infinite'),
                        '&::before': { content: '""', position: 'absolute', top: 0, left: '2rem', right: '2rem', height: '2px', background: 'linear-gradient(90deg, transparent, #00a4dc 40%, #aa5cc3 60%, transparent)', borderRadius: '0 0 4px 4px' }
                    }}
                >
                    <Typography variant='h5' sx={{ fontWeight: 700, mb: 3, textAlign: 'center', background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        {globalize.translate('HeaderPleaseSignIn')}
                    </Typography>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress sx={{ color: '#00a4dc' }} />
                        </Box>
                    ) : showCards ? (
                    /* Tarjetas de usuarios */
                        <>
                            {/* TV remote: left / right stay among the profiles, down goes to the buttons below */}
                            <Box className='focuscontainer-x' sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', mb: 3 }}>
                                {users.map((user, index) => (
                                // A real button: Tab, the arrows of a TV remote (focusManager looks for buttons) and Enter
                                    <ButtonBase
                                        key={user.Id}
                                        data-user-id={user.Id ?? ''}
                                        onClick={onUserCard}
                                        action={index === 0 ? firstCard : undefined}
                                        aria-label={user.Name ?? ''}
                                        sx={userCardSx}
                                    >
                                        <Avatar
                                            src={user.PrimaryImageTag && user.Id ? ServerConnections.currentApiClient()?.getUserImageUrl(user.Id, { width: 120, tag: user.PrimaryImageTag, type: 'Primary' }) : undefined}
                                            sx={{ width: 64, height: 64, bgcolor: 'rgba(0,164,220,0.3)', border: '2px solid rgba(0,164,220,0.3)' }}
                                        >
                                            <PersonIcon sx={{ fontSize: '2rem' }} />
                                        </Avatar>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 500 }}>
                                            {user.Name}
                                        </Typography>
                                    </ButtonBase>
                                ))}
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                                <Button variant='outlined' onClick={() => { setUsername(''); setShowManual(true); }} sx={ghostSx}>
                                    {globalize.translate('ButtonManualLogin')}
                                </Button>
                                {quickConnectEnabled && (
                                    <Button variant='outlined' onClick={handleQuickConnect} sx={ghostSx}>
                                        {globalize.translate('ButtonUseQuickConnect')}
                                    </Button>
                                )}
                            </Box>
                        </>
                    ) : (
                    /* Formulario manual */
                        <Box component='form' onSubmit={handleSubmit}>
                            <TextField
                                label={globalize.translate('LabelUser')}
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                fullWidth variant='filled'
                                autoComplete='username'
                                inputRef={usernameInput}
                                inputProps={{ autoCapitalize: 'off' }}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                label={globalize.translate('LabelPassword')}
                                type='password'
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                fullWidth variant='filled'
                                autoComplete='current-password'
                                inputRef={passwordInput}
                                error={!!error}
                                helperText={error || ' '}
                                sx={{ mb: 1 }}
                            />
                            <FormControlLabel
                                control={<Checkbox checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} sx={{ color: TEXT_TERTIARY, '&.Mui-checked': { color: '#00a4dc' } }} />}
                                label={<Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.65)' }}>{globalize.translate('RememberMe')}</Typography>}
                                sx={{ mb: 2 }}
                            />
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                                <Button type='submit' variant='contained' disabled={submitting} sx={buttonSx}
                                    endIcon={submitting ? <CircularProgress size={16} color='inherit' /> : <LockIcon />}>
                                    {globalize.translate('ButtonSignIn')}
                                </Button>
                                {users.length > 0 && (
                                    <Button variant='outlined' onClick={() => setShowManual(false)} sx={ghostSx}>
                                        {globalize.translate('ButtonCancel')}
                                    </Button>
                                )}
                                {quickConnectEnabled && (
                                    <Button variant='outlined' onClick={handleQuickConnect} sx={ghostSx}>
                                        {globalize.translate('ButtonUseQuickConnect')}
                                    </Button>
                                )}
                                <Button variant='outlined' onClick={() => navigate('/forgotpassword')} sx={ghostSx}>
                                    {globalize.translate('ButtonForgotPassword')}
                                </Button>
                                <Button variant='outlined' onClick={() => navigate('/selectserver')} sx={ghostSx}>
                                    {globalize.translate('ButtonChangeServer')}
                                </Button>
                            </Box>
                        </Box>
                    )}
                </Paper>
            </Box>
        </>
    );
};

export default LoginPage;
