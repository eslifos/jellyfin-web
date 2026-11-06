/**
 * PlaybackPreferencesPage — React migration of the legacy playback settings
 * (components/playbackSettings), split into colored glassmorphism cards.
 * Reads and writes exactly the same settings as the legacy form.
 */
import { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import CastIcon from '@mui/icons-material/Cast';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import HighQualityIcon from '@mui/icons-material/HighQuality';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { useSearchParams } from 'react-router-dom';

import { MediaSegmentAction } from 'apps/legacy/features/playback/constants/mediaSegmentAction';
import { getId as getSegmentId, getMediaSegmentAction } from 'apps/legacy/features/playback/utils/mediaSegmentSettings';
import { appHost } from 'components/apphost';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { pluginManager } from 'components/pluginManager';
import qualityoptions from 'components/qualityOptions';
import { AppFeature } from 'constants/appFeature';
import { PluginType } from 'constants/pluginType';
import { MILLISECONDS_PER_MINUTE } from 'constants/time';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { ID as STILL_WATCHING_ID, StillWatchingConfiguration, StillWatchingOptions } from 'plugins/stillWatching/constants';
import rawAppSettings from 'scripts/settings/appSettings';
import browser from 'scripts/browser';
import * as userSettings from 'scripts/settings/userSettings';
import { queryClient } from 'utils/query/queryClient';

import { type Accessors, Card, Check, SaveButton, SavedSnackbar, Sel } from '../components/PreferencesUi';

const appSettings = rawAppSettings as unknown as Accessors;

const SKIP_LENGTHS = [ 5, 10, 15, 20, 25, 30 ];

const SEGMENT_TYPES = [
    MediaSegmentType.Intro,
    MediaSegmentType.Preview,
    MediaSegmentType.Recap,
    MediaSegmentType.Commercial,
    MediaSegmentType.Outro
];

const MAX_VIDEO_WIDTHS: { value: string; label: string }[] = [
    { value: '0', label: 'Auto' },
    { value: '-1', label: 'ScreenResolution' },
    { value: '640', label: '360p' },
    { value: '852', label: '480p' },
    { value: '1280', label: '720p' },
    { value: '1920', label: '1080p' },
    { value: '3840', label: '4K' },
    { value: '7680', label: '8K' }
];

const C = {
    audio: '#00a4dc',
    videoQuality: '#aa5cc3',
    musicQuality: '#e91e63',
    behavior: '#4caf50',
    skip: '#ff9800',
    segments: '#26c6da',
    videoAdvanced: '#ffca28',
    audioAdvanced: '#8d6e63'
};

interface QualityOption { name: string; bitrate?: number }
interface Culture { ThreeLetterISOLanguageName: string; DisplayName: string }
interface CastApp { Id: string; Name: string }

const toQualityItems = (options: (QualityOption | undefined)[]) => options.filter((o): o is QualityOption => Boolean(o)).map(o => ({ value: o.bitrate ? String(o.bitrate) : '', label: o.name }));

/** Current bitrate setting as a select value ('' means automatic). */
const getBitrateValue = (isInNetwork: boolean, mediaType: string) => (
    appSettings.enableAutomaticBitrateDetection(isInNetwork, mediaType) ? '' : String(appSettings.maxStreamingBitrate(isInNetwork, mediaType) ?? '')
);

const setBitrateValue = (value: string, isInNetwork: boolean, mediaType: string) => {
    if (value) {
        appSettings.maxStreamingBitrate(isInNetwork, mediaType, value);
        appSettings.enableAutomaticBitrateDetection(isInNetwork, mediaType, false);
    } else {
        appSettings.enableAutomaticBitrateDetection(isInNetwork, mediaType, true);
    }
};

const qualityOptionsFor = (mediaType: string, isInNetwork: boolean) => {
    const opts = {
        currentMaxBitrate: appSettings.maxStreamingBitrate(isInNetwork, mediaType),
        isAutomaticBitrateEnabled: appSettings.enableAutomaticBitrateDetection(isInNetwork, mediaType),
        enableAuto: true
    };
    return toQualityItems(mediaType === 'Audio' ? qualityoptions.getAudioQualityOptions(opts) : qualityoptions.getVideoQualityOptions(opts));
};

/** Make sure the current value is one of the options, otherwise MUI shows an empty select. */
const withValue = (items: { value: string; label: string }[], value: string) => (
    items.some(i => i.value === value) ? items : [ ...items, { value, label: value } ]
);

const PlaybackPreferencesPage: FC = () => {
    const { user: currentUser, __legacyApiClient__: apiClient } = useApi();
    const [ searchParams ] = useSearchParams();
    const userId = searchParams.get('userId') || currentUser?.Id;
    const isLoggedInUser = Boolean(userId && userId === currentUser?.Id);

    const settingsInstance = useMemo(() => (
        userId && userId !== currentUser?.Id ? new userSettings.UserSettings() : userSettings.currentSettings
    ), [ userId, currentUser ]);
    const settings = settingsInstance as unknown as Accessors;

    const [ loaded, setLoaded ] = useState(false);
    const [ saving, setSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);
    const [ expanded, setExpanded ] = useState<Record<string, boolean>>({
        audio: true, videoQuality: true, musicQuality: true, behavior: true, skip: true, segments: true, videoAdvanced: true, audioAdvanced: true
    });
    const toggle = useCallback((id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] })), []);

    // Data used to build options / decide visibility
    const [ user, setUser ] = useState<UserDto>();
    const [ cultures, setCultures ] = useState<Culture[]>([]);
    const [ castApps, setCastApps ] = useState<CastApp[]>([]);
    const [ isInNetwork, setIsInNetwork ] = useState<boolean | null>(null);

    // Audio
    const [ audioChannels, setAudioChannels ] = useState('-1');
    const [ audioLanguage, setAudioLanguage ] = useState('');
    const [ playDefaultAudio, setPlayDefaultAudio ] = useState(false);
    const [ disableVbr, setDisableVbr ] = useState(false);
    // Quality
    const [ videoInNetwork, setVideoInNetwork ] = useState('');
    const [ videoInternet, setVideoInternet ] = useState('');
    const [ musicInternet, setMusicInternet ] = useState('');
    const [ chromecastQuality, setChromecastQuality ] = useState('');
    const [ maxVideoWidth, setMaxVideoWidth ] = useState('0');
    const [ limitResolution, setLimitResolution ] = useState(false);
    // Behavior
    const [ preferFmp4, setPreferFmp4 ] = useState(false);
    const [ cinemaMode, setCinemaMode ] = useState(false);
    const [ autoPlayNext, setAutoPlayNext ] = useState(false);
    const [ stillWatching, setStillWatching ] = useState<string>(StillWatchingOptions.Default);
    const [ rememberAudio, setRememberAudio ] = useState(false);
    const [ rememberSubs, setRememberSubs ] = useState(false);
    const [ nextVideoOverlay, setNextVideoOverlay ] = useState(false);
    const [ externalPlayer, setExternalPlayer ] = useState(false);
    // Skip & cast
    const [ castReceiver, setCastReceiver ] = useState('');
    const [ skipForward, setSkipForward ] = useState('30000');
    const [ skipBack, setSkipBack ] = useState('10000');
    // Media segments
    const [ segments, setSegments ] = useState<Record<string, string>>({});
    // Advanced video
    const [ enableDts, setEnableDts ] = useState(false);
    const [ enableTrueHd, setEnableTrueHd ] = useState(false);
    const [ enableHi10p, setEnableHi10p ] = useState(false);
    const [ limitSegmentLength, setLimitSegmentLength ] = useState(false);
    const [ transcodeVideoCodec, setTranscodeVideoCodec ] = useState('');
    const [ transcodeAudioCodec, setTranscodeAudioCodec ] = useState('');
    // Advanced audio
    const [ audioNormalization, setAudioNormalization ] = useState('Off');
    const [ remuxFlac, setRemuxFlac ] = useState(false);
    const [ remuxMp3, setRemuxMp3 ] = useState(false);

    useEffect(() => {
        if (!apiClient || !userId) return;
        let cancelled = false;

        const load = async () => {
            const [ u, systemInfo, allCultures ] = await Promise.all([
                apiClient.getUser(userId) as Promise<UserDto>,
                apiClient.getSystemInfo() as Promise<{ CastReceiverApplications?: CastApp[] }>,
                apiClient.getCultures() as Promise<Culture[]>
            ]);
            await settings.setUserInfo(userId, apiClient);

            // Which quality fields apply depends on where the client is
            let inNetwork: boolean | null = null;
            if (!appHost.supports(AppFeature.MultiServer)) {
                const endpoint = await apiClient.getEndpointInfo() as { IsInNetwork?: boolean };
                inNetwork = Boolean(endpoint?.IsInNetwork);
            }
            if (cancelled) return;

            const config = u.Configuration;
            setAudioChannels(String(settings.allowedAudioChannels() ?? '-1'));
            setAudioLanguage(config?.AudioLanguagePreference || '');
            setPlayDefaultAudio(Boolean(config?.PlayDefaultAudioTrack));
            setDisableVbr(Boolean(appSettings.disableVbrAudio()));

            setVideoInNetwork(getBitrateValue(true, 'Video'));
            setVideoInternet(getBitrateValue(false, 'Video'));
            setMusicInternet(getBitrateValue(false, 'Audio'));
            setChromecastQuality(String(appSettings.maxChromecastBitrate() || ''));
            setMaxVideoWidth(String(appSettings.maxVideoWidth() ?? '0'));
            setLimitResolution(Boolean(appSettings.limitSupportedVideoResolution()));

            setPreferFmp4(Boolean(settings.preferFmp4HlsContainer()));
            setCinemaMode(Boolean(settings.enableCinemaMode()));
            setAutoPlayNext(Boolean(config?.EnableNextEpisodeAutoPlay));
            setStillWatching(settings.stillWatchingPrompt() || StillWatchingOptions.Default);
            setRememberAudio(Boolean(config?.RememberAudioSelections));
            setRememberSubs(Boolean(config?.RememberSubtitleSelections));
            setNextVideoOverlay(Boolean(settings.enableNextVideoInfoOverlay()));
            setExternalPlayer(Boolean(appSettings.enableSystemExternalPlayers()));

            setCastReceiver(config?.CastReceiverId || '');
            setSkipForward(String(settings.skipForwardLength()));
            setSkipBack(String(settings.skipBackLength()));

            setSegments(Object.fromEntries(SEGMENT_TYPES.map(t => [ getSegmentId(t), getMediaSegmentAction(settingsInstance, t) ])));

            setEnableDts(Boolean(appSettings.enableDts()));
            setEnableTrueHd(Boolean(appSettings.enableTrueHd()));
            setEnableHi10p(Boolean(appSettings.enableHi10p()));
            setLimitSegmentLength(Boolean(settings.limitSegmentLength()));
            setTranscodeVideoCodec(appSettings.preferredTranscodeVideoCodec() || '');
            setTranscodeAudioCodec(appSettings.preferredTranscodeVideoAudioCodec() || '');

            setAudioNormalization(settings.selectAudioNormalization() || 'Off');
            setRemuxFlac(Boolean(appSettings.alwaysRemuxFlac()));
            setRemuxMp3(Boolean(appSettings.alwaysRemuxMp3()));

            setUser(u);
            setCultures(allCultures ?? []);
            setCastApps(systemInfo?.CastReceiverApplications ?? []);
            setIsInNetwork(inNetwork);
            setLoaded(true);
        };

        load().catch(err => console.error('[PlaybackPreferences] failed to load settings', err));
        return () => { cancelled = true; };
    }, [ apiClient, userId, settings ]);

    const handleSave = useCallback(async () => {
        if (!apiClient || !userId) return;
        setSaving(true);
        try {
            const u: UserDto = await apiClient.getUser(userId);
            await settings.setUserInfo(userId, apiClient);
            if (!u.Configuration) throw new Error('Missing user configuration');

            appSettings.enableSystemExternalPlayers(externalPlayer);
            appSettings.maxChromecastBitrate(chromecastQuality);
            appSettings.maxVideoWidth(maxVideoWidth);
            appSettings.limitSupportedVideoResolution(limitResolution);
            appSettings.preferredTranscodeVideoCodec(transcodeVideoCodec);
            appSettings.preferredTranscodeVideoAudioCodec(transcodeAudioCodec);
            appSettings.enableDts(enableDts);
            appSettings.enableTrueHd(enableTrueHd);
            appSettings.enableHi10p(enableHi10p);
            appSettings.disableVbrAudio(disableVbr);
            appSettings.alwaysRemuxFlac(remuxFlac);
            appSettings.alwaysRemuxMp3(remuxMp3);
            setBitrateValue(videoInNetwork, true, 'Video');
            setBitrateValue(videoInternet, false, 'Video');
            setBitrateValue(musicInternet, false, 'Audio');

            settings.allowedAudioChannels(audioChannels);
            settings.stillWatchingPrompt(stillWatching);
            settings.preferFmp4HlsContainer(preferFmp4);
            settings.limitSegmentLength(limitSegmentLength);
            settings.enableCinemaMode(cinemaMode);
            settings.selectAudioNormalization(audioNormalization);
            settings.enableNextVideoInfoOverlay(nextVideoOverlay);
            settings.skipForwardLength(skipForward);
            settings.skipBackLength(skipBack);
            Object.entries(segments).forEach(([ id, value ]) => { settings.set(id, value, false); });

            u.Configuration.AudioLanguagePreference = audioLanguage;
            u.Configuration.PlayDefaultAudioTrack = playDefaultAudio;
            u.Configuration.EnableNextEpisodeAutoPlay = autoPlayNext;
            u.Configuration.RememberAudioSelections = rememberAudio;
            u.Configuration.RememberSubtitleSelections = rememberSubs;
            u.Configuration.CastReceiverId = castReceiver;

            await apiClient.updateUserConfiguration(userId, u.Configuration);
            void queryClient.invalidateQueries({ queryKey: [ 'User', userId ] });
            setSaved(true);
        } catch (err) {
            console.error('[PlaybackPreferences] failed to save settings', err);
        } finally {
            setSaving(false);
        }
    }, [ apiClient, userId, settings, externalPlayer, chromecastQuality, maxVideoWidth, limitResolution, transcodeVideoCodec, transcodeAudioCodec,
        enableDts, enableTrueHd, enableHi10p, disableVbr, remuxFlac, remuxMp3, videoInNetwork, videoInternet, musicInternet, audioChannels,
        stillWatching, preferFmp4, limitSegmentLength, cinemaMode, audioNormalization, nextVideoOverlay, skipForward, skipBack, segments,
        audioLanguage, playDefaultAudio, autoPlayNext, rememberAudio, rememberSubs, castReceiver ]);

    if (!loaded || !user) return <Loading />;

    // Visibility rules (same as the legacy form)
    const canTranscodeVideo = Boolean(user.Policy?.EnableVideoPlaybackTranscoding);
    const canTranscodeAudio = Boolean(user.Policy?.EnableAudioPlaybackTranscoding);
    const showQuality = isLoggedInUser && (canTranscodeVideo || canTranscodeAudio);
    const multiServer = isInNetwork === null;
    const showVideoQuality = showQuality && canTranscodeVideo;
    const showInNetwork = multiServer || isInNetwork === true;
    const showInternet = multiServer || isInNetwork === false;
    const showMusicQuality = showQuality && canTranscodeAudio && showInternet;
    const showChromecastQuality = showQuality && canTranscodeVideo && appHost.supports(AppFeature.Chromecast);
    const showExternalPlayer = isLoggedInUser && appHost.supports(AppFeature.ExternalPlayerIntent);
    const showStillWatching = pluginManager.ofType(PluginType.PreplayIntercept).some((p: { id: string }) => p.id === STILL_WATCHING_ID);

    const stillWatchingItems = Object.values(StillWatchingOptions).map(value => {
        if (value === StillWatchingOptions.Disabled) return { value, label: globalize.translate('Disabled') };
        const { count, duration } = StillWatchingConfiguration[value];
        return { value, label: globalize.translate('StillWatchingOption', count, Math.round(duration / MILLISECONDS_PER_MINUTE)) };
    });
    const skipItems = SKIP_LENGTHS.map(s => ({ value: String(s * 1000), label: globalize.translate('ValueSeconds', s) }));

    const videoQualityInNetwork = withValue(qualityOptionsFor('Video', true), videoInNetwork);
    const videoQualityInternet = withValue(qualityOptionsFor('Video', false), videoInternet);
    const musicQualityInternet = withValue(qualityOptionsFor('Audio', false), musicInternet);
    const chromecastItems = withValue(toQualityItems(qualityoptions.getVideoQualityOptions({
        currentMaxBitrate: appSettings.maxChromecastBitrate(),
        isAutomaticBitrateEnabled: !appSettings.maxChromecastBitrate(),
        enableAuto: true
    })), chromecastQuality);

    const items = (list: { value: string; label: string }[]) => list.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>);

    return (
        <Page id='playbackPreferencesPage' className='libraryPage userPreferencesPage noSecondaryNavPage mainAnimatedPage' title={globalize.translate('TitlePlayback')}>
            <Box sx={{ maxWidth: 1300, mx: 'auto', px: 2, pt: 3, pb: 14 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>

                    {/* ── Columna izquierda ── */}
                    <Box>
                        <Card id='audio' title={globalize.translate('HeaderAudioSettings')} icon={<VolumeUpIcon />} accentColor={C.audio} open={expanded.audio} onToggle={toggle}>
                            <Sel label={globalize.translate('LabelAllowedAudioChannels')} value={audioChannels} onChange={setAudioChannels}>
                                <MenuItem value='-1'>{globalize.translate('Auto')}</MenuItem>
                                <MenuItem value='1'>{globalize.translate('LabelSelectMono')}</MenuItem>
                                <MenuItem value='2'>{globalize.translate('LabelSelectStereo')}</MenuItem>
                                <MenuItem value='6'>5.1 {globalize.translate('LabelSelectAudioChannels')}</MenuItem>
                                <MenuItem value='8'>7.1 {globalize.translate('LabelSelectAudioChannels')}</MenuItem>
                            </Sel>
                            <Sel label={globalize.translate('LabelAudioLanguagePreference')} value={audioLanguage} onChange={setAudioLanguage}>
                                <MenuItem value=''>{globalize.translate('AnyLanguage')}</MenuItem>
                                <MenuItem value='OriginalLanguage'>{globalize.translate('OriginalLanguage')}</MenuItem>
                                {cultures.map(c => <MenuItem key={c.ThreeLetterISOLanguageName} value={c.ThreeLetterISOLanguageName}>{c.DisplayName}</MenuItem>)}
                            </Sel>
                            <Check label={globalize.translate('LabelPlayDefaultAudioTrack')} checked={playDefaultAudio} onChange={setPlayDefaultAudio} color={C.audio} />
                            <Check label={globalize.translate('LabelDisableVbrAudioEncoding')} desc={globalize.translate('DisableVbrAudioEncodingHelp')}
                                checked={disableVbr} onChange={setDisableVbr} color={C.audio} />
                        </Card>

                        {showVideoQuality && (
                            <Card id='videoQuality' title={globalize.translate('HeaderVideoQuality')} icon={<HighQualityIcon />} accentColor={C.videoQuality} open={expanded.videoQuality} onToggle={toggle}>
                                {showInNetwork && (
                                    <Sel label={globalize.translate('LabelHomeNetworkQuality')} value={videoInNetwork} onChange={setVideoInNetwork}>{items(videoQualityInNetwork)}</Sel>
                                )}
                                {showInternet && (
                                    <Sel label={globalize.translate('LabelInternetQuality')} value={videoInternet} onChange={setVideoInternet}>{items(videoQualityInternet)}</Sel>
                                )}
                                {showChromecastQuality && (
                                    <Sel label={globalize.translate('LabelMaxChromecastBitrate')} value={chromecastQuality} onChange={setChromecastQuality}>{items(chromecastItems)}</Sel>
                                )}
                                <Sel label={globalize.translate('LabelMaxVideoResolution')} value={maxVideoWidth} onChange={setMaxVideoWidth}>
                                    {MAX_VIDEO_WIDTHS.map(o => (
                                        <MenuItem key={o.value} value={o.value}>{o.value === '0' || o.value === '-1' ? globalize.translate(o.label) : o.label}</MenuItem>
                                    ))}
                                </Sel>
                                <Check label={globalize.translate('LimitSupportedVideoResolution')} desc={globalize.translate('LimitSupportedVideoResolutionHelp')}
                                    checked={limitResolution} onChange={setLimitResolution} color={C.videoQuality} />
                            </Card>
                        )}

                        {showMusicQuality && (
                            <Card id='musicQuality' title={globalize.translate('HeaderMusicQuality')} icon={<LibraryMusicIcon />} accentColor={C.musicQuality} open={expanded.musicQuality} onToggle={toggle}>
                                <Sel label={globalize.translate('LabelInternetQuality')} value={musicInternet} onChange={setMusicInternet}>{items(musicQualityInternet)}</Sel>
                            </Card>
                        )}

                        <Card id='behavior' title={globalize.translate('HeaderPlayback')} icon={<PlayCircleIcon />} accentColor={C.behavior} open={expanded.behavior} onToggle={toggle}>
                            <Check label={globalize.translate('PlayNextEpisodeAutomatically')} checked={autoPlayNext} onChange={setAutoPlayNext} color={C.behavior} />
                            <Check label={globalize.translate('EnableNextVideoInfoOverlay')} desc={globalize.translate('EnableNextVideoInfoOverlayHelp')}
                                checked={nextVideoOverlay} onChange={setNextVideoOverlay} color={C.behavior} />
                            <Check label={globalize.translate('EnableCinemaMode')} desc={globalize.translate('CinemaModeConfigurationHelp')}
                                checked={cinemaMode} onChange={setCinemaMode} color={C.behavior} />
                            <Check label={globalize.translate('RememberAudioSelections')} desc={globalize.translate('RememberAudioSelectionsHelp')}
                                checked={rememberAudio} onChange={setRememberAudio} color={C.behavior} />
                            <Check label={globalize.translate('RememberSubtitleSelections')} desc={globalize.translate('RememberSubtitleSelectionsHelp')}
                                checked={rememberSubs} onChange={setRememberSubs} color={C.behavior} />
                            <Check label={globalize.translate('PreferFmp4HlsContainer')} desc={globalize.translate('PreferFmp4HlsContainerHelp')}
                                checked={preferFmp4} onChange={setPreferFmp4} color={C.behavior} />
                            {showExternalPlayer && (
                                <Check label={globalize.translate('EnableExternalVideoPlayers')} desc={globalize.translate('EnableExternalVideoPlayersHelp')}
                                    checked={externalPlayer} onChange={setExternalPlayer} color={C.behavior} />
                            )}
                            {showStillWatching && (
                                <Box sx={{ mt: 1.5 }}>
                                    <Sel label={globalize.translate('StillWatchingPrompt')} value={stillWatching} onChange={setStillWatching}>{items(stillWatchingItems)}</Sel>
                                </Box>
                            )}
                        </Card>
                    </Box>

                    {/* ── Columna derecha ── */}
                    <Box>
                        <Card id='skip' title={`${globalize.translate('Controls')} · Chromecast`} icon={<CastIcon />} accentColor={C.skip} open={expanded.skip} onToggle={toggle}>
                            <Sel label={globalize.translate('LabelSkipForwardLength')} value={skipForward} onChange={setSkipForward}>{items(withValue(skipItems, skipForward))}</Sel>
                            <Sel label={globalize.translate('LabelSkipBackLength')} value={skipBack} onChange={setSkipBack}>{items(withValue(skipItems, skipBack))}</Sel>
                            {castApps.length > 0 && (
                                <Sel label={globalize.translate('LabelChromecastVersion')} value={castReceiver} onChange={setCastReceiver}>
                                    {items(withValue(castApps.map(a => ({ value: a.Id, label: a.Name })), castReceiver))}
                                </Sel>
                            )}
                        </Card>

                        <Card id='segments' title={globalize.translate('HeaderMediaSegmentActions')} icon={<SkipNextIcon />} accentColor={C.segments} open={expanded.segments} onToggle={toggle}>
                            {SEGMENT_TYPES.map(type => {
                                const id = getSegmentId(type);
                                return (
                                    <Sel key={id} label={globalize.translate('LabelMediaSegmentsType', globalize.translate(`MediaSegmentType.${type}`))}
                                        value={segments[id] ?? MediaSegmentAction.None}
                                        onChange={v => setSegments(prev => ({ ...prev, [id]: v }))}>
                                        {Object.values(MediaSegmentAction).map(a => (
                                            <MenuItem key={a} value={a}>{globalize.translate(`MediaSegmentAction.${a}`)}</MenuItem>
                                        ))}
                                    </Sel>
                                );
                            })}
                        </Card>

                        <Card id='videoAdvanced' title={globalize.translate('HeaderVideoAdvanced')} icon={<MovieFilterIcon />} accentColor={C.videoAdvanced} open={expanded.videoAdvanced} onToggle={toggle}>
                            <Check label={globalize.translate('EnableDts')} desc={globalize.translate('EnableDtsHelp')} checked={enableDts} onChange={setEnableDts} color={C.videoAdvanced} />
                            <Check label={globalize.translate('EnableTrueHd')} desc={globalize.translate('EnableTrueHdHelp')} checked={enableTrueHd} onChange={setEnableTrueHd} color={C.videoAdvanced} />
                            {browser.safari && (
                                <Check label={globalize.translate('EnableHi10p')} desc={globalize.translate('EnableHi10pHelp')} checked={enableHi10p} onChange={setEnableHi10p} color={C.videoAdvanced} />
                            )}
                            {browser.web0s && (
                                <Check label={globalize.translate('LimitSegmentLength')} desc={globalize.translate('LimitSegmentLengthHelp')}
                                    checked={limitSegmentLength} onChange={setLimitSegmentLength} color={C.videoAdvanced} />
                            )}
                            <Box sx={{ mt: 1.5 }}>
                                <Sel label={globalize.translate('LabelSelectPreferredTranscodeVideoCodec')} value={transcodeVideoCodec} onChange={setTranscodeVideoCodec}
                                    helper={globalize.translate('SelectPreferredTranscodeVideoCodecHelp')}>
                                    <MenuItem value=''>{globalize.translate('Auto')}</MenuItem>
                                    <MenuItem value='h264'>H264</MenuItem>
                                    <MenuItem value='hevc'>HEVC</MenuItem>
                                    <MenuItem value='av1'>AV1</MenuItem>
                                </Sel>
                                <Sel label={globalize.translate('LabelSelectPreferredTranscodeVideoAudioCodec')} value={transcodeAudioCodec} onChange={setTranscodeAudioCodec}
                                    helper={globalize.translate('SelectPreferredTranscodeVideoAudioCodecHelp')}>
                                    <MenuItem value=''>{globalize.translate('Auto')}</MenuItem>
                                    <MenuItem value='aac'>AAC</MenuItem>
                                    <MenuItem value='ac3'>AC3</MenuItem>
                                    <MenuItem value='alac'>ALAC</MenuItem>
                                    <MenuItem value='dts'>DTS</MenuItem>
                                    <MenuItem value='flac'>FLAC</MenuItem>
                                    <MenuItem value='opus'>Opus</MenuItem>
                                </Sel>
                            </Box>
                        </Card>

                        <Card id='audioAdvanced' title={globalize.translate('HeaderAudioAdvanced')} icon={<GraphicEqIcon />} accentColor={C.audioAdvanced} open={expanded.audioAdvanced} onToggle={toggle}>
                            {!browser.iOS && (
                                <Sel label={globalize.translate('LabelSelectAudioNormalization')} value={audioNormalization} onChange={setAudioNormalization}
                                    helper={globalize.translate('SelectAudioNormalizationHelp')}>
                                    <MenuItem value='Off'>{globalize.translate('Off')}</MenuItem>
                                    <MenuItem value='TrackGain'>{globalize.translate('LabelTrackGain')}</MenuItem>
                                    <MenuItem value='AlbumGain'>{globalize.translate('LabelAlbumGain')}</MenuItem>
                                </Sel>
                            )}
                            <Check label={globalize.translate('LabelAlwaysRemuxFlacAudioFiles')} desc={globalize.translate('AlwaysRemuxFlacAudioFilesHelp')}
                                checked={remuxFlac} onChange={setRemuxFlac} color={C.audioAdvanced} />
                            <Check label={globalize.translate('LabelAlwaysRemuxMp3AudioFiles')} desc={globalize.translate('AlwaysRemuxMp3AudioFilesHelp')}
                                checked={remuxMp3} onChange={setRemuxMp3} color={C.audioAdvanced} />
                        </Card>
                    </Box>
                </Box>

                <SaveButton saving={saving} onClick={handleSave} />
            </Box>

            <SavedSnackbar open={saved} onClose={() => setSaved(false)} />
        </Page>
    );
};

export default PlaybackPreferencesPage;
