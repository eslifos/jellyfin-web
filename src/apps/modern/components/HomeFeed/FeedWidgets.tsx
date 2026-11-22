/**
 * Widgets shared by the home feed, the library start screens and the genre page:
 * upcoming release card, external (TMDb) movie card and genre tile.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import Box from '@mui/material/Box';
import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';
import Typography from '@mui/material/Typography';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import React, { type FC, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ExternalMovie } from 'apps/modern/components/Trailer';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { hashColor, itemRoute } from './feedUtils';

export interface UpcomingRelease {
    Kind: string;
    TmdbId?: number;
    Title: string;
    ReleaseDate: string;
    Overview?: string | null;
    ImageUrl?: string | null;
    BackdropUrl?: string | null;
    Rating?: number | null;
    SeriesId?: string | null;
    SeriesName?: string | null;
    SeasonNumber?: number | null;
    EpisodeNumber?: number | null;
    RelatedItemId?: string | null;
}

export const dayLabel = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return globalize.translate('HfToday');
    if (diff === 1) return globalize.translate('HfTomorrow');
    return new Intl.DateTimeFormat(undefined, { weekday: diff > 0 && diff < 7 ? 'short' : undefined, day: 'numeric', month: 'short', year: Math.abs(diff) > 300 ? 'numeric' : undefined }).format(day);
};

/** Image that tries several sources in order (TMDb first, then the library's own images). */
export const FallbackImage: FC<{ sources: (string | null | undefined)[], alt?: string }> = ({ sources, alt }) => {
    const list = useMemo(() => sources.filter((s): s is string => !!s), [ sources ]);
    const [ index, setIndex ] = useState(0);
    const onError = useCallback(() => setIndex(i => i + 1), []);
    const src = list[index];
    if (!src) return null;
    return <Box component='img' src={src} alt={alt ?? ''} loading='lazy' onError={onError} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
};

const landscapeCardSx = (accent: string, clickable: boolean): SystemStyleObject<Theme> => ({
    position: 'relative', aspectRatio: '16 / 9', borderRadius: '12px', overflow: 'hidden', cursor: clickable ? 'pointer' : 'default',
    background: `linear-gradient(135deg, ${accent}55, #0d1022 70%)`, boxShadow: '0 8px 22px rgba(0,0,0,0.45)', transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': clickable ? { transform: 'translateY(-3px)', boxShadow: `0 0 0 2px ${accent}, 0 10px 28px ${accent}55` } : {}
});

/** Upcoming episode of a library series, or upcoming movie of a saga. */
export const UpcomingCard: FC<{ release: UpcomingRelease }> = ({ release }) => {
    const { api } = useApi();
    const navigate = useNavigate();
    const target = release.SeriesId ?? release.RelatedItemId;
    const open = useCallback(() => {
        if (target) navigate(`/details?id=${target}`);
    }, [ navigate, target ]);

    // TMDb still / backdrop first; many future episodes have none, then the series' own art
    const sources = useMemo(() => {
        const local = (id: string | null | undefined, type: ImageType) => (api && id ? getImageApi(api).getItemImageUrlById(id, type, { maxWidth: 560, quality: 90 }) : undefined);
        return [
            release.Kind === 'Episode' ? release.ImageUrl : release.BackdropUrl,
            release.Kind === 'Episode' ? release.BackdropUrl : release.ImageUrl,
            local(release.SeriesId, ImageType.Backdrop),
            local(release.SeriesId, ImageType.Thumb),
            local(release.RelatedItemId, ImageType.Backdrop),
            local(release.SeriesId, ImageType.Primary),
            local(release.RelatedItemId, ImageType.Primary)
        ];
    }, [ api, release ]);

    const episode = release.Kind === 'Episode' && release.SeasonNumber != null ? `T${release.SeasonNumber}:E${release.EpisodeNumber ?? '?'} · ` : '';

    return (
        <Box onClick={open} role='link' tabIndex={0} sx={{ flex: '0 0 auto', width: { xs: 230, md: 290 }, scrollSnapAlign: 'start' }}>
            <Box sx={landscapeCardSx('#26c6da', !!target)}>
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.75)' }}>{release.SeriesName ?? release.Title}</Typography>
                </Box>
                <FallbackImage sources={sources} />
                <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.35, borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'capitalize', color: '#001018', background: '#26c6da' }}>
                    <EventRoundedIcon sx={{ fontSize: 14 }} />{dayLabel(release.ReleaseDate)}
                </Box>
            </Box>
            <Box sx={{ mt: 0.85, px: 0.25 }}>
                <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{release.SeriesName ?? release.Title}</Typography>
                <Typography noWrap sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>{release.SeriesName ? `${episode}${release.Title}` : globalize.translate('HfMovieRelease')}</Typography>
            </Box>
        </Box>
    );
};

/** Movie from TMDb (in theaters / coming to theaters): opens it in the library or its sheet with the trailer. */
export const ExternalCard: FC<{ release: UpcomingRelease, showDate: boolean, onOpen: (movie: ExternalMovie) => void }> = ({ release, showDate, onOpen }) => {
    const navigate = useNavigate();
    const open = useCallback(() => {
        if (release.RelatedItemId) {
            navigate(`/details?id=${release.RelatedItemId}`);
        } else if (release.TmdbId) {
            onOpen({ ...release, TmdbId: release.TmdbId });
        }
    }, [ navigate, onOpen, release ]);

    return (
        <Box onClick={open} role='link' tabIndex={0} sx={{ flex: '0 0 auto', width: { xs: 118, md: 152 }, scrollSnapAlign: 'start', cursor: 'pointer' }}>
            <Box sx={{ ...landscapeCardSx('#ff7043', true), aspectRatio: '2 / 3' }}>
                <FallbackImage sources={[ release.ImageUrl ]} alt={release.Title} />
                {showDate && (
                    <Box sx={{ position: 'absolute', top: 6, left: 6, px: 0.75, py: 0.25, borderRadius: '7px', fontSize: '0.68rem', fontWeight: 800, textTransform: 'capitalize', color: '#1a0800', background: '#ffab40' }}>
                        {dayLabel(release.ReleaseDate)}
                    </Box>
                )}
                {release.Rating != null && release.Rating > 0 && (
                    <Box sx={{ position: 'absolute', bottom: 6, right: 6, display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: '7px', fontSize: '0.7rem', fontWeight: 800, background: 'rgba(8,10,22,0.8)', color: '#ffca28' }}>
                        <StarRoundedIcon sx={{ fontSize: 13 }} />{release.Rating.toFixed(1)}
                    </Box>
                )}
            </Box>
            <Typography noWrap sx={{ mt: 0.85, fontSize: '0.85rem', fontWeight: 700, textAlign: 'center' }}>{release.Title}</Typography>
        </Box>
    );
};

/** Coloured tile of a genre; opens the genre page (all libraries, or one library with parentId). */
export const GenreTile: FC<{ genre: BaseItemDto, parentId?: string | null }> = ({ genre, parentId }) => {
    const navigate = useNavigate();
    const open = useCallback(() => {
        if (genre.Type === 'Genre') {
            const scope = parentId ? '&parentId=' + parentId : '';
            navigate(`/genre?genreId=${genre.Id}${scope}`);
        } else {
            navigate(itemRoute(genre));
        }
    }, [ navigate, genre, parentId ]);
    const color = hashColor(genre.Name || '');

    return (
        <Box onClick={open} role='link' tabIndex={0} sx={{
            flex: '0 0 auto', width: { xs: 150, md: 190 }, height: { xs: 80, md: 96 }, borderRadius: '14px', cursor: 'pointer', scrollSnapAlign: 'start',
            display: 'flex', alignItems: 'flex-end', p: 1.5, position: 'relative', overflow: 'hidden',
            background: `linear-gradient(135deg, ${color} 0%, rgba(10,12,28,0.95) 120%)`, boxShadow: '0 8px 22px rgba(0,0,0,0.4)',
            transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px) scale(1.02)' },
            '&::after': { content: '""', position: 'absolute', right: -20, top: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }
        }}>
            <Typography sx={{ position: 'relative', zIndex: 1, fontWeight: 900, fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                {genre.Name}
            </Typography>
        </Box>
    );
};
