import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { LiveTvOptions } from '@jellyfin/sdk/lib/generated-client/models/live-tv-options';
import type { TunerHostInfo } from '@jellyfin/sdk/lib/generated-client/models/tuner-host-info';
import { getLiveTvApi } from '@jellyfin/sdk/lib/utils/api/live-tv-api';
import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CategoryIcon from '@mui/icons-material/Category';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import LinkIcon from '@mui/icons-material/Link';
import TuneIcon from '@mui/icons-material/Tune';
import WifiFindIcon from '@mui/icons-material/WifiFind';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { BrowseField, ChoiceTile, FormActions, IconBox, TunerTypeIcon, tunerColor } from 'apps/dashboard/features/livetv/components/LiveTvForms';
import getTunerName from 'apps/dashboard/features/livetv/utils/getTunerName';
import { Column, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

const DEFAULT_TUNER: TunerHostInfo = {
    Type: '',
    TunerCount: 0,
    FallbackMaxStreamingBitrate: 30e6,
    AllowStreamSharing: true,
    IgnoreDts: true,
    ReadAtNativeFramerate: false
};

const TYPE_HELP: Record<string, string> = {
    m3u: 'LtfTypeM3uHelp',
    hdhomerun: 'LtfTypeHdhrHelp',
    satip: 'LtfTypeSatipHelp',
    hauppauge: 'LtfTypeHauppaugeHelp'
};

const TIPS: Record<string, string[]> = {
    m3u: [ 'LtfTipM3u1', 'LtfTipM3u2', 'LtfTipM3u3' ],
    hdhomerun: [ 'LtfTipHdhr1', 'LtfTipHdhr2' ]
};

/** Which fields each tuner type uses (same rules as the classic page). */
const capabilities = (type: string) => {
    const m3u = type === 'm3u';
    const hdhr = type === 'hdhomerun';
    return {
        path: m3u || hdhr,
        browse: m3u,
        userAgent: m3u,
        tunerCount: m3u,
        fallbackBitrate: m3u || hdhr,
        favorites: hdhr,
        hwTranscode: hdhr,
        drm: hdhr,
        fmp4: m3u,
        sharing: m3u,
        looping: m3u,
        ignoreDts: m3u,
        nativeFramerate: m3u
    };
};

export const Component = () => {
    const { api } = useApi();
    const navigate = useNavigate();
    const [ params ] = useSearchParams();
    const id = params.get('id');
    const { data: config, isPending } = useNamedConfiguration<LiveTvOptions>('livetv');
    const [ tuner, setTuner ] = useState<TunerHostInfo | null>(id ? null : DEFAULT_TUNER);
    const [ found, setFound ] = useState<TunerHostInfo[] | null>(null);

    const { data: types } = useQuery({
        queryKey: [ 'LiveTvTunerTypes' ],
        queryFn: async ({ signal }) => (await getLiveTvApi(api!).getTunerHostTypes({ signal })).data,
        enabled: !!api
    });

    useEffect(() => {
        if (id && config && !tuner) {
            setTuner(config.TunerHosts?.find(t => t.Id === id) || DEFAULT_TUNER);
        }
    }, [ id, config, tuner ]);

    const update = useCallback((patch: Partial<TunerHostInfo>) => setTuner(t => ({ ...t, ...patch })), []);

    const discover = useMutation({
        mutationFn: async () => (await getLiveTvApi(api!).discoverTuners({ newDevicesOnly: true })).data,
        onSuccess: data => setFound(data)
    });

    const save = useMutation({
        mutationFn: async (info: TunerHostInfo) => (await getLiveTvApi(api!).addTunerHost({ tunerHostInfo: info })).data,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [ QUERY_KEY, 'livetv' ] });
            void queryClient.invalidateQueries({ queryKey: [ 'LiveTvOverview' ] });
            navigate('/dashboard/livetv');
        }
    });

    const type = (tuner?.Type || '').toLowerCase();
    const caps = useMemo(() => capabilities(type), [ type ]);

    const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!tuner?.Type) return;
        save.mutate({
            ...tuner,
            Id: id || tuner.Id || undefined,
            Url: tuner.Url || null,
            UserAgent: tuner.UserAgent || null,
            FriendlyName: tuner.FriendlyName || null,
            DeviceId: tuner.DeviceId || null,
            TunerCount: Number(tuner.TunerCount) || 0,
            FallbackMaxStreamingBitrate: tuner.FallbackMaxStreamingBitrate || 30e6
        });
    }, [ id, save, tuner ]);

    const runDiscover = useCallback(() => discover.mutate(), [ discover ]);

    if (isPending || !tuner) return <Loading />;

    const isEdit = !!id;
    const color = tunerColor(type);
    const typeList = types?.length ? types : [ { Id: 'm3u', Name: 'M3U' }, { Id: 'hdhomerun', Name: 'HDHomeRun' } ];
    const bitrateMbps = tuner.FallbackMaxStreamingBitrate ? String(tuner.FallbackMaxStreamingBitrate / 1e6) : '';
    const title = isEdit ? (tuner.FriendlyName || getTunerName(type)) : globalize.translate('HeaderLiveTvTunerSetup');

    return (
        <Page id='liveTvTunerPage' title={globalize.translate('HeaderLiveTvTunerSetup')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={title} subtitle={globalize.translate(isEdit ? 'LtfTunerEditSubtitle' : 'LtfTunerNewSubtitle')} />

                <form onSubmit={onSubmit} style={{ maxWidth: 'none' }}>
                    {save.isError && <Alert severity='error' sx={{ mb: 2 }}>{globalize.translate('ErrorSavingTvProvider')}</Alert>}

                    <SectionCard title={globalize.translate('LabelTunerType')} icon={<CategoryIcon />} accentColor='#00a4dc' description={isEdit ? globalize.translate('LtfTypeLocked') : undefined}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 1.5 }}>
                            {typeList.map(t => {
                                const tid = (t.Id || '').toLowerCase();
                                return (
                                    <ChoiceTile
                                        key={tid}
                                        selected={type === tid}
                                        disabled={isEdit}
                                        color={tunerColor(tid)}
                                        icon={<TunerTypeIcon type={tid} />}
                                        title={t.Name || tid}
                                        description={TYPE_HELP[tid] ? globalize.translate(TYPE_HELP[tid]) : undefined}
                                        onClick={() => update({ Type: t.Id })}
                                    />
                                );
                            })}
                        </Box>

                        {!isEdit && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                    <Button variant='outlined' onClick={runDiscover} disabled={discover.isPending} startIcon={discover.isPending ? <CircularProgress size={16} /> : <WifiFindIcon />}>
                                        {globalize.translate('HeaderDetectMyDevices')}
                                    </Button>
                                    <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)' }}>{globalize.translate('LtfDetectHelp')}</Typography>
                                </Box>
                                {found && !found.length && (
                                    <Alert severity='info' sx={{ mt: 1.5 }}>{globalize.translate('LtvNothingFound')}</Alert>
                                )}
                                {found && found.length > 0 && (
                                    <Stack spacing={1} sx={{ mt: 1.5 }}>
                                        {found.map(d => (
                                            <Box key={d.DeviceId || d.Url} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                <IconBox color={tunerColor(d.Type)} size={36}><TunerTypeIcon type={d.Type} /></IconBox>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography sx={{ fontSize: '0.88rem' }}>{d.FriendlyName || getTunerName(d.Type)}</Typography>
                                                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>{d.Url}</Typography>
                                                </Box>
                                                <Button size='small' variant='contained' onClick={() => update({ ...d, Id: undefined })}>{globalize.translate('LtfUseDevice')}</Button>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}
                            </Box>
                        )}
                    </SectionCard>

                    {!type ? (
                        <Alert severity='info' sx={{ mt: 2 }}>{globalize.translate('LtfPickType')}</Alert>
                    ) : (
                        <>
                            <TwoColumns>
                                <Column>
                                    <SectionCard title={globalize.translate('LtfConnection')} icon={<LinkIcon />} accentColor={color}>
                                        <Stack spacing={2.5}>
                                            <TextField
                                                label={globalize.translate('LabelFriendlyName')}
                                                value={tuner.FriendlyName || ''}
                                                onChange={e => update({ FriendlyName: e.target.value })}
                                                placeholder={getTunerName(type)}
                                                helperText={globalize.translate('LtfFriendlyNameHelp')}
                                                fullWidth
                                                slotProps={{ inputLabel: { shrink: true } }}
                                            />
                                            {caps.path && (
                                                <BrowseField
                                                    label={globalize.translate(caps.browse ? 'LabelFileOrUrl' : 'LabelTunerIpAddress')}
                                                    value={tuner.Url || ''}
                                                    onChange={v => update({ Url: v })}
                                                    required={caps.browse}
                                                    browse={caps.browse}
                                                    placeholder={caps.browse ? 'http://.../playlist.m3u' : '192.168.1.50'}
                                                />
                                            )}
                                            {caps.userAgent && (
                                                <TextField
                                                    label={globalize.translate('LabelUserAgent')}
                                                    helperText={globalize.translate('UserAgentHelp')}
                                                    value={tuner.UserAgent || ''}
                                                    onChange={e => update({ UserAgent: e.target.value })}
                                                    fullWidth
                                                    slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }, inputLabel: { shrink: true } }}
                                                />
                                            )}
                                            {(caps.tunerCount || caps.fallbackBitrate) && (
                                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                                    {caps.tunerCount && (
                                                        <TextField
                                                            type='number'
                                                            label={globalize.translate('LabelSimultaneousConnectionLimit')}
                                                            helperText={globalize.translate('LtfTunerCountHelp')}
                                                            value={String(tuner.TunerCount ?? 0)}
                                                            onChange={e => update({ TunerCount: parseInt(e.target.value, 10) || 0 })}
                                                            slotProps={{ htmlInput: { min: 0, step: 1 }, inputLabel: { shrink: true } }}
                                                        />
                                                    )}
                                                    {caps.fallbackBitrate && (
                                                        <TextField
                                                            type='number'
                                                            label={globalize.translate('LabelFallbackMaxStreamingBitrate')}
                                                            helperText={globalize.translate('FallbackMaxStreamingBitrateHelp')}
                                                            value={bitrateMbps}
                                                            onChange={e => update({ FallbackMaxStreamingBitrate: Math.round((parseFloat(e.target.value) || 0) * 1e6) })}
                                                            slotProps={{ htmlInput: { min: 1, step: 1 }, input: { endAdornment: <InputAdornment position='end'>Mbps</InputAdornment> }, inputLabel: { shrink: true } }}
                                                        />
                                                    )}
                                                </Box>
                                            )}
                                        </Stack>
                                    </SectionCard>

                                    {TIPS[type] && (
                                        <SectionCard title={globalize.translate('LtfTips')} icon={<LightbulbIcon />} accentColor='#ffca28'>
                                            <Stack component='ul' spacing={1} sx={{ m: 0, pl: 2.5 }}>
                                                {TIPS[type].map(k => (
                                                    <Typography key={k} component='li' sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{globalize.translate(k)}</Typography>
                                                ))}
                                            </Stack>
                                        </SectionCard>
                                    )}
                                </Column>

                                <Column>
                                    <SectionCard title={globalize.translate('LtfOptions')} icon={<TuneIcon />} accentColor='#aa5cc3'>
                                        <Stack spacing={1.25}>
                                            {caps.favorites && <ToggleRow label={globalize.translate('LabelImportOnlyFavoriteChannels')} description={globalize.translate('ImportFavoriteChannelsHelp')} checked={!!tuner.ImportFavoritesOnly} onChange={v => update({ ImportFavoritesOnly: v })} color='#aa5cc3' />}
                                            {caps.hwTranscode && <ToggleRow label={globalize.translate('LabelAllowHWTranscoding')} description={globalize.translate('AllowHWTranscodingHelp')} checked={!!tuner.AllowHWTranscoding} onChange={v => update({ AllowHWTranscoding: v })} color='#aa5cc3' />}
                                            {caps.sharing && <ToggleRow label={globalize.translate('LabelAllowStreamSharing')} description={globalize.translate('AllowStreamSharingHelp')} checked={!!tuner.AllowStreamSharing} onChange={v => update({ AllowStreamSharing: v })} color='#aa5cc3' />}
                                            {caps.fmp4 && <ToggleRow label={globalize.translate('LabelAllowFmp4TranscodingContainer')} description={globalize.translate('AllowFmp4TranscodingContainerHelp')} checked={!!tuner.AllowFmp4TranscodingContainer} onChange={v => update({ AllowFmp4TranscodingContainer: v })} color='#aa5cc3' />}
                                            {caps.looping && <ToggleRow label={globalize.translate('EnableStreamLooping')} description={globalize.translate('EnableStreamLoopingHelp')} checked={!!tuner.EnableStreamLooping} onChange={v => update({ EnableStreamLooping: v })} color='#aa5cc3' />}
                                            {caps.ignoreDts && <ToggleRow label={globalize.translate('IgnoreDts')} description={globalize.translate('IgnoreDtsHelp')} checked={!!tuner.IgnoreDts} onChange={v => update({ IgnoreDts: v })} color='#aa5cc3' />}
                                            {caps.nativeFramerate && <ToggleRow label={globalize.translate('ReadInputAtNativeFramerate')} description={globalize.translate('ReadInputAtNativeFramerateHelp')} checked={!!tuner.ReadAtNativeFramerate} onChange={v => update({ ReadAtNativeFramerate: v })} color='#aa5cc3' />}
                                            {!Object.values(caps).some(Boolean) && (
                                                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('LtfNoOptions')}</Typography>
                                            )}
                                        </Stack>
                                        {caps.drm && <Alert severity='warning' sx={{ mt: 2 }}>{globalize.translate('DrmChannelsNotImported')}</Alert>}
                                    </SectionCard>
                                </Column>
                            </TwoColumns>

                            <FormActions saving={save.isPending} disabled={!type} />
                        </>
                    )}
                </form>
            </Box>
        </Page>
    );
};

Component.displayName = 'LiveTvTunerPage';
