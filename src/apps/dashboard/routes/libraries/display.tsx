import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import EventIcon from '@mui/icons-material/Event';
import FolderIcon from '@mui/icons-material/Folder';
import RecommendIcon from '@mui/icons-material/Recommend';
import SaveIcon from '@mui/icons-material/Save';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import type { MetadataConfiguration } from '@jellyfin/sdk/lib/generated-client/models/metadata-configuration';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';

import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY as CONFIG_QUERY_KEY, useConfiguration } from 'hooks/useConfiguration';
import { QUERY_KEY as NAMED_CONFIG_QUERY_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

const CONFIG_KEY = 'metadata';

const COLORS = {
    dates: '#26c6da',
    folders: '#00a4dc',
    collections: '#aa5cc3',
    suggestions: '#ff9800'
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    const { data: config } = await getSystemApi(api).getConfiguration();

    const metadataConfig: MetadataConfiguration = {
        UseFileCreationTimeForDateAdded: data.DateAddedBehavior.toString() === '1'
    };

    config.EnableFolderView = data.DisplayFolderView?.toString() === 'on';
    config.DisplaySpecialsWithinSeasons = data.DisplaySpecialsWithinSeasons?.toString() === 'on';
    config.EnableGroupingMoviesIntoCollections = data.GroupMoviesIntoCollections?.toString() === 'on';
    config.EnableGroupingShowsIntoCollections = data.GroupShowsIntoCollections?.toString() === 'on';
    config.EnableExternalContentInSuggestions = data.EnableExternalContentInSuggestions?.toString() === 'on';

    await getSystemApi(api)
        .updateConfiguration({ serverConfiguration: config });

    await getSystemApi(api)
        .updateNamedConfiguration({ key: CONFIG_KEY, body: metadataConfig });

    void queryClient.invalidateQueries({
        queryKey: [ CONFIG_QUERY_KEY ]
    });
    void queryClient.invalidateQueries({
        queryKey: [ NAMED_CONFIG_QUERY_KEY, CONFIG_KEY ]
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
        data: namedConfig,
        isPending: isNamedConfigPending,
        isError: isNamedConfigError
    } = useNamedConfiguration<MetadataConfiguration>(CONFIG_KEY);

    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const isSubmitting = navigation.state === 'submitting';
    const [ saved, setSaved ] = useState(false);

    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    const closeSaved = useCallback(() => setSaved(false), []);

    if (isConfigPending || isNamedConfigPending) {
        return <Loading />;
    }

    return (
        <Page
            id='libraryDisplayPage'
            title={globalize.translate('Display')}
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={globalize.translate('Display')} subtitle={globalize.translate('LibDisplaySubtitle')} />

                {isConfigError || isNamedConfigError ? (
                    <Alert severity='error'>{globalize.translate('DisplayLoadError')}</Alert>
                ) : (
                    <Form method='POST' style={{ maxWidth: 'none' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
                            <Stack spacing={2.5}>
                                <SectionCard
                                    title={globalize.translate('LibCardDates')}
                                    icon={<EventIcon />}
                                    accentColor={COLORS.dates}
                                    description={globalize.translate('LibCardDatesHelp')}
                                >
                                    <TextField
                                        name='DateAddedBehavior'
                                        label={globalize.translate('LabelDateAddedBehavior')}
                                        select
                                        fullWidth
                                        defaultValue={namedConfig.UseFileCreationTimeForDateAdded ? '1' : '0'}
                                        helperText={globalize.translate('LabelDateAddedBehaviorHelp')}
                                    >
                                        <MenuItem value='0'>{globalize.translate('OptionDateAddedImportTime')}</MenuItem>
                                        <MenuItem value='1'>{globalize.translate('OptionDateAddedFileTime')}</MenuItem>
                                    </TextField>
                                </SectionCard>

                                <SectionCard
                                    title={globalize.translate('LibCardNavigation')}
                                    icon={<FolderIcon />}
                                    accentColor={COLORS.folders}
                                    description={globalize.translate('LibCardNavigationHelp')}
                                >
                                    <Stack spacing={1.25}>
                                        <ToggleRow
                                            name='DisplayFolderView'
                                            label={globalize.translate('OptionDisplayFolderView')}
                                            description={globalize.translate('OptionDisplayFolderViewHelp')}
                                            defaultChecked={config.EnableFolderView}
                                            color={COLORS.folders}
                                        />
                                        <ToggleRow
                                            name='DisplaySpecialsWithinSeasons'
                                            label={globalize.translate('LabelDisplaySpecialsWithinSeasons')}
                                            description={globalize.translate('LibSpecialsHelp')}
                                            defaultChecked={config.DisplaySpecialsWithinSeasons}
                                            color={COLORS.folders}
                                        />
                                    </Stack>
                                </SectionCard>
                            </Stack>

                            <Stack spacing={2.5}>
                                <SectionCard
                                    title={globalize.translate('Collections')}
                                    icon={<CollectionsBookmarkIcon />}
                                    accentColor={COLORS.collections}
                                    description={globalize.translate('LibCardCollectionsHelp')}
                                >
                                    <Stack spacing={1.25}>
                                        <ToggleRow
                                            name='GroupMoviesIntoCollections'
                                            label={globalize.translate('LabelGroupMoviesIntoCollections')}
                                            description={globalize.translate('LabelGroupMoviesIntoCollectionsHelp')}
                                            defaultChecked={config.EnableGroupingMoviesIntoCollections}
                                            color={COLORS.collections}
                                        />
                                        <ToggleRow
                                            name='GroupShowsIntoCollections'
                                            label={globalize.translate('LabelGroupShowsIntoCollections')}
                                            description={globalize.translate('LabelGroupShowsIntoCollectionsHelp')}
                                            defaultChecked={config.EnableGroupingShowsIntoCollections}
                                            color={COLORS.collections}
                                        />
                                    </Stack>
                                </SectionCard>

                                <SectionCard
                                    title={globalize.translate('LibCardSuggestions')}
                                    icon={<RecommendIcon />}
                                    accentColor={COLORS.suggestions}
                                >
                                    <ToggleRow
                                        name='EnableExternalContentInSuggestions'
                                        label={globalize.translate('OptionEnableExternalContentInSuggestions')}
                                        description={globalize.translate('OptionEnableExternalContentInSuggestionsHelp')}
                                        defaultChecked={config.EnableExternalContentInSuggestions}
                                        color={COLORS.suggestions}
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
                    </Form>
                )}
            </Box>

            <SavedSnackbar open={saved} onClose={closeSaved} />
        </Page>
    );
};

Component.displayName = 'DisplayPage';
