/**
 * Administrator editor of a meta universe: name and description, automatic rules, items added or
 * removed by hand, banner artwork and the in-universe (chronological) order.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import React, { type FC, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { normId, type UniverseDefinition, type UniverseDetails, useUniverseMutations } from './api';

const t = (key: string, ...args: (string | number)[]) => globalize.translate(key, ...args);
const lines = (v: string) => v.split(/\r?\n|,(?![^(]*\))/).map(x => x.trim()).filter(Boolean);
const SEARCH_TYPES = [ BaseItemKind.Movie, BaseItemKind.Series, BaseItemKind.MusicAlbum, BaseItemKind.BoxSet, BaseItemKind.Book ];

interface Props {
    open: boolean;
    onClose: () => void;
    onSaved?: (def: UniverseDefinition) => void;
    definition: UniverseDefinition;
    details?: UniverseDetails;
    items?: Map<string, BaseItemDto>;
}

const typeLabel = (type?: string | null) => {
    switch (type) {
        case 'Movie': return t('UniMovie');
        case 'Series': return t('UniSeriesOne');
        case 'MusicAlbum': return t('UniAlbum');
        case 'BoxSet': return t('UniCollection');
        default: return type || '';
    }
};

const ItemLine: FC<{ item?: BaseItemDto; fallback: string; children?: React.ReactNode }> = ({ item, fallback, children }) => {
    const { api } = useApi();
    const tag = item?.ImageTags?.Primary;
    const img = api && item && tag ? getImageApi(api).getItemImageUrlById(item.Id!, ImageType.Primary, { maxHeight: 80, tag }) : null;
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, py: 0.7, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Box sx={{ width: 30, height: 44, flexShrink: 0, borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                {img && <Box component='img' src={img} alt='' sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 700 }}>{item?.Name || fallback}</Typography>
                <Typography noWrap sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>
                    {[ typeLabel(item?.Type), item?.ProductionYear ].filter(Boolean).join(' · ')}
                </Typography>
            </Box>
            {children}
        </Box>
    );
};

const UniverseEditor: FC<Props> = ({ open, onClose, onSaved, definition, details, items }) => {
    const { api, user } = useApi();
    const { save, remove } = useUniverseMutations();
    const [ tab, setTab ] = useState(0);
    const [ def, setDef ] = useState<UniverseDefinition>(definition);
    const [ rules, setRules ] = useState({ tags: '', studios: '', titles: '', collections: '' });
    const [ chrono, setChrono ] = useState<string[]>([]);
    const [ chronoTouched, setChronoTouched ] = useState(false);
    const [ search, setSearch ] = useState('');
    const [ results, setResults ] = useState<BaseItemDto[]>([]);
    const [ known, setKnown ] = useState<Map<string, BaseItemDto>>(new Map());
    const [ error, setError ] = useState('');

    useEffect(() => {
        if (!open) return;
        setDef(definition);
        setRules({
            tags: definition.Tags.join('\n'),
            studios: definition.Studios.join('\n'),
            titles: definition.TitlePatterns.join('\n'),
            collections: definition.TmdbCollectionIds.join(', ')
        });
        setChrono(details ? (details.HasChronology ? details.ChronologicalOrder : details.ReleaseOrder) : []);
        setChronoTouched(false);
        setSearch('');
        setResults([]);
        setError('');
        setTab(0);
        setKnown(new Map(items));
    }, [ open, definition, details, items ]);

    // Search the libraries to add items by hand
    useEffect(() => {
        if (!api || search.trim().length < 2) {
            setResults([]);
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            getLibraryApi(api).getItems({
                userId: user?.Id, recursive: true, searchTerm: search.trim(), includeItemTypes: SEARCH_TYPES, limit: 12,
                enableImageTypes: [ ImageType.Primary ], imageTypeLimit: 1
            }, { signal: controller.signal }).then(res => setResults(res.data.Items || [])).catch(() => undefined);
        }, 300);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [ api, user, search ]);

    const memberIds = useMemo(() => {
        if (!details) return def.IncludeIds;
        const all = [ ...details.MovieIds, ...details.SeriesIds, ...details.AlbumIds, ...details.CollectionIds, ...details.OtherIds, ...def.IncludeIds ];
        const excluded = new Set(def.ExcludeIds.map(normId));
        return all.filter((id, i) => !excluded.has(normId(id)) && all.findIndex(x => normId(x) === normId(id)) === i);
    }, [ details, def.IncludeIds, def.ExcludeIds ]);

    const lookup = (id: string) => known.get(normId(id));

    const add = (item: BaseItemDto) => {
        setKnown(m => new Map(m).set(normId(item.Id), item));
        setDef(d => ({
            ...d,
            IncludeIds: d.IncludeIds.some(x => normId(x) === normId(item.Id)) ? d.IncludeIds : [ ...d.IncludeIds, item.Id! ],
            ExcludeIds: d.ExcludeIds.filter(x => normId(x) !== normId(item.Id))
        }));
        if ((item.Type === 'Movie' || item.Type === 'Series') && !chrono.some(x => normId(x) === normId(item.Id))) {
            setChrono(c => [ ...c, item.Id! ]);
        }
    };

    const removeItem = (id: string) => setDef(d => ({
        ...d,
        IncludeIds: d.IncludeIds.filter(x => normId(x) !== normId(id)),
        ExcludeIds: d.ExcludeIds.some(x => normId(x) === normId(id)) ? d.ExcludeIds : [ ...d.ExcludeIds, id ]
    }));

    const restore = (id: string) => setDef(d => ({ ...d, ExcludeIds: d.ExcludeIds.filter(x => normId(x) !== normId(id)) }));

    const move = (index: number, delta: number) => {
        setChrono(c => {
            const next = [ ...c ];
            const target = index + delta;
            if (target < 0 || target >= next.length) return c;
            [ next[index], next[target] ] = [ next[target], next[index] ];
            return next;
        });
        setChronoTouched(true);
    };

    const onSave = () => {
        if (!def.Name.trim()) {
            setTab(0);
            setError(t('UniNameRequired'));
            return;
        }
        const excluded = new Set(def.ExcludeIds.map(normId));
        const payload: UniverseDefinition = {
            ...def,
            Tags: lines(rules.tags),
            Studios: lines(rules.studios),
            TitlePatterns: rules.titles.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
            TmdbCollectionIds: lines(rules.collections),
            ChronologicalOrder: chronoTouched ? chrono.filter(id => !excluded.has(normId(id))) : def.ChronologicalOrder
        };
        save.mutate(payload, {
            onSuccess: saved => {
                onSaved?.(saved);
                onClose();
            },
            onError: () => setError(t('UniSaveError'))
        });
    };

    const onDelete = () => {
        const custom = def.Source === 'custom';
        if (!window.confirm(t(custom ? 'UniDeleteConfirm' : 'UniResetConfirm', def.Name))) return;
        remove.mutate(def.Id, { onSettled: () => onClose() });
    };

    const field = { '& .MuiOutlinedInput-root': { borderRadius: '12px', background: 'rgba(255,255,255,0.03)' } };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth='md'
            PaperProps={{ sx: {
                color: '#fff', borderRadius: '22px', backgroundImage: 'none',
                background: 'linear-gradient(160deg, rgba(18,22,42,0.98), rgba(10,12,26,0.98))',
                border: '1px solid rgba(0,164,220,0.25)', boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 40px rgba(0,164,220,0.12)'
            } }}
        >
            <DialogTitle sx={{ pb: 0 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00a4dc' }}>
                    {def.Id ? t('UniEdit') : t('UniNew')}
                </Typography>
                <Typography component='span' sx={{ fontSize: '1.35rem', fontWeight: 800 }}>{def.Name || t('UniNew')}</Typography>
            </DialogTitle>
            <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant='scrollable' sx={{ px: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Tab label={t('UniTabGeneral')} />
                <Tab label={t('UniTabRules')} />
                <Tab label={t('UniTabContent')} />
                <Tab label={t('UniTabChronology')} disabled={!details} />
            </Tabs>
            <DialogContent sx={{ minHeight: 380 }}>
                {error && <Typography sx={{ color: '#ff6b6b', fontWeight: 700, mb: 1.5 }}>{error}</Typography>}

                {tab === 0 && (
                    <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>
                        <TextField label={t('LabelName')} value={def.Name} onChange={e => setDef({ ...def, Name: e.target.value })} sx={field} autoFocus />
                        <TextField label={t('UniOverview')} value={def.Overview || ''} onChange={e => setDef({ ...def, Overview: e.target.value })} multiline minRows={3} sx={field} />
                        <FormControlLabel
                            control={<Switch checked={def.Hidden} onChange={e => setDef({ ...def, Hidden: e.target.checked })} />}
                            label={t('UniHiddenHelp')}
                        />
                        {def.Source !== 'custom' && (
                            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                                {t(def.Source === 'auto' ? 'UniSourceAutoHelp' : 'UniSourceBuiltinHelp')}
                            </Typography>
                        )}
                    </Box>
                )}

                {tab === 1 && (
                    <Box sx={{ display: 'grid', gap: 2, pt: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                        <Typography sx={{ gridColumn: '1 / -1', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{t('UniRulesHelp')}</Typography>
                        <TextField label={t('UniRuleTags')} helperText={t('UniRuleTagsHelp')} value={rules.tags} onChange={e => setRules({ ...rules, tags: e.target.value })} multiline minRows={4} sx={field} />
                        <TextField label={t('UniRuleStudios')} helperText={t('UniRuleStudiosHelp')} value={rules.studios} onChange={e => setRules({ ...rules, studios: e.target.value })} multiline minRows={4} sx={field} />
                        <TextField label={t('UniRuleTitles')} helperText={t('UniRuleTitlesHelp')} value={rules.titles} onChange={e => setRules({ ...rules, titles: e.target.value })} multiline minRows={4} sx={field} />
                        <TextField label={t('UniRuleCollections')} helperText={t('UniRuleCollectionsHelp')} value={rules.collections} onChange={e => setRules({ ...rules, collections: e.target.value })} sx={field} />
                    </Box>
                )}

                {tab === 2 && (
                    <Box sx={{ pt: 1 }}>
                        <TextField fullWidth label={t('UniAddSearch')} value={search} onChange={e => setSearch(e.target.value)} sx={field} />
                        {results.length > 0 && (
                            <Box sx={{ mt: 1, mb: 2, p: 1, borderRadius: '12px', background: 'rgba(0,164,220,0.06)', border: '1px solid rgba(0,164,220,0.2)' }}>
                                {results.map(r => (
                                    <ItemLine key={r.Id} item={r} fallback={r.Name || ''}>
                                        <Button size='small' startIcon={<AddRoundedIcon />} onClick={() => add(r)}
                                            disabled={memberIds.some(x => normId(x) === normId(r.Id))}>
                                            {t('Add')}
                                        </Button>
                                    </ItemLine>
                                ))}
                            </Box>
                        )}
                        <Typography sx={{ mt: 2, mb: 0.5, fontWeight: 800 }}>{t('UniMembers', memberIds.length)}</Typography>
                        {memberIds.map(id => {
                            const item = lookup(id);
                            const isBanner = normId(def.BackdropItemId) === normId(id);
                            return (
                                <ItemLine key={id} item={item} fallback={id}>
                                    {item?.BackdropImageTags?.length ? (
                                        <Tooltip title={t('UniUseAsBanner')}>
                                            <IconButton size='small' onClick={() => setDef({ ...def, BackdropItemId: isBanner ? null : id })} sx={{ color: isBanner ? '#00a4dc' : 'inherit' }}>
                                                <WallpaperRoundedIcon fontSize='small' />
                                            </IconButton>
                                        </Tooltip>
                                    ) : null}
                                    <Tooltip title={t('UniRemove')}>
                                        <IconButton size='small' onClick={() => removeItem(id)}><CloseRoundedIcon fontSize='small' /></IconButton>
                                    </Tooltip>
                                </ItemLine>
                            );
                        })}
                        {def.ExcludeIds.length > 0 && (
                            <>
                                <Typography sx={{ mt: 2.5, mb: 0.5, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>{t('UniExcluded', def.ExcludeIds.length)}</Typography>
                                {def.ExcludeIds.map(id => (
                                    <ItemLine key={id} item={lookup(id)} fallback={id}>
                                        <Tooltip title={t('UniRestore')}>
                                            <IconButton size='small' onClick={() => restore(id)}><RestoreRoundedIcon fontSize='small' /></IconButton>
                                        </Tooltip>
                                    </ItemLine>
                                ))}
                            </>
                        )}
                    </Box>
                )}

                {tab === 3 && details && (
                    <Box sx={{ pt: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                            <Typography sx={{ flex: 1, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{t('UniChronologyHelp')}</Typography>
                            <Button size='small' startIcon={<RestoreRoundedIcon />} onClick={() => {
                                setChrono(details.ReleaseOrder);
                                setDef(d => ({ ...d, ChronologicalOrder: [] }));
                                setChronoTouched(false);
                            }}>
                                {t('UniChronologyReset')}
                            </Button>
                        </Box>
                        {chrono.map((id, index) => (
                            <ItemLine key={id} item={lookup(id)} fallback={id}>
                                <Typography sx={{ width: 28, textAlign: 'right', fontWeight: 800, color: '#00a4dc' }}>{index + 1}</Typography>
                                <IconButton size='small' disabled={index === 0} onClick={() => move(index, -1)}><ArrowUpwardRoundedIcon fontSize='small' /></IconButton>
                                <IconButton size='small' disabled={index === chrono.length - 1} onClick={() => move(index, 1)}><ArrowDownwardRoundedIcon fontSize='small' /></IconButton>
                            </ItemLine>
                        ))}
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                {def.Id && (
                    <Button color='error' onClick={onDelete} sx={{ mr: 'auto' }}>
                        {t(def.Source === 'custom' ? 'Delete' : 'UniReset')}
                    </Button>
                )}
                <Button onClick={onClose}>{t('ButtonCancel')}</Button>
                <Button variant='contained' onClick={onSave} disabled={save.isPending}
                    sx={{ borderRadius: '999px', px: 3, fontWeight: 800, background: 'linear-gradient(135deg, #00a4dc 0%, #0077b6 100%)' }}>
                    {t('Save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default UniverseEditor;
