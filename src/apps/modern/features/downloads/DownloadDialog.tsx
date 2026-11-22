/**
 * What to download: quality (the user's default, "optimal" if never chosen), audio and subtitles of a movie or
 * episode, only the unwatched episodes of a season or series, and how much space it takes against what is left
 * (10% of the device is never used).
 */
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type ChangeEvent, type FC, useCallback, useEffect, useMemo, useState } from 'react';

import toast from 'components/toast/toast';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { renderComponent } from 'utils/reactUtils';

import { enqueue, estimateBytes, getDownloads, loadDownloads } from './engine';
import { formatBytes } from './format';
import { QUALITY_LABELS, QUALITY_PRESETS, readDownloadSettings } from './settings';
import { type Quality, type Space, readSpace } from './store';

const FIELDS = 'MediaSources,MediaStreams';
const QUALITIES = Object.keys(QUALITY_PRESETS) as Quality[];

/** The titles behind what was chosen: a movie or song itself, or the episodes / tracks of a folder. */
const expand = async (api: Api, userId: string, item: BaseItemDto): Promise<BaseItemDto[]> => {
    const folder = [ 'Season', 'Series', 'MusicAlbum', 'Playlist' ].includes(item.Type ?? '') || (item.Type === 'AudioBook' && item.IsFolder);
    const isMusic = [ 'MusicAlbum', 'Playlist', 'AudioBook' ].includes(item.Type ?? '');
    const params: Record<string, unknown> = folder ? {
        ParentId: item.Id,
        Recursive: true,
        IncludeItemTypes: isMusic ? 'Audio,AudioBook' : 'Episode',
        SortBy: 'ParentIndexNumber,IndexNumber,SortName',
        IsMissing: false,
        Fields: FIELDS
    } : { Ids: item.Id, Fields: FIELDS };
    const { data } = await api.axiosInstance.get<{ Items?: BaseItemDto[] }>(`${api.basePath}/Items`, {
        headers: { Authorization: api.authorizationHeader },
        params: { ...params, userId, EnableUserData: true }
    });
    return (data.Items ?? []).filter(i => !i.IsFolder && i.LocationType !== 'Virtual');
};

const streamLabel = (stream: { DisplayTitle?: string | null, Language?: string | null, Index?: number }) => stream.DisplayTitle || stream.Language || `#${stream.Index}`;

const DownloadDialog: FC<{ item: BaseItemDto, onClose: () => void }> = ({ item, onClose }) => {
    const serverId = item.ServerId ?? ServerConnections.currentApiClient()?.serverId() ?? '';
    const api = ServerConnections.getApi(serverId) as Api | undefined;
    const userId = (ServerConnections.getApiClient(serverId) as unknown as { getCurrentUserId: () => string }).getCurrentUserId();
    const [ items, setItems ] = useState<BaseItemDto[]>();
    const [ space, setSpace ] = useState<Space>();
    const [ quality, setQuality ] = useState<Quality>(() => readDownloadSettings().quality);
    const [ unwatchedOnly, setUnwatchedOnly ] = useState(false);
    const [ audioIndex, setAudioIndex ] = useState<number>();
    const [ subtitleIndex, setSubtitleIndex ] = useState<number>(-1);
    const [ open, setOpen ] = useState(true);

    useEffect(() => {
        if (!api) return;
        void loadDownloads();
        void readSpace().then(setSpace);
        expand(api, userId, item).then(list => {
            setItems(list);
            const streams = list.length === 1 ? list[0].MediaSources?.[0] : undefined;
            setAudioIndex(streams?.DefaultAudioStreamIndex ?? undefined);
        }).catch(() => setItems([]));
    }, [ api, userId, item ]);

    const close = useCallback(() => {
        setOpen(false);
        onClose();
    }, [ onClose ]);

    const single = items?.length === 1 ? items[0] : undefined;
    const streams = single?.MediaSources?.[0]?.MediaStreams ?? [];
    const audioStreams = streams.filter(s => s.Type === 'Audio');
    const subtitleStreams = streams.filter(s => s.Type === 'Subtitle');
    const hasEpisodes = (items?.length ?? 0) > 1 && items?.some(i => i.Type === 'Episode');

    const chosen = useMemo(() => {
        const downloaded = getDownloads();
        return (items ?? []).filter(i => !downloaded[i.Id ?? ''] && !(unwatchedOnly && i.UserData?.Played));
    }, [ items, unwatchedOnly ]);
    const total = chosen.reduce((sum, i) => sum + estimateBytes(i, quality), 0);
    const fits = !space || total <= space.available;

    const onQuality = useCallback((e: ChangeEvent<HTMLInputElement>) => setQuality(e.target.value as Quality), []);
    const onAudio = useCallback((e: ChangeEvent<HTMLInputElement>) => setAudioIndex(Number(e.target.value)), []);
    const onSubtitle = useCallback((e: ChangeEvent<HTMLInputElement>) => setSubtitleIndex(Number(e.target.value)), []);
    const onUnwatched = useCallback((_: unknown, checked: boolean) => setUnwatchedOnly(checked), []);
    const onConfirm = useCallback(() => {
        void enqueue(chosen, serverId, userId, { quality, audioIndex: single ? audioIndex : undefined, subtitleIndex: single ? subtitleIndex : undefined });
        toast(globalize.translate('DlAdded', chosen.length));
        close();
    }, [ chosen, serverId, userId, quality, audioIndex, subtitleIndex, single, close ]);

    return (
        <Dialog open={open} onClose={close} fullWidth maxWidth='xs'>
            <DialogTitle>{globalize.translate('DlTitle', item.Name ?? '')}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
                <TextField select label={globalize.translate('DlQuality')} value={quality} onChange={onQuality} fullWidth>
                    {QUALITIES.map(q => <MenuItem key={q} value={q}>{globalize.translate(QUALITY_LABELS[q])}</MenuItem>)}
                </TextField>
                {audioStreams.length > 1 && (
                    <TextField select label={globalize.translate('Audio')} value={audioIndex ?? ''} onChange={onAudio} fullWidth>
                        {audioStreams.map(s => <MenuItem key={s.Index} value={s.Index}>{streamLabel(s)}</MenuItem>)}
                    </TextField>
                )}
                {subtitleStreams.length > 0 && (
                    <TextField select label={globalize.translate('Subtitles')} value={subtitleIndex} onChange={onSubtitle} fullWidth helperText={globalize.translate('DlSubtitlesHelp')}>
                        <MenuItem value={-1}>{globalize.translate('Off')}</MenuItem>
                        {subtitleStreams.map(s => <MenuItem key={s.Index} value={s.Index}>{streamLabel(s)}</MenuItem>)}
                    </TextField>
                )}
                {hasEpisodes && (
                    <FormControlLabel control={<Switch checked={unwatchedOnly} onChange={onUnwatched} />} label={globalize.translate('DlUnwatchedOnly')} />
                )}
                <Typography variant='body2' color='text.secondary'>
                    {items ? globalize.translate('DlSummary', chosen.length, formatBytes(total)) : globalize.translate('DlLoading')}
                </Typography>
                {space && (
                    <Typography variant='body2' color={fits ? 'text.secondary' : 'error'}>
                        {fits ?
                            globalize.translate('DlSpaceLeft', formatBytes(space.available), formatBytes(space.reserve)) :
                            globalize.translate('DlNoSpace', formatBytes(total), formatBytes(space.available))}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={close}>{globalize.translate('ButtonCancel')}</Button>
                <Button variant='contained' onClick={onConfirm} disabled={!items || !chosen.length || !fits}>{globalize.translate('Download')}</Button>
            </DialogActions>
        </Dialog>
    );
};

/** Opens the download options for a title (from its page or its menu). */
export const openDownloadDialog = (item: BaseItemDto) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const mounted: { unmount?: () => void } = {};
    const onClose = () => {
        // Leaves time for the closing animation
        window.setTimeout(() => {
            mounted.unmount?.();
            host.remove();
        }, 300);
    };
    mounted.unmount = renderComponent(DownloadDialog, { item, onClose }, host);
};
