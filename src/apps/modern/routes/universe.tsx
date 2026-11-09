/**
 * One meta universe: banner with rotating artwork, timeline (release or chronological order), rows of movies,
 * series, soundtracks and collections from every library, and the actors who appear across it.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import React, { type FC, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AlbumRoundedIcon from '@mui/icons-material/AlbumRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { normId, useUniverse, useUniverseItems } from '../components/Universes/api';
import UniverseEditor from '../components/Universes/UniverseEditor';
import { glassCard, MediaCard, PersonCard, RowSection } from '../components/Universes/UniverseParts';

const t = (key: string, ...args: (string | number)[]) => globalize.translate(key, ...args);
const ROTATE_MS = 9000;
const ORDER_KEY = 'universeOrder';

type Order = 'release' | 'chrono';

const readOrder = (): Order => {
    try {
        return localStorage.getItem(ORDER_KEY) === 'chrono' ? 'chrono' : 'release';
    } catch {
        return 'release';
    }
};

const Universe: FC = () => {
    const { api, user } = useApi();
    const navigate = useNavigate();
    const [ params ] = useSearchParams();
    const id = params.get('id');
    const { data, isLoading, isError } = useUniverse(id);
    const [ slide, setSlide ] = useState(0);
    const [ order, setOrder ] = useState<Order>(readOrder);
    const [ editing, setEditing ] = useState(false);
    const isAdmin = !!user?.Policy?.IsAdministrator;

    const allIds = useMemo(() => {
        if (!data) return [];
        return [ ...new Set([
            ...data.MovieIds, ...data.SeriesIds, ...data.AlbumIds, ...data.CollectionIds, ...data.OtherIds,
            ...data.Summary.BackdropItemIds, ...data.Definition.ExcludeIds
        ]) ];
    }, [ data ]);
    const { data: items } = useUniverseItems(allIds);
    const get = (itemId: string) => items?.get(normId(itemId));
    const list = (ids: string[]) => ids.map(get).filter((x): x is BaseItemDto => !!x);

    const backdrops = data?.Summary.BackdropItemIds || [];
    useEffect(() => {
        if (backdrops.length < 2) return;
        const timer = window.setTimeout(() => setSlide(s => (s + 1) % backdrops.length), ROTATE_MS);
        return () => window.clearTimeout(timer);
    }, [ slide, backdrops.length ]);

    const changeOrder = (value: Order | null) => {
        if (!value) return;
        setOrder(value);
        try {
            localStorage.setItem(ORDER_KEY, value);
        } catch {
            // ignore
        }
    };

    if (isLoading || !api) {
        return (
            <Page id='universePage' className='mainAnimatedPage libraryPage noSecondaryNavPage'>
                <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><CircularProgress /></Box>
            </Page>
        );
    }

    if (isError || !data) {
        return (
            <Page id='universePage' className='mainAnimatedPage libraryPage noSecondaryNavPage'>
                <Box sx={{ ...glassCard, m: 3, textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 800, mb: 2 }}>{t('UniNotFound')}</Typography>
                    <Button component={Link} to='/universes' startIcon={<ArrowBackRoundedIcon />}>{t('UniAll')}</Button>
                </Box>
            </Page>
        );
    }

    const s = data.Summary;
    const timeline = list(order === 'chrono' ? data.ChronologicalOrder : data.ReleaseOrder);
    const meta = [
        s.MovieCount ? t(s.MovieCount === 1 ? 'UniCountMovie' : 'UniCountMovies', s.MovieCount) : '',
        s.SeriesCount ? t(s.SeriesCount === 1 ? 'UniCountSeriesOne' : 'UniCountSeries', s.SeriesCount) : '',
        s.AlbumCount ? t(s.AlbumCount === 1 ? 'UniCountAlbum' : 'UniCountAlbums', s.AlbumCount) : '',
        s.FirstYear ? (s.LastYear && s.LastYear !== s.FirstYear ? `${s.FirstYear}–${s.LastYear}` : String(s.FirstYear)) : ''
    ].filter(Boolean);
    const sourceLabel = t(s.Source === 'auto' ? 'UniSourceAuto' : (s.Source === 'custom' ? 'UniSourceCustom' : 'UniSourceBuiltin'));
    const glassButton = {
        borderRadius: '999px', px: 2.4, py: 1, fontWeight: 800, color: '#fff', textTransform: 'none',
        background: 'rgba(8,10,22,0.62)', border: '1px solid rgba(0,164,220,0.3)', backdropFilter: 'blur(16px)',
        '&:hover': { background: 'rgba(0,164,220,0.16)', borderColor: 'rgba(0,164,220,0.65)', color: '#00a4dc' }
    };

    return (
        <Page id='universePage' title={s.Name} className='mainAnimatedPage libraryPage noSecondaryNavPage'>
            {/* ---------- Banner ---------- */}
            <Box sx={{ position: 'relative', minHeight: { xs: '58vh', md: '68vh' }, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                {backdrops.map((bid, i) => (
                    <Box key={bid} sx={{
                        position: 'absolute', inset: 0, backgroundSize: 'cover', backgroundPosition: 'center 20%',
                        backgroundImage: `url("${getImageApi(api).getItemImageUrlById(bid, ImageType.Backdrop, { maxWidth: 1920 })}")`,
                        opacity: i === slide ? 1 : 0, transition: 'opacity 1.4s ease',
                        maskImage: 'linear-gradient(to bottom, #000 60%, transparent 100%)'
                    }} />
                ))}
                {!backdrops.length && (
                    <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 140% at 0% 0%, rgba(0,164,220,0.25), transparent 55%), radial-gradient(90% 120% at 100% 0%, rgba(170,92,195,0.25), transparent 60%)' }} />
                )}
                <Box sx={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'linear-gradient(90deg, rgba(8,8,16,0.94) 0%, rgba(8,8,16,0.6) 40%, rgba(8,8,16,0) 75%), linear-gradient(0deg, #080810 0%, rgba(8,8,16,0) 45%)'
                }} />
                <Box sx={{ position: 'relative', zIndex: 2, px: '3.3%', pb: 4, pt: 10, maxWidth: 820 }}>
                    <Button component={Link} to='/universes' startIcon={<ArrowBackRoundedIcon />} size='small'
                        sx={{ mb: 2, color: 'rgba(255,255,255,0.75)', textTransform: 'none', fontWeight: 700 }}>
                        {t('UniAll')}
                    </Button>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#00a4dc' }}>
                            {t('UniKicker')}
                        </Typography>
                        <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)' }}>
                            {sourceLabel}
                        </Box>
                        {s.Hidden && <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, color: '#ffca28', border: '1px solid rgba(255,202,40,0.4)' }}>{t('UniHidden')}</Box>}
                    </Box>
                    <Typography component='h1' sx={{ fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 900, lineHeight: 1.02, textShadow: '0 4px 24px rgba(0,0,0,0.7)' }}>
                        {s.Name}
                    </Typography>
                    <Typography sx={{ mt: 1.2, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>{meta.join('  ·  ')}</Typography>
                    {s.Overview && (
                        <Typography sx={{ mt: 1.2, lineHeight: 1.55, color: 'rgba(255,255,255,0.86)', textShadow: '0 2px 8px rgba(0,0,0,0.85)' }}>
                            {s.Overview}
                        </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1.2, mt: 2.5, flexWrap: 'wrap' }}>
                        <Button startIcon={<TimelineRoundedIcon />} sx={glassButton}
                            onClick={() => document.getElementById('universeTimeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                            {t('UniTimeline')}
                        </Button>
                        {isAdmin && (
                            <Button startIcon={<EditRoundedIcon />} sx={glassButton} onClick={() => setEditing(true)}>{t('Edit')}</Button>
                        )}
                    </Box>
                    {backdrops.length > 1 && (
                        <Box sx={{ display: 'flex', gap: 0.8, mt: 2.5 }}>
                            {backdrops.map((bid, i) => (
                                <Box key={bid} component='button' aria-label={String(i + 1)} onClick={() => setSlide(i)} sx={{
                                    width: i === slide ? 26 : 8, height: 8, p: 0, border: 0, borderRadius: '999px', cursor: 'pointer',
                                    background: i === slide ? '#00a4dc' : 'rgba(255,255,255,0.35)', transition: 'all 0.3s'
                                }} />
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>

            <Box sx={{ px: '3.3%', mt: -2, position: 'relative', zIndex: 3, pb: 12 }}>
                {/* ---------- Timeline ---------- */}
                {timeline.length > 0 && (
                    <Box id='universeTimeline' component='section' sx={{ ...glassCard, scrollMarginTop: 90 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                            <TimelineRoundedIcon sx={{ color: '#00a4dc' }} />
                            <Typography component='h2' sx={{ fontSize: '1.25rem', fontWeight: 800, flex: 1 }}>{t('UniTimeline')}</Typography>
                            <ToggleButtonGroup size='small' exclusive value={order} onChange={(_, v: Order | null) => changeOrder(v)}
                                sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, px: 1.6, borderRadius: '999px !important', border: '1px solid rgba(255,255,255,0.14) !important', mx: 0.3 },
                                    '& .Mui-selected': { background: 'rgba(0,164,220,0.22) !important', color: '#fff !important', borderColor: '#00a4dc !important' } }}>
                                <ToggleButton value='release'>{t('UniOrderRelease')}</ToggleButton>
                                <ToggleButton value='chrono'>{t('UniOrderChrono')}</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                        {order === 'chrono' && !data.HasChronology && (
                            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', mb: 1 }}>
                                {t(isAdmin ? 'UniNoChronologyAdmin' : 'UniNoChronology')}
                            </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pt: 1, pb: 1, px: 0.5, scrollbarWidth: 'thin' }}>
                            {timeline.map((item, i) => (
                                <Box key={item.Id} sx={{ position: 'relative', flexShrink: 0, pt: 4.2 }}>
                                    {/* line + dot + label */}
                                    <Box sx={{ position: 'absolute', top: 14, left: i === 0 ? '50%' : -16, right: i === timeline.length - 1 ? '50%' : 0, height: 2, background: 'linear-gradient(90deg, rgba(0,164,220,0.6), rgba(170,92,195,0.6))' }} />
                                    <Box sx={{ position: 'absolute', top: 8, left: 'calc(50% - 7px)', width: 14, height: 14, borderRadius: '50%', background: '#00a4dc', boxShadow: '0 0 12px rgba(0,164,220,0.8)', border: '2px solid #0b0f1e' }} />
                                    <Typography sx={{ position: 'absolute', top: -6, left: 0, right: 0, textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.75)' }}>
                                        {order === 'chrono' ? `#${i + 1}` : (item.ProductionYear || '')}
                                    </Typography>
                                    <MediaCard item={item} width={140}
                                        caption={order === 'chrono' ? item.ProductionYear : (item.Type === 'Series' ? t('UniSeriesOne') : t('UniMovie'))} />
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* ---------- Rows by type ---------- */}
                {list(data.MovieIds).length > 0 && (
                    <RowSection title={`${t('UniMovies')} (${data.MovieIds.length})`} icon={<MovieRoundedIcon />}>
                        {list(data.MovieIds).map(item => <MediaCard key={item.Id} item={item} />)}
                    </RowSection>
                )}
                {list(data.SeriesIds).length > 0 && (
                    <RowSection title={`${t('UniSeries')} (${data.SeriesIds.length})`} icon={<TvRoundedIcon />}>
                        {list(data.SeriesIds).map(item => <MediaCard key={item.Id} item={item} />)}
                    </RowSection>
                )}
                {list(data.AlbumIds).length > 0 && (
                    <RowSection title={`${t('UniSoundtracks')} (${data.AlbumIds.length})`} icon={<AlbumRoundedIcon />}>
                        {list(data.AlbumIds).map(item => <MediaCard key={item.Id} item={item} width={160} caption={item.AlbumArtist || item.ProductionYear} />)}
                    </RowSection>
                )}
                {list(data.CollectionIds).length > 0 && (
                    <RowSection title={`${t('UniCollections')} (${data.CollectionIds.length})`} icon={<CollectionsBookmarkRoundedIcon />}>
                        {list(data.CollectionIds).map(item => (
                            <MediaCard key={item.Id} item={item} caption={item.ChildCount ? t('UniCountTitles', item.ChildCount) : ''} />
                        ))}
                    </RowSection>
                )}
                {list(data.OtherIds).length > 0 && (
                    <RowSection title={t('UniOther')} icon={<LibraryBooksRoundedIcon />}>
                        {list(data.OtherIds).map(item => <MediaCard key={item.Id} item={item} />)}
                    </RowSection>
                )}

                {/* ---------- Recurring actors ---------- */}
                {data.People.length > 0 && (
                    <RowSection title={t('UniPeople')} icon={<PeopleAltRoundedIcon />}>
                        {data.People.map(p => (
                            <PersonCard key={p.Name} id={p.Id} name={p.Name} subtitle={p.Roles.join(' / ')} badge={t('UniCountTitles', p.Appearances)} />
                        ))}
                    </RowSection>
                )}
            </Box>

            {isAdmin && (
                <UniverseEditor
                    open={editing}
                    onClose={() => setEditing(false)}
                    onSaved={saved => { if (saved.Id !== id) navigate(`/universe?id=${encodeURIComponent(saved.Id)}`); }}
                    definition={data.Definition}
                    details={data}
                    items={items}
                />
            )}
        </Page>
    );
};

export default Universe;
