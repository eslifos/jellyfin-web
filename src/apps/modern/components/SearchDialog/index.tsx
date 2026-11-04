/**
 * SearchDialog — floating, non-invasive search overlay for the experimental layout.
 *
 * Opens as a glassmorphism card anchored near the top-center of the viewport.
 * Features:
 *  - Debounced real-time search with fuzzy fallback (splits query into individual words).
 *  - Results grouped by category in horizontally scrollable rows.
 *  - "You might also like" section powered by the /Items/{id}/Similar endpoint.
 *  - Category filter chips for Movies, Shows, Music, Books, People, and Photos.
 * Rendered via `createPortal` on `document.body` to avoid stacking context issues.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import BookIcon from '@mui/icons-material/Book';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GridViewIcon from '@mui/icons-material/GridView';
import { useNavigate } from 'react-router-dom';

import globalize from 'lib/globalize';

import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { BaseItemKind, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client';
import { useApi } from 'hooks/useApi';

type SearchResult = BaseItemDto;

interface Category {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    types: BaseItemKind[];
}

const CATEGORIES: Category[] = [
    { id: 'movies',  label: globalize.translate('Movies'), icon: <MovieIcon />,    color: '#00a4dc', types: [ BaseItemKind.Movie ] },
    { id: 'shows',   label: globalize.translate('Shows'),    icon: <TvIcon />,        color: '#aa5cc3', types: [ BaseItemKind.Series, BaseItemKind.Episode ] },
    { id: 'music',   label: globalize.translate('TabMusic'),    icon: <MusicNoteIcon />, color: '#4caf50', types: [ BaseItemKind.MusicAlbum, BaseItemKind.Audio ] },
    { id: 'books',   label: globalize.translate('Books'),    icon: <BookIcon />,      color: '#ff9800', types: [ BaseItemKind.Book, BaseItemKind.AudioBook ] },
    { id: 'people',  label: globalize.translate('People'),  icon: <PersonIcon />,    color: '#e91e63', types: [ BaseItemKind.Person ] },
    { id: 'all',     label: globalize.translate('All'),      icon: <GridViewIcon />,  color: '#607d8b', types: [] }
];

const dedupe = (items: SearchResult[]) => {
    const seen = new Set<string>();
    return items.filter(i => { if (!i.Id || seen.has(i.Id)) return false; seen.add(i.Id); return true; });
};

interface SearchDialogProps {
    open: boolean;
    onClose: () => void;
}

const SearchDialog = ({ open, onClose }: SearchDialogProps) => {
    const { api, user } = useApi();
    const navigate = useNavigate();
    const [ query, setQuery ] = useState('');
    const [ activeCategory, setActiveCategory ] = useState('all');
    const [ results, setResults ] = useState<Record<string, SearchResult[]>>({});
    const [ similar, setSimilar ] = useState<SearchResult[]>([]);
    const [ loading, setLoading ] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const searchByTerm = useCallback(async (term: string, types: BaseItemKind[], limit: number) => {
        if (!api || !user?.Id) return [];
        const base = { userId: user.Id, recursive: true, imageTypeLimit: 1, enableTotalRecordCount: false };
        const main = (await getLibraryApi(api).getItems({ ...base, searchTerm: term, includeItemTypes: types, limit })).data.Items ?? [];
        let extra: SearchResult[] = [];
        if (main.length < limit / 2) {
            const words = term.split(/\s+/).filter(w => w.length >= 2);
            const ws = await Promise.all(words.map(w =>
                getLibraryApi(api).getItems({ ...base, searchTerm: w, includeItemTypes: types, limit: Math.ceil(limit / words.length) }).then(r => r.data.Items ?? [])
            ));
            extra = ws.flat();
        }
        return dedupe([ ...main, ...extra ]).slice(0, limit);
    }, [ api, user ]);

    const fetchSimilar = useCallback(async (itemId: string) => {
        if (!api || !user?.Id) return [];
        try {
            const r = await api.axiosInstance.get(`${api.basePath}/Items/${itemId}/Similar`, { params: { userId: user.Id, limit: 14 } });
            return (r.data?.Items ?? []) as SearchResult[];
        } catch { return []; }
    }, [ api, user ]);

    const search = useCallback(async (term: string, catId: string) => {
        if (!api || !user?.Id || !term) { setResults({}); setSimilar([]); return; }
        setLoading(true);
        try {
            const cat = CATEGORIES.find(c => c.id === catId);
            if (cat?.id === 'all') {
                const searches = await Promise.all(
                    CATEGORIES.filter(c => c.id !== 'all').map(async c => ({ id: c.id, items: await searchByTerm(term, c.types, 20) }))
                );
                const grouped: Record<string, SearchResult[]> = {};
                searches.forEach(({ id, items }) => { if (items.length) grouped[id] = items; });
                setResults(grouped);
                const first = grouped['movies']?.[0] ?? grouped['shows']?.[0];
                setSimilar(first?.Id ? await fetchSimilar(first.Id) : []);
            } else {
                const items = await searchByTerm(term, cat?.types ?? [], 50);
                setResults({ [catId]: items });
                setSimilar(items[0]?.Id ? await fetchSimilar(items[0].Id) : []);
            }
        } catch { /* */ } finally { setLoading(false); }
    }, [ api, user, searchByTerm, fetchSimilar ]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => void search(query, activeCategory), 350);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [ query, activeCategory, search ]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 150);
        else { setQuery(''); setResults({}); setSimilar([]); setActiveCategory('all'); }
    }, [ open ]);

    const getImg = (item: SearchResult) => {
        const tag = item.ImageTags?.['Primary'] ?? item.AlbumPrimaryImageTag;
        return api && item.Id && tag ? `${api.basePath}/Items/${item.Id}/Images/Primary?tag=${tag}&maxWidth=200&quality=90` : null;
    };

    const goTo = (item: SearchResult) => { onClose(); navigate(`/details?id=${item.Id}`); };

    const hasResults = Object.values(results).some(a => a.length > 0);
    const ResultCard = ({ item, color }: { item: SearchResult; color: string }) => (
        <Box
            onClick={() => goTo(item)}
            sx={{
                flexShrink: 0,
                width: 90,
                cursor: 'pointer',
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.18s',
                '&:hover': { transform: 'scale(1.06) translateY(-3px)', border: `1px solid ${color}60`, boxShadow: `0 6px 20px rgba(0,0,0,0.4), 0 0 8px ${color}30` }
            }}
        >
            <Box sx={{ width: '100%', paddingBottom: '150%', position: 'relative', background: `${color}15` }}>
                {getImg(item) ? (
                    <img src={getImg(item)!} alt={item.Name ?? ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: '1.8rem' }}>🎬</Typography>
                    </Box>
                )}
            </Box>
            <Box sx={{ p: '6px 7px 7px' }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.25 }} noWrap>
                    {item.Name}
                </Typography>
                {item.ProductionYear && (
                    <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>{item.ProductionYear}</Typography>
                )}
            </Box>
        </Box>
    );
    const HorizontalRow = ({ catId, items }: { catId: string; items: SearchResult[] }) => {
        const cat = CATEGORIES.find(c => c.id === catId);
        if (!cat || !items.length) return null;
        return (
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <Box sx={{ color: cat.color, display: 'flex', '& svg': { fontSize: '0.85rem' } }}>{cat.icon}</Box>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: cat.color }}>
                        {cat.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>({items.length})</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: '3px' }, '&::-webkit-scrollbar-thumb': { background: `${cat.color}40`, borderRadius: '4px' }, '&::-webkit-scrollbar-track': { background: 'transparent' } }}>
                    {items.map(item => <ResultCard key={item.Id} item={item} color={cat.color} />)}
                </Box>
            </Box>
        );
    };

    return (
        <>
            {/* Overlay difuminado — clic fuera cierra */}
            <Fade in={open}>
                <Box
                    onClick={onClose}
                    sx={{ position: 'fixed', inset: 0, zIndex: 1299, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                />
            </Fade>

            {/* Card flotante */}
            <Fade in={open} style={{ transformOrigin: 'top center' }}>
                <Paper
                    elevation={0}
                    sx={{
                        position: 'fixed',
                        top: '8vh',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1300,
                        width: { xs: '95vw', sm: '680px', md: '760px' },
                        maxHeight: '78vh',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'rgba(9, 10, 22, 0.93)',
                        backdropFilter: 'blur(32px) saturate(1.6)',
                        WebkitBackdropFilter: 'blur(32px) saturate(1.6)',
                        border: '1px solid rgba(0,164,220,0.22)',
                        borderRadius: '24px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 40px rgba(0,164,220,0.08)',
                        overflow: 'hidden',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0, left: '3rem', right: '3rem',
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, #00a4dc 40%, #aa5cc3 60%, transparent)',
                            borderRadius: '0 0 4px 4px'
                        }
                    }}
                >
                    {/* Barra de búsqueda */}
                    <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', color: loading ? '#00a4dc' : 'rgba(255,255,255,0.35)', mr: 0.5 }}>
                            {loading ? <CircularProgress size={16} sx={{ color: '#00a4dc' }} /> : <SearchIcon sx={{ fontSize: '1.2rem' }} />}
                        </Box>
                        <TextField
                            inputRef={inputRef}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={globalize.translate('SearchPlaceholder')}
                            fullWidth
                            variant='standard'
                            autoComplete='off'
                            InputProps={{
                                disableUnderline: true,
                                sx: { color: '#fff', fontSize: '1rem', '& input::placeholder': { color: 'rgba(255,255,255,0.3)', opacity: 1 } }
                            }}
                        />
                        {query && (
                            <IconButton size='small' onClick={() => setQuery('')} sx={{ color: 'rgba(255,255,255,0.35)', p: 0.5, '&:hover': { color: '#fff' } }}>
                                <CloseIcon sx={{ fontSize: '1rem' }} />
                            </IconButton>
                        )}
                        <Box sx={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', mx: 0.5 }} />
                        <IconButton size='small' onClick={onClose} sx={{ color: 'rgba(255,255,255,0.35)', p: 0.5, '&:hover': { color: '#fff' } }}>
                            <CloseIcon sx={{ fontSize: '1.1rem' }} />
                        </IconButton>
                    </Box>

                    {/* Chips de filtro — solo si hay query */}
                    {query.length > 0 && (
                        <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 0.75, overflowX: 'auto', flexShrink: 0, '&::-webkit-scrollbar': { display: 'none' } }}>
                            {CATEGORIES.map(cat => (
                                <Chip
                                    key={cat.id}
                                    label={cat.label}
                                    size='small'
                                    onClick={() => setActiveCategory(cat.id)}
                                    sx={{
                                        height: 24,
                                        fontSize: '0.7rem',
                                        background: activeCategory === cat.id ? `${cat.color}30` : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${activeCategory === cat.id ? cat.color : 'rgba(255,255,255,0.08)'}`,
                                        color: activeCategory === cat.id ? '#fff' : 'rgba(255,255,255,0.5)',
                                        flexShrink: 0,
                                        fontWeight: activeCategory === cat.id ? 600 : 400,
                                        transition: 'all 0.15s',
                                        '&:hover': { background: `${cat.color}20`, borderColor: cat.color }
                                    }}
                                />
                            ))}
                        </Box>
                    )}

                    {/* Divisor */}
                    {query.length > 0 && <Box sx={{ mx: 2, height: '1px', background: 'rgba(0,164,220,0.1)', flexShrink: 0 }} />}

                    {/* Resultados — scroll interno */}
                    <Box sx={{ overflowY: 'auto', px: 2, py: 1.5, flex: 1,
                        '&::-webkit-scrollbar': { width: '4px' },
                        '&::-webkit-scrollbar-thumb': { background: 'rgba(0,164,220,0.3)', borderRadius: '4px' },
                        '&::-webkit-scrollbar-track': { background: 'transparent' }
                    }}>
                        {!query ? (
                            <Box sx={{ py: 2, textAlign: 'center' }}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
                                    Empieza a escribir para buscar
                                </Typography>
                            </Box>
                        ) : !hasResults && !loading ? (
                            <Box sx={{ py: 2, textAlign: 'center' }}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                                    {globalize.translate('SearchResultsEmpty').replace('{0}', query)}
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                {Object.entries(results).map(([ catId, items ]) => (
                                    <HorizontalRow key={catId} catId={catId} items={items} />
                                ))}
                                {similar.length > 0 && (
                                    <Box sx={{ mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                                            <AutoAwesomeIcon sx={{ fontSize: '0.85rem', color: '#f9a825' }} />
                                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f9a825' }}>
                                                También te puede gustar
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: '3px' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(249,168,37,0.4)', borderRadius: '4px' } }}>
                                            {similar.map(item => <ResultCard key={item.Id} item={item} color='#f9a825' />)}
                                        </Box>
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>
                </Paper>
            </Fade>
        </>
    );
};

export default SearchDialog;