import type { BrandingOptionsDto } from '@jellyfin/sdk/lib/generated-client/models/branding-options-dto';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import CodeIcon from '@mui/icons-material/Code';
import Delete from '@mui/icons-material/Delete';
import LoginIcon from '@mui/icons-material/Login';
import SaveIcon from '@mui/icons-material/Save';
import Upload from '@mui/icons-material/Upload';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import React, { useCallback, useEffect, useState } from 'react';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';

import { getBrandingOptionsQuery, QUERY_KEY, useBrandingOptions } from 'apps/dashboard/features/branding/api/useBrandingOptions';
import Loading from 'components/loading/LoadingComponent';
import Image from 'components/Image';
import Page from 'components/Page';
import { SPLASHSCREEN_URL } from 'constants/branding';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { queryClient } from 'utils/query/queryClient';
import { ActionData } from 'types/actionData';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';
import LogoCard from '../../features/branding/components/LogoCard';

const COLORS = {
    splash: '#aa5cc3',
    disclaimer: '#00a4dc',
    css: '#4caf50'
};

const outlinedSx = (color: string) => ({
    fontWeight: 600,
    color,
    borderColor: `${color}55`,
    background: `${color}10`,
    '&:hover': { borderColor: color, background: `${color}22` }
});

const BRANDING_CONFIG_KEY = 'branding';
const BrandingOption = {
    CustomCss: 'CustomCss',
    LoginDisclaimer: 'LoginDisclaimer',
    SplashscreenEnabled: 'SplashscreenEnabled'
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    const brandingOptions: BrandingOptionsDto = {
        CustomCss: data.CustomCss?.toString(),
        LoginDisclaimer: data.LoginDisclaimer?.toString(),
        SplashscreenEnabled: data.SplashscreenEnabled?.toString() === 'on'
    };

    await getSystemApi(api)
        .updateNamedConfiguration({
            key: BRANDING_CONFIG_KEY,
            body: JSON.stringify(brandingOptions)
        });

    void queryClient.invalidateQueries({
        queryKey: [ QUERY_KEY ]
    });

    return {
        isSaved: true
    };
};

export const loader = async () => {
    const api = ServerConnections.getApi();
    if (!api) return {};

    return queryClient.ensureQueryData(
        getBrandingOptionsQuery(api));
};

export const Component = () => {
    const { api } = useApi();
    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const isSubmitting = navigation.state === 'submitting';

    const {
        data: defaultBrandingOptions,
        isPending,
        isError
    } = useBrandingOptions();
    const [ brandingOptions, setBrandingOptions ] = useState(defaultBrandingOptions || {});

    const [ error, setError ] = useState<string>();

    const [ isSplashscreenEnabled, setIsSplashscreenEnabled ] = useState(brandingOptions.SplashscreenEnabled ?? false);
    const [ splashscreenUrl, setSplashscreenUrl ] = useState<string>();
    useEffect(() => {
        if (!api || isSubmitting) return;

        setSplashscreenUrl(api.getUri(SPLASHSCREEN_URL, { t: Date.now() }));
    }, [ api, isSubmitting ]);

    const onSplashscreenDelete = useCallback(() => {
        setError(undefined);

        if (!api) return;

        getImageApi(api)
            .deleteCustomSplashscreen()
            .then(() => {
                setSplashscreenUrl(api.getUri(SPLASHSCREEN_URL, { t: Date.now() }));
            })
            .catch(e => {
                console.error('[BrandingPage] error deleting image', e);
                setError('ImageDeleteFailed');
            });
    }, [ api ]);

    const onSplashscreenUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setError(undefined);

        const files = event.target.files;

        if (!api || !files) return false;

        const file = files[0];
        const reader = new FileReader();
        reader.onerror = e => {
            console.error('[BrandingPage] error reading file', e);
            setError('ImageUploadFailed');
        };
        reader.onabort = e => {
            console.warn('[BrandingPage] aborted reading file', e);
            setError('ImageUploadCancelled');
        };
        reader.onload = () => {
            if (!reader.result) return;

            const dataUrl = reader.result as string; // readAsDataURL produces a string
            // FIXME: TypeScript SDK thinks body should be a File but in reality it is a Base64 string
            const body = dataUrl.split(',')[1] as never;
            getImageApi(api)
                .uploadCustomSplashscreen(
                    { body },
                    { headers: { ['Content-Type']: file.type } }
                )
                .then(() => {
                    setSplashscreenUrl(dataUrl);
                })
                .catch(e => {
                    console.error('[BrandingPage] error uploading splashscreen', e);
                    setError('ImageUploadFailed');
                });
        };

        reader.readAsDataURL(file);
    }, [ api ]);

    const setSplashscreenEnabled = useCallback(async (_: React.ChangeEvent<HTMLInputElement>, isEnabled: boolean) => {
        setIsSplashscreenEnabled(isEnabled);

        await getSystemApi(api!)
            .updateNamedConfiguration({
                key: BRANDING_CONFIG_KEY,
                body: JSON.stringify({
                    ...defaultBrandingOptions,
                    SplashscreenEnabled: isEnabled
                })
            });

        void queryClient.invalidateQueries({
            queryKey: [ QUERY_KEY ]
        });
    }, [ api, defaultBrandingOptions ]);

    const setBrandingOption = useCallback((event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (Object.keys(BrandingOption).includes(event.target.name)) {
            setBrandingOptions({
                ...brandingOptions,
                [event.target.name]: event.target.value
            });
        }
    }, [ brandingOptions ]);

    const onSubmit = useCallback(() => {
        setError(undefined);
    }, []);

    const onSplashscreenToggle = useCallback((isEnabled: boolean) => {
        void setSplashscreenEnabled({} as React.ChangeEvent<HTMLInputElement>, isEnabled);
    }, [ setSplashscreenEnabled ]);

    const [ saved, setSaved ] = useState(false);
    const closeSaved = useCallback(() => setSaved(false), []);
    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    if (isPending) return <Loading />;

    return (
        <Page
            id='brandingPage'
            title={globalize.translate('HeaderBranding')}
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={globalize.translate('HeaderBranding')} />

                <Form
                    method='POST'
                    onSubmit={onSubmit}
                    style={{ maxWidth: 'none' }}
                >
                    {isError ? (
                        <Alert severity='error'>{globalize.translate('BrandingLoadError')}</Alert>
                    ) : (
                        <>
                            {error && (
                                <Alert severity='error' sx={{ mb: 2.5 }}>
                                    {globalize.translate(error)}
                                </Alert>
                            )}

                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
                                {/* ── Fila completa: logo ── */}
                                <Box sx={{ gridColumn: '1 / -1' }}>
                                    <LogoCard onError={setError} />
                                </Box>

                                {/* ── Columna izquierda: pantalla de bienvenida ── */}
                                <SectionCard
                                    title={globalize.translate('EnableSplashScreen')}
                                    icon={<WallpaperIcon />}
                                    accentColor={COLORS.splash}
                                    description={globalize.translate('CustomSplashScreenSize')}
                                >
                                    <Stack spacing={2}>
                                        <ToggleRow
                                            name={BrandingOption.SplashscreenEnabled}
                                            label={globalize.translate('EnableSplashScreen')}
                                            checked={isSplashscreenEnabled}
                                            onChange={onSplashscreenToggle}
                                            color={COLORS.splash}
                                        />

                                        <Box sx={{
                                            position: 'relative', borderRadius: '16px', overflow: 'hidden',
                                            border: `1px solid ${COLORS.splash}40`, boxShadow: `0 0 24px ${COLORS.splash}14`,
                                            opacity: isSplashscreenEnabled ? 1 : 0.45, transition: 'opacity 0.25s',
                                            '& .MuiPaper-root': { border: 'none !important', borderRadius: '0 !important', background: 'rgba(0,0,0,0.35) !important' },
                                            '& img': { display: 'block', objectFit: 'cover', height: '100%' }
                                        }}>
                                            <Image
                                                isLoading={false}
                                                url={isSplashscreenEnabled ? splashscreenUrl : undefined}
                                            />
                                        </Box>

                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                                            <Button
                                                component='label'
                                                variant='outlined'
                                                startIcon={<Upload />}
                                                disabled={!isSplashscreenEnabled}
                                                sx={{ ...outlinedSx(COLORS.splash), flex: 1 }}
                                            >
                                                <input
                                                    type='file'
                                                    accept='image/*'
                                                    hidden
                                                    onChange={onSplashscreenUpload}
                                                />
                                                {globalize.translate('UploadCustomImage')}
                                            </Button>

                                            <Button
                                                variant='outlined'
                                                startIcon={<Delete />}
                                                disabled={!isSplashscreenEnabled}
                                                onClick={onSplashscreenDelete}
                                                sx={{ ...outlinedSx('#ef5350'), flex: 1 }}
                                            >
                                                {globalize.translate('DeleteCustomImage')}
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </SectionCard>

                                {/* ── Columna derecha: textos y CSS ── */}
                                <Stack spacing={2.5}>
                                    <SectionCard
                                        title={globalize.translate('LabelLoginDisclaimer')}
                                        icon={<LoginIcon />}
                                        accentColor={COLORS.disclaimer}
                                        description={globalize.translate('LabelLoginDisclaimerHelp')}
                                    >
                                        <TextField
                                            fullWidth
                                            multiline
                                            minRows={5}
                                            maxRows={10}
                                            name={BrandingOption.LoginDisclaimer}
                                            label={globalize.translate('LabelLoginDisclaimer')}
                                            value={brandingOptions?.LoginDisclaimer ?? ''}
                                            onChange={setBrandingOption}
                                        />
                                    </SectionCard>

                                    <SectionCard
                                        title={globalize.translate('LabelCustomCss')}
                                        icon={<CodeIcon />}
                                        accentColor={COLORS.css}
                                        description={globalize.translate('LabelCustomCssHelp')}
                                    >
                                        <TextField
                                            fullWidth
                                            multiline
                                            minRows={8}
                                            maxRows={24}
                                            name={BrandingOption.CustomCss}
                                            placeholder='/* CSS */'
                                            spellCheck={false}
                                            value={brandingOptions?.CustomCss ?? ''}
                                            onChange={setBrandingOption}
                                            sx={{
                                                '& .MuiOutlinedInput-root': { background: 'rgba(0,0,0,0.35)', alignItems: 'flex-start' },
                                                '& textarea': {
                                                    fontFamily: 'Consolas, "Fira Code", Menlo, Monaco, monospace',
                                                    fontSize: '0.82rem', lineHeight: 1.6, color: '#b9f6ca'
                                                }
                                            }}
                                        />
                                    </SectionCard>
                                </Stack>
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                                <Button
                                    type='submit'
                                    variant='contained'
                                    size='large'
                                    disabled={isSubmitting}
                                    startIcon={isSubmitting ? <CircularProgress size={16} color='inherit' /> : <SaveIcon />}
                                    sx={{ px: 8, py: 1.4, fontWeight: 600 }}
                                >
                                    {globalize.translate('Save')}
                                </Button>
                            </Box>
                        </>
                    )}
                </Form>
            </Box>

            <SavedSnackbar open={saved} onClose={closeSaved} />
        </Page>
    );
};

Component.displayName = 'BrandingPage';
