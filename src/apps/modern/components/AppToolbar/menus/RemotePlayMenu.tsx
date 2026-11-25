/**
 * "Play on…": every place the content can go, grouped and refreshed while the menu is open.
 * - this device
 * - Jellyfin apps signed in on other devices (TVs, phones, other browsers…) that accept remote control
 * - Google Cast: Chromecast through the Cast SDK (https) or, for the video or song playing here, through the browser
 */
import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import CastRounded from '@mui/icons-material/CastRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Popover, { type PopoverProps } from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { type FC, type ReactNode, useCallback, useEffect, useState } from 'react';

import { CAST_STATUS_TEXT, type CastStatus, getCastStatus } from 'components/playback/castStatus';
import { playbackManager } from 'components/playback/playbackmanager';
import { getAudioElement, getVideoElement, promptRemotePlayback, type RemoteState, watchRemotePlayback } from 'components/playback/remotePlayback';
import toast from 'components/toast/toast';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import type { PlayTarget } from 'types/playTarget';

import PlayTargetIcon from '../../PlayTargetIcon';
import { glassPaperSx, popoverPlacement } from './menuStyles';
import { TEXT_TERTIARY } from 'themes/cosmic/textColors';

interface RemotePlayMenuProps extends Omit<PopoverProps, 'open' | 'anchorEl'> {
    open: boolean
    anchorEl: HTMLElement | null
    onMenuClose: () => void
}

export const ID = 'app-remote-play-menu';

const REFRESH_MS = 5000;
const CAST_PLAYER = 'Google Cast';

const getPlayingMedia = (): HTMLMediaElement | null => {
    if (playbackManager.isPlayingVideo()) return getVideoElement();
    return playbackManager.isPlayingAudio() ? getAudioElement() : null;
};

const Section: FC<{ title: string, children: ReactNode }> = ({ title, children }) => (
    <>
        <Typography
            component='div'
            sx={{ px: 2, pt: 1.5, pb: 0.5, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_TERTIARY }}
        >
            {title}
        </Typography>
        {children}
    </>
);

const Hint: FC<{ text: string }> = ({ text }) => (
    <Box sx={{ display: 'flex', gap: 1, mx: 2, my: 0.75, color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', lineHeight: 1.45 }}>
        <InfoOutlined sx={{ fontSize: 16, mt: '2px', flexShrink: 0 }} />
        <span>{text}</span>
    </Box>
);

const TargetRow: FC<{ target: PlayTarget, session?: SessionInfoDto, onPick: (target: PlayTarget) => void }> = ({ target, session, onPick }) => {
    const onClick = useCallback(() => onPick(target), [ onPick, target ]);
    const details = [ target.appName && target.appName !== target.name ? target.appName : '', target.user?.Name ].filter(Boolean).join(' · ');
    const playing = session?.NowPlayingItem;
    const playingName = playing ? [ playing.SeriesName, playing.Name ].filter(Boolean).join(' — ') : '';

    return (
        <ListItemButton onClick={onClick}>
            <ListItemIcon><PlayTargetIcon target={target} /></ListItemIcon>
            <ListItemText
                primary={target.deviceName || target.name}
                secondary={
                    <>
                        {details}
                        {playingName && (
                            <Box component='span' sx={{ display: 'block', color: '#00a4dc' }}>
                                {globalize.translate('RpNowPlaying', playingName)}
                            </Box>
                        )}
                    </>
                }
            />
        </ListItemButton>
    );
};

const RemotePlayMenu: FC<RemotePlayMenuProps> = ({ anchorEl, open, onMenuClose }) => {
    const { api, user } = useApi();
    const [ targets, setTargets ] = useState<PlayTarget[]>([]);
    const [ sessions, setSessions ] = useState<SessionInfoDto[]>([]);
    const [ loading, setLoading ] = useState(false);
    const [ castStatus, setCastStatus ] = useState<CastStatus>(getCastStatus);
    const [ remoteState, setRemoteState ] = useState<RemoteState>('unsupported');
    const [ media, setMedia ] = useState<HTMLMediaElement | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setCastStatus(getCastStatus());
        try {
            const [ found, list ] = await Promise.all([
                playbackManager.getTargets() as Promise<PlayTarget[]>,
                api && user?.Id ?
                    getSessionApi(api).getSessions({ controllableByUserId: user.Id }).then(r => r.data).catch(() => []) :
                    Promise.resolve([])
            ]);
            setTargets(found);
            setSessions(list);
        } catch (err) {
            console.error('[RemotePlayMenu] unable to get playback targets', err);
        } finally {
            setLoading(false);
        }
    }, [ api, user ]);

    // Keep looking for devices while the menu is open
    useEffect(() => {
        if (!open) return;
        void refresh();
        const timer = setInterval(() => {
            refresh().catch(console.error);
        }, REFRESH_MS);
        return () => clearInterval(timer);
    }, [ open, refresh ]);

    // The video or song playing here can go to a device through the browser (works over http too)
    useEffect(() => {
        if (!open) return;
        const playing = getPlayingMedia();
        setMedia(playing);
        if (!playing) return;
        return watchRemotePlayback(playing, setRemoteState);
    }, [ open ]);

    const onPick = useCallback((target: PlayTarget) => {
        playbackManager.trySetActivePlayer(target.playerName, target);
        onMenuClose();
    }, [ onMenuClose ]);

    const isSong = media instanceof HTMLAudioElement;

    const onRemotePlayback = useCallback(() => {
        void promptRemotePlayback(media).then(ok => {
            if (!ok) toast({ text: globalize.translate(isSong ? 'RpRemoteSongFailed' : 'RpRemotePlaybackFailed') });
        });
        onMenuClose();
    }, [ isSong, media, onMenuClose ]);

    const onRefresh = useCallback(() => {
        refresh().catch(console.error);
    }, [ refresh ]);

    const castTargets = targets.filter(t => t.playerName === CAST_PLAYER);
    const jellyfinTargets = targets.filter(t => t.playerName !== CAST_PLAYER && !t.isLocalPlayer);
    const sessionById = new Map(sessions.map(s => [ s.Id, s ]));
    const canRemote = !!media && remoteState !== 'unsupported' && remoteState !== 'unavailable';
    const remoteConnected = remoteState === 'connected' || remoteState === 'connecting';
    const castLabel = isSong ? 'RpRemoteSong' : 'RpRemotePlayback';

    return (
        <Popover
            id={ID}
            anchorEl={anchorEl}
            open={open}
            onClose={onMenuClose}
            {...popoverPlacement(anchorEl)}
            slotProps={{ paper: { sx: { ...glassPaperSx, width: 360, maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(640px, 80vh)' } } }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.75, pb: 0.5 }}>
                <CastRounded sx={{ color: '#00a4dc' }} />
                <Typography sx={{ flex: 1, fontWeight: 700, fontSize: '1.05rem' }}>{globalize.translate('HeaderPlayOn')}</Typography>
                {loading ? <CircularProgress size={18} sx={{ m: 1 }} /> : (
                    <Tooltip title={globalize.translate('RpSearchAgain')}>
                        <IconButton size='small' onClick={onRefresh} aria-label={globalize.translate('RpSearchAgain')}>
                            <RefreshRounded fontSize='small' />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            <List dense disablePadding sx={{ pb: 1 }}>
                <Section title={globalize.translate('RpThisDevice')}>
                    <ListItemButton selected onClick={onMenuClose}>
                        <ListItemIcon><PlayTargetIcon target={{ id: 'local', name: '', isLocalPlayer: true, playableMediaTypes: [] }} /></ListItemIcon>
                        <ListItemText primary={globalize.translate('RpThisDevice')} secondary={globalize.translate('RpThisDeviceHint')} />
                        <CheckCircleRounded sx={{ color: '#00a4dc', fontSize: 20 }} />
                    </ListItemButton>
                </Section>

                <Section title={globalize.translate('RpJellyfinDevices')}>
                    {jellyfinTargets.map(target => (
                        <TargetRow key={target.id} target={target} session={sessionById.get(target.id)} onPick={onPick} />
                    ))}
                    {!jellyfinTargets.length && !loading && <Hint text={globalize.translate('RpNoJellyfinDevices')} />}
                </Section>

                <Section title='Google Cast · Chromecast'>
                    {castTargets.map(target => (
                        <TargetRow key={target.id} target={{ ...target, deviceName: target.deviceName || 'Chromecast' }} onPick={onPick} />
                    ))}
                    {canRemote && (
                        <ListItemButton onClick={onRemotePlayback}>
                            <ListItemIcon><CastRounded sx={{ color: remoteConnected ? '#00a4dc' : undefined }} /></ListItemIcon>
                            <ListItemText
                                primary={globalize.translate(remoteConnected ? 'RpRemotePlaybackActive' : castLabel)}
                                secondary={globalize.translate('RpRemotePlaybackHint')}
                            />
                        </ListItemButton>
                    )}
                    {castStatus !== 'ready' && <Hint text={globalize.translate(CAST_STATUS_TEXT[castStatus])} />}
                    {castStatus === 'insecure' && !media && <Hint text={globalize.translate('RpCastFromPlayer')} />}
                </Section>

                <Box sx={{ mx: 2, mt: 1.25, pt: 1.25, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: TEXT_TERTIARY, lineHeight: 1.5 }}>
                        {globalize.translate('RpMissingDevice')}
                    </Typography>
                </Box>
            </List>
        </Popover>
    );
};

export default RemotePlayMenu;
