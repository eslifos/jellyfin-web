/**
 * Trailer player and TMDb movie sheet, both inside the app (no links to other sites).
 * The trailer is chosen by the server in the library language: es-MX / es-419, other Spanish, English, original.
 */
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import React, { type FC, useState } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

export interface TrailerSource {
    /** A library item (movie or series) */
    itemId?: string;
    /** Or a TMDb movie id, with the library for the language */
    tmdbId?: number;
    parentId?: string | null;
}

interface TrailerInfo {
    Key: string;
    Name: string;
    Language: string;
}

export interface ExternalMovie {
    TmdbId: number;
    Title: string;
    ReleaseDate: string;
    Overview?: string | null;
    ImageUrl?: string | null;
    BackdropUrl?: string | null;
    Rating?: number | null;
}

const glassButtonSx = {
    px: 2.5, py: 1, borderRadius: '14px', textTransform: 'none', fontSize: '0.95rem', fontWeight: 700,
    color: '#fff', background: 'linear-gradient(135deg, #00a4dc 0%, #0077b6 100%)',
    border: '1px solid rgba(120,220,255,0.45)', boxShadow: '0 0 18px rgba(0,164,220,0.4)',
    '&:hover': { background: 'linear-gradient(135deg, #14b4ec 0%, #0088cc 100%)' }
};

/** Asks the server for the trailer; only while enabled. */
export const useTrailer = (source: TrailerSource, enabled: boolean) => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'Trailer', source.itemId, source.tmdbId, source.parentId ],
        queryFn: async ({ signal }) => {
            const res = await api!.axiosInstance.get<TrailerInfo | ''>(`${api!.basePath}/Discovery/Trailer`, {
                headers: { Authorization: api!.authorizationHeader },
                params: { itemId: source.itemId, tmdbId: source.tmdbId, parentId: source.parentId || undefined },
                signal
            });
            return res.data || null;
        },
        enabled: !!api && enabled && (!!source.itemId || !!source.tmdbId),
        staleTime: 12 * 60 * 60 * 1000
    });
};

/** 16:9 player of the trailer downloaded by the server: the app's own video, nothing from other sites. */
export const TrailerPlayer: FC<{ source: TrailerSource }> = ({ source }) => {
    const { api } = useApi();

    // The server finds a trailer that downloads (library language first, then the next ones) and waits until it is ready
    const prepare = useQuery({
        queryKey: [ 'TrailerReady', source.itemId, source.tmdbId, source.parentId ],
        queryFn: async ({ signal }) => {
            try {
                const res = await api!.axiosInstance.get<TrailerInfo>(`${api!.basePath}/Discovery/Trailer/Ready`, {
                    headers: { Authorization: api!.authorizationHeader },
                    params: { itemId: source.itemId, tmdbId: source.tmdbId, parentId: source.parentId || undefined },
                    timeout: 10 * 60 * 1000,
                    signal
                });
                return res.data || null;
            } catch (err) {
                if (signal?.aborted) throw err;
                return null;
            }
        },
        enabled: !!api && (!!source.itemId || !!source.tmdbId),
        retry: false,
        staleTime: 30 * 60 * 1000
    });
    const key = prepare.data?.Key;

    const [ playError, setPlayError ] = useState(false);
    const failed = (!prepare.isPending && !key) || playError;
    const ready = !!key && !playError;
    const src = ready && api ?
        `${api.basePath}/Discovery/Trailer/${encodeURIComponent(key)}/Video?ApiKey=${encodeURIComponent(api.accessToken)}` :
        '';

    return (
        <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000', display: 'grid', placeItems: 'center' }}>
            {!failed && !ready && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                    <CircularProgress />
                    <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>
                        {globalize.translate('TrailerPreparing')}
                    </Typography>
                </Box>
            )}
            {failed && (
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', px: 3, textAlign: 'center' }}>
                    {globalize.translate('TrailerUnavailable')}
                </Typography>
            )}
            {ready && (
                <Box
                    component='video'
                    src={src}
                    autoPlay
                    controls
                    playsInline
                    controlsList='nodownload noremoteplayback'
                    // eslint-disable-next-line react/jsx-no-bind
                    onError={() => setPlayError(true)}
                    disablePictureInPicture
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000', outline: 'none' }}
                />
            )}
        </Box>
    );
};

/** Trailer in a dialog over the page. */
export const TrailerDialog: FC<{ open: boolean; onClose: () => void; source: TrailerSource }> = ({ open, onClose, source }) => (
    <Dialog
        open={open}
        onClose={onClose}
        maxWidth='lg'
        fullWidth
        PaperProps={{ sx: { background: '#000', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(0,164,220,0.3)' } }}
    >
        <IconButton onClick={onClose} aria-label={globalize.translate('ButtonClose')} sx={{
            position: 'absolute', top: 8, right: 8, zIndex: 2, color: '#fff', background: 'rgba(0,0,0,0.55)',
            '&:hover': { background: 'rgba(0,164,220,0.4)' }
        }}>
            <CloseRoundedIcon />
        </IconButton>
        {open && <TrailerPlayer source={source} />}
    </Dialog>
);

/** Sheet of a movie that is not in the library (in theaters / upcoming), with its trailer. */
export const ExternalMovieDialog: FC<{ movie: ExternalMovie | null; parentId?: string | null; onClose: () => void }> = ({ movie, parentId, onClose }) => {
    const [ playing, setPlaying ] = useState(false);
    const close = () => {
        setPlaying(false);
        onClose();
    };

    const date = movie ? new Date(movie.ReleaseDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
    const released = movie ? new Date(movie.ReleaseDate).getTime() <= Date.now() : false;

    return (
        <Dialog
            open={!!movie}
            onClose={close}
            maxWidth='md'
            fullWidth
            PaperProps={{ sx: {
                background: 'rgba(10,12,24,0.97)', borderRadius: '18px', overflow: 'hidden',
                border: '1px solid rgba(0,164,220,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(0,164,220,0.15)'
            } }}
        >
            {movie && (
                <>
                    <IconButton onClick={close} aria-label={globalize.translate('ButtonClose')} sx={{
                        position: 'absolute', top: 8, right: 8, zIndex: 3, color: '#fff', background: 'rgba(0,0,0,0.55)',
                        '&:hover': { background: 'rgba(0,164,220,0.4)' }
                    }}>
                        <CloseRoundedIcon />
                    </IconButton>

                    {playing ? (
                        <TrailerPlayer source={{ tmdbId: movie.TmdbId, parentId }} />
                    ) : (
                        <Box sx={{
                            position: 'relative', width: '100%', aspectRatio: '16 / 7', background: '#111',
                            backgroundImage: movie.BackdropUrl ? `url(${movie.BackdropUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center 25%'
                        }}>
                            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(10,12,24,1) 0%, rgba(10,12,24,0) 60%)' }} />
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: { xs: 2, md: 3 }, p: { xs: 2, md: 3 }, pt: playing ? undefined : 0, mt: playing ? 0 : { xs: -6, md: -10 }, position: 'relative' }}>
                        {movie.ImageUrl && (
                            <Box component='img' src={movie.ImageUrl} alt={movie.Title} sx={{
                                width: { xs: 100, md: 150 }, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: '12px', flexShrink: 0,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.6)', display: playing ? { xs: 'none', sm: 'block' } : 'block'
                            }} />
                        )}
                        <Box sx={{ minWidth: 0, alignSelf: 'flex-end' }}>
                            <Typography component='h2' sx={{ fontSize: { xs: '1.4rem', md: '2rem' }, fontWeight: 900, color: '#fff', lineHeight: 1.1, mb: 1 }}>
                                {movie.Title}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1.5, color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.9rem' }}>
                                <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                    <CalendarMonthRoundedIcon sx={{ fontSize: '1.1rem', color: '#00a4dc' }} />
                                    {globalize.translate(released ? 'ExternalInTheatersSince' : 'ExternalReleaseOn', date)}
                                </Box>
                                {!!movie.Rating && (
                                    <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: '#ffca28' }}>
                                        <StarRoundedIcon sx={{ fontSize: '1.1rem' }} />{movie.Rating.toFixed(1)}
                                    </Box>
                                )}
                            </Box>
                            {movie.Overview && (
                                <Typography sx={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.55, mb: 2, fontSize: '0.95rem' }}>
                                    {movie.Overview}
                                </Typography>
                            )}
                            {!playing && (
                                <Button onClick={() => setPlaying(true)} startIcon={<MovieRoundedIcon />} sx={glassButtonSx}>
                                    {globalize.translate('WatchTrailer')}
                                </Button>
                            )}
                        </Box>
                    </Box>
                </>
            )}
        </Dialog>
    );
};
