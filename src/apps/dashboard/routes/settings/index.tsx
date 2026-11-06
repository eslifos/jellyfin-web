import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import DnsIcon from '@mui/icons-material/Dns';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import PhonelinkLockIcon from '@mui/icons-material/PhonelinkLock';
import SaveIcon from '@mui/icons-material/Save';
import SpeedIcon from '@mui/icons-material/Speed';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import React, { useCallback, useEffect, useState } from 'react';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';

import { useLocalizationOptions } from 'apps/dashboard/features/settings/api/useLocalizationOptions';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import DirectoryBrowser from 'components/directorybrowser/directorybrowser';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY as CONFIGURATION_QUERY_KEY, useConfiguration } from 'hooks/useConfiguration';
import { QUERY_KEY as SYSTEM_INFO_QUERY_KEY } from 'hooks/useSystemInfo';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const { data: config } = await getSystemApi(api).getConfiguration();
    const formData = await request.formData();

    config.ServerName = formData.get('ServerName')?.toString();
    config.UICulture = formData.get('UICulture')?.toString();
    config.CachePath = formData.get('CachePath')?.toString();
    config.MetadataPath = formData.get('MetadataPath')?.toString();
    config.QuickConnectAvailable = formData.get('QuickConnectAvailable')?.toString() === 'on';
    config.LibraryScanFanoutConcurrency = parseInt(formData.get('LibraryScanFanoutConcurrency')?.toString() || '0', 10);
    config.ParallelImageEncodingLimit = parseInt(formData.get('ParallelImageEncodingLimit')?.toString() || '0', 10);

    await getSystemApi(api)
        .updateConfiguration({ serverConfiguration: config });

    void queryClient.invalidateQueries({
        queryKey: [ CONFIGURATION_QUERY_KEY ]
    });
    void queryClient.invalidateQueries({
        queryKey: [ SYSTEM_INFO_QUERY_KEY ]
    });

    return {
        isSaved: true
    };
};

const COLORS = {
    server: '#00a4dc',
    paths: '#26c6da',
    quickConnect: '#aa5cc3',
    performance: '#ff9800'
};

const BrowseButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <InputAdornment position='end'>
        <Tooltip title={label}>
            <IconButton edge='end' onClick={onClick} sx={{ color: COLORS.paths }}>
                <FolderOpenIcon />
            </IconButton>
        </Tooltip>
    </InputAdornment>
);

export const Component = () => {
    const {
        data: config,
        isPending: isConfigPending,
        isError: isConfigError
    } = useConfiguration();
    const {
        data: languageOptions,
        isPending: isLocalizationOptionsPending,
        isError: isLocalizationOptionsError
    } = useLocalizationOptions();

    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const isSubmitting = navigation.state === 'submitting';
    const [ cachePath, setCachePath ] = useState<string | null | undefined>('');
    const [ metadataPath, setMetadataPath ] = useState<string | null | undefined>('');
    const [ saved, setSaved ] = useState(false);

    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    const onCachePathChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setCachePath(event.target.value);
    }, []);

    const onMetadataPathChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setMetadataPath(event.target.value);
    }, []);

    const showCachePathPicker = useCallback(() => {
        const picker = new DirectoryBrowser();

        picker.show({
            callback: function (path: string) {
                if (path) {
                    setCachePath(path);
                }

                picker.close();
            },
            validateWriteable: true,
            header: globalize.translate('HeaderSelectServerCachePath'),
            instruction: globalize.translate('HeaderSelectServerCachePathHelp')
        });
    }, []);

    const showMetadataPathPicker = useCallback(() => {
        const picker = new DirectoryBrowser();

        picker.show({
            path: metadataPath,
            callback: function (path: string) {
                if (path) {
                    setMetadataPath(path);
                }

                picker.close();
            },
            validateWriteable: true,
            header: globalize.translate('HeaderSelectMetadataPath'),
            instruction: globalize.translate('HeaderSelectMetadataPathHelp')
        });
    }, [metadataPath]);

    const closeSaved = useCallback(() => setSaved(false), []);

    useEffect(() => {
        if (!isConfigPending && !isConfigError) {
            setCachePath(config.CachePath);
            setMetadataPath(config.MetadataPath);
        }
    }, [config, isConfigPending, isConfigError]);

    if (isConfigPending || isLocalizationOptionsPending) {
        return <Loading />;
    }

    return (
        <Page
            id='dashboardGeneralPage'
            title={globalize.translate('General')}
            className='type-interior mainAnimatedPage'
        >
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={globalize.translate('General')} subtitle={globalize.translate('Settings')} />

                {isConfigError || isLocalizationOptionsError ? (
                    <Alert severity='error'>{globalize.translate('SettingsPageLoadError')}</Alert>
                ) : (
                    <Form method='POST' style={{ maxWidth: 'none' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
                            {/* ── Columna izquierda ── */}
                            <Stack spacing={2.5}>
                                <SectionCard title={globalize.translate('TabServer')} icon={<DnsIcon />} accentColor={COLORS.server}>
                                    <Stack spacing={2.5}>
                                        <TextField
                                            name='ServerName'
                                            label={globalize.translate('LabelServerName')}
                                            helperText={globalize.translate('LabelServerNameHelp')}
                                            defaultValue={config.ServerName}
                                            fullWidth
                                        />

                                        <TextField
                                            select
                                            name='UICulture'
                                            label={globalize.translate('LabelPreferredDisplayLanguage')}
                                            helperText={(
                                                <>
                                                    <span>{globalize.translate('LabelDisplayLanguageHelp')}</span>
                                                    <Link href='https://jellyfin.org/docs/general/contributing/#translating' target='_blank' sx={{ color: COLORS.server }}>
                                                        {globalize.translate('LearnHowYouCanContribute')}
                                                    </Link>
                                                </>
                                            )}
                                            defaultValue={config.UICulture}
                                            fullWidth
                                            slotProps={{
                                                formHelperText: { component: Stack }
                                            }}
                                        >
                                            {languageOptions.map((language) =>
                                                <MenuItem key={language.Name} value={language.Value || ''}>{language.Name}</MenuItem>
                                            )}
                                        </TextField>
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('HeaderPaths')} icon={<FolderSpecialIcon />} accentColor={COLORS.paths}>
                                    <Stack spacing={2.5}>
                                        <TextField
                                            name='CachePath'
                                            label={globalize.translate('LabelCachePath')}
                                            helperText={globalize.translate('LabelCachePathHelp')}
                                            value={cachePath}
                                            onChange={onCachePathChange}
                                            fullWidth
                                            slotProps={{
                                                input: {
                                                    endAdornment: <BrowseButton onClick={showCachePathPicker} label={globalize.translate('HeaderSelectServerCachePath')} />
                                                }
                                            }}
                                        />

                                        <TextField
                                            name='MetadataPath'
                                            label={globalize.translate('LabelMetadataPath')}
                                            helperText={globalize.translate('LabelMetadataPathHelp')}
                                            value={metadataPath}
                                            onChange={onMetadataPathChange}
                                            fullWidth
                                            slotProps={{
                                                input: {
                                                    endAdornment: <BrowseButton onClick={showMetadataPathPicker} label={globalize.translate('HeaderSelectMetadataPath')} />
                                                }
                                            }}
                                        />
                                    </Stack>
                                </SectionCard>
                            </Stack>

                            {/* ── Columna derecha ── */}
                            <Stack spacing={2.5}>
                                <SectionCard title={globalize.translate('QuickConnect')} icon={<PhonelinkLockIcon />} accentColor={COLORS.quickConnect}>
                                    <ToggleRow
                                        name='QuickConnectAvailable'
                                        label={globalize.translate('EnableQuickConnect')}
                                        description={globalize.translate('QuickConnectDescription')}
                                        defaultChecked={config.QuickConnectAvailable}
                                        color={COLORS.quickConnect}
                                    />
                                </SectionCard>

                                <SectionCard title={globalize.translate('HeaderPerformance')} icon={<SpeedIcon />} accentColor={COLORS.performance}>
                                    <Stack spacing={2.5}>
                                        <TextField
                                            name='LibraryScanFanoutConcurrency'
                                            type='number'
                                            label={globalize.translate('LibraryScanFanoutConcurrency')}
                                            helperText={globalize.translate('LibraryScanFanoutConcurrencyHelp')}
                                            defaultValue={config.LibraryScanFanoutConcurrency || ''}
                                            fullWidth
                                            slotProps={{
                                                htmlInput: {
                                                    min: 0,
                                                    step: 1
                                                }
                                            }}
                                        />

                                        <TextField
                                            name='ParallelImageEncodingLimit'
                                            type='number'
                                            label={globalize.translate('LabelParallelImageEncodingLimit')}
                                            helperText={globalize.translate('LabelParallelImageEncodingLimitHelp')}
                                            defaultValue={config.ParallelImageEncodingLimit || ''}
                                            fullWidth
                                            slotProps={{
                                                htmlInput: {
                                                    min: 0,
                                                    step: 1
                                                }
                                            }}
                                        />
                                    </Stack>
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
                    </Form>
                )}
            </Box>

            <SavedSnackbar open={saved} onClose={closeSaved} />
        </Page>
    );
};

Component.displayName = 'SettingsPage';
