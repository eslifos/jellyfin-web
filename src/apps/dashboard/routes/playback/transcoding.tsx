import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EncodingOptions } from '@jellyfin/sdk/lib/generated-client/models/encoding-options';
import { HardwareAccelerationType } from '@jellyfin/sdk/lib/generated-client/models/hardware-acceleration-type';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import BoltIcon from '@mui/icons-material/Bolt';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import HdrOnIcon from '@mui/icons-material/HdrOn';
import MemoryIcon from '@mui/icons-material/Memory';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import SpeedIcon from '@mui/icons-material/Speed';
import StreamIcon from '@mui/icons-material/Stream';
import TransformIcon from '@mui/icons-material/Transform';
import TuneIcon from '@mui/icons-material/Tune';
import { type ActionFunctionArgs, Form, useActionData, useNavigation, useSubmit } from 'react-router-dom';

import { CODECS, HEVC_REXT_DECODING_TYPES, HEVC_VP9_HW_DECODING_TYPES } from 'apps/dashboard/features/playback/constants/codecs';
import { ActiveStreamsCard, Column, InfoGrid, InfoTile, SaveBar, TaskCard, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import useLiveSessions from 'apps/dashboard/features/sessions/hooks/useLiveSessions';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import DirectoryBrowser from 'components/directorybrowser/directorybrowser';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import playmethodhelper from 'components/playback/playmethodhelper';
import SimpleAlert from 'components/SimpleAlert';
import { QUERY_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

const CONFIG_KEY = 'encoding';

const COLORS = {
    hardware: '#ff9800',
    encoding: '#aa5cc3',
    tonemap: '#ec407a',
    quality: '#00a4dc',
    audio: '#4caf50',
    paths: '#26c6da',
    streaming: '#7e57c2',
    live: '#ef5350'
};

const HWA_LABELS: Record<string, string> = {
    none: 'Software (CPU)',
    amf: 'AMD AMF',
    nvenc: 'Nvidia NVENC',
    qsv: 'Intel Quicksync (QSV)',
    vaapi: 'VAAPI',
    rkmpp: 'Rockchip MPP',
    videotoolbox: 'Apple VideoToolBox',
    v4l2m2m: 'Video4Linux2 (V4L2)'
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const data = await request.json() as EncodingOptions;

    await getSystemApi(api)
        .updateNamedConfiguration({ key: CONFIG_KEY, body: data });

    void queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, CONFIG_KEY]
    });

    return {
        isSaved: true
    };
};

const threadOptions = [ '-1', ...Array.from({ length: 16 }, (_, i) => String(i + 1)), '0' ];

export const Component = () => {
    const { data: initialConfig, isPending, isError } = useNamedConfiguration<EncodingOptions>(CONFIG_KEY);
    const { data: sessions } = useLiveSessions();
    const [ config, setConfig ] = useState<EncodingOptions | null>(null);
    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const submit = useSubmit();
    const isSubmitting = navigation.state === 'submitting';
    const [ isAlertOpen, setIsAlertOpen ] = useState(false);
    const [ saved, setSaved ] = useState(false);

    useEffect(() => {
        if (initialConfig && config == null) {
            setConfig(initialConfig);
        }
    }, [ initialConfig, config ]);

    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    const onConfigChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setConfig(c => ({ ...c, [e.target.name]: e.target.value }));
    }, []);

    const setFlag = useCallback((name: keyof EncodingOptions) => (value: boolean) => {
        setConfig(c => ({ ...c, [name]: value }));
    }, []);

    const toggleCodec = useCallback((codec: string) => {
        setConfig(c => {
            const current = c?.HardwareDecodingCodecs || [];
            return {
                ...c,
                HardwareDecodingCodecs: current.includes(codec) ? current.filter(v => v !== codec) : [ ...current, codec ]
            };
        });
    }, []);

    const onAlertClose = useCallback(() => setIsAlertOpen(false), []);
    const closeSaved = useCallback(() => setSaved(false), []);

    const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (config) {
            if (config.HardwareAccelerationType && config.HardwareAccelerationType !== 'none') setIsAlertOpen(true);
            submit(
                { ...config },
                { method: 'post', encType: 'application/json' }
            );
        }
    }, [ config, submit ]);

    const showTranscodingPathPicker = useCallback(() => {
        const picker = new DirectoryBrowser();
        picker.show({
            callback: (path: string) => {
                if (path) setConfig(c => ({ ...c, TranscodingTempPath: path }));
                picker.close();
            },
            validateWriteable: true,
            header: globalize.translate('HeaderSelectTranscodingPath'),
            instruction: globalize.translate('HeaderSelectTranscodingPathHelp')
        });
    }, []);

    const showFallbackFontPathPicker = useCallback(() => {
        const picker = new DirectoryBrowser();
        picker.show({
            callback: (path: string) => {
                if (path) setConfig(c => ({ ...c, FallbackFontPath: path }));
                picker.close();
            },
            header: globalize.translate('HeaderSelectFallbackFontPath'),
            instruction: globalize.translate('HeaderSelectFallbackFontPathHelp')
        });
    }, []);

    const hardwareAccelType = config?.HardwareAccelerationType || HardwareAccelerationType.None;
    const isHwaSelected = [ 'amf', 'nvenc', 'qsv', 'vaapi', 'rkmpp', 'videotoolbox' ].includes(hardwareAccelType);
    const isIntel = hardwareAccelType === 'qsv' || hardwareAccelType === 'vaapi';

    const availableCodecs = useMemo(() => (
        CODECS.filter(codec => codec.types.includes(hardwareAccelType))
    ), [hardwareAccelType]);

    const transcodes = (sessions || []).filter(s => s.NowPlayingItem && playmethodhelper.getDisplayPlayMethod(s) === 'Transcode');
    const hwTranscodes = transcodes.filter(s => s.TranscodingInfo?.HardwareAccelerationType && s.TranscodingInfo.HardwareAccelerationType !== 'none').length;

    if (isPending || !config) return <Loading />;

    const extraDecoding = [
        HEVC_VP9_HW_DECODING_TYPES.includes(hardwareAccelType) && { key: 'EnableDecodingColorDepth10Hevc' as const, label: 'HEVC 10bit' },
        HEVC_VP9_HW_DECODING_TYPES.includes(hardwareAccelType) && { key: 'EnableDecodingColorDepth10Vp9' as const, label: 'VP9 10bit' },
        HEVC_REXT_DECODING_TYPES.includes(hardwareAccelType) && { key: 'EnableDecodingColorDepth10HevcRext' as const, label: 'HEVC RExt 8/10bit' },
        HEVC_REXT_DECODING_TYPES.includes(hardwareAccelType) && { key: 'EnableDecodingColorDepth12HevcRext' as const, label: 'HEVC RExt 12bit' }
    ].filter(Boolean) as { key: keyof EncodingOptions; label: string }[];

    const chipSx = (active: boolean, color: string) => ({
        fontWeight: 600,
        color: active ? '#fff' : 'rgba(255,255,255,0.6)',
        background: active ? `${color}44` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.12)'}`,
        '&:hover': { background: active ? `${color}66` : 'rgba(255,255,255,0.08)' }
    });

    return (
        <Page
            id='encodingSettingsPage'
            className='mainAnimatedPage type-interior'
            title={globalize.translate('TitlePlayback')}
        >
            <SimpleAlert
                open={isAlertOpen}
                onClose={onAlertClose}
                title={globalize.translate('TitleHardwareAcceleration')}
                text={globalize.translate('HardwareAccelerationWarning')}
            />
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={globalize.translate('Transcoding')} subtitle={globalize.translate('PbTranscodingSubtitle')} />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('TranscodingLoadError')}</Alert>
                ) : (
                    <Form method='POST' onSubmit={onSubmit} style={{ maxWidth: 'none' }}>
                        <InfoGrid>
                            <InfoTile icon={<MemoryIcon />} color={COLORS.hardware} label={globalize.translate('LabelHardwareAccelerationType')} value={HWA_LABELS[hardwareAccelType] ?? hardwareAccelType} />
                            <InfoTile icon={<BoltIcon />} color={COLORS.encoding} label={globalize.translate('LabelHardwareEncodingOptions')} value={hardwareAccelType !== 'none' && config.EnableHardwareEncoding ? globalize.translate('PbEnabled') : globalize.translate('PbDisabled')} />
                            <InfoTile icon={<TransformIcon />} color={COLORS.live} label={globalize.translate('PbActiveTranscodes')} value={transcodes.length} secondary={transcodes.length ? globalize.translate('PbHwTranscodes', hwTranscodes) : undefined} />
                            <InfoTile icon={<SpeedIcon />} color={COLORS.quality} label={globalize.translate('LabelEncoderPreset')} value={config.EncoderPreset || 'auto'} secondary={`CRF H.264 ${config.H264Crf} · H.265 ${config.H265Crf}`} />
                        </InfoGrid>

                        <TwoColumns>
                            <Column>
                                {/* ── Hardware ── */}
                                <SectionCard title={globalize.translate('TitleHardwareAcceleration')} icon={<MemoryIcon />} accentColor={COLORS.hardware} description={globalize.translate('PbHwaHelp')}>
                                    <Stack spacing={2.5}>
                                        <TextField
                                            name='HardwareAccelerationType'
                                            select
                                            fullWidth
                                            label={globalize.translate('LabelHardwareAccelerationType')}
                                            value={config.HardwareAccelerationType}
                                            onChange={onConfigChange}
                                            helperText={(
                                                <Link href='https://jellyfin.org/docs/general/administration/hardware-acceleration' target='_blank' sx={{ color: COLORS.hardware }}>
                                                    {globalize.translate('LabelHardwareAccelerationTypeHelp')}
                                                </Link>
                                            )}
                                        >
                                            <MenuItem value='none'>{globalize.translate('None')}</MenuItem>
                                            <MenuItem value='amf'>AMD AMF</MenuItem>
                                            <MenuItem value='nvenc'>Nvidia NVENC</MenuItem>
                                            <MenuItem value='qsv'>Intel Quicksync (QSV)</MenuItem>
                                            <MenuItem value='vaapi'>Video Acceleration API (VAAPI)</MenuItem>
                                            <MenuItem value='rkmpp'>Rockchip MPP (RKMPP)</MenuItem>
                                            <MenuItem value='videotoolbox'>Apple VideoToolBox</MenuItem>
                                            <MenuItem value='v4l2m2m'>Video4Linux2 (V4L2)</MenuItem>
                                        </TextField>

                                        {hardwareAccelType === 'vaapi' && (
                                            <TextField name='VaapiDevice' fullWidth label={globalize.translate('LabelVaapiDevice')} value={config.VaapiDevice} onChange={onConfigChange} helperText={globalize.translate('LabelVaapiDeviceHelp')} />
                                        )}
                                        {hardwareAccelType === 'qsv' && (
                                            <TextField name='QsvDevice' fullWidth label={globalize.translate('LabelQsvDevice')} value={config.QsvDevice} onChange={onConfigChange} helperText={globalize.translate('LabelQsvDeviceHelp')} />
                                        )}

                                        {hardwareAccelType !== 'none' && (
                                            <Box>
                                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', mb: 1 }}>
                                                    {globalize.translate('LabelEnableHardwareDecodingFor')}
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                    {availableCodecs.map(codec => {
                                                        const active = (config.HardwareDecodingCodecs || []).includes(codec.codec);
                                                        return <Chip key={codec.codec} label={codec.name} onClick={() => toggleCodec(codec.codec)} sx={chipSx(active, COLORS.hardware)} />;
                                                    })}
                                                    {extraDecoding.map(opt => {
                                                        const active = !!config[opt.key];
                                                        return <Chip key={opt.key} label={opt.label} onClick={() => setFlag(opt.key)(!active)} sx={chipSx(active, COLORS.hardware)} />;
                                                    })}
                                                </Box>
                                            </Box>
                                        )}

                                        {hardwareAccelType === 'nvenc' && (
                                            <ToggleRow label={globalize.translate('EnableEnhancedNvdecDecoder')} description={globalize.translate('EnableEnhancedNvdecDecoderHelp')} checked={!!config.EnableEnhancedNvdecDecoder} onChange={setFlag('EnableEnhancedNvdecDecoder')} color={COLORS.hardware} />
                                        )}
                                        {hardwareAccelType === 'qsv' && (
                                            <ToggleRow label={globalize.translate('PreferSystemNativeHwDecoder')} checked={!!config.PreferSystemNativeHwDecoder} onChange={setFlag('PreferSystemNativeHwDecoder')} color={COLORS.hardware} />
                                        )}
                                    </Stack>
                                </SectionCard>

                                {/* ── Encoding formats ── */}
                                <SectionCard title={globalize.translate('LabelEncodingFormatOptions')} icon={<BoltIcon />} accentColor={COLORS.encoding} description={globalize.translate('EncodingFormatHelp')}>
                                    <Stack spacing={1.25}>
                                        {hardwareAccelType !== 'none' && (
                                            <ToggleRow label={globalize.translate('EnableHardwareEncoding')} checked={!!config.EnableHardwareEncoding} onChange={setFlag('EnableHardwareEncoding')} color={COLORS.encoding} />
                                        )}
                                        {hardwareAccelType !== 'none' && isIntel && (
                                            <>
                                                <ToggleRow label={globalize.translate('EnableIntelLowPowerH264HwEncoder')} checked={!!config.EnableIntelLowPowerH264HwEncoder} onChange={setFlag('EnableIntelLowPowerH264HwEncoder')} color={COLORS.encoding} />
                                                <ToggleRow label={globalize.translate('EnableIntelLowPowerHevcHwEncoder')} checked={!!config.EnableIntelLowPowerHevcHwEncoder} onChange={setFlag('EnableIntelLowPowerHevcHwEncoder')} color={COLORS.encoding} />
                                                <Link href='https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/intel#configure-and-verify-lp-mode-on-linux' target='_blank' sx={{ fontSize: '0.75rem', color: COLORS.encoding }}>
                                                    {globalize.translate('IntelLowPowerEncHelp')}
                                                </Link>
                                            </>
                                        )}
                                        <ToggleRow label={globalize.translate('AllowHevcEncoding')} checked={!!config.AllowHevcEncoding} onChange={setFlag('AllowHevcEncoding')} color={COLORS.encoding} />
                                        <ToggleRow label={globalize.translate('AllowAv1Encoding')} checked={!!config.AllowAv1Encoding} onChange={setFlag('AllowAv1Encoding')} color={COLORS.encoding} />
                                    </Stack>
                                </SectionCard>

                                {/* ── Tone mapping ── */}
                                <SectionCard title={globalize.translate('PbToneMapping')} icon={<HdrOnIcon />} accentColor={COLORS.tonemap} description={globalize.translate('PbToneMappingHelp')}>
                                    <Stack spacing={2.5}>
                                        {isIntel && (
                                            <>
                                                <ToggleRow label={globalize.translate('EnableVppTonemapping')} description={globalize.translate('AllowVppTonemappingHelp')} checked={!!config.EnableVppTonemapping} onChange={setFlag('EnableVppTonemapping')} color={COLORS.tonemap} />
                                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                                    <TextField name='VppTonemappingBrightness' value={config.VppTonemappingBrightness} onChange={onConfigChange} label={globalize.translate('LabelVppTonemappingBrightness')} helperText={globalize.translate('LabelVppTonemappingBrightnessHelp')} type='number' slotProps={{ htmlInput: { min: 0, max: 100, step: 0.00001 } }} />
                                                    <TextField name='VppTonemappingContrast' value={config.VppTonemappingContrast} onChange={onConfigChange} label={globalize.translate('LabelVppTonemappingContrast')} helperText={globalize.translate('LabelVppTonemappingContrastHelp')} type='number' slotProps={{ htmlInput: { min: 1, max: 2, step: 0.00001 } }} />
                                                </Box>
                                            </>
                                        )}

                                        {hardwareAccelType === 'videotoolbox' && (
                                            <ToggleRow label={globalize.translate('EnableVideoToolboxTonemapping')} description={globalize.translate('AllowVideoToolboxTonemappingHelp')} checked={!!config.EnableVideoToolboxTonemapping} onChange={setFlag('EnableVideoToolboxTonemapping')} color={COLORS.tonemap} />
                                        )}

                                        {(hardwareAccelType === 'none' || isHwaSelected) && (
                                            <>
                                                {isHwaSelected && (
                                                    <ToggleRow label={globalize.translate('EnableTonemapping')} description={globalize.translate('AllowTonemappingHelp')} checked={!!config.EnableTonemapping} onChange={setFlag('EnableTonemapping')} color={COLORS.tonemap} />
                                                )}
                                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                                    <TextField
                                                        name='TonemappingAlgorithm'
                                                        select
                                                        label={globalize.translate('LabelTonemappingAlgorithm')}
                                                        value={config.TonemappingAlgorithm}
                                                        onChange={onConfigChange}
                                                        helperText={(
                                                            <Link href='https://ffmpeg.org/ffmpeg-all.html#tonemap_005fopencl' target='_blank' sx={{ color: COLORS.tonemap }}>
                                                                {globalize.translate('TonemappingAlgorithmHelp')}
                                                            </Link>
                                                        )}
                                                    >
                                                        <MenuItem value='none'>{globalize.translate('None')}</MenuItem>
                                                        <MenuItem value='clip'>Clip</MenuItem>
                                                        <MenuItem value='linear'>Linear</MenuItem>
                                                        <MenuItem value='gamma'>Gamma</MenuItem>
                                                        <MenuItem value='reinhard'>Reinhard</MenuItem>
                                                        <MenuItem value='hable'>Hable</MenuItem>
                                                        <MenuItem value='mobius'>Mobius</MenuItem>
                                                        <MenuItem value='bt2390'>BT.2390</MenuItem>
                                                    </TextField>
                                                    {isHwaSelected && (
                                                        <TextField name='TonemappingMode' select value={config.TonemappingMode} onChange={onConfigChange} label={globalize.translate('LabelTonemappingMode')} helperText={globalize.translate('TonemappingModeHelp')}>
                                                            <MenuItem value='auto'>{globalize.translate('Auto')}</MenuItem>
                                                            <MenuItem value='max'>MAX</MenuItem>
                                                            <MenuItem value='rgb'>RGB</MenuItem>
                                                            <MenuItem value='lum'>LUM</MenuItem>
                                                            <MenuItem value='itp'>ITP</MenuItem>
                                                        </TextField>
                                                    )}
                                                    <TextField name='TonemappingRange' select value={config.TonemappingRange} onChange={onConfigChange} label={globalize.translate('LabelTonemappingRange')} helperText={globalize.translate('TonemappingRangeHelp')}>
                                                        <MenuItem value='auto'>{globalize.translate('Auto')}</MenuItem>
                                                        <MenuItem value='tv'>TV</MenuItem>
                                                        <MenuItem value='pc'>PC</MenuItem>
                                                    </TextField>
                                                    <TextField name='TonemappingDesat' value={config.TonemappingDesat} onChange={onConfigChange} label={globalize.translate('LabelTonemappingDesat')} helperText={globalize.translate('LabelTonemappingDesatHelp')} type='number' slotProps={{ htmlInput: { min: 0, step: 0.00001 } }} />
                                                    <TextField name='TonemappingPeak' value={config.TonemappingPeak} onChange={onConfigChange} label={globalize.translate('LabelTonemappingPeak')} helperText={globalize.translate('LabelTonemappingPeakHelp')} type='number' slotProps={{ htmlInput: { min: 0, step: 0.00001 } }} />
                                                    <TextField name='TonemappingParam' value={config.TonemappingParam || ''} onChange={onConfigChange} label={globalize.translate('LabelTonemappingParam')} helperText={globalize.translate('LabelTonemappingParamHelp')} type='number' slotProps={{ htmlInput: { min: 0, step: 0.00001 } }} />
                                                </Box>
                                            </>
                                        )}
                                    </Stack>
                                </SectionCard>

                                {/* ── Audio ── */}
                                <SectionCard title={globalize.translate('PbAudio')} icon={<AudiotrackIcon />} accentColor={COLORS.audio}>
                                    <Stack spacing={2.5}>
                                        <ToggleRow label={globalize.translate('LabelEnableAudioVbr')} description={globalize.translate('LabelEnableAudioVbrHelp')} checked={!!config.EnableAudioVbr} onChange={setFlag('EnableAudioVbr')} color={COLORS.audio} />
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                            <TextField name='DownMixAudioBoost' value={config.DownMixAudioBoost} onChange={onConfigChange} label={globalize.translate('LabelDownMixAudioScale')} helperText={globalize.translate('LabelDownMixAudioScaleHelp')} type='number' slotProps={{ htmlInput: { required: true, min: 0.5, max: 3, step: 0.1 } }} />
                                            <TextField name='DownMixStereoAlgorithm' value={config.DownMixStereoAlgorithm} onChange={onConfigChange} label={globalize.translate('LabelStereoDownmixAlgorithm')} helperText={globalize.translate('StereoDownmixAlgorithmHelp')} select>
                                                <MenuItem value='None'>{globalize.translate('None')}</MenuItem>
                                                <MenuItem value='Dave750'>Dave750</MenuItem>
                                                <MenuItem value='NightmodeDialogue'>NightmodeDialogue</MenuItem>
                                                <MenuItem value='Rfc7845'>RFC7845</MenuItem>
                                                <MenuItem value='Ac4'>AC-4</MenuItem>
                                            </TextField>
                                        </Box>
                                        <TextField name='HlsAudioSeekStrategy' fullWidth value={config.HlsAudioSeekStrategy} onChange={onConfigChange} label={globalize.translate('LabelHlsAudioSeekStrategy')} helperText={globalize.translate('HlsAudioSeekStrategy')} select>
                                            <MenuItem value='TrimCopiedAudio'>TrimCopiedAudio</MenuItem>
                                            <MenuItem value='TranscodeAudio'>TranscodeAudio</MenuItem>
                                        </TextField>
                                    </Stack>
                                </SectionCard>
                            </Column>

                            <Column>
                                <ActiveStreamsCard title={globalize.translate('PbActiveTranscodes')} icon={<TransformIcon />} accentColor={COLORS.live} transcodesOnly description={globalize.translate('PbActiveTranscodesHelp')} />

                                {/* ── Quality ── */}
                                <SectionCard title={globalize.translate('PbQualityPerformance')} icon={<TuneIcon />} accentColor={COLORS.quality}>
                                    <Stack spacing={2.5}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                            <TextField name='EncodingThreadCount' value={config.EncodingThreadCount} onChange={onConfigChange} label={globalize.translate('LabelTranscodingThreadCount')} helperText={globalize.translate('LabelTranscodingThreadCountHelp')} select>
                                                {threadOptions.map(v => (
                                                    <MenuItem key={v} value={v}>
                                                        {v === '-1' ? globalize.translate('Auto') : v === '0' ? globalize.translate('OptionMax') : v}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                            <TextField name='EncoderPreset' value={config.EncoderPreset} onChange={onConfigChange} label={globalize.translate('LabelEncoderPreset')} helperText={globalize.translate('EncoderPresetHelp')} select>
                                                <MenuItem value='auto'>{globalize.translate('Auto')}</MenuItem>
                                                {[ 'veryslow', 'slower', 'slow', 'medium', 'fast', 'faster', 'veryfast', 'superfast', 'ultrafast' ].map(p => (
                                                    <MenuItem key={p} value={p}>{p}</MenuItem>
                                                ))}
                                            </TextField>
                                            <TextField name='H264Crf' value={config.H264Crf} onChange={onConfigChange} label={globalize.translate('LabelH264Crf')} helperText={globalize.translate('H264CrfHelp')} type='number' slotProps={{ htmlInput: { min: 0, max: 51, step: 1 } }} />
                                            <TextField name='H265Crf' value={config.H265Crf} onChange={onConfigChange} label={globalize.translate('LabelH265Crf')} helperText={globalize.translate('PbCrfHelp')} type='number' slotProps={{ htmlInput: { min: 0, max: 51, step: 1 } }} />
                                        </Box>
                                        <TextField name='DeinterlaceMethod' fullWidth value={config.DeinterlaceMethod} onChange={onConfigChange} label={globalize.translate('LabelDeinterlaceMethod')} helperText={globalize.translate('DeinterlaceMethodHelp')} select>
                                            <MenuItem value='yadif'>{globalize.translate('Yadif')}</MenuItem>
                                            <MenuItem value='bwdif'>{globalize.translate('Bwdif')}</MenuItem>
                                        </TextField>
                                        <ToggleRow label={globalize.translate('UseDoubleRateDeinterlacing')} description={globalize.translate('UseDoubleRateDeinterlacingHelp')} checked={!!config.DeinterlaceDoubleRate} onChange={setFlag('DeinterlaceDoubleRate')} color={COLORS.quality} />
                                    </Stack>
                                </SectionCard>

                                {/* ── Streaming / cleanup ── */}
                                <SectionCard title={globalize.translate('PbSegments')} icon={<StreamIcon />} accentColor={COLORS.streaming} description={globalize.translate('PbSegmentsHelp')}>
                                    <Stack spacing={1.25}>
                                        <ToggleRow label={globalize.translate('AllowOnTheFlySubtitleExtraction')} description={globalize.translate('AllowOnTheFlySubtitleExtractionHelp')} checked={!!config.EnableSubtitleExtraction} onChange={setFlag('EnableSubtitleExtraction')} color={COLORS.streaming} />
                                        <ToggleRow label={globalize.translate('AllowFfmpegThrottling')} description={globalize.translate('AllowFfmpegThrottlingHelp')} checked={!!config.EnableThrottling} onChange={setFlag('EnableThrottling')} color={COLORS.streaming} />
                                        <ToggleRow label={globalize.translate('AllowSegmentDeletion')} description={globalize.translate('AllowSegmentDeletionHelp')} checked={!!config.EnableSegmentDeletion} onChange={setFlag('EnableSegmentDeletion')} color={COLORS.streaming} />
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, pt: 1.25 }}>
                                            <TextField name='ThrottleDelaySeconds' value={config.ThrottleDelaySeconds} onChange={onConfigChange} label={globalize.translate('LabelThrottleDelaySeconds')} helperText={globalize.translate('LabelThrottleDelaySecondsHelp')} type='number' slotProps={{ htmlInput: { min: 10, max: 3600, step: 1 } }} />
                                            <TextField name='SegmentKeepSeconds' value={config.SegmentKeepSeconds} onChange={onConfigChange} label={globalize.translate('LabelSegmentKeepSeconds')} helperText={globalize.translate('LabelSegmentKeepSecondsHelp')} type='number' slotProps={{ htmlInput: { min: 10, max: 3600, step: 1 } }} />
                                            <TextField name='MaxMuxingQueueSize' value={config.MaxMuxingQueueSize} onChange={onConfigChange} label={globalize.translate('LabelMaxMuxingQueueSize')} helperText={globalize.translate('LabelMaxMuxingQueueSizeHelp')} />
                                        </Box>
                                    </Stack>
                                </SectionCard>

                                {/* ── Paths ── */}
                                <SectionCard title={globalize.translate('PbPathsFonts')} icon={<FolderSpecialIcon />} accentColor={COLORS.paths}>
                                    <Stack spacing={2.5}>
                                        <TextField name='FFmpegPath' fullWidth value={config.EncoderAppPathDisplay || ''} label={globalize.translate('LabelffmpegPath')} helperText={globalize.translate('LabelffmpegPathHelp')} disabled />
                                        <TextField
                                            name='TranscodingTempPath'
                                            fullWidth
                                            value={config.TranscodingTempPath || ''}
                                            onChange={onConfigChange}
                                            label={globalize.translate('LabelTranscodePath')}
                                            helperText={globalize.translate('LabelTranscodingTempPathHelp')}
                                            slotProps={{
                                                input: {
                                                    endAdornment: (
                                                        <InputAdornment position='end'>
                                                            <IconButton edge='end' onClick={showTranscodingPathPicker} sx={{ color: COLORS.paths }}><FolderOpenIcon /></IconButton>
                                                        </InputAdornment>
                                                    )
                                                }
                                            }}
                                        />
                                        <TextField
                                            name='FallbackFontPath'
                                            fullWidth
                                            value={config.FallbackFontPath || ''}
                                            onChange={onConfigChange}
                                            label={globalize.translate('LabelFallbackFontPath')}
                                            helperText={
                                                <Link href='https://jellyfin.org/docs/general/administration/configuration#fonts' target='_blank' sx={{ color: COLORS.paths }}>
                                                    {globalize.translate('LabelFallbackFontPathHelp')}
                                                </Link>
                                            }
                                            slotProps={{
                                                input: {
                                                    endAdornment: (
                                                        <InputAdornment position='end'>
                                                            <IconButton edge='end' onClick={showFallbackFontPathPicker} sx={{ color: COLORS.paths }}><FolderOpenIcon /></IconButton>
                                                        </InputAdornment>
                                                    )
                                                }
                                            }}
                                        />
                                        <ToggleRow label={globalize.translate('EnableFallbackFont')} description={globalize.translate('EnableFallbackFontHelp')} checked={!!config.EnableFallbackFont} onChange={setFlag('EnableFallbackFont')} color={COLORS.paths} />
                                    </Stack>
                                </SectionCard>

                                <TaskCard taskKey='DeleteTranscodeFiles' title={globalize.translate('PbCleanTranscodes')} icon={<CleaningServicesIcon />} accentColor={COLORS.paths} description={globalize.translate('PbCleanTranscodesHelp')} />

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.4)' }}>
                                    <MovieFilterIcon sx={{ fontSize: '1rem' }} />
                                    <Typography sx={{ fontSize: '0.74rem' }}>{globalize.translate('PbTranscodingFooter')}</Typography>
                                </Box>
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

Component.displayName = 'TranscodingPage';
