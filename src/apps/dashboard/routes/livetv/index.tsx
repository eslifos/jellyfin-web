import React, { type FC, useCallback, useState } from 'react';
import type { LiveTvOptions } from '@jellyfin/sdk/lib/generated-client/models/live-tv-options';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DvrIcon from '@mui/icons-material/Dvr';
import EventIcon from '@mui/icons-material/Event';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import TvIcon from '@mui/icons-material/Tv';
import { Link, useNavigate } from 'react-router-dom';

import { useLiveTvOverview } from 'apps/dashboard/features/livetv/api/useLiveTvOverview';
import {
    CardGrid,
    DiscoverCard,
    ProviderCard,
    TunerCard,
    UpcomingRecordingsCard,
    WatchingNowCard
} from 'apps/dashboard/features/livetv/components/LiveTvCards';
import { Column, InfoTile, TaskCard, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useNamedConfiguration } from 'hooks/useNamedConfiguration';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader } from '../../components/cosmic';

const CONFIG_KEY = 'livetv';

const SectionTitle: FC<{ title: string; count?: number; action?: React.ReactNode }> = ({ title, count, action }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, mt: 1 }}>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#00a4dc', whiteSpace: 'nowrap' }}>
            {title}{count != null ? ` · ${count}` : ''}
        </Typography>
        <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(0,164,220,0.35), transparent)' }} />
        {action}
    </Box>
);

const Step: FC<{ n: number; title: string; text: string; done: boolean; action?: React.ReactNode }> = ({ n, title, text, done, action }) => (
    <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: '14px', background: done ? 'rgba(76,175,80,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${done ? 'rgba(76,175,80,0.35)' : 'rgba(255,255,255,0.07)'}` }}>
        <Box sx={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
            color: done ? '#4caf50' : '#00a4dc', background: done ? 'rgba(76,175,80,0.15)' : 'rgba(0,164,220,0.15)'
        }}>
            {done ? '✓' : n}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{title}</Typography>
            <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.5)', mt: 0.25 }}>{text}</Typography>
            {action && !done && <Box sx={{ mt: 1 }}>{action}</Box>}
        </Box>
    </Box>
);

export const Component = () => {
    const navigate = useNavigate();
    const { data: config, isPending, isError } = useNamedConfiguration<LiveTvOptions>(CONFIG_KEY);
    const { data: overview } = useLiveTvOverview();
    const [ menuAnchor, setMenuAnchor ] = useState<HTMLElement | null>(null);

    const openProviderMenu = useCallback((e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget), []);
    const closeProviderMenu = useCallback(() => setMenuAnchor(null), []);
    const addSchedulesDirect = useCallback(() => navigate('/dashboard/livetv/guide?type=schedulesdirect'), [ navigate ]);
    const addXmltv = useCallback(() => navigate('/dashboard/livetv/guide?type=xmltv'), [ navigate ]);
    const refresh = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: [ 'LiveTvOverview' ] });
        void queryClient.invalidateQueries({ queryKey: [ 'NamedConfiguration', CONFIG_KEY ] });
    }, []);

    if (isPending) return <Loading />;

    const tuners = config?.TunerHosts || [];
    const providers = config?.ListingProviders || [];
    const streams = tuners.reduce((sum, t) => sum + (t.TunerCount || 0), 0);
    const unlimited = tuners.some(t => !t.TunerCount);
    const mappedChannels = providers.reduce((sum, p) => sum + (p.ChannelMappings?.length || 0), 0);
    const services = (overview?.info?.Services || []).filter(s => s.Status && s.Status !== 'Ok');
    const isSetUp = tuners.length > 0 && providers.length > 0;

    const addTunerButton = (
        <Button variant='contained' size='small' startIcon={<AddIcon />} component={Link} to='/dashboard/livetv/tuner' sx={{ borderRadius: '10px' }}>
            {globalize.translate('ButtonAddTunerDevice')}
        </Button>
    );
    const addProviderButton = (
        <Button variant='outlined' size='small' startIcon={<AddIcon />} onClick={openProviderMenu} sx={{ borderRadius: '10px' }}>
            {globalize.translate('ButtonAddProvider')}
        </Button>
    );

    return (
        <Page id='liveTvStatusPage' title={globalize.translate('LiveTV')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('LiveTV')}
                    subtitle={globalize.translate('LtvSubtitle')}
                    actions={(
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                            <Button variant='outlined' startIcon={<RefreshIcon />} onClick={refresh} sx={{ borderRadius: '12px' }}>
                                {globalize.translate('Refresh')}
                            </Button>
                            <Button variant='outlined' color='secondary' startIcon={<DvrIcon />} component={Link} to='/dashboard/livetv/recordings' sx={{ borderRadius: '12px' }}>
                                {globalize.translate('HeaderDVR')}
                            </Button>
                            <Button variant='contained' startIcon={<TvIcon />} component={Link} to='/livetv?tab=1' sx={{ borderRadius: '12px' }}>
                                {globalize.translate('LtvOpenGuide')}
                            </Button>
                        </Box>
                    )}
                />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('HeaderError')}</Alert>
                ) : (
                    <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, mb: 2.5 }}>
                            <InfoTile icon={<SettingsInputAntennaIcon />} label={globalize.translate('LtvTuners')} value={tuners.length} color='#00a4dc'
                                secondary={tuners.length ? (unlimited ? globalize.translate('LtvStreamsUnlimited') : globalize.translate('LtvStreams', streams)) : undefined} />
                            <InfoTile icon={<LiveTvIcon />} label={globalize.translate('LtvChannels')} value={overview?.channelCount ?? '—'} color='#26c6da'
                                secondary={mappedChannels ? globalize.translate('LtvMapped', mappedChannels) : undefined} />
                            <InfoTile icon={<ListAltIcon />} label={globalize.translate('LtvGuides')} value={providers.length} color='#aa5cc3' />
                            <InfoTile icon={<FiberManualRecordIcon />} label={globalize.translate('LtvRecordingNow')} value={overview?.recordingNow ?? '—'} color='#ef5350' />
                            <InfoTile icon={<EventIcon />} label={globalize.translate('LtvScheduled')} value={overview?.scheduled ?? '—'} color='#ff9800' />
                            <InfoTile icon={<EventRepeatIcon />} label={globalize.translate('LtvSeriesRules')} value={overview?.seriesCount ?? '—'} color='#66bb6a' />
                            <InfoTile icon={<OndemandVideoIcon />} label={globalize.translate('LtvRecordings')} value={overview?.recordingCount ?? '—'} color='#90caf9' />
                        </Box>

                        {services.map(s => (
                            <Alert key={s.Name} severity='warning' sx={{ mb: 2, borderRadius: '12px' }}>
                                {s.Name}: {s.StatusMessage || s.Status}
                            </Alert>
                        ))}

                        {!isSetUp && (
                            <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: '16px', border: '1px solid rgba(0,164,220,0.3)' }}>
                                <Typography sx={{ fontSize: '1rem', fontWeight: 700, mb: 0.5 }}>{globalize.translate('LtvGetStarted')}</Typography>
                                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', mb: 2 }}>{globalize.translate('LtvGetStartedHelp')}</Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                                    <Step n={1} title={globalize.translate('LtvStep1')} text={globalize.translate('LtvStep1Help')} done={tuners.length > 0} action={addTunerButton} />
                                    <Step n={2} title={globalize.translate('LtvStep2')} text={globalize.translate('LtvStep2Help')} done={providers.length > 0} action={addProviderButton} />
                                    <Step n={3} title={globalize.translate('LtvStep3')} text={globalize.translate('LtvStep3Help')} done={(overview?.channelCount ?? 0) > 0 && providers.length > 0} />
                                </Box>
                            </Paper>
                        )}

                        <SectionTitle title={globalize.translate('HeaderTunerDevices')} count={tuners.length} action={addTunerButton} />
                        {tuners.length === 0 ? (
                            <Typography sx={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.45)', mb: 3 }}>{globalize.translate('LtvNoTuners')}</Typography>
                        ) : (
                            <Box sx={{ mb: 3 }}>
                                <CardGrid>
                                    {tuners.map(t => <TunerCard key={t.Id} tuner={t} />)}
                                </CardGrid>
                            </Box>
                        )}

                        <SectionTitle title={globalize.translate('HeaderGuideProviders')} count={providers.length} action={addProviderButton} />
                        {providers.length === 0 ? (
                            <Typography sx={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.45)', mb: 3 }}>{globalize.translate('LtvNoGuides')}</Typography>
                        ) : (
                            <Box sx={{ mb: 3 }}>
                                <CardGrid>
                                    {providers.map(p => <ProviderCard key={p.Id} provider={p} tunerCount={tuners.length} />)}
                                </CardGrid>
                            </Box>
                        )}

                        <TwoColumns>
                            <Column>
                                <WatchingNowCard />
                                <UpcomingRecordingsCard timers={overview?.timers || []} />
                            </Column>
                            <Column>
                                <TaskCard
                                    taskKey='RefreshGuide'
                                    title={globalize.translate('LtvGuideData')}
                                    icon={<RefreshIcon />}
                                    accentColor='#aa5cc3'
                                    description={globalize.translate('LtvGuideDataHelp', config?.GuideDays || globalize.translate('Auto'))}
                                />
                                <DiscoverCard />
                            </Column>
                        </TwoColumns>

                        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeProviderMenu}>
                            <MenuItem onClick={addXmltv}>
                                <ListItemIcon><ListAltIcon fontSize='small' /></ListItemIcon>
                                <ListItemText primary='XMLTV' secondary={globalize.translate('LtvXmltvHelp')} />
                            </MenuItem>
                            <MenuItem onClick={addSchedulesDirect}>
                                <ListItemIcon><EventIcon fontSize='small' /></ListItemIcon>
                                <ListItemText primary='Schedules Direct' secondary={globalize.translate('LtvSdHelp')} />
                            </MenuItem>
                        </Menu>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'LiveTvPage';
