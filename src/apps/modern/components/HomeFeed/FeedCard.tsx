/**
 * Card of the home feed: poster, square or landscape, with progress, watched mark and a play button on hover.
 * Portrait cards keep the legacy `.card[data-id] > .cardScalable` markup so the quality / rating badges are added.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import React, { type FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { playbackManager } from 'components/playback/playbackmanager';
import { useApi } from 'hooks/useApi';

import { type CardShape, cardImage, cardSubtitle, cardTitle, isPlayable, itemRoute, timeLeft } from './feedUtils';

export const CARD_WIDTH: Record<CardShape, { xs: number, md: number }> = {
    portrait: { xs: 118, md: 152 },
    square: { xs: 132, md: 164 },
    landscape: { xs: 230, md: 300 }
};

const RATIO: Record<CardShape, string> = { portrait: '2 / 3', square: '1 / 1', landscape: '16 / 9' };

interface FeedCardProps {
    item: BaseItemDto;
    shape: CardShape;
    /** Shows the progress bar and the time left (continue watching). */
    resume?: boolean;
    /** Round image (artists). */
    round?: boolean;
    context?: string | null;
    subtitle?: string;
}

const FeedCard: FC<FeedCardProps> = ({ item, shape, resume, round, context, subtitle }) => {
    const { api } = useApi();
    const navigate = useNavigate();

    const open = useCallback(() => navigate(itemRoute(item, context)), [ navigate, item, context ]);
    const onKey = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') open();
    }, [ open ]);
    const play = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        void playbackManager.play({
            items: [ item ],
            serverId: item.ServerId,
            startPositionTicks: resume ? item.UserData?.PlaybackPositionTicks ?? 0 : undefined
        });
    }, [ item, resume ]);

    if (!api) return null;

    const src = cardImage(api, item, shape);
    const played = item.UserData?.Played && !resume;
    const percent = item.UserData?.PlayedPercentage ?? 0;
    const sub = subtitle ?? (resume ? timeLeft(item) ?? cardSubtitle(item) : cardSubtitle(item));
    const badges = shape === 'portrait';

    return (
        <Box
            className={badges ? 'card hfCard' : 'hfCard'}
            data-id={badges ? item.Id : undefined}
            data-type={badges ? item.Type : undefined}
            sx={{ flex: '0 0 auto', width: CARD_WIDTH[shape], scrollSnapAlign: 'start', display: 'block' }}
        >
            <Box
                className={badges ? 'cardScalable' : undefined}
                role='link'
                tabIndex={0}
                onClick={open}
                onKeyDown={onKey}
                title={item.Name || ''}
                sx={{
                    position: 'relative', width: '100%', aspectRatio: RATIO[shape], cursor: 'pointer', overflow: 'hidden',
                    borderRadius: round ? '50%' : '12px', background: 'linear-gradient(135deg, #1b2040, #0d1022)',
                    boxShadow: '0 8px 22px rgba(0,0,0,0.45)', transition: 'transform 0.2s, box-shadow 0.2s', outline: 'none',
                    '&:hover, &:focus-visible': { transform: 'translateY(-3px)', boxShadow: '0 0 0 2px #00a4dc, 0 10px 28px rgba(0,164,220,0.35)' },
                    '&:hover .hfPlay, &:focus-visible .hfPlay': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
                }}
            >
                {src ? (
                    <Box component='img' src={src} alt='' loading='lazy' sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5, textAlign: 'center' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)' }}>{cardTitle(item)}</Typography>
                    </Box>
                )}

                {isPlayable(item) && (
                    <Box
                        component='span'
                        className='hfPlay'
                        role='button'
                        aria-label='play'
                        onClick={play}
                        sx={{
                            position: 'absolute', top: '50%', left: '50%', zIndex: 2, opacity: 0, transform: 'translate(-50%, -50%) scale(0.8)',
                            transition: 'all 0.2s', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,164,220,0.92)', color: '#fff', boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                            '&:hover': { background: '#00b8f5' }
                        }}
                    >
                        <PlayArrowRoundedIcon sx={{ fontSize: 30 }} />
                    </Box>
                )}

                {played && (
                    <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2, width: 22, height: 22, borderRadius: '50%', background: '#00a4dc', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
                        <CheckRoundedIcon sx={{ fontSize: 16, color: '#fff' }} />
                    </Box>
                )}

                {resume && percent > 0 && (
                    <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, zIndex: 2, background: 'rgba(0,0,0,0.55)' }}>
                        <Box sx={{ width: `${Math.min(100, percent)}%`, height: '100%', background: 'linear-gradient(90deg, #00a4dc, #aa5cc3)' }} />
                    </Box>
                )}
            </Box>

            <Box sx={{ mt: 0.85, px: 0.25, textAlign: shape === 'landscape' ? 'left' : 'center', minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{cardTitle(item)}</Typography>
                {sub && <Typography noWrap sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>{sub}</Typography>}
            </Box>
        </Box>
    );
};

export default FeedCard;
