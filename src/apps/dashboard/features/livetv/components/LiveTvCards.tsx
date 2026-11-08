/**
 * Cosmic cards for the Live TV dashboard: tuners, guide providers,
 * network discovery, people watching now and upcoming recordings.
 */
import React, { type FC, useCallback, useState } from 'react';
import type { ListingsProviderInfo } from '@jellyfin/sdk/lib/generated-client/models/listings-provider-info';
import type { TimerInfoDto } from '@jellyfin/sdk/lib/generated-client/models/timer-info-dto';
import type { TunerHostInfo } from '@jellyfin/sdk/lib/generated-client/models/tuner-host-info';
import { getLiveTvApi } from '@jellyfin/sdk/lib/utils/api/live-tv-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Cancel';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import EventIcon from '@mui/icons-material/Event';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import RouterIcon from '@mui/icons-material/Router';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import WifiFindIcon from '@mui/icons-material/WifiFind';
import { Link, useNavigate } from 'react-router-dom';

import { SectionCard } from 'apps/dashboard/components/cosmic';
import { useDeleteProvider } from 'apps/dashboard/features/livetv/api/useDeleteProvider';
import { useDeleteTuner } from 'apps/dashboard/features/livetv/api/useDeleteTuner';
import getProviderConfigurationUrl from 'apps/dashboard/features/livetv/utils/getProviderConfigurationUrl';
import getProviderName from 'apps/dashboard/features/livetv/utils/getProviderName';
import getTunerName from 'apps/dashboard/features/livetv/utils/getTunerName';
import useLiveSessions from 'apps/dashboard/features/sessions/hooks/useLiveSessions';
import ChannelMapper from 'components/channelMapper/channelMapper';
import ConfirmDialog from 'components/ConfirmDialog';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { queryClient } from 'utils/query/queryClient';

const TUNER_COLORS: Record<string, string> = { m3u: '#00a4dc', hdhomerun: '#4caf50', hauppauge: '#ff9800', satip: '#aa5cc3' };
const tunerColor = (type?: string | null) => TUNER_COLORS[(type || '').toLowerCase()] || '#90a4ae';

const TunerTypeIcon: FC<{ type?: string | null }> = ({ type }) => {
    switch ((type || '').toLowerCase()) {
        case 'hdhomerun': return <RouterIcon />;
        case 'satip': return <SatelliteAltIcon />;
        case 'm3u': return <ListAltIcon />;
        default: return <SettingsInputAntennaIcon />;
    }
};

const IconBox: FC<{ color: string; children: React.ReactNode; size?: number }> = ({ color, children, size = 44 }) => (
    <Box sx={{
        width: size, height: size, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1f`, border: `1px solid ${color}44`, '& svg': { color, fontSize: size * 0.5 }
    }}>
        {children}
    </Box>
);

const InfoRow: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{label}</Typography>
        <Box sx={{ ml: 'auto', minWidth: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
            {children}
        </Box>
    </Box>
);

const OptionChip: FC<{ label: string; color?: string }> = ({ label, color = '#00a4dc' }) => (
    <Box sx={{ px: 1, py: 0.25, borderRadius: '8px', fontSize: '0.66rem', fontWeight: 600, color, background: `${color}14`, border: `1px solid ${color}33`, whiteSpace: 'nowrap' }}>
        {label}
    </Box>
);

const cardSx = (accent: string) => ({
    position: 'relative', overflow: 'hidden', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5,
    borderRadius: '16px', border: `1px solid ${accent}33`,
    boxShadow: `0 8px 28px rgba(0,0,0,0.3), 0 0 18px ${accent}10`,
    transition: 'transform 0.2s, border-color 0.2s', '&:hover': { transform: 'translateY(-2px)', borderColor: `${accent}77` }
});

const AccentLine: FC<{ color: string }> = ({ color }) => (
    <Box sx={{ position: 'absolute', top: 0, left: '1.25rem', right: '1.25rem', height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
);

const detailsSx = { display: 'flex', flexDirection: 'column', gap: 0.75, p: 1.25, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' };

export const CardGrid: FC<{ children: React.ReactNode }> = ({ children }) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 2 }}>{children}</Box>
);

export const TunerCard: FC<{ tuner: TunerHostInfo }> = ({ tuner }) => {
    const navigate = useNavigate();
    const deleteTuner = useDeleteTuner();
    const [ confirmOpen, setConfirmOpen ] = useState(false);
    const [ copied, setCopied ] = useState(false);
    const accent = tunerColor(tuner.Type);

    const edit = useCallback(() => navigate(`/dashboard/livetv/tuner?id=${tuner.Id}`), [ navigate, tuner.Id ]);
    const openConfirm = useCallback(() => setConfirmOpen(true), []);
    const closeConfirm = useCallback(() => setConfirmOpen(false), []);
    const remove = useCallback(() => {
        if (tuner.Id) deleteTuner.mutate({ id: tuner.Id }, { onSettled: () => setConfirmOpen(false) });
    }, [ deleteTuner, tuner.Id ]);
    const copyUrl = useCallback(() => {
        if (!tuner.Url) return;
        void navigator.clipboard?.writeText(tuner.Url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [ tuner.Url ]);

    const options = [
        tuner.ImportFavoritesOnly && globalize.translate('LtvOptFavorites'),
        tuner.AllowHWTranscoding && globalize.translate('LtvOptHwTranscode'),
        tuner.AllowStreamSharing && globalize.translate('LtvOptSharing'),
        tuner.EnableStreamLooping && globalize.translate('LtvOptLooping'),
        tuner.ReadAtNativeFramerate && globalize.translate('LtvOptNativeFramerate'),
        tuner.IgnoreDts && globalize.translate('LtvOptIgnoreDts'),
        tuner.AllowFmp4TranscodingContainer && 'fMP4'
    ].filter(Boolean) as string[];

    return (
        <Paper elevation={0} sx={cardSx(accent)}>
            <AccentLine color={accent} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <IconBox color={accent}><TunerTypeIcon type={tuner.Type} /></IconBox>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.98rem', fontWeight: 700, color: '#fff' }}>{tuner.FriendlyName || getTunerName(tuner.Type)}</Typography>
                    <Typography noWrap sx={{ fontSize: '0.74rem', color: accent, fontWeight: 600 }}>{getTunerName(tuner.Type)}</Typography>
                </Box>
            </Box>

            <Box sx={detailsSx}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    <Tooltip title={tuner.Url || ''}>
                        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)' }}>{tuner.Url || '—'}</Typography>
                    </Tooltip>
                    {tuner.Url && (
                        <Tooltip title={copied ? globalize.translate('LtvCopied') : globalize.translate('LtvCopyUrl')}>
                            <IconButton size='small' onClick={copyUrl} sx={{ color: 'rgba(255,255,255,0.5)' }}><ContentCopyIcon sx={{ fontSize: '0.95rem' }} /></IconButton>
                        </Tooltip>
                    )}
                </Box>
                <InfoRow label={globalize.translate('LtvSimultaneous')}>
                    {tuner.TunerCount ? tuner.TunerCount : globalize.translate('LtvUnlimited')}
                </InfoRow>
                {!!tuner.FallbackMaxStreamingBitrate && (
                    <InfoRow label={globalize.translate('LtvFallbackBitrate')}>{Math.round(tuner.FallbackMaxStreamingBitrate / 1e6)} Mbps</InfoRow>
                )}
                {tuner.UserAgent && <InfoRow label='User-Agent'>{tuner.UserAgent}</InfoRow>}
                {tuner.DeviceId && <InfoRow label={globalize.translate('LtvDeviceId')}>{tuner.DeviceId}</InfoRow>}
            </Box>

            {options.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {options.map(o => <OptionChip key={o} label={o} color={accent} />)}
                </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 'auto' }}>
                <Tooltip title={globalize.translate('Edit')}>
                    <IconButton size='small' onClick={edit} sx={{ color: 'rgba(255,255,255,0.65)' }}><EditIcon fontSize='small' /></IconButton>
                </Tooltip>
                <Tooltip title={globalize.translate('Delete')}>
                    <IconButton size='small' onClick={openConfirm} sx={{ color: '#ef5350' }}><DeleteIcon fontSize='small' /></IconButton>
                </Tooltip>
            </Box>

            <ConfirmDialog
                open={confirmOpen}
                title={globalize.translate('HeaderDeleteDevice')}
                text={globalize.translate('MessageConfirmDeleteTunerDevice')}
                onCancel={closeConfirm}
                onConfirm={remove}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('Delete')}
            />
        </Paper>
    );
};

export const ProviderCard: FC<{ provider: ListingsProviderInfo; tunerCount: number }> = ({ provider, tunerCount }) => {
    const navigate = useNavigate();
    const deleteProvider = useDeleteProvider();
    const [ confirmOpen, setConfirmOpen ] = useState(false);
    const accent = (provider.Type || '').toLowerCase() === 'schedulesdirect' ? '#26c6da' : '#aa5cc3';
    const mapped = provider.ChannelMappings?.length ?? 0;
    const tuners = provider.EnableAllTuners ? globalize.translate('LtvAllTuners') : globalize.translate('LtvSomeTuners', provider.EnabledTuners?.length ?? 0, tunerCount);
    const categories = [
        [ 'LtvCatMovies', provider.MovieCategories ],
        [ 'LtvCatSports', provider.SportsCategories ],
        [ 'LtvCatNews', provider.NewsCategories ],
        [ 'LtvCatKids', provider.KidsCategories ]
    ].filter(([ , list ]) => (list as string[] | null | undefined)?.length) as [ string, string[] ][];

    const edit = useCallback(() => navigate(`${getProviderConfigurationUrl(provider.Type || '')}&id=${provider.Id}`), [ navigate, provider ]);
    const mapChannels = useCallback(() => {
        void new ChannelMapper({ serverId: ServerConnections.currentApiClient()?.serverId(), providerId: provider.Id }).show();
    }, [ provider.Id ]);
    const openConfirm = useCallback(() => setConfirmOpen(true), []);
    const closeConfirm = useCallback(() => setConfirmOpen(false), []);
    const remove = useCallback(() => {
        if (provider.Id) deleteProvider.mutate({ id: provider.Id }, { onSettled: () => setConfirmOpen(false) });
    }, [ deleteProvider, provider.Id ]);

    return (
        <Paper elevation={0} sx={cardSx(accent)}>
            <AccentLine color={accent} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <IconBox color={accent}><EventIcon /></IconBox>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.98rem', fontWeight: 700, color: '#fff' }}>{getProviderName(provider.Type)}</Typography>
                    <Tooltip title={provider.Path || provider.ListingsId || ''}>
                        <Typography noWrap sx={{ fontSize: '0.74rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.55)' }}>{provider.Path || provider.ListingsId || '—'}</Typography>
                    </Tooltip>
                </Box>
            </Box>

            <Box sx={detailsSx}>
                <InfoRow label={globalize.translate('LtvMappedChannels')}>{mapped}</InfoRow>
                <InfoRow label={globalize.translate('LtvUsedBy')}>{tuners}</InfoRow>
                {(provider.Country || provider.ZipCode) && (
                    <InfoRow label={globalize.translate('LtvRegion')}>{[ provider.Country, provider.ZipCode ].filter(Boolean).join(' · ')}</InfoRow>
                )}
                {provider.PreferredLanguage && <InfoRow label={globalize.translate('LtvLanguage')}>{provider.PreferredLanguage}</InfoRow>}
                {provider.MoviePrefix && <InfoRow label={globalize.translate('LtvMoviePrefix')}>{provider.MoviePrefix}</InfoRow>}
            </Box>

            {categories.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {categories.map(([ key, list ]) => <OptionChip key={key} label={`${globalize.translate(key)}: ${list.length}`} color={accent} />)}
                </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto' }}>
                <Button size='small' startIcon={<LocationSearchingIcon />} onClick={mapChannels} sx={{ borderRadius: '10px', color: accent }}>
                    {globalize.translate('MapChannels')}
                </Button>
                <Box sx={{ ml: 'auto' }} />
                <Tooltip title={globalize.translate('Edit')}>
                    <IconButton size='small' onClick={edit} sx={{ color: 'rgba(255,255,255,0.65)' }}><EditIcon fontSize='small' /></IconButton>
                </Tooltip>
                <Tooltip title={globalize.translate('Delete')}>
                    <IconButton size='small' onClick={openConfirm} sx={{ color: '#ef5350' }}><DeleteIcon fontSize='small' /></IconButton>
                </Tooltip>
            </Box>

            <ConfirmDialog
                open={confirmOpen}
                title={globalize.translate('HeaderDeleteProvider')}
                text={globalize.translate('MessageConfirmDeleteGuideProvider')}
                onCancel={closeConfirm}
                onConfirm={remove}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('Delete')}
            />
        </Paper>
    );
};

/** Looks for HDHomeRun / SAT>IP devices on the network and adds them in one click. */
export const DiscoverCard: FC = () => {
    const { api } = useApi();
    const [ isSearching, setIsSearching ] = useState(false);
    const [ found, setFound ] = useState<TunerHostInfo[] | null>(null);
    const [ addingUrl, setAddingUrl ] = useState<string | null>(null);

    const search = useCallback(async () => {
        if (!api) return;
        setIsSearching(true);
        try {
            const { data } = await getLiveTvApi(api).discoverTuners({ newDevicesOnly: true });
            setFound(data);
        } catch (err) {
            console.error('[LiveTv] discovery failed', err);
            setFound([]);
        } finally {
            setIsSearching(false);
        }
    }, [ api ]);

    const add = useCallback(async (tuner: TunerHostInfo) => {
        if (!api) return;
        setAddingUrl(tuner.Url || '');
        try {
            await getLiveTvApi(api).addTunerHost({ tunerHostInfo: tuner });
            setFound(list => (list || []).filter(t => t !== tuner));
            await queryClient.invalidateQueries({ queryKey: [ 'NamedConfiguration', 'livetv' ] });
        } catch (err) {
            console.error('[LiveTv] add tuner failed', err);
        } finally {
            setAddingUrl(null);
        }
    }, [ api ]);

    return (
        <SectionCard title={globalize.translate('LtvDiscover')} icon={<WifiFindIcon />} accentColor='#4caf50' description={globalize.translate('LtvDiscoverHelp')}>
            <Button variant='outlined' color='success' onClick={search} disabled={isSearching} startIcon={isSearching ? <CircularProgress size={16} color='inherit' /> : <WifiFindIcon />} sx={{ borderRadius: '12px' }}>
                {isSearching ? globalize.translate('LtvSearching') : globalize.translate('LtvSearchNetwork')}
            </Button>
            {found && found.length === 0 && (
                <Alert severity='info' sx={{ mt: 2, borderRadius: '12px' }}>{globalize.translate('LtvNothingFound')}</Alert>
            )}
            {found && found.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                    {found.map(t => (
                        <Box key={`${t.Type}-${t.Url}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <IconBox color={tunerColor(t.Type)} size={34}><TunerTypeIcon type={t.Type} /></IconBox>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 600 }}>{t.FriendlyName || getTunerName(t.Type)}</Typography>
                                <Typography noWrap sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>{t.Url}</Typography>
                            </Box>
                            <Button size='small' variant='contained' startIcon={addingUrl === (t.Url || '') ? <CircularProgress size={14} color='inherit' /> : <AddIcon />} disabled={addingUrl !== null} onClick={() => add(t)} sx={{ borderRadius: '10px' }}>
                                {globalize.translate('Add')}
                            </Button>
                        </Box>
                    ))}
                </Box>
            )}
        </SectionCard>
    );
};

/** Sessions currently watching a live channel. */
export const WatchingNowCard: FC = () => {
    const { data: sessions } = useLiveSessions();
    const watching = (sessions || []).filter(s => s.NowPlayingItem?.Type === 'TvChannel' || s.NowPlayingItem?.Type === 'Program' || s.NowPlayingItem?.ChannelId);

    return (
        <SectionCard title={globalize.translate('LtvWatchingNow')} icon={<LiveTvIcon />} accentColor='#00a4dc'>
            {watching.length === 0 ? (
                <Typography sx={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.45)' }}>{globalize.translate('LtvNobodyWatching')}</Typography>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {watching.map(s => (
                        <Box key={s.Id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px', background: 'rgba(0,164,220,0.06)', border: '1px solid rgba(0,164,220,0.2)' }}>
                            <FiberManualRecordIcon sx={{ fontSize: '0.8rem', color: '#ef5350', filter: 'drop-shadow(0 0 4px #ef5350)' }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 600 }}>
                                    {s.NowPlayingItem?.ChannelName || s.NowPlayingItem?.Name}
                                </Typography>
                                <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                                    {[ s.UserName, s.DeviceName, s.Client ].filter(Boolean).join(' · ')}
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}
        </SectionCard>
    );
};

const timeRange = (timer: TimerInfoDto) => {
    if (!timer.StartDate) return '';
    const locale = globalize.getCurrentDateTimeLocale();
    const start = new Date(timer.StartDate);
    const end = timer.EndDate ? new Date(timer.EndDate) : null;
    const day = start.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    return `${day} · ${start.toLocaleTimeString(locale, opts)}${end ? ` – ${end.toLocaleTimeString(locale, opts)}` : ''}`;
};

/** Next scheduled recordings with a cancel button. */
export const UpcomingRecordingsCard: FC<{ timers: TimerInfoDto[] }> = ({ timers }) => {
    const { api } = useApi();
    const [ toCancel, setToCancel ] = useState<TimerInfoDto | null>(null);
    const upcoming = timers.filter(t => t.Status !== 'Completed' && t.Status !== 'Cancelled').slice(0, 6);

    const closeCancel = useCallback(() => setToCancel(null), []);
    const confirmCancel = useCallback(async () => {
        const timer = toCancel;
        setToCancel(null);
        if (!api || !timer?.Id) return;
        try {
            await getLiveTvApi(api).cancelTimer({ timerId: timer.Id });
            await queryClient.invalidateQueries({ queryKey: [ 'LiveTvOverview' ] });
        } catch (err) {
            console.error('[LiveTv] cancel timer failed', err);
        }
    }, [ api, toCancel ]);

    return (
        <SectionCard title={globalize.translate('LtvUpcoming')} icon={<EventIcon />} accentColor='#ef5350'>
            {upcoming.length === 0 ? (
                <Typography sx={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.45)' }}>{globalize.translate('LtvNoUpcoming')}</Typography>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {upcoming.map(t => {
                        const isRecording = t.Status === 'InProgress';
                        return (
                            <Box key={t.Id} sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px',
                                background: isRecording ? 'rgba(239,83,80,0.08)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isRecording ? 'rgba(239,83,80,0.35)' : 'rgba(255,255,255,0.06)'}`
                            }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 600 }}>{t.Name}</Typography>
                                    <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                                        {[ t.ChannelName, timeRange(t) ].filter(Boolean).join(' · ')}
                                    </Typography>
                                </Box>
                                {isRecording && <OptionChip label={globalize.translate('LtvRecordingNow')} color='#ef5350' />}
                                {t.SeriesTimerId && !isRecording && <OptionChip label={globalize.translate('LtvSeries')} color='#aa5cc3' />}
                                <Tooltip title={globalize.translate('LtvCancelRecording')}>
                                    <IconButton size='small' onClick={() => setToCancel(t)} sx={{ color: 'rgba(239,83,80,0.85)' }}><CancelIcon fontSize='small' /></IconButton>
                                </Tooltip>
                            </Box>
                        );
                    })}
                    {timers.length > upcoming.length && (
                        <Button component={Link} to='/livetv?tab=4' size='small' sx={{ alignSelf: 'flex-start', borderRadius: '10px' }}>
                            {globalize.translate('LtvSeeAll', timers.length)}
                        </Button>
                    )}
                </Box>
            )}
            <ConfirmDialog
                open={!!toCancel}
                title={globalize.translate('LtvCancelRecording')}
                text={toCancel ? `${toCancel.Name}\n${timeRange(toCancel)}` : ''}
                onCancel={closeCancel}
                onConfirm={confirmCancel}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('LtvCancelRecording')}
            />
        </SectionCard>
    );
};
