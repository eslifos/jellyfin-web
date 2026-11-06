import React, { useCallback, useEffect, useState } from 'react';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import type { XbmcMetadataOptions } from '@jellyfin/sdk/lib/generated-client/models/xbmc-metadata-options';
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
import DescriptionIcon from '@mui/icons-material/Description';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
import TuneIcon from '@mui/icons-material/Tune';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';

import { useVirtualFolders } from 'apps/dashboard/features/libraries/api/useVirtualFolders';
import { getLibraryAccent } from 'apps/dashboard/features/libraries/utils/libraryUi';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import SimpleAlert from 'components/SimpleAlert';
import { QUERY_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { ActionData } from 'types/actionData';
import { getLibraryIcon } from 'utils/image';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

const CONFIG_KEY = 'xbmcmetadata';

const COLORS = {
    info: '#26c6da',
    user: '#00a4dc',
    options: '#aa5cc3',
    libraries: '#4caf50'
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    const newConfig: XbmcMetadataOptions = {
        UserId: data.UserId?.toString(),
        ReleaseDateFormat: 'yyyy-MM-dd',
        SaveImagePathsInNfo: data.SaveImagePathsInNfo?.toString() === 'on',
        EnablePathSubstitution: data.EnablePathSubstitution?.toString() === 'on',
        EnableExtraThumbsDuplication: data.EnableExtraThumbsDuplication?.toString() === 'on'
    };

    await getSystemApi(api)
        .updateNamedConfiguration({ key: CONFIG_KEY, body: newConfig });

    void queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, CONFIG_KEY]
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
    } = useNamedConfiguration<XbmcMetadataOptions>(CONFIG_KEY);
    const {
        data: users,
        isPending: isUsersPending,
        isError: isUsersError
    } = useUsers();
    const { data: virtualFolders } = useVirtualFolders();
    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const isSubmitting = navigation.state === 'submitting';
    const [ isAlertOpen, setIsAlertOpen ] = useState(false);
    const [ saved, setSaved ] = useState(false);

    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    const closeSaved = useCallback(() => setSaved(false), []);
    const onAlertClose = useCallback(() => setIsAlertOpen(false), []);
    const onSubmit = useCallback(() => setIsAlertOpen(true), []);

    if (isConfigPending || isUsersPending) {
        return <Loading />;
    }

    const libraries = virtualFolders || [];
    const nfoCount = libraries.filter(l => l.LibraryOptions?.MetadataSavers?.includes('Nfo')).length;

    return (
        <Page
            id='metadataNfoPage'
            title={globalize.translate('TabNfoSettings')}
            className='type-interior mainAnimatedPage'
        >
            <SimpleAlert
                open={isAlertOpen}
                text={globalize.translate('MetadataSettingChangeHelp')}
                onClose={onAlertClose}
            />
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('TabNfoSettings')}
                    subtitle={globalize.translate('LibNfoSubtitle', nfoCount, libraries.length)}
                />

                {isConfigError || isUsersError ? (
                    <Alert severity='error'>{globalize.translate('MetadataNfoLoadError')}</Alert>
                ) : (
                    <Form method='POST' onSubmit={onSubmit} style={{ maxWidth: 'none' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
                            <Stack spacing={2.5}>
                                <SectionCard title={globalize.translate('LibNfoWhat')} icon={<InfoOutlinedIcon />} accentColor={COLORS.info}>
                                    <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
                                        {globalize.translate('HeaderKodiMetadataHelp')}
                                    </Typography>
                                    <Typography sx={{ mt: 1.5, fontSize: '0.8rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
                                        {globalize.translate('LibNfoWhatHelp')}
                                    </Typography>
                                </SectionCard>

                                <SectionCard title={globalize.translate('LibNfoUser')} icon={<PersonIcon />} accentColor={COLORS.user}>
                                    <TextField
                                        name='UserId'
                                        label={globalize.translate('LabelKodiMetadataUser')}
                                        defaultValue={config.UserId || ''}
                                        select
                                        fullWidth
                                        helperText={globalize.translate('LabelKodiMetadataUserHelp')}
                                        slotProps={{
                                            select: { displayEmpty: true },
                                            inputLabel: { shrink: true }
                                        }}
                                    >
                                        <MenuItem value=''>{globalize.translate('None')}</MenuItem>
                                        {users.map(user =>
                                            <MenuItem key={user.Id} value={user.Id}>{user.Name}</MenuItem>
                                        )}
                                    </TextField>
                                </SectionCard>

                                <SectionCard title={globalize.translate('LibNfoOptions')} icon={<TuneIcon />} accentColor={COLORS.options}>
                                    <Stack spacing={1.25}>
                                        <ToggleRow
                                            name='SaveImagePathsInNfo'
                                            label={globalize.translate('LabelKodiMetadataSaveImagePaths')}
                                            description={globalize.translate('LabelKodiMetadataSaveImagePathsHelp')}
                                            defaultChecked={config.SaveImagePathsInNfo}
                                            color={COLORS.options}
                                        />
                                        <ToggleRow
                                            name='EnablePathSubstitution'
                                            label={globalize.translate('LabelKodiMetadataEnablePathSubstitution')}
                                            description={globalize.translate('LabelKodiMetadataEnablePathSubstitutionHelp')}
                                            defaultChecked={config.EnablePathSubstitution}
                                            color={COLORS.options}
                                        />
                                        <ToggleRow
                                            name='EnableExtraThumbsDuplication'
                                            label={globalize.translate('LabelKodiMetadataEnableExtraThumbs')}
                                            description={globalize.translate('LabelKodiMetadataEnableExtraThumbsHelp')}
                                            defaultChecked={config.EnableExtraThumbsDuplication}
                                            color={COLORS.options}
                                        />
                                    </Stack>
                                </SectionCard>
                            </Stack>

                            <SectionCard
                                title={globalize.translate('LibNfoLibraries')}
                                icon={<VideoLibraryIcon />}
                                accentColor={COLORS.libraries}
                                description={globalize.translate('LibNfoLibrariesHelp')}
                            >
                                <Stack spacing={1}>
                                    {libraries.length === 0 && (
                                        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('LibNoLibraries')}</Typography>
                                    )}
                                    {libraries.map(lib => {
                                        const accent = getLibraryAccent(lib.CollectionType);
                                        const savesNfo = !!lib.LibraryOptions?.MetadataSavers?.includes('Nfo');
                                        const readsNfo = !lib.LibraryOptions?.DisabledLocalMetadataReaders?.includes('Nfo');
                                        return (
                                            <Box key={lib.ItemId || lib.Name} sx={{
                                                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                                            }}>
                                                <Box sx={{
                                                    width: 34, height: 34, borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent
                                                }}>
                                                    <Icon sx={{ fontSize: '1.1rem' }}>{getLibraryIcon(lib.CollectionType)}</Icon>
                                                </Box>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{lib.Name}</Typography>
                                                    <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                                                        {readsNfo ? globalize.translate('LibNfoReads') : globalize.translate('LibNfoNotReads')}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    size='small'
                                                    icon={<DescriptionIcon sx={{ fontSize: '0.9rem !important', color: savesNfo ? `${COLORS.libraries} !important` : 'rgba(255,255,255,0.4) !important' }} />}
                                                    label={savesNfo ? globalize.translate('LibNfoSaves') : globalize.translate('LibNfoNotSaves')}
                                                    sx={{
                                                        height: 24, fontSize: '0.68rem', fontWeight: 600,
                                                        color: savesNfo ? COLORS.libraries : 'rgba(255,255,255,0.55)',
                                                        background: savesNfo ? `${COLORS.libraries}1a` : 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${savesNfo ? COLORS.libraries + '55' : 'rgba(255,255,255,0.1)'}`
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

Component.displayName = 'NFOSettingsPage';
