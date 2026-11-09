/**
 * Building blocks of the meta universe pages: poster cards (with the Kometa-like badges, since they keep the
 * legacy ".card[data-id] .cardScalable" structure), glass section cards with a horizontal row, and people.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import React, { type FC, type ReactNode, useRef } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link } from 'react-router-dom';

import { useApi } from 'hooks/useApi';
import { ServerConnections } from 'lib/jellyfin-apiclient';

export const glassCard = {
    position: 'relative',
    mb: 2.5,
    p: { xs: 1.5, sm: 2.2 },
    borderRadius: '22px',
    background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
    border: '1px solid rgba(0,164,220,0.14)',
    boxShadow: '0 10px 34px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
    backdropFilter: 'blur(14px)',
    overflow: 'hidden'
} as const;

export const detailsUrl = (item: BaseItemDto) => `/details?id=${item.Id}&serverId=${item.ServerId}`;

const SQUARE = new Set([ 'MusicAlbum', 'Audio', 'MusicArtist', 'Playlist' ]);

interface MediaCardProps {
    item: BaseItemDto;
    width?: number;
    caption?: ReactNode;
}

export const MediaCard: FC<MediaCardProps> = ({ item, width = 150, caption }) => {
    const { api } = useApi();
    const square = SQUARE.has(item.Type || '');
    const tag = item.ImageTags?.Primary;
    const img = api && tag ? getImageApi(api).getItemImageUrlById(item.Id!, ImageType.Primary, { maxWidth: width * 2, tag }) : null;
    const played = item.UserData?.Played;
    const progress = item.UserData?.PlayedPercentage;

    return (
        <Box
            className='card'
            data-id={item.Id}
            data-type={item.Type}
            sx={{ width, flexShrink: 0, '&:hover .cardScalable': {
                transform: 'scale(1.05)',
                boxShadow: '0 14px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,164,220,0.55), 0 0 20px rgba(0,164,220,0.3)'
            } }}
        >
            <Box
                component={Link}
                to={detailsUrl(item)}
                aria-label={item.Name || undefined}
                sx={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
            >
                <Box className='cardScalable' sx={{
                    position: 'relative', aspectRatio: square ? '1' : '2 / 3', borderRadius: '12px', overflow: 'hidden',
                    background: 'linear-gradient(160deg, #1b2440, #0b0f1e)',
                    transition: 'transform 0.28s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.28s'
                }}>
                    {img ? (
                        <Box component='img' src={img} alt='' loading='lazy' sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 1, textAlign: 'center', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
                            {item.Name}
                        </Box>
                    )}
                    {played && (
                        <Box sx={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#00a4dc', fontSize: 14, fontWeight: 900, zIndex: 3 }}>✓</Box>
                    )}
                    {!played && !!progress && (
                        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(0,0,0,0.5)', zIndex: 3 }}>
                            <Box sx={{ width: `${progress}%`, height: '100%', background: '#00a4dc' }} />
                        </Box>
                    )}
                </Box>
                <Typography noWrap sx={{ mt: 0.8, fontSize: '0.85rem', fontWeight: 700 }}>{item.Name}</Typography>
                <Typography noWrap sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>
                    {caption ?? item.ProductionYear ?? ''}
                </Typography>
            </Box>
        </Box>
    );
};

interface SectionProps {
    title: ReactNode;
    icon?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}

/** Glass card with a title and a horizontal scrolling row. */
export const RowSection: FC<SectionProps> = ({ title, icon, actions, children }) => {
    const scroller = useRef<HTMLDivElement>(null);
    const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' });

    return (
        <Box component='section' sx={glassCard}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                {icon && <Box sx={{ color: '#00a4dc', display: 'flex' }}>{icon}</Box>}
                <Typography component='h2' sx={{ fontSize: '1.25rem', fontWeight: 800, flex: 1, minWidth: 0 }}>{title}</Typography>
                {actions}
                <IconButton size='small' onClick={() => scroll(-1)} sx={{ display: { xs: 'none', sm: 'inline-flex' }, border: '1px solid rgba(255,255,255,0.12)' }}><ChevronLeftIcon /></IconButton>
                <IconButton size='small' onClick={() => scroll(1)} sx={{ display: { xs: 'none', sm: 'inline-flex' }, border: '1px solid rgba(255,255,255,0.12)' }}><ChevronRightIcon /></IconButton>
            </Box>
            <Box ref={scroller} sx={{
                display: 'flex', gap: 1.6, overflowX: 'auto', pb: 1, pt: 0.5, px: 0.5,
                scrollbarWidth: 'thin', scrollSnapType: 'x proximity', '& > *': { scrollSnapAlign: 'start' }
            }}>
                {children}
            </Box>
        </Box>
    );
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

interface PersonCardProps {
    id: string;
    name: string;
    subtitle?: string;
    badge?: string;
}

export const PersonCard: FC<PersonCardProps> = ({ id, name, subtitle, badge }) => {
    const { api } = useApi();
    const img = api && id && !/^0+$/.test(id.replace(/-/g, '')) ? getImageApi(api).getItemImageUrlById(id, ImageType.Primary, { maxWidth: 240 }) : null;

    return (
        <Box
            component={Link}
            to={`/details?id=${id}&serverId=${ServerConnections.currentApiClient()?.serverId() ?? ''}`}
            sx={{ width: 120, flexShrink: 0, textAlign: 'center', color: 'inherit', textDecoration: 'none', '&:hover .uniPersonImg': { borderColor: '#00a4dc', boxShadow: '0 0 18px rgba(0,164,220,0.5)' } }}
        >
            <Box className='uniPersonImg' sx={{
                position: 'relative', width: 104, height: 104, mx: 'auto', borderRadius: '50%', overflow: 'hidden',
                display: 'grid', placeItems: 'center', fontSize: '1.8rem', fontWeight: 900,
                background: 'linear-gradient(135deg, #aa5cc3, #00a4dc)', border: '2px solid rgba(255,255,255,0.12)', transition: 'all 0.2s'
            }}>
                {initials(name)}
                {img && (
                    <Box component='img' src={img} alt='' loading='lazy'
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
                        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
            </Box>
            {badge && (
                <Box sx={{ display: 'inline-block', mt: -1.2, position: 'relative', px: 0.9, py: 0.1, borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800, background: '#00a4dc', color: '#fff' }}>{badge}</Box>
            )}
            <Typography sx={{ mt: 0.6, fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.2 }}>{name}</Typography>
            {subtitle && <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.25 }}>{subtitle}</Typography>}
        </Box>
    );
};
