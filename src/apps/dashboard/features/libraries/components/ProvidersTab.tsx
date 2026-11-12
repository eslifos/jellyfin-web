/**
 * "Providers" tab of the library manager: which sources are used for each kind of item (movies, series,
 * episodes...) and in which order, plus the library-wide sources (subtitles, segments, lyrics, NFO).
 * It edits the same LibraryOptions fields as the classic editor.
 */
import type { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import type { ImageOption } from '@jellyfin/sdk/lib/generated-client/models/image-option';
import type { LibraryOptionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/library-option-info-dto';
import type { LibraryOptions } from '@jellyfin/sdk/lib/generated-client/models/library-options';
import type { LibraryTypeOptionsDto } from '@jellyfin/sdk/lib/generated-client/models/library-type-options-dto';
import type { TypeOptions } from '@jellyfin/sdk/lib/generated-client/models/type-options';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import React, { type Dispatch, type FC, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

interface ProvidersTabProps {
    collectionType: string;
    draft: LibraryOptions;
    setDraft: Dispatch<SetStateAction<LibraryOptions>>;
    accent: string;
}

interface ProviderItem {
    name: string;
    enabled: boolean;
}

/** Short explanation of the providers people usually see. */
const PROVIDER_HELP: [ string, string ][] = [
    [ 'themoviedb', 'MngProvTmdb' ],
    [ 'tmdb', 'MngProvTmdb' ],
    [ 'thetvdb', 'MngProvTvdb' ],
    [ 'tvdb', 'MngProvTvdb' ],
    [ 'open movie database', 'MngProvOmdb' ],
    [ 'omdb', 'MngProvOmdb' ],
    [ 'anidb', 'MngProvAnime' ],
    [ 'anilist', 'MngProvAnime' ],
    [ 'anisearch', 'MngProvAnime' ],
    [ 'kitsu', 'MngProvAnime' ],
    [ 'fanart', 'MngProvFanart' ],
    [ 'screen grabber', 'MngProvScreen' ],
    [ 'image extractor', 'MngProvScreen' ],
    [ 'embedded image', 'MngProvEmbedded' ],
    [ 'musicbrainz', 'MngProvMusic' ],
    [ 'audiodb', 'MngProvMusic' ],
    [ 'opensubtitles', 'MngProvSubtitles' ],
    [ 'open subtitles', 'MngProvSubtitles' ],
    [ 'nfo', 'MngProvNfo' ],
    [ 'chapter', 'MngProvSegments' ],
    [ 'intro', 'MngProvSegments' ]
];

const providerHelp = (name: string) => {
    const lower = name.toLowerCase();
    const match = PROVIDER_HELP.find(([ key ]) => lower.includes(key));
    return match ? globalize.translate(match[1]) : undefined;
};

/** Same order rule as the server and the classic editor. */
const ordered = (plugins: LibraryOptionInfoDto[] = [], order: string[] = []) =>
    [ ...plugins ].sort((a, b) => order.indexOf(a.Name || '') - order.indexOf(b.Name || ''));

/** Providers stored as a list of the enabled ones. */
const fromEnabledList = (plugins: LibraryOptionInfoDto[] | undefined, order: string[] | null | undefined, enabled: string[] | null | undefined): ProviderItem[] =>
    ordered(plugins, order || []).map(p => ({ name: p.Name || '', enabled: enabled ? enabled.includes(p.Name || '') : !!p.DefaultEnabled }));

/** Providers stored as a list of the disabled ones. */
const fromDisabledList = (plugins: LibraryOptionInfoDto[] | undefined, order: string[] | null | undefined, disabled: string[] | null | undefined): ProviderItem[] =>
    ordered(plugins, order || []).map(p => ({ name: p.Name || '', enabled: disabled ? !disabled.includes(p.Name || '') : !!p.DefaultEnabled }));

const IMAGE_TYPES = [ 'Primary', 'Backdrop', 'Logo', 'Thumb', 'Banner', 'Art', 'Disc', 'Box', 'BoxRear', 'Menu' ];

/* ---------- Ordered list with switches ---------- */

const ProviderList: FC<{
    title: string;
    help?: string;
    items: ProviderItem[];
    onChange: (items: ProviderItem[]) => void;
    accent: string;
    orderOnly?: boolean;
    toggleOnly?: boolean;
}> = ({ title, help, items, onChange, accent, orderOnly, toggleOnly }) => {
    const move = (index: number, delta: number) => {
        const next = [ ...items ];
        const [ item ] = next.splice(index, 1);
        next.splice(index + delta, 0, item);
        onChange(next);
    };
    const toggle = (index: number, enabled: boolean) => onChange(items.map((it, i) => (i === index ? { ...it, enabled } : it)));
    let rank = 0;

    if (!items.length) return null;

    return (
        <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{title}</Typography>
            {help && <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', mb: 1 }}>{help}</Typography>}
            <Box sx={{ borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                {items.map((item, index) => {
                    const on = orderOnly || item.enabled;
                    if (on) rank++;
                    const description = providerHelp(item.name);
                    return (
                        <Box key={item.name} sx={{
                            display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1,
                            opacity: on ? 1 : 0.5, transition: 'opacity 0.15s',
                            '& + &': { borderTop: '1px solid rgba(255,255,255,0.06)' }
                        }}>
                            {!toggleOnly && (
                                <Box sx={{
                                    width: 26, height: 26, borderRadius: '8px', flexShrink: 0, display: 'grid', placeItems: 'center',
                                    fontSize: '0.75rem', fontWeight: 800,
                                    color: on ? '#fff' : 'rgba(255,255,255,0.4)',
                                    background: on ? `linear-gradient(135deg, ${accent}, #aa5cc3)` : 'rgba(255,255,255,0.06)'
                                }}>
                                    {on ? rank : '–'}
                                </Box>
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>{item.name}</Typography>
                                {description && <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{description}</Typography>}
                            </Box>
                            {!toggleOnly && (
                                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                                    {/* eslint-disable react/jsx-no-bind */}
                                    <IconButton size='small' disabled={index === 0} onClick={() => move(index, -1)} title={globalize.translate('Up')}>
                                        <KeyboardArrowUpRoundedIcon fontSize='small' />
                                    </IconButton>
                                    <IconButton size='small' disabled={index === items.length - 1} onClick={() => move(index, 1)} title={globalize.translate('Down')}>
                                        <KeyboardArrowDownRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Box>
                            )}
                            {!orderOnly && <Switch checked={item.enabled} onChange={e => toggle(index, e.target.checked)} />}
                            {/* eslint-enable react/jsx-no-bind */}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

/* ---------- Tab ---------- */

const ProvidersTab: FC<ProvidersTabProps> = ({ collectionType, draft, setDraft, accent }) => {
    const { api } = useApi();
    const contentType = collectionType === 'mixed' ? undefined : collectionType as CollectionType;
    const { data: available, isPending } = useQuery({
        queryKey: [ 'LibraryAvailableOptions', contentType ?? 'mixed' ],
        queryFn: async ({ signal }) => (await getLibraryApi(api!).getLibraryOptionsInfo({ libraryContentType: contentType, isNewLibrary: false }, { signal })).data,
        enabled: !!api,
        staleTime: 5 * 60 * 1000
    });

    const kinds = useMemo(() => (available?.TypeOptions || []).filter(t =>
        t.MetadataFetchers?.length || t.ImageFetchers?.length || t.SimilarItemProviders?.length), [ available ]);
    const [ kind, setKind ] = useState<string>('');
    useEffect(() => {
        if (kinds.length && !kinds.some(k => k.Type === kind)) setKind(kinds[0].Type || '');
    }, [ kinds, kind ]);

    const kindInfo: LibraryTypeOptionsDto | undefined = kinds.find(k => k.Type === kind);
    const typeOptions: TypeOptions = draft.TypeOptions?.find(t => t.Type === kind) || { Type: kind };

    const updateType = useCallback((patch: Partial<TypeOptions>) => {
        setDraft(d => {
            const list = [ ...(d.TypeOptions || []) ];
            const index = list.findIndex(t => t.Type === kind);
            if (index >= 0) list[index] = { ...list[index], ...patch };
            else list.push({ Type: kind, ...patch });
            return { ...d, TypeOptions: list };
        });
    }, [ kind, setDraft ]);

    /* ----- Image types for the selected kind ----- */
    const imageConfig = (imageType: string): ImageOption =>
        typeOptions.ImageOptions?.find(o => o.Type === imageType)
        || kindInfo?.DefaultImageOptions?.find(o => o.Type === imageType)
        || { Type: imageType as ImageOption['Type'], Limit: imageType === 'Primary' ? 1 : 0, MinWidth: 0 };
    const supportedImages = IMAGE_TYPES.filter(t => kindInfo?.SupportedImageTypes?.includes(t as never));
    const setImageConfig = (imageType: string, patch: Partial<ImageOption>) => {
        const all = supportedImages.map(t => (t === imageType ? { ...imageConfig(t), ...patch } : imageConfig(t)));
        updateType({ ImageOptions: all });
    };
    const backdrop = imageConfig('Backdrop');

    if (isPending) {
        return <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>;
    }

    const metadataItems = fromEnabledList(kindInfo?.MetadataFetchers, typeOptions.MetadataFetcherOrder, typeOptions.MetadataFetchers);
    const imageItems = fromEnabledList(kindInfo?.ImageFetchers, typeOptions.ImageFetcherOrder, typeOptions.ImageFetchers);
    const similarItems = fromEnabledList(kindInfo?.SimilarItemProviders, typeOptions.SimilarItemProviderOrder, typeOptions.SimilarItemProviders);

    const subtitleItems = fromDisabledList(available?.SubtitleFetchers, draft.SubtitleFetcherOrder, draft.DisabledSubtitleFetchers);
    const segmentItems = fromDisabledList(available?.MediaSegmentProviders, draft.MediaSegmentProviderOrder, draft.DisabledMediaSegmentProviders);
    const lyricItems = fromDisabledList(available?.LyricFetchers, draft.LyricFetcherOrder, draft.DisabledLyricFetchers);
    const readerItems = ordered(available?.MetadataReaders, draft.LocalMetadataReaderOrder || [])
        .map(p => ({ name: p.Name || '', enabled: true }));
    const saverItems = fromEnabledList(available?.MetadataSavers, [], draft.MetadataSavers);

    const names = (items: ProviderItem[]) => items.map(i => i.name);
    const enabledNames = (items: ProviderItem[]) => items.filter(i => i.enabled).map(i => i.name);
    const disabledNames = (items: ProviderItem[]) => items.filter(i => !i.enabled).map(i => i.name);
    const kindLabel = (type?: string | null) => globalize.translate('TypeOptionPlural' + (type || ''));

    /* eslint-disable react/jsx-no-bind */
    return (
        <>
            {kinds.length > 0 && (
                <Box sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', mb: 1 }}>
                        {globalize.translate('MngProvKind')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {kinds.map(k => {
                            const active = k.Type === kind;
                            return (
                                <Chip
                                    key={k.Type}
                                    label={kindLabel(k.Type)}
                                    onClick={() => setKind(k.Type || '')}
                                    sx={{
                                        fontWeight: 700, fontSize: '0.85rem', height: 34, px: 0.5, color: '#fff',
                                        background: active ? `linear-gradient(135deg, ${accent}, #aa5cc3)` : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.12)'}`,
                                        boxShadow: active ? `0 0 14px ${accent}55` : 'none',
                                        '&:hover': { background: active ? undefined : `${accent}22` }
                                    }}
                                />
                            );
                        })}
                    </Box>
                </Box>
            )}

            {kindInfo && (
                <Box sx={{ p: 2, mb: 3, borderRadius: '16px', border: `1px solid ${accent}33`, background: `${accent}08` }}>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', mb: 1.5 }}>{kindLabel(kind)}</Typography>

                    <ProviderList
                        title={globalize.translate('MngProvInfo')}
                        help={globalize.translate('MngProvInfoHelp')}
                        items={metadataItems}
                        accent={accent}
                        onChange={items => updateType({ MetadataFetchers: enabledNames(items), MetadataFetcherOrder: names(items) })}
                    />

                    <ProviderList
                        title={globalize.translate('MngProvImages')}
                        help={globalize.translate('MngProvImagesHelp')}
                        items={imageItems}
                        accent={accent}
                        onChange={items => updateType({ ImageFetchers: enabledNames(items), ImageFetcherOrder: names(items) })}
                    />

                    {supportedImages.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{globalize.translate('MngProvImageTypes')}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', mb: 1 }}>{globalize.translate('MngProvImageTypesHelp')}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                {supportedImages.filter(t => t !== 'Backdrop').map(t => {
                                    const on = !!imageConfig(t).Limit;
                                    return (
                                        <Chip
                                            key={t}
                                            label={globalize.translate('MngImg' + t)}
                                            onClick={() => setImageConfig(t, { Limit: on ? 0 : 1 })}
                                            sx={{
                                                fontWeight: 600, color: on ? '#fff' : 'rgba(255,255,255,0.55)',
                                                background: on ? `${accent}30` : 'rgba(255,255,255,0.04)',
                                                border: `1px solid ${on ? accent : 'rgba(255,255,255,0.12)'}`
                                            }}
                                        />
                                    );
                                })}
                            </Box>
                            {supportedImages.includes('Backdrop') && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5 }}>
                                    <TextField
                                        type='number'
                                        size='small'
                                        label={globalize.translate('MngImgBackdropCount')}
                                        value={backdrop.Limit ?? 0}
                                        inputProps={{ min: 0, max: 20 }}
                                        onChange={e => setImageConfig('Backdrop', { Limit: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
                                        sx={{ width: 170 }}
                                    />
                                    <TextField
                                        type='number'
                                        size='small'
                                        label={globalize.translate('MngImgBackdropWidth')}
                                        value={backdrop.MinWidth ?? 0}
                                        inputProps={{ min: 0, step: 100 }}
                                        onChange={e => setImageConfig('Backdrop', { MinWidth: Math.max(0, Number(e.target.value) || 0) })}
                                        sx={{ width: 200 }}
                                    />
                                </Box>
                            )}
                        </Box>
                    )}

                    <ProviderList
                        title={globalize.translate('MngProvSimilar')}
                        help={globalize.translate('MngProvSimilarHelp')}
                        items={similarItems}
                        accent={accent}
                        onChange={items => updateType({ SimilarItemProviders: enabledNames(items), SimilarItemProviderOrder: names(items) })}
                    />
                </Box>
            )}

            {(subtitleItems.length + segmentItems.length + lyricItems.length + readerItems.length + saverItems.length) > 0 && (
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', mb: 1.25 }}>
                    {globalize.translate('MngProvWholeLibrary')}
                </Typography>
            )}

            <ProviderList
                title={globalize.translate('MngProvSubtitleSources')}
                help={globalize.translate('MngProvSubtitleSourcesHelp')}
                items={subtitleItems}
                accent={accent}
                onChange={items => setDraft(d => ({ ...d, DisabledSubtitleFetchers: disabledNames(items), SubtitleFetcherOrder: names(items) }))}
            />
            <ProviderList
                title={globalize.translate('MngProvSegmentSources')}
                help={globalize.translate('MngProvSegmentSourcesHelp')}
                items={segmentItems}
                accent={accent}
                onChange={items => setDraft(d => ({ ...d, DisabledMediaSegmentProviders: disabledNames(items), MediaSegmentProviderOrder: names(items) }))}
            />
            <ProviderList
                title={globalize.translate('MngProvLyricSources')}
                items={lyricItems}
                accent={accent}
                onChange={items => setDraft(d => ({ ...d, DisabledLyricFetchers: disabledNames(items), LyricFetcherOrder: names(items) }))}
            />
            {readerItems.length > 1 && (
                <ProviderList
                    title={globalize.translate('MngProvReaders')}
                    help={globalize.translate('MngProvReadersHelp')}
                    items={readerItems}
                    accent={accent}
                    orderOnly
                    onChange={items => setDraft(d => ({ ...d, LocalMetadataReaderOrder: names(items) }))}
                />
            )}
            <ProviderList
                title={globalize.translate('MngProvSavers')}
                help={globalize.translate('MngProvSaversHelp')}
                items={saverItems}
                accent={accent}
                toggleOnly
                onChange={items => setDraft(d => ({ ...d, MetadataSavers: enabledNames(items) }))}
            />
        </>
    );
    /* eslint-enable react/jsx-no-bind */
};

export default ProvidersTab;
