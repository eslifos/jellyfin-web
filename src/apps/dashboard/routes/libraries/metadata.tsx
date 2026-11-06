import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageResolution } from '@jellyfin/sdk/lib/generated-client/models/image-resolution';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Icon from '@mui/material/Icon';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LanguageIcon from '@mui/icons-material/Language';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SaveIcon from '@mui/icons-material/Save';
import TranslateIcon from '@mui/icons-material/Translate';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';

import { useCountries } from 'apps/dashboard/features/libraries/api/useCountries';
import { useCultures } from 'apps/dashboard/features/libraries/api/useCultures';
import { useVirtualFolders } from 'apps/dashboard/features/libraries/api/useVirtualFolders';
import { getLibraryAccent } from 'apps/dashboard/features/libraries/utils/libraryUi';
import { getImageResolutionOptions } from 'apps/dashboard/features/libraries/utils/metadataOptions';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY, useConfiguration } from 'hooks/useConfiguration';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { ActionData } from 'types/actionData';
import { getLibraryIcon } from 'utils/image';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard } from '../../components/cosmic';

const COLORS = {
    language: '#00a4dc',
    chapters: '#ff9800',
    libraries: '#aa5cc3'
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    const { data: config } = await getSystemApi(api).getConfiguration();

    config.PreferredMetadataLanguage = data.Language.toString();
    config.MetadataCountryCode = data.Country.toString();
    config.DummyChapterDuration = parseInt(data.DummyChapterDuration.toString(), 10);
    config.ChapterImageResolution = data.ChapterImageResolution.toString() as ImageResolution;

    await getSystemApi(api)
        .updateConfiguration({ serverConfiguration: config });

    void queryClient.invalidateQueries({
        queryKey: [ QUERY_KEY ]
    });

    return {
        isSaved: true
    };
};

export const Component = () => {
    const {
        data: config,
        isPending: isConfigPending,
        isError: isConfigError
    } = useConfiguration();
    const {
        data: cultures,
        isPending: isCulturesPending,
        isError: isCulturesError
    } = useCultures();
    const {
        data: countries,
        isPending: isCountriesPending,
        isError: isCountriesError
    } = useCountries();
    const { data: virtualFolders } = useVirtualFolders();

    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const isSubmitting = navigation.state === 'submitting';
    const [ saved, setSaved ] = useState(false);

    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    const closeSaved = useCallback(() => setSaved(false), []);

    const imageResolutions = getImageResolutionOptions();

    const languageName = useCallback((code?: string | null) => (
        cultures?.find(c => c.TwoLetterISOLanguageName === code)?.DisplayName || code || ''
    ), [ cultures ]);
    const countryName = useCallback((code?: string | null) => (
        countries?.find(c => c.TwoLetterISORegionName === code)?.DisplayName || code || ''
    ), [ countries ]);

    const overrides = useMemo(() => (virtualFolders || []).map(folder => ({
        id: folder.ItemId || folder.Name || '',
        name: folder.Name || '',
        type: folder.CollectionType,
        language: folder.LibraryOptions?.PreferredMetadataLanguage,
        country: folder.LibraryOptions?.MetadataCountryCode
    })), [ virtualFolders ]);

    if (isConfigPending || isCulturesPending || isCountriesPending) {
        return <Loading />;
    }

    return (
        <Page
            id='metadataImagesConfigurationPage'
            title={globalize.translate('LabelMetadata')}
            className='type-interior mainAnimatedPage'
        >
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('LabelMetadata')}
                    subtitle={`${globalize.translate('LibCurrentDefault')}: ${languageName(config?.PreferredMetadataLanguage) || '—'} · ${countryName(config?.MetadataCountryCode) || '—'}`}
                />

                {isConfigError || isCulturesError || isCountriesError ? (
                    <Alert severity='error'>{globalize.translate('MetadataImagesLoadError')}</Alert>
                ) : (
                    <Form method='POST' style={{ maxWidth: 'none' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
                            <Stack spacing={2.5}>
                                <SectionCard
                                    title={globalize.translate('HeaderPreferredMetadataLanguage')}
                                    icon={<TranslateIcon />}
                                    accentColor={COLORS.language}
                                    description={globalize.translate('DefaultMetadataLangaugeDescription')}
                                >
                                    <Stack spacing={2.5}>
                                        <TextField
                                            name='Language'
                                            label={globalize.translate('LabelLanguage')}
                                            defaultValue={config.PreferredMetadataLanguage}
                                            select
                                            fullWidth
                                        >
                                            {cultures.map(culture => (
                                                <MenuItem key={culture.TwoLetterISOLanguageName} value={culture.TwoLetterISOLanguageName}>
                                                    {culture.DisplayName}
                                                </MenuItem>
                                            ))}
                                        </TextField>

                                        <TextField
                                            name='Country'
                                            label={globalize.translate('LabelCountry')}
                                            defaultValue={config.MetadataCountryCode}
                                            select
                                            fullWidth
                                        >
                                            {countries.map(country => (
                                                <MenuItem key={country.DisplayName} value={country.TwoLetterISORegionName || ''}>
                                                    {country.DisplayName}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Stack>
                                </SectionCard>

                                <SectionCard
                                    title={globalize.translate('HeaderDummyChapter')}
                                    icon={<PhotoLibraryIcon />}
                                    accentColor={COLORS.chapters}
                                    description={globalize.translate('LibChaptersHelp')}
                                >
                                    <Stack spacing={2.5}>
                                        <TextField
                                            name='DummyChapterDuration'
                                            defaultValue={config.DummyChapterDuration}
                                            type='number'
                                            fullWidth
                                            label={globalize.translate('LabelDummyChapterDuration')}
                                            helperText={globalize.translate('LabelDummyChapterDurationHelp')}
                                            slotProps={{
                                                htmlInput: {
                                                    min: 0,
                                                    required: true
                                                }
                                            }}
                                        />

                                        <TextField
                                            name='ChapterImageResolution'
                                            select
                                            fullWidth
                                            defaultValue={config.ChapterImageResolution}
                                            label={globalize.translate('LabelChapterImageResolution')}
                                            helperText={globalize.translate('LabelChapterImageResolutionHelp')}
                                        >
                                            {imageResolutions.map(resolution => (
                                                <MenuItem key={resolution.name} value={resolution.value}>{resolution.name}</MenuItem>
                                            ))}
                                        </TextField>
                                    </Stack>
                                </SectionCard>
                            </Stack>

                            <SectionCard
                                title={globalize.translate('LibPerLibraryLanguage')}
                                icon={<LanguageIcon />}
                                accentColor={COLORS.libraries}
                                description={globalize.translate('LibPerLibraryLanguageHelp')}
                            >
                                <Stack spacing={1}>
                                    {overrides.length === 0 && (
                                        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('LibNoLibraries')}</Typography>
                                    )}
                                    {overrides.map(lib => {
                                        const accent = getLibraryAccent(lib.type);
                                        const inherits = !lib.language && !lib.country;
                                        return (
                                            <Box key={lib.id} sx={{
                                                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                                            }}>
                                                <Box sx={{
                                                    width: 34, height: 34, borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent
                                                }}>
                                                    <Icon sx={{ fontSize: '1.1rem' }}>{getLibraryIcon(lib.type)}</Icon>
                                                </Box>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{lib.name}</Typography>
                                                    <Typography noWrap sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                                        {inherits ?
                                                            `${languageName(config.PreferredMetadataLanguage)} · ${countryName(config.MetadataCountryCode)}` :
                                                            `${languageName(lib.language || config.PreferredMetadataLanguage)} · ${countryName(lib.country || config.MetadataCountryCode)}`}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    size='small'
                                                    label={inherits ? globalize.translate('LibInherited') : globalize.translate('LibCustom')}
                                                    sx={{
                                                        height: 22, fontSize: '0.68rem', fontWeight: 600,
                                                        color: inherits ? 'rgba(255,255,255,0.6)' : COLORS.libraries,
                                                        background: inherits ? 'rgba(255,255,255,0.05)' : `${COLORS.libraries}1f`,
                                                        border: `1px solid ${inherits ? 'rgba(255,255,255,0.1)' : COLORS.libraries + '55'}`
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            </SectionCard>
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

Component.displayName = 'MetadataImagesPage';
