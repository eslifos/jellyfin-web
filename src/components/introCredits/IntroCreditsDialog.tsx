import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import { playbackManager } from 'components/playback/playbackmanager';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { renderComponent } from 'utils/reactUtils';

/** Response of the custom /IntroCredits endpoints (Jellyfin.Api IntroCreditsController). */
interface IntroCreditsResult {
    ItemId: string
    Name?: string | null
    SeriesName?: string | null
    ParentIndexNumber?: number | null
    IndexNumber?: number | null
    RunTimeTicks: number
    IsAnalyzed: boolean
    AnalyzedUtc?: string | null
    IntroStartTicks?: number | null
    IntroEndTicks?: number | null
    IntroSource?: string | null
    CreditsStartTicks?: number | null
    CreditsEndTicks?: number | null
    CreditsSource?: string | null
}

const INTRO_COLOR = '#00a4dc';
const CREDITS_COLOR = '#aa5cc3';
const TICKS_PER_SECOND = 10_000_000;
/** Playback starts a bit before the segment so the transition can be checked. */
const PREVIEW_LEAD_SECONDS = 5;

const request = async (api: Api, method: 'get' | 'post', path: string) => {
    const response = await api.axiosInstance.request<IntroCreditsResult[]>({
        method,
        url: `${api.basePath}/IntroCredits/${path}`,
        headers: { Authorization: api.authorizationHeader }
    });
    return response.data;
};

const formatTime = (ticks?: number | null) => {
    if (ticks == null) return '—';
    const total = Math.round(ticks / TICKS_PER_SECOND);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    return `${h > 0 ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
};

const formatLength = (start?: number | null, end?: number | null) => {
    if (start == null || end == null) return '';
    return `${Math.round((end - start) / TICKS_PER_SECOND)} s`;
};

const sourceLabel = (source?: string | null) => {
    switch (source) {
        case 'Chapter': return globalize.translate('IntroCreditsSourceChapter');
        case 'Fingerprint': return globalize.translate('IntroCreditsSourceFingerprint');
        case 'BlackFrames': return globalize.translate('IntroCreditsSourceBlackFrames');
        default: return source || '';
    }
};

const Timeline = ({ result }: { result: IntroCreditsResult }) => {
    const total = result.RunTimeTicks || 1;
    const segment = (start: number | null | undefined, end: number | null | undefined, color: string) => {
        if (start == null || end == null) return null;
        return (
            <Box sx={{
                position: 'absolute', top: 0, bottom: 0, borderRadius: '4px',
                left: `${(start / total) * 100}%`,
                width: `${Math.max(((end - start) / total) * 100, 0.6)}%`,
                background: color, boxShadow: `0 0 10px ${color}88`
            }} />
        );
    };

    return (
        <Box sx={{ position: 'relative', height: 10, borderRadius: '5px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            {segment(result.IntroStartTicks, result.IntroEndTicks, INTRO_COLOR)}
            {segment(result.CreditsStartTicks, result.CreditsEndTicks, CREDITS_COLOR)}
        </Box>
    );
};

interface SegmentRowProps {
    label: string;
    color: string;
    start?: number | null;
    end?: number | null;
    source?: string | null;
    onPreview: (ticks: number) => void;
}

const SegmentRow = ({ label, color, start, end, source, onPreview }: SegmentRowProps) => {
    const found = start != null && end != null;
    const preview = useCallback(() => {
        if (start != null) onPreview(start);
    }, [ start, onPreview ]);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', background: found ? color : 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: found ? color : 'rgba(255,255,255,0.45)', width: 70, flexShrink: 0 }}>{label}</Typography>
            {found ? (
                <>
                    <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.88)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatTime(start)} → {formatTime(end)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>({formatLength(start, end)})</Typography>
                    <Chip size='small' label={sourceLabel(source)} sx={{ height: 20, fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.06)', ml: 'auto' }} />
                    <Tooltip title={globalize.translate('IntroCreditsPreview')}>
                        <IconButton size='small' onClick={preview} sx={{ color, background: `${color}1a`, '&:hover': { background: `${color}33` } }}>
                            <PlayArrowIcon fontSize='small' />
                        </IconButton>
                    </Tooltip>
                </>
            ) : (
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{globalize.translate('IntroCreditsNotFound')}</Typography>
            )}
        </Box>
    );
};

interface IntroCreditsDialogProps {
    item: BaseItemDto;
    onClose: () => void;
}

const IntroCreditsDialog = ({ item, onClose }: IntroCreditsDialogProps) => {
    const [ open, setOpen ] = useState(true);
    const [ results, setResults ] = useState<IntroCreditsResult[] | null>(null);
    const [ isDetecting, setIsDetecting ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const startedRef = useRef(false);
    const api = ServerConnections.getApi(item.ServerId || '');

    const detect = useCallback(() => {
        if (!api || !item.Id) return;
        setIsDetecting(true);
        setError(null);
        request(api, 'post', `${item.Id}/Detect`)
            .then(setResults)
            .catch(err => {
                console.error('[IntroCredits] detection failed', err);
                setError(globalize.translate('IntroCreditsError'));
            })
            .finally(() => setIsDetecting(false));
    }, [ api, item.Id ]);

    // Show the previous results right away and start a fresh detection.
    useEffect(() => {
        if (startedRef.current || !api || !item.Id) return;
        startedRef.current = true;
        request(api, 'get', item.Id)
            .then(data => setResults(current => current ?? data))
            .catch(() => { /* no previous results */ });
        detect();
    }, [ api, item.Id, detect ]);

    const close = useCallback(() => setOpen(false), []);

    const preview = useCallback((itemId: string, ticks: number) => {
        setOpen(false);
        void playbackManager.play({
            ids: [ itemId ],
            serverId: item.ServerId,
            startPositionTicks: Math.max(0, ticks - PREVIEW_LEAD_SECONDS * TICKS_PER_SECOND)
        });
    }, [ item.ServerId ]);

    const isMany = (results?.length || 0) > 1;
    const found = (results || []).filter(r => r.IntroStartTicks != null || r.CreditsStartTicks != null).length;

    return (
        <Dialog
            open={open}
            onClose={isDetecting ? undefined : close}
            TransitionProps={{ onExited: onClose }}
            fullWidth
            maxWidth='sm'
            PaperProps={{
                sx: {
                    background: 'rgba(10,12,22,0.96)', backdropFilter: 'blur(24px)', borderRadius: '18px',
                    border: '1px solid rgba(0,164,220,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
                <Box sx={{
                    width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(0,164,220,0.25), rgba(170,92,195,0.25))', color: '#fff'
                }}>
                    <AutoFixHighIcon fontSize='small' />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{globalize.translate('IntroCreditsTitle')}</Typography>
                    <Typography noWrap sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                        {item.SeriesName ? `${item.SeriesName} · ` : ''}{item.Name}
                    </Typography>
                </Box>
                <IconButton onClick={close} disabled={isDetecting} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 1 }}>
                {isDetecting && (
                    <Box sx={{ mb: 2 }}>
                        <LinearProgress sx={{ height: 4, borderRadius: 2, background: 'rgba(0,164,220,0.15)', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #00a4dc, #aa5cc3)' } }} />
                        <Typography sx={{ mt: 1, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                            {globalize.translate(item.Type === 'Season' || item.Type === 'Series' ? 'IntroCreditsDetectingMany' : 'IntroCreditsDetecting')}
                        </Typography>
                    </Box>
                )}

                {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}

                {!isDetecting && results && isMany && (
                    <Typography sx={{ mb: 1.5, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                        {globalize.translate('IntroCreditsSummary', found, results.length)}
                    </Typography>
                )}

                {results && results.length === 0 && (
                    <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('IntroCreditsNoItems')}</Typography>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, opacity: isDetecting ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                    {results?.map(result => (
                        <Box key={result.ItemId} sx={{
                            p: 1.5, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: 1,
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)'
                        }}>
                            {isMany && (
                                <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                                    {result.IndexNumber != null ? `${result.ParentIndexNumber ?? ''}x${String(result.IndexNumber).padStart(2, '0')} · ` : ''}{result.Name}
                                </Typography>
                            )}
                            <Timeline result={result} />
                            <SegmentRow
                                label={globalize.translate('IntroCreditsIntro')}
                                color={INTRO_COLOR}
                                start={result.IntroStartTicks}
                                end={result.IntroEndTicks}
                                source={result.IntroSource}
                                onPreview={ticks => preview(result.ItemId, ticks)}
                            />
                            <SegmentRow
                                label={globalize.translate('IntroCreditsCredits')}
                                color={CREDITS_COLOR}
                                start={result.CreditsStartTicks}
                                end={result.CreditsEndTicks}
                                source={result.CreditsSource}
                                onPreview={ticks => preview(result.ItemId, ticks)}
                            />
                            {!result.IsAnalyzed && !isDetecting && (
                                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{globalize.translate('IntroCreditsNotAnalyzed')}</Typography>
                            )}
                        </Box>
                    ))}
                </Box>

                {item.Type === 'Movie' && !isDetecting && (
                    <Typography sx={{ mt: 2, fontSize: '0.72rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.4)' }}>
                        {globalize.translate('IntroCreditsMovieHelp')}
                    </Typography>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button onClick={close} disabled={isDetecting} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {globalize.translate('ButtonClose')}
                </Button>
                <Button variant='contained' startIcon={<AutoFixHighIcon />} onClick={detect} disabled={isDetecting} sx={{ borderRadius: '10px', fontWeight: 600 }}>
                    {globalize.translate('IntroCreditsDetectAgain')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

/** Opens the intro / credits detection dialog for a movie, episode, season or series. */
export const showIntroCreditsDialog = (item: BaseItemDto) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let unmount: (() => void) | undefined;
    const onClose = () => {
        unmount?.();
        setTimeout(() => container.remove());
    };
    unmount = renderComponent(IntroCreditsDialog, { item, onClose }, container);
};

export default showIntroCreditsDialog;
