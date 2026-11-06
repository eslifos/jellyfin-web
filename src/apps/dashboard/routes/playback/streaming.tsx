import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CellTowerIcon from '@mui/icons-material/CellTower';
import GroupIcon from '@mui/icons-material/Group';
import HighQualityIcon from '@mui/icons-material/HighQuality';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import PublicIcon from '@mui/icons-material/Public';
import SpeedIcon from '@mui/icons-material/Speed';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';

import { ActiveStreamsCard, Column, InfoGrid, InfoTile, SaveBar, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import useLiveSessions from 'apps/dashboard/features/sessions/hooks/useLiveSessions';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY, useConfiguration } from 'hooks/useConfiguration';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard } from '../../components/cosmic';

const COLORS = {
    limit: '#00a4dc',
    quality: '#aa5cc3',
    users: '#ff9800',
    streams: '#4caf50'
};

/** Quick presets in Mbps (0 = no limit). */
const PRESETS = [ 0, 4, 8, 12, 20, 40, 80 ];

/** Approximate quality reachable at each bitrate (H.264). */
const QUALITY_GUIDE = [
    { mbps: 1.5, label: '480p' },
    { mbps: 4, label: '720p' },
    { mbps: 8, label: '1080p' },
    { mbps: 20, label: '1080p HQ' },
    { mbps: 40, label: '4K' },
    { mbps: 80, label: '4K HDR / Remux' }
];

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const { data: config } = await getSystemApi(api).getConfiguration();
    const formData = await request.formData();

    const bitrateLimit = formData.get('StreamingBitrateLimit')?.toString();
    config.RemoteClientBitrateLimit = Math.trunc(1e6 * parseFloat(bitrateLimit || '0'));

    await getSystemApi(api)
        .updateConfiguration({ serverConfiguration: config });

    void queryClient.invalidateQueries({
        queryKey: [ QUERY_KEY ]
    });

    return {
        isSaved: true
    };
};

const formatMbps = (bits?: number | null) => (bits ? `${(bits / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} Mbps` : '');

export const Component = () => {
    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const isSubmitting = navigation.state === 'submitting';
    const { isPending: isConfigurationPending, isError: isConfigurationError, data: config } = useConfiguration();
    const { data: users } = useUsers();
    const { data: sessions } = useLiveSessions();

    const [ limit, setLimit ] = useState<string | null>(null);
    const [ saved, setSaved ] = useState(false);

    useEffect(() => {
        if (config && limit === null) {
            setLimit(config.RemoteClientBitrateLimit ? String(config.RemoteClientBitrateLimit / 1e6) : '');
        }
    }, [ config, limit ]);

    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    const onLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setLimit(e.target.value), []);
    const closeSaved = useCallback(() => setSaved(false), []);

    const usersWithLimit = useMemo(() => (users || [])
        .filter(u => (u.Policy?.RemoteClientBitrateLimit ?? 0) > 0)
        .sort((a, b) => (a.Name || '').localeCompare(b.Name || '')), [ users ]);

    const activeStreams = (sessions || []).filter(s => s.NowPlayingItem);
    const totalBitrate = activeStreams.reduce((sum, s) => sum + (s.TranscodingInfo?.Bitrate ?? 0), 0);

    if (isConfigurationPending || limit === null) {
        return <Loading />;
    }

    const mbps = parseFloat(limit) || 0;
    const reachable = mbps === 0 ? QUALITY_GUIDE[QUALITY_GUIDE.length - 1] : [ ...QUALITY_GUIDE ].reverse().find(q => q.mbps <= mbps);

    return (
        <Page
            id='streamingSettingsPage'
            title={globalize.translate('TabStreaming')}
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={globalize.translate('TabStreaming')} subtitle={globalize.translate('PbStreamingSubtitle')} />

                {isConfigurationError ? (
                    <Alert severity='error'>{globalize.translate('StreamingLoadError')}</Alert>
                ) : (
                    <Form method='POST' style={{ maxWidth: 'none' }}>
                        <InfoGrid>
                            <InfoTile icon={<SpeedIcon />} color={COLORS.limit} label={globalize.translate('PbGlobalLimit')} value={mbps ? `${mbps} Mbps` : globalize.translate('PbNoLimit')} />
                            <InfoTile icon={<GroupIcon />} color={COLORS.users} label={globalize.translate('PbUsersWithLimit')} value={usersWithLimit.length} />
                            <InfoTile icon={<PlayCircleIcon />} color={COLORS.streams} label={globalize.translate('ResourceActiveStreams')} value={activeStreams.length} />
                            <InfoTile icon={<CellTowerIcon />} color={COLORS.quality} label={globalize.translate('PbTranscodedBitrate')} value={totalBitrate ? formatMbps(totalBitrate) : '—'} />
                        </InfoGrid>

                        <TwoColumns>
                            <Column>
                                <SectionCard title={globalize.translate('PbRemoteLimit')} icon={<PublicIcon />} accentColor={COLORS.limit} description={globalize.translate('LabelRemoteClientBitrateLimitHelp')}>
                                    <TextField
                                        fullWidth
                                        type='number'
                                        inputMode='decimal'
                                        name='StreamingBitrateLimit'
                                        label={globalize.translate('LabelRemoteClientBitrateLimit')}
                                        value={limit}
                                        onChange={onLimitChange}
                                        slotProps={{
                                            htmlInput: { min: 0, step: 0.25, max: 2147.25 },
                                            input: { endAdornment: <InputAdornment position='end'>Mbps</InputAdornment> }
                                        }}
                                    />
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                                        {PRESETS.map(p => {
                                            const selected = (p === 0 && mbps === 0) || p === mbps;
                                            return (
                                                <Chip
                                                    key={p}
                                                    label={p === 0 ? globalize.translate('PbNoLimit') : `${p} Mbps`}
                                                    onClick={() => setLimit(p === 0 ? '' : String(p))}
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: selected ? '#fff' : 'rgba(255,255,255,0.7)',
                                                        background: selected ? `${COLORS.limit}55` : 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${selected ? COLORS.limit : 'rgba(255,255,255,0.12)'}`
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>
                                    {reachable && (
                                        <Typography sx={{ mt: 2, fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>
                                            {mbps === 0 ? globalize.translate('PbNoLimitHelp') : globalize.translate('PbReachableQuality', reachable.label)}
                                        </Typography>
                                    )}
                                </SectionCard>

                                <SectionCard title={globalize.translate('PbQualityGuide')} icon={<HighQualityIcon />} accentColor={COLORS.quality} description={globalize.translate('PbQualityGuideHelp')}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                        {QUALITY_GUIDE.map(q => {
                                            const ok = mbps === 0 || q.mbps <= mbps;
                                            return (
                                                <Box key={q.label} sx={{
                                                    display: 'flex', alignItems: 'center', gap: 1.5, p: 1, px: 1.5, borderRadius: '10px',
                                                    background: ok ? `${COLORS.quality}14` : 'rgba(255,255,255,0.02)',
                                                    border: `1px solid ${ok ? COLORS.quality + '40' : 'rgba(255,255,255,0.05)'}`
                                                }}>
                                                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: ok ? '#fff' : 'rgba(255,255,255,0.35)', flex: 1 }}>{q.label}</Typography>
                                                    <Typography sx={{ fontSize: '0.78rem', color: ok ? COLORS.quality : 'rgba(255,255,255,0.3)' }}>≈ {q.mbps} Mbps</Typography>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </SectionCard>
                            </Column>

                            <Column>
                                <ActiveStreamsCard title={globalize.translate('ResourceActiveStreams')} icon={<PlayCircleIcon />} accentColor={COLORS.streams} />

                                <SectionCard title={globalize.translate('PbUsersWithLimit')} icon={<GroupIcon />} accentColor={COLORS.users} description={globalize.translate('PbUsersWithLimitHelp')}>
                                    {usersWithLimit.length === 0 ? (
                                        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)' }}>{globalize.translate('PbNoUsersWithLimit')}</Typography>
                                    ) : (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                            {usersWithLimit.map(u => (
                                                <Box
                                                    key={u.Id}
                                                    component='a'
                                                    href={`#/dashboard/users/${u.Id}/profile`}
                                                    sx={{
                                                        display: 'flex', alignItems: 'center', gap: 1.5, p: 1, px: 1.5, borderRadius: '10px', textDecoration: 'none',
                                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                                        '&:hover': { borderColor: `${COLORS.users}66` }
                                                    }}
                                                >
                                                    <Typography sx={{ flex: 1, fontSize: '0.85rem', color: 'rgba(255,255,255,0.88)' }}>{u.Name}</Typography>
                                                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.users }}>{formatMbps(u.Policy?.RemoteClientBitrateLimit)}</Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    )}
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

Component.displayName = 'StreamingPage';
