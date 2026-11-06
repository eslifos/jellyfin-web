import React, { useCallback, useEffect, useState } from 'react';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { ProcessPriorityClass } from '@jellyfin/sdk/lib/generated-client/models/process-priority-class';
import { TrickplayScanBehavior } from '@jellyfin/sdk/lib/generated-client/models/trickplay-scan-behavior';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Icon from '@mui/material/Icon';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import BoltIcon from '@mui/icons-material/Bolt';
import CalculateIcon from '@mui/icons-material/Calculate';
import GridViewIcon from '@mui/icons-material/GridView';
import ImageIcon from '@mui/icons-material/Image';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TimerIcon from '@mui/icons-material/Timer';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';

import { useVirtualFolders } from 'apps/dashboard/features/libraries/api/useVirtualFolders';
import { getLibraryAccent } from 'apps/dashboard/features/libraries/utils/libraryUi';
import { Column, InfoGrid, InfoTile, SaveBar, TaskCard, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY, useConfiguration } from 'hooks/useConfiguration';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { ActionData } from 'types/actionData';
import { getLibraryIcon } from 'utils/image';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

const COLORS = {
    accel: '#ff9800',
    schedule: '#aa5cc3',
    images: '#00a4dc',
    calc: '#4caf50',
    libraries: '#26c6da'
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    const { data: config } = await getSystemApi(api).getConfiguration();

    const options = config.TrickplayOptions;
    if (!options) throw new Error('Unexpected null TrickplayOptions');

    options.EnableHwAcceleration = data.HwAcceleration?.toString() === 'on';
    options.EnableHwEncoding = data.HwEncoding?.toString() === 'on';
    options.EnableKeyFrameOnlyExtraction = data.KeyFrameOnlyExtraction?.toString() === 'on';
    options.ScanBehavior = data.ScanBehavior.toString() as TrickplayScanBehavior;
    options.ProcessPriority = data.ProcessPriority.toString() as ProcessPriorityClass;
    options.Interval = parseInt(data.ImageInterval.toString() || '10000', 10);
    options.WidthResolutions = data.WidthResolutions.toString().replace(/\s/g, '').split(',').filter(Boolean).map(Number);
    options.TileWidth = parseInt(data.TileWidth.toString() || '10', 10);
    options.TileHeight = parseInt(data.TileHeight.toString() || '10', 10);
    options.Qscale = parseInt(data.Qscale.toString() || '4', 10);
    options.JpegQuality = parseInt(data.JpegQuality.toString() || '90', 10);
    options.ProcessThreads = parseInt(data.TrickplayThreads.toString() || '1', 10);

    await getSystemApi(api)
        .updateConfiguration({ serverConfiguration: config });

    void queryClient.invalidateQueries({
        queryKey: [ QUERY_KEY ]
    });

    return {
        isSaved: true
    };
};

const MOVIE_SECONDS = 2 * 3600;

const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const Component = () => {
    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const { data: config, isPending, isError } = useConfiguration();
    const { data: virtualFolders } = useVirtualFolders();
    const isSubmitting = navigation.state === 'submitting';

    const [ values, setValues ] = useState<Record<string, string> | null>(null);
    const [ saved, setSaved ] = useState(false);

    useEffect(() => {
        const t = config?.TrickplayOptions;
        if (t && !values) {
            setValues({
                ImageInterval: String(t.Interval ?? 10000),
                WidthResolutions: (t.WidthResolutions || [ 320 ]).join(','),
                TileWidth: String(t.TileWidth ?? 10),
                TileHeight: String(t.TileHeight ?? 10),
                JpegQuality: String(t.JpegQuality ?? 90)
            });
        }
    }, [ config, values ]);

    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setValues(v => ({ ...v, [name]: value }));
    }, []);

    const closeSaved = useCallback(() => setSaved(false), []);

    if (!config || isPending || !values) {
        return <Loading />;
    }

    const t = config.TrickplayOptions;
    const intervalSec = Math.max(0.1, (parseInt(values.ImageInterval, 10) || 10000) / 1000);
    const widths = values.WidthResolutions.split(',').map(w => parseInt(w.trim(), 10)).filter(w => w > 0);
    const tileW = Math.max(1, parseInt(values.TileWidth, 10) || 10);
    const tileH = Math.max(1, parseInt(values.TileHeight, 10) || 10);
    const quality = Math.min(100, Math.max(1, parseInt(values.JpegQuality, 10) || 90));
    const perTile = tileW * tileH;
    const images = Math.ceil(MOVIE_SECONDS / intervalSec);
    const sheets = Math.ceil(images / perTile);
    // Rough JPEG size: ~0.06 - 0.25 bytes per pixel depending on quality (16:9 thumbnails).
    const bytesPerPixel = 0.05 + (quality / 100) * 0.2;
    const estimate = widths.reduce((sum, w) => sum + images * w * (w * 9 / 16) * bytesPerPixel, 0);

    const libraries = (virtualFolders || []).filter(f => f.CollectionType !== 'music' && f.CollectionType !== 'books');

    return (
        <Page
            id='trickplayConfigurationPage'
            className='mainAnimatedPage type-interior'
            title={globalize.translate('Trickplay')}
        >
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={globalize.translate('Trickplay')} subtitle={globalize.translate('PbTrickplaySubtitle')} />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('TrickplayLoadError')}</Alert>
                ) : (
                    <Form method='POST' style={{ maxWidth: 'none' }}>
                        <InfoGrid>
                            <InfoTile icon={<TimerIcon />} color={COLORS.images} label={globalize.translate('PbEveryNSeconds')} value={`${intervalSec} s`} />
                            <InfoTile icon={<ImageIcon />} color={COLORS.schedule} label={globalize.translate('PbResolutions')} value={widths.length ? widths.map(w => `${w}px`).join(' · ') : '—'} />
                            <InfoTile icon={<GridViewIcon />} color={COLORS.accel} label={globalize.translate('PbPerSheet')} value={`${tileW}×${tileH} = ${perTile}`} />
                            <InfoTile icon={<VideoLibraryIcon />} color={COLORS.libraries} label={globalize.translate('PbLibrariesEnabled')} value={`${libraries.filter(l => l.LibraryOptions?.EnableTrickplayImageExtraction).length} / ${libraries.length}`} />
                        </InfoGrid>

                        <TwoColumns>
                            <Column>
                                <SectionCard title={globalize.translate('PbTrickplayAccel')} icon={<BoltIcon />} accentColor={COLORS.accel}>
                                    <Stack spacing={1.25}>
                                        <ToggleRow name='HwAcceleration' label={globalize.translate('LabelTrickplayAccel')} defaultChecked={t?.EnableHwAcceleration} color={COLORS.accel} />
                                        <ToggleRow name='HwEncoding' label={globalize.translate('LabelTrickplayAccelEncoding')} description={globalize.translate('LabelTrickplayAccelEncodingHelp')} defaultChecked={t?.EnableHwEncoding} color={COLORS.accel} />
                                        <ToggleRow name='KeyFrameOnlyExtraction' label={globalize.translate('LabelTrickplayKeyFrameOnlyExtraction')} description={globalize.translate('LabelTrickplayKeyFrameOnlyExtractionHelp')} defaultChecked={t?.EnableKeyFrameOnlyExtraction} color={COLORS.accel} />
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('PbTrickplaySchedule')} icon={<ScheduleIcon />} accentColor={COLORS.schedule}>
                                    <Stack spacing={2.5}>
                                        <TextField name='ScanBehavior' select fullWidth defaultValue={t?.ScanBehavior} label={globalize.translate('LabelScanBehavior')} helperText={globalize.translate('LabelScanBehaviorHelp')}>
                                            <MenuItem value={TrickplayScanBehavior.NonBlocking}>{globalize.translate('NonBlockingScan')}</MenuItem>
                                            <MenuItem value={TrickplayScanBehavior.Blocking}>{globalize.translate('BlockingScan')}</MenuItem>
                                        </TextField>
                                        <TextField name='ProcessPriority' select fullWidth defaultValue={t?.ProcessPriority} label={globalize.translate('LabelProcessPriority')} helperText={globalize.translate('LabelProcessPriorityHelp')}>
                                            <MenuItem value={ProcessPriorityClass.High}>{globalize.translate('PriorityHigh')}</MenuItem>
                                            <MenuItem value={ProcessPriorityClass.AboveNormal}>{globalize.translate('PriorityAboveNormal')}</MenuItem>
                                            <MenuItem value={ProcessPriorityClass.Normal}>{globalize.translate('PriorityNormal')}</MenuItem>
                                            <MenuItem value={ProcessPriorityClass.BelowNormal}>{globalize.translate('PriorityBelowNormal')}</MenuItem>
                                            <MenuItem value={ProcessPriorityClass.Idle}>{globalize.translate('PriorityIdle')}</MenuItem>
                                        </TextField>
                                        <TextField
                                            fullWidth
                                            label={globalize.translate('LabelTrickplayThreads')}
                                            name='TrickplayThreads'
                                            type='number'
                                            defaultValue={t?.ProcessThreads}
                                            helperText={globalize.translate('LabelTrickplayThreadsHelp')}
                                            slotProps={{ htmlInput: { min: 0, required: true } }}
                                        />
                                    </Stack>
                                </SectionCard>

                                <TaskCard
                                    taskKey='RefreshTrickplayImages'
                                    title={globalize.translate('PbGenerateNow')}
                                    icon={<ViewModuleIcon />}
                                    accentColor={COLORS.libraries}
                                    description={globalize.translate('PbTrickplayTaskHelp')}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.5 }}>
                                        {libraries.map(lib => {
                                            const accent = getLibraryAccent(lib.CollectionType);
                                            const enabled = !!lib.LibraryOptions?.EnableTrickplayImageExtraction;
                                            const duringScan = !!lib.LibraryOptions?.ExtractTrickplayImagesDuringLibraryScan;
                                            const withMedia = !!lib.LibraryOptions?.SaveTrickplayWithMedia;
                                            return (
                                                <Box key={lib.ItemId} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1, px: 1.25, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                    <Icon sx={{ fontSize: '1.1rem', color: accent }}>{getLibraryIcon(lib.CollectionType)}</Icon>
                                                    <Typography noWrap sx={{ flex: 1, fontSize: '0.85rem', color: 'rgba(255,255,255,0.88)' }}>{lib.Name}</Typography>
                                                    {enabled && duringScan && <Chip size='small' label={globalize.translate('PbDuringScan')} sx={{ height: 20, fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} />}
                                                    {enabled && withMedia && <Chip size='small' label={globalize.translate('PbWithMedia')} sx={{ height: 20, fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} />}
                                                    <Chip
                                                        size='small'
                                                        label={enabled ? globalize.translate('PbEnabled') : globalize.translate('PbDisabled')}
                                                        sx={{
                                                            height: 22, fontSize: '0.68rem', fontWeight: 600,
                                                            color: enabled ? '#4caf50' : 'rgba(255,255,255,0.5)',
                                                            background: enabled ? 'rgba(76,175,80,0.12)' : 'rgba(255,255,255,0.05)',
                                                            border: `1px solid ${enabled ? 'rgba(76,175,80,0.4)' : 'rgba(255,255,255,0.1)'}`
                                                        }}
                                                    />
                                                </Box>
                                            );
                                        })}
                                        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>{globalize.translate('PbTrickplayLibrariesHelp')}</Typography>
                                    </Box>
                                </TaskCard>
                            </Column>

                            <Column>
                                <SectionCard title={globalize.translate('PbTrickplayImages')} icon={<ImageIcon />} accentColor={COLORS.images}>
                                    <Stack spacing={2.5}>
                                        <TextField
                                            fullWidth
                                            label={globalize.translate('LabelImageInterval')}
                                            name='ImageInterval'
                                            type='number'
                                            value={values.ImageInterval}
                                            onChange={onChange}
                                            helperText={globalize.translate('LabelImageIntervalHelp')}
                                            slotProps={{ htmlInput: { min: 1, required: true } }}
                                        />
                                        <TextField
                                            fullWidth
                                            label={globalize.translate('LabelWidthResolutions')}
                                            name='WidthResolutions'
                                            value={values.WidthResolutions}
                                            onChange={onChange}
                                            helperText={globalize.translate('LabelWidthResolutionsHelp')}
                                            slotProps={{ htmlInput: { required: true, pattern: '[0-9, ]*' } }}
                                        />
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                            <TextField
                                                label={globalize.translate('LabelTileWidth')}
                                                name='TileWidth'
                                                type='number'
                                                value={values.TileWidth}
                                                onChange={onChange}
                                                helperText={globalize.translate('LabelTileWidthHelp')}
                                                slotProps={{ htmlInput: { min: 1, required: true } }}
                                            />
                                            <TextField
                                                label={globalize.translate('LabelTileHeight')}
                                                name='TileHeight'
                                                type='number'
                                                value={values.TileHeight}
                                                onChange={onChange}
                                                helperText={globalize.translate('LabelTileHeightHelp')}
                                                slotProps={{ htmlInput: { min: 1, required: true } }}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                            <TextField
                                                label={globalize.translate('LabelJpegQuality')}
                                                name='JpegQuality'
                                                type='number'
                                                value={values.JpegQuality}
                                                onChange={onChange}
                                                helperText={globalize.translate('LabelJpegQualityHelp')}
                                                slotProps={{ htmlInput: { min: 1, max: 100, required: true } }}
                                            />
                                            <TextField
                                                label={globalize.translate('LabelQscale')}
                                                name='Qscale'
                                                type='number'
                                                defaultValue={t?.Qscale}
                                                helperText={globalize.translate('LabelQscaleHelp')}
                                                slotProps={{ htmlInput: { min: 2, max: 31, required: true } }}
                                            />
                                        </Box>
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('PbEstimate')} icon={<CalculateIcon />} accentColor={COLORS.calc} description={globalize.translate('PbEstimateHelp')}>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                                        {[
                                            { label: globalize.translate('PbThumbnails'), value: images.toLocaleString() },
                                            { label: globalize.translate('PbSheets'), value: (sheets * Math.max(widths.length, 1)).toLocaleString() },
                                            { label: globalize.translate('PbApproxSize'), value: `≈ ${formatBytes(estimate)}` }
                                        ].map(s => (
                                            <Box key={s.label} sx={{ p: 1.25, borderRadius: '12px', textAlign: 'center', background: `${COLORS.calc}10`, border: `1px solid ${COLORS.calc}26` }}>
                                                <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{s.value}</Typography>
                                                <Typography noWrap sx={{ fontSize: '0.64rem', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{s.label}</Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                    <Typography sx={{ mt: 1.5, fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                                        {globalize.translate('PbEstimateNote', intervalSec)}
                                    </Typography>
                                </SectionCard>
                            </Column>
                        </TwoColumns>

                        <SaveBar isSubmitting={isSubmitting} />
                    </Form>
                )}
            </Box>

            <SavedSnackbar open={saved} onClose={closeSaved} />
        </Page>
    );
};

Component.displayName = 'TrickplayPage';
