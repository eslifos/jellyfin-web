/**
 * All meta universes as large artwork cards. Administrators can create universes, rebuild them and show
 * the hidden ones.
 */
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import React, { type FC, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Link, useNavigate } from 'react-router-dom';

import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { emptyDefinition, type UniverseSummary, useUniverseMutations, useUniverses } from '../components/Universes/api';
import UniverseEditor from '../components/Universes/UniverseEditor';
import { glassCard } from '../components/Universes/UniverseParts';

const t = (key: string, ...args: (string | number)[]) => globalize.translate(key, ...args);

const UniverseTile: FC<{ universe: UniverseSummary }> = ({ universe: u }) => {
    const { api } = useApi();
    if (!api) return null;
    const backdrop = u.BackdropItemIds[0];
    const posters = u.PosterItemIds.slice(0, 4);
    const counts = [
        u.MovieCount ? t(u.MovieCount === 1 ? 'UniCountMovie' : 'UniCountMovies', u.MovieCount) : '',
        u.SeriesCount ? t(u.SeriesCount === 1 ? 'UniCountSeriesOne' : 'UniCountSeries', u.SeriesCount) : '',
        u.AlbumCount ? t(u.AlbumCount === 1 ? 'UniCountAlbum' : 'UniCountAlbums', u.AlbumCount) : ''
    ].filter(Boolean).join(' · ');

    return (
        <Box
            component={Link}
            to={`/universe?id=${encodeURIComponent(u.Id)}`}
            sx={{
                position: 'relative', display: 'block', aspectRatio: '16 / 9', borderRadius: '20px', overflow: 'hidden',
                color: '#fff', textDecoration: 'none', opacity: u.Hidden ? 0.5 : 1,
                background: 'linear-gradient(135deg, rgba(0,164,220,0.25), rgba(170,92,195,0.25))',
                border: '1px solid rgba(0,164,220,0.18)', boxShadow: '0 10px 34px rgba(0,0,0,0.4)',
                transition: 'transform 0.28s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.28s, border-color 0.28s',
                '&:hover, &:focus-visible': {
                    transform: 'translateY(-4px) scale(1.015)', outline: 'none', borderColor: 'rgba(0,164,220,0.7)',
                    boxShadow: '0 18px 40px rgba(0,0,0,0.55), 0 0 26px rgba(0,164,220,0.35)',
                    '& .uniTileBg': { transform: 'scale(1.06)' }
                }
            }}
        >
            {backdrop && (
                <Box className='uniTileBg' sx={{
                    position: 'absolute', inset: 0, backgroundSize: 'cover', backgroundPosition: 'center 25%', transition: 'transform 0.6s ease',
                    backgroundImage: `url("${getImageApi(api).getItemImageUrlById(backdrop, ImageType.Backdrop, { maxWidth: 900 })}")`
                }} />
            )}
            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(6,8,18,0.95) 0%, rgba(6,8,18,0.55) 45%, rgba(6,8,18,0.1) 100%)' }} />
            <Box sx={{ position: 'absolute', top: 12, right: 12, display: 'flex' }}>
                {posters.map((pid, i) => (
                    <Box key={pid} component='img' alt='' loading='lazy'
                        src={getImageApi(api).getItemImageUrlById(pid, ImageType.Primary, { maxWidth: 120 })}
                        sx={{ width: { xs: 34, sm: 44 }, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: '6px', ml: i ? -1.2 : 0, border: '2px solid rgba(6,8,18,0.9)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} />
                ))}
            </Box>
            <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: { xs: 1.5, sm: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4 }}>
                    {u.Source === 'auto' && <AutoAwesomeRoundedIcon sx={{ fontSize: '0.95rem', color: '#ffca28' }} />}
                    {u.Hidden && <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#ffca28' }}>{t('UniHidden')}</Typography>}
                </Box>
                <Typography sx={{ fontSize: { xs: '1.1rem', sm: '1.35rem' }, fontWeight: 900, lineHeight: 1.1, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>{u.Name}</Typography>
                <Typography noWrap sx={{ mt: 0.4, fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.78)' }}>
                    {[ counts, u.FirstYear ? (u.LastYear && u.LastYear !== u.FirstYear ? `${u.FirstYear}–${u.LastYear}` : u.FirstYear) : '' ].filter(Boolean).join('  ·  ')}
                </Typography>
            </Box>
        </Box>
    );
};

const Universes: FC = () => {
    const { user } = useApi();
    const navigate = useNavigate();
    const isAdmin = !!user?.Policy?.IsAdministrator;
    const [ showHidden, setShowHidden ] = useState(false);
    const [ creating, setCreating ] = useState(false);
    const { data, isLoading, isError } = useUniverses(isAdmin && showHidden);
    const { rebuild } = useUniverseMutations();
    const newDefinition = useMemo(() => emptyDefinition(), [ creating ]);

    const pill = {
        borderRadius: '999px', px: 2.2, fontWeight: 800, textTransform: 'none', color: '#fff',
        background: 'rgba(8,10,22,0.62)', border: '1px solid rgba(0,164,220,0.3)',
        '&:hover': { background: 'rgba(0,164,220,0.16)', color: '#00a4dc' }
    };

    return (
        <Page id='universesPage' title={t('UniTitle')} className='mainAnimatedPage libraryPage noSecondaryNavPage'>
            <Box sx={{ px: '3.3%', pt: { xs: 3, md: 4 }, pb: 12 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 240 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PublicRoundedIcon sx={{ color: '#00a4dc', fontSize: '2rem', filter: 'drop-shadow(0 0 10px rgba(0,164,220,0.6))' }} />
                            <Typography component='h1' sx={{ fontSize: 'clamp(1.8rem, 3.6vw, 2.8rem)', fontWeight: 900 }}>{t('UniTitle')}</Typography>
                        </Box>
                        <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>{t('UniSubtitle')}</Typography>
                    </Box>
                    {isAdmin && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <FormControlLabel control={<Switch checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />} label={t('UniShowHidden')} />
                            <Button startIcon={<RefreshRoundedIcon />} sx={pill} onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>{t('UniRebuild')}</Button>
                            <Button startIcon={<AddRoundedIcon />} sx={{ ...pill, background: 'linear-gradient(135deg, #00a4dc 0%, #0077b6 100%)', '&:hover': { color: '#fff', filter: 'brightness(1.1)' } }}
                                onClick={() => setCreating(true)}>{t('UniNew')}</Button>
                        </Box>
                    )}
                </Box>

                {isLoading && <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}><CircularProgress /></Box>}
                {(isError || (!isLoading && !data?.length)) && (
                    <Box sx={{ ...glassCard, textAlign: 'center', py: 5 }}>
                        <Typography sx={{ fontWeight: 800 }}>{t(isError ? 'UniError' : 'UniEmpty')}</Typography>
                    </Box>
                )}
                <Box sx={{ display: 'grid', gap: { xs: 1.5, md: 2.2 }, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
                    {(data || []).map(u => <UniverseTile key={u.Id} universe={u} />)}
                </Box>
            </Box>

            {isAdmin && (
                <UniverseEditor
                    open={creating}
                    onClose={() => setCreating(false)}
                    onSaved={saved => navigate(`/universe?id=${encodeURIComponent(saved.Id)}`)}
                    definition={newDefinition}
                />
            )}
        </Page>
    );
};

export default Universes;
