/**
 * Simple library manager: the library settings split in tabs with short switches,
 * folders with their free space, and quick tools (scan, refresh, copy settings, apply language to all).
 * The settings that are not shown here (provider order, savers, lyrics...) stay as they are and can be
 * edited in the complete editor ("Advanced").
 */
import type { LibraryOptions } from '@jellyfin/sdk/lib/generated-client/models/library-options';
import type { VirtualFolderInfo } from '@jellyfin/sdk/lib/generated-client/models/virtual-folder-info';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLibraryStructureApi } from '@jellyfin/sdk/lib/utils/api/library-structure-api';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { type FC, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import ConfirmDialog from 'components/ConfirmDialog';
import imageeditor from 'components/imageeditor/imageeditor';
import toast from 'components/toast/toast';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { getLibraryIcon } from 'utils/image';

import { invalidateVirtualFolders } from '../api/invalidateVirtualFolders';
import { useCountries } from '../api/useCountries';
import { useCultures } from '../api/useCultures';
import { useVirtualFolders } from '../api/useVirtualFolders';
import getCollectionTypeOptions from '../utils/collectionTypeOptions';
import { formatSize, getLibraryAccent } from '../utils/libraryUi';
import ChangeLibraryTypeDialog from './ChangeLibraryTypeDialog';
import ProvidersTab from './ProvidersTab';

interface LibraryManageDialogProps {
    open: boolean;
    virtualFolder: VirtualFolderInfo;
    onClose: () => void;
}

type TabKey = 'general' | 'folders' | 'metadata' | 'providers' | 'subtitles' | 'preview' | 'tools';
type RefreshKind = 'scan' | 'missing' | 'replace';

const VIDEO_TYPES = [ 'movies', 'tvshows', 'musicvideos', 'homevideos', 'mixed' ];
const SUBTITLE_TYPES = [ 'movies', 'tvshows', 'musicvideos', 'mixed' ];

/* ---------- Small building blocks ---------- */

const Section: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
    <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', mb: 1 }}>
            {title}
        </Typography>
        <Box sx={{ borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            {children}
        </Box>
    </Box>
);

const Row: FC<{ title: string; help?: string; children: ReactNode }> = ({ title, help, children }) => (
    <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.4,
        '& + &': { borderTop: '1px solid rgba(255,255,255,0.06)' }
    }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.92rem', fontWeight: 600, color: '#fff' }}>{title}</Typography>
            {help && <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', mt: 0.25 }}>{help}</Typography>}
        </Box>
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{children}</Box>
    </Box>
);

const SwitchRow: FC<{ title: string; help?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }> = ({ title, help, checked, onChange, disabled }) => (
    <Row title={title} help={help}>
        {/* eslint-disable-next-line react/jsx-no-bind */}
        <Switch checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    </Row>
);

const ToolButton: FC<{ icon: ReactNode; title: string; help: string; onClick: () => void; busy?: boolean; color?: string }> = ({ icon, title, help, onClick, busy, color = '#00a4dc' }) => (
    <Box
        component='button'
        type='button'
        onClick={onClick}
        disabled={busy}
        sx={{
            display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.75, borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
            font: 'inherit', color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            transition: 'all 0.15s', '&:hover': { borderColor: color, background: `${color}14` }, '&:disabled': { opacity: 0.6, cursor: 'default' }
        }}
    >
        <Box sx={{ color, display: 'flex', mt: 0.25 }}>{busy ? <CircularProgress size={22} /> : icon}</Box>
        <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.92rem', fontWeight: 700 }}>{title}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>{help}</Typography>
        </Box>
    </Box>
);

const selectSx = { minWidth: { xs: 150, sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

/* ---------- Dialog ---------- */

const LibraryManageDialog: FC<LibraryManageDialogProps> = ({ open, virtualFolder, onClose }) => {
    const { api, user } = useApi();
    const fullScreen = useMediaQuery('(max-width: 700px)');
    const type = virtualFolder.CollectionType || 'mixed';
    const accent = getLibraryAccent(virtualFolder.CollectionType);
    const original = useMemo(() => virtualFolder.LibraryOptions || {}, [ virtualFolder ]);

    const [ tab, setTab ] = useState<TabKey>('general');
    const [ draft, setDraft ] = useState<LibraryOptions>(original);
    const [ changeTypeOpen, setChangeTypeOpen ] = useState(false);
    const [ confirmReplace, setConfirmReplace ] = useState(false);
    const [ removePath, setRemovePath ] = useState<string | null>(null);
    const [ copyFrom, setCopyFrom ] = useState('');

    useEffect(() => {
        if (open) {
            setDraft(original);
            setTab('general');
            setCopyFrom('');
        }
    }, [ open, original ]);

    const { data: cultures } = useCultures();
    const { data: countries } = useCountries();
    const { data: allFolders } = useVirtualFolders();
    const { data: storage } = useQuery({
        queryKey: [ 'SystemStorage' ],
        queryFn: async ({ signal }) => (await getSystemApi(api!).getSystemStorage({ signal })).data,
        enabled: !!api && open,
        staleTime: 60 * 1000
    });

    const set = useCallback(<K extends keyof LibraryOptions>(key: K, value: LibraryOptions[K]) => {
        setDraft(d => ({ ...d, [key]: value }));
    }, []);

    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(original), [ draft, original ]);
    const isVideo = VIDEO_TYPES.includes(type);
    const hasSubtitles = SUBTITLE_TYPES.includes(type);
    const typeName = getCollectionTypeOptions().find(t => t.value === type)?.name || type;

    const imageUrl = virtualFolder.PrimaryImageItemId && virtualFolder.ItemId && api ?
        getImageApi(api).getItemImageUrlById(virtualFolder.ItemId, ImageType.Primary, { maxWidth: 900 }) :
        undefined;

    /* ----- Saving ----- */
    const save = useMutation({
        mutationFn: async (options: LibraryOptions) => {
            await getLibraryStructureApi(api!).updateLibraryOptions({
                updateLibraryOptionsDto: { Id: virtualFolder.ItemId!, LibraryOptions: options }
            });
        },
        onSuccess: () => {
            invalidateVirtualFolders(user, virtualFolder);
            toast(globalize.translate('MngSaved'));
            onClose();
        },
        onError: () => toast(globalize.translate('ErrorDefault'))
    });
    const onSave = useCallback(() => save.mutate({ ...original, ...draft, PathInfos: original.PathInfos }), [ save, original, draft ]);

    /* ----- Refresh tools ----- */
    const refresh = useMutation({
        mutationFn: async (kind: RefreshKind) => {
            const full = kind !== 'scan';
            await api!.axiosInstance.post(`${api!.basePath}/Items/${virtualFolder.ItemId}/Refresh`, null, {
                headers: { Authorization: api!.authorizationHeader },
                params: {
                    Recursive: true,
                    MetadataRefreshMode: full ? 'FullRefresh' : 'Default',
                    ImageRefreshMode: full ? 'FullRefresh' : 'Default',
                    ReplaceAllMetadata: kind === 'replace',
                    ReplaceAllImages: kind === 'replace'
                }
            });
        },
        onSuccess: () => {
            invalidateVirtualFolders(user, virtualFolder);
            toast(globalize.translate('MngRefreshStarted'));
        },
        onError: () => toast(globalize.translate('ErrorDefault'))
    });
    const runScan = useCallback(() => refresh.mutate('scan'), [ refresh ]);
    const runMissing = useCallback(() => refresh.mutate('missing'), [ refresh ]);
    const askReplace = useCallback(() => setConfirmReplace(true), []);
    const cancelReplace = useCallback(() => setConfirmReplace(false), []);
    const runReplace = useCallback(() => {
        setConfirmReplace(false);
        refresh.mutate('replace');
    }, [ refresh ]);

    /* ----- Language to every library ----- */
    const applyLanguage = useMutation({
        mutationFn: async () => {
            const others = (allFolders || []).filter(f => f.ItemId && f.ItemId !== virtualFolder.ItemId && f.CollectionType !== 'boxsets');
            for (const folder of others) {
                await getLibraryStructureApi(api!).updateLibraryOptions({
                    updateLibraryOptionsDto: {
                        Id: folder.ItemId!,
                        LibraryOptions: {
                            ...folder.LibraryOptions,
                            PreferredMetadataLanguage: draft.PreferredMetadataLanguage,
                            MetadataCountryCode: draft.MetadataCountryCode
                        }
                    }
                });
            }
            return others.length;
        },
        onSuccess: count => {
            invalidateVirtualFolders(user);
            toast(globalize.translate('MngLanguageApplied', count));
        },
        onError: () => toast(globalize.translate('ErrorDefault'))
    });
    const runApplyLanguage = useCallback(() => applyLanguage.mutate(), [ applyLanguage ]);

    /* ----- Copy settings from another library ----- */
    const otherLibraries = (allFolders || []).filter(f => f.ItemId && f.ItemId !== virtualFolder.ItemId && f.CollectionType !== 'boxsets');
    const onCopyFrom = useCallback((id: string) => {
        setCopyFrom(id);
        const source = otherLibraries.find(f => f.ItemId === id);
        if (source?.LibraryOptions) {
            setDraft({ ...source.LibraryOptions, PathInfos: original.PathInfos, Enabled: draft.Enabled });
            toast(globalize.translate('MngCopied', source.Name || ''));
        }
    }, [ otherLibraries, original, draft.Enabled ]);

    /* ----- Folders ----- */
    const pathInfos = original.PathInfos?.length ?
        original.PathInfos :
        (virtualFolder.Locations || []).map(p => ({ Path: p }));
    const libraryStorage = storage?.Libraries?.find(l => l.Id?.replace(/-/g, '') === virtualFolder.ItemId?.replace(/-/g, ''));

    const addFolder = useCallback(() => {
        void import('components/directorybrowser/directorybrowser').then(({ default: DirectoryBrowser }) => {
            const picker = new DirectoryBrowser();
            picker.show({
                callback: (path: string) => {
                    picker.close();
                    if (!path || !virtualFolder.Name || virtualFolder.Locations?.includes(path)) return;
                    void getLibraryStructureApi(api!)
                        .addMediaPath({ mediaPathDto: { Name: virtualFolder.Name, PathInfo: { Path: path } }, refreshLibrary: true })
                        .then(() => {
                            invalidateVirtualFolders(user, virtualFolder);
                            toast(globalize.translate('MngFolderAdded'));
                        })
                        .catch(() => toast(globalize.translate('ErrorAddingMediaPathToVirtualFolder')));
                }
            });
        });
    }, [ api, user, virtualFolder ]);

    const cancelRemove = useCallback(() => setRemovePath(null), []);
    const confirmRemove = useCallback(() => {
        const path = removePath;
        setRemovePath(null);
        if (!path || !virtualFolder.Name) return;
        void getLibraryStructureApi(api!)
            .removeMediaPath({ name: virtualFolder.Name, path, refreshLibrary: true })
            .then(() => {
                invalidateVirtualFolders(user, virtualFolder);
                toast(globalize.translate('MngFolderRemoved'));
            })
            .catch(() => toast(globalize.translate('ErrorDefault')));
    }, [ api, user, virtualFolder, removePath ]);

    /* ----- Other editors ----- */
    const openImages = useCallback(() => {
        void imageeditor.show({
            itemId: virtualFolder.ItemId,
            serverId: ServerConnections.currentApiClient()?.serverId()
        }).then(() => invalidateVirtualFolders(user)).catch(() => { /* closed */ });
    }, [ user, virtualFolder ]);

    const openChangeType = useCallback(() => setChangeTypeOpen(true), []);
    const closeChangeType = useCallback(() => setChangeTypeOpen(false), []);
    const onTab = useCallback((_e: React.SyntheticEvent, value: TabKey) => setTab(value), []);

    /* ----- Lists for selects ----- */
    const languageOptions = useMemo(() => {
        const list = (cultures || []).map(c => ({ value: c.TwoLetterISOLanguageName || '', label: c.DisplayName || '' }))
            .filter(c => c.value);
        const current = draft.PreferredMetadataLanguage;
        if (current && !list.some(l => l.value === current)) list.unshift({ value: current, label: current });
        return list;
    }, [ cultures, draft.PreferredMetadataLanguage ]);

    const countryOptions = useMemo(() => (countries || [])
        .map(c => ({ value: c.TwoLetterISORegionName || '', label: c.DisplayName || '' }))
        .filter(c => c.value)
        .sort((a, b) => a.label.localeCompare(b.label)), [ countries ]);

    const subtitleLanguages = useMemo(() => {
        const seen = new Set<string>();
        return (cultures || [])
            .map(c => ({ value: (c.ThreeLetterISOLanguageName || '').toLowerCase(), label: c.DisplayName || '' }))
            .filter(c => c.value && !seen.has(c.value) && seen.add(c.value));
    }, [ cultures ]);
    const selectedSubtitleLanguages = subtitleLanguages.filter(l => draft.SubtitleDownloadLanguages?.includes(l.value));

    const tabs: { key: TabKey; label: string; show: boolean }[] = [
        { key: 'general', label: globalize.translate('MngTabGeneral'), show: true },
        { key: 'folders', label: globalize.translate('Folders'), show: type !== 'boxsets' },
        { key: 'metadata', label: globalize.translate('MngTabMetadata'), show: true },
        { key: 'providers', label: globalize.translate('MngTabProviders'), show: type !== 'boxsets' },
        { key: 'subtitles', label: globalize.translate('Subtitles'), show: hasSubtitles },
        { key: 'preview', label: globalize.translate('MngTabPreview'), show: isVideo },
        { key: 'tools', label: globalize.translate('MngTabTools'), show: true }
    ];

    const nfo = draft.MetadataSavers?.includes('Nfo') ?? false;
    const setNfo = useCallback((value: boolean) => {
        setDraft(d => {
            const others = (d.MetadataSavers || []).filter(s => s !== 'Nfo');
            return { ...d, MetadataSavers: value ? [ ...others, 'Nfo' ] : others };
        });
    }, []);

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                fullScreen={fullScreen}
                maxWidth='md'
                fullWidth
                PaperProps={{ sx: {
                    background: 'rgba(10,12,24,0.98)', borderRadius: fullScreen ? 0 : '20px', overflow: 'hidden',
                    border: `1px solid ${accent}40`, boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 30px ${accent}20`,
                    height: fullScreen ? '100%' : 'min(820px, 92vh)', display: 'flex', flexDirection: 'column'
                } }}
            >
                {/* Header */}
                <Box sx={{
                    position: 'relative', flexShrink: 0, px: 3, pt: 3, pb: 2,
                    background: imageUrl ?
                        `linear-gradient(180deg, rgba(10,12,24,0.35), rgba(10,12,24,1)), url("${imageUrl}") center / cover` :
                        `radial-gradient(circle at 20% 0%, ${accent}40, transparent 60%)`
                }}>
                    <IconButton onClick={onClose} aria-label={globalize.translate('ButtonClose')} sx={{ position: 'absolute', top: 10, right: 10, color: '#fff', background: 'rgba(0,0,0,0.4)' }}>
                        <CloseRoundedIcon />
                    </IconButton>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 5 }}>
                        <Box sx={{ width: 46, height: 46, borderRadius: '14px', display: 'grid', placeItems: 'center', background: `${accent}26`, border: `1px solid ${accent}66`, flexShrink: 0 }}>
                            <Icon sx={{ color: accent }}>{getLibraryIcon(virtualFolder.CollectionType)}</Icon>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>{virtualFolder.Name}</Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>{typeName}</Typography>
                        </Box>
                    </Box>
                    <Tabs
                        value={tab}
                        onChange={onTab}
                        variant='scrollable'
                        scrollButtons='auto'
                        sx={{
                            mt: 2, minHeight: 40,
                            '& .MuiTabs-indicator': { height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${accent}, #aa5cc3)` },
                            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 700, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' },
                            '& .Mui-selected': { color: '#fff !important' }
                        }}
                    >
                        {tabs.filter(t => t.show).map(t => <Tab key={t.key} value={t.key} label={t.label} />)}
                    </Tabs>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
                    {tab === 'general' && (
                        <>
                            <Section title={globalize.translate('MngTabGeneral')}>
                                <Row title={globalize.translate('LibChangeTypeCurrent')} help={typeName}>
                                    <Button size='small' startIcon={<SwapHorizRoundedIcon />} onClick={openChangeType} sx={{ textTransform: 'none', color: accent }}>
                                        {globalize.translate('LibChangeType')}
                                    </Button>
                                </Row>
                                {/* eslint-disable react/jsx-no-bind */}
                                <SwitchRow title={globalize.translate('MngEnabled')} help={globalize.translate('MngEnabledHelp')} checked={draft.Enabled ?? true} onChange={v => set('Enabled', v)} />
                                <SwitchRow title={globalize.translate('MngRealtime')} help={globalize.translate('MngRealtimeHelp')} checked={!!draft.EnableRealtimeMonitor} onChange={v => set('EnableRealtimeMonitor', v)} />
                                {(type === 'homevideos') && (
                                    <SwitchRow title={globalize.translate('EnablePhotos')} help={globalize.translate('MngPhotosHelp')} checked={!!draft.EnablePhotos} onChange={v => set('EnablePhotos', v)} />
                                )}
                                {type === 'music' && (
                                    <SwitchRow title={globalize.translate('LabelEnableLUFSScan')} help={globalize.translate('MngLufsHelp')} checked={!!draft.EnableLUFSScan} onChange={v => set('EnableLUFSScan', v)} />
                                )}
                                {/* eslint-enable react/jsx-no-bind */}
                            </Section>
                            <Section title={globalize.translate('MngQuickActions')}>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, p: 1 }}>
                                    <ToolButton icon={<RefreshRoundedIcon />} title={globalize.translate('MngScan')} help={globalize.translate('MngScanHelp')} onClick={runScan} busy={refresh.isPending && refresh.variables === 'scan'} color={accent} />
                                    <ToolButton icon={<ImageRoundedIcon />} title={globalize.translate('EditImages')} help={globalize.translate('MngImagesHelp')} onClick={openImages} color={accent} />
                                </Box>
                            </Section>
                        </>
                    )}

                    {tab === 'folders' && (
                        <Section title={`${globalize.translate('Folders')} (${pathInfos.length})`}>
                            {pathInfos.map(info => {
                                const folderStorage = libraryStorage?.Folders?.find(f => f.Path === info.Path);
                                const total = folderStorage && folderStorage.FreeSpace != null && folderStorage.UsedSpace != null ?
                                    folderStorage.FreeSpace + folderStorage.UsedSpace : 0;
                                const usedPct = total ? (folderStorage!.UsedSpace! / total) * 100 : 0;
                                return (
                                    <Box key={info.Path} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, '& + &': { borderTop: '1px solid rgba(255,255,255,0.06)' } }}>
                                        <FolderRoundedIcon sx={{ color: accent }} />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Tooltip title={info.Path || ''} placement='top'>
                                                <Typography noWrap sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#fff' }}>{info.Path}</Typography>
                                            </Tooltip>
                                            {total > 0 && (
                                                <>
                                                    <LinearProgress
                                                        variant='determinate'
                                                        value={usedPct}
                                                        sx={{
                                                            mt: 0.75, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)',
                                                            '& .MuiLinearProgress-bar': { background: usedPct > 90 ? '#ef5350' : `linear-gradient(90deg, ${accent}, #aa5cc3)` }
                                                        }}
                                                    />
                                                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', mt: 0.4 }}>
                                                        {globalize.translate('MngFreeSpace', formatSize(folderStorage!.FreeSpace!), formatSize(total))}
                                                    </Typography>
                                                </>
                                            )}
                                        </Box>
                                        <Tooltip title={globalize.translate('ButtonRemove')}>
                                            {/* eslint-disable-next-line react/jsx-no-bind */}
                                            <IconButton onClick={() => setRemovePath(info.Path || null)} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#ef5350' } }}>
                                                <DeleteOutlineRoundedIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                );
                            })}
                            <Box sx={{ p: 1.5, borderTop: pathInfos.length ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                                <Button startIcon={<AddRoundedIcon />} onClick={addFolder} sx={{ textTransform: 'none', fontWeight: 700, color: accent }}>
                                    {globalize.translate('MngAddFolder')}
                                </Button>
                            </Box>
                        </Section>
                    )}

                    {/* eslint-disable react/jsx-no-bind */}
                    {tab === 'metadata' && (
                        <>
                            <Section title={globalize.translate('MngLanguageSection')}>
                                <Row title={globalize.translate('MngLanguage')} help={globalize.translate('MngLanguageHelp')}>
                                    <TextField select size='small' sx={selectSx} value={draft.PreferredMetadataLanguage || ''} onChange={e => set('PreferredMetadataLanguage', e.target.value)}>
                                        <MenuItem value=''>—</MenuItem>
                                        {languageOptions.map(l => <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>)}
                                    </TextField>
                                </Row>
                                <Row title={globalize.translate('LabelCountry')}>
                                    <TextField select size='small' sx={selectSx} value={draft.MetadataCountryCode || ''} onChange={e => set('MetadataCountryCode', e.target.value)}>
                                        <MenuItem value=''>—</MenuItem>
                                        {countryOptions.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                                    </TextField>
                                </Row>
                                <Row title={globalize.translate('MngAutoRefresh')} help={globalize.translate('MngAutoRefreshHelp')}>
                                    <TextField select size='small' sx={selectSx} value={draft.AutomaticRefreshIntervalDays || 0} onChange={e => set('AutomaticRefreshIntervalDays', Number(e.target.value))}>
                                        <MenuItem value={0}>{globalize.translate('Never')}</MenuItem>
                                        {[ 30, 60, 90 ].map(d => <MenuItem key={d} value={d}>{globalize.translate('EveryNDays', d)}</MenuItem>)}
                                    </TextField>
                                </Row>
                            </Section>

                            <Section title={globalize.translate('MngIdentifySection')}>
                                {type !== 'books' && type !== 'music' && (
                                    <SwitchRow title={globalize.translate('MngEmbeddedTitles')} help={globalize.translate('MngEmbeddedTitlesHelp')} checked={!!draft.EnableEmbeddedTitles} onChange={v => set('EnableEmbeddedTitles', v)} />
                                )}
                                {type === 'tvshows' && (
                                    <>
                                        <SwitchRow title={globalize.translate('MngEmbeddedEpisodes')} help={globalize.translate('MngEmbeddedEpisodesHelp')} checked={!!draft.EnableEmbeddedEpisodeInfos} onChange={v => set('EnableEmbeddedEpisodeInfos', v)} />
                                        <SwitchRow title={globalize.translate('MngGroupSeries')} help={globalize.translate('MngGroupSeriesHelp')} checked={!!draft.EnableAutomaticSeriesGrouping} onChange={v => set('EnableAutomaticSeriesGrouping', v)} />
                                        <Row title={globalize.translate('LabelSpecialSeasonsDisplayName')}>
                                            <TextField size='small' sx={selectSx} value={draft.SeasonZeroDisplayName ?? 'Specials'} onChange={e => set('SeasonZeroDisplayName', e.target.value)} />
                                        </Row>
                                    </>
                                )}
                                {(type === 'movies' || type === 'mixed') && (
                                    <SwitchRow title={globalize.translate('MngAutoCollections')} help={globalize.translate('MngAutoCollectionsHelp')} checked={!!draft.AutomaticallyAddToCollection} onChange={v => set('AutomaticallyAddToCollection', v)} />
                                )}
                            </Section>

                            <Section title={globalize.translate('MngSaveSection')}>
                                <SwitchRow title={globalize.translate('MngSaveImages')} help={globalize.translate('MngSaveImagesHelp')} checked={!!draft.SaveLocalMetadata} onChange={v => set('SaveLocalMetadata', v)} />
                                <SwitchRow title={globalize.translate('MngSaveNfo')} help={globalize.translate('MngSaveNfoHelp')} checked={nfo} onChange={setNfo} />
                            </Section>

                        </>
                    )}

                    {tab === 'providers' && (
                        <ProvidersTab collectionType={type} draft={draft} setDraft={setDraft} accent={accent} />
                    )}

                    {tab === 'subtitles' && (
                        <>
                            <Section title={globalize.translate('MngSubtitleDownload')}>
                                <Box sx={{ p: 2 }}>
                                    <Typography sx={{ fontSize: '0.92rem', fontWeight: 600, color: '#fff', mb: 0.25 }}>{globalize.translate('LabelDownloadLanguages')}</Typography>
                                    <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', mb: 1.25 }}>{globalize.translate('MngSubtitleLanguagesHelp')}</Typography>
                                    <Autocomplete
                                        multiple
                                        size='small'
                                        options={subtitleLanguages}
                                        value={selectedSubtitleLanguages}
                                        getOptionLabel={o => o.label}
                                        isOptionEqualToValue={(a, b) => a.value === b.value}
                                        onChange={(_e, value) => set('SubtitleDownloadLanguages', value.map(v => v.value))}
                                        renderTags={(value, getTagProps) => value.map((o, i) => {
                                            const { key, ...props } = getTagProps({ index: i });
                                            return <Chip key={key} {...props} size='small' label={o.label} sx={{ background: `${accent}26`, border: `1px solid ${accent}55` }} />;
                                        })}
                                        renderInput={params => <TextField {...params} placeholder={globalize.translate('Search')} />}
                                    />
                                </Box>
                                <SwitchRow title={globalize.translate('MngSkipEmbedded')} checked={!!draft.SkipSubtitlesIfEmbeddedSubtitlesPresent} onChange={v => set('SkipSubtitlesIfEmbeddedSubtitlesPresent', v)} />
                                <SwitchRow title={globalize.translate('MngSkipAudio')} help={globalize.translate('MngSkipAudioHelp')} checked={!!draft.SkipSubtitlesIfAudioTrackMatches} onChange={v => set('SkipSubtitlesIfAudioTrackMatches', v)} />
                                <SwitchRow title={globalize.translate('MngPerfectMatch')} help={globalize.translate('MngPerfectMatchHelp')} checked={draft.RequirePerfectSubtitleMatch ?? true} onChange={v => set('RequirePerfectSubtitleMatch', v)} />
                                <SwitchRow title={globalize.translate('MngSaveSubtitles')} help={globalize.translate('MngSaveSubtitlesHelp')} checked={draft.SaveSubtitlesWithMedia ?? true} onChange={v => set('SaveSubtitlesWithMedia', v)} />
                            </Section>
                            <Section title={globalize.translate('MngEmbeddedSubtitles')}>
                                <Row title={globalize.translate('MngEmbeddedSubtitlesAllowed')}>
                                    <TextField select size='small' sx={selectSx} value={draft.AllowEmbeddedSubtitles || 'AllowAll'} onChange={e => set('AllowEmbeddedSubtitles', e.target.value as LibraryOptions['AllowEmbeddedSubtitles'])}>
                                        <MenuItem value='AllowAll'>{globalize.translate('AllowEmbeddedSubtitlesAllowAllOption')}</MenuItem>
                                        <MenuItem value='AllowText'>{globalize.translate('AllowEmbeddedSubtitlesAllowTextOption')}</MenuItem>
                                        <MenuItem value='AllowImage'>{globalize.translate('AllowEmbeddedSubtitlesAllowImageOption')}</MenuItem>
                                        <MenuItem value='AllowNone'>{globalize.translate('AllowEmbeddedSubtitlesAllowNoneOption')}</MenuItem>
                                    </TextField>
                                </Row>
                            </Section>
                        </>
                    )}

                    {tab === 'preview' && (
                        <>
                            <Alert severity='info' sx={{ mb: 2, borderRadius: '12px' }}>{globalize.translate('MngPreviewInfo')}</Alert>
                            <Section title={globalize.translate('MngTrickplaySection')}>
                                <SwitchRow title={globalize.translate('MngTrickplay')} help={globalize.translate('MngTrickplayHelp')} checked={!!draft.EnableTrickplayImageExtraction} onChange={v => set('EnableTrickplayImageExtraction', v)} />
                                <SwitchRow title={globalize.translate('MngDuringScan')} help={globalize.translate('MngDuringScanHelp')} checked={!!draft.ExtractTrickplayImagesDuringLibraryScan} disabled={!draft.EnableTrickplayImageExtraction} onChange={v => set('ExtractTrickplayImagesDuringLibraryScan', v)} />
                                <SwitchRow title={globalize.translate('MngSaveWithMedia')} checked={!!draft.SaveTrickplayWithMedia} disabled={!draft.EnableTrickplayImageExtraction} onChange={v => set('SaveTrickplayWithMedia', v)} />
                            </Section>
                            <Section title={globalize.translate('HeaderChapterImages')}>
                                <SwitchRow title={globalize.translate('MngChapters')} help={globalize.translate('MngChaptersHelp')} checked={!!draft.EnableChapterImageExtraction} onChange={v => set('EnableChapterImageExtraction', v)} />
                                <SwitchRow title={globalize.translate('MngDuringScan')} help={globalize.translate('MngDuringScanHelp')} checked={!!draft.ExtractChapterImagesDuringLibraryScan} disabled={!draft.EnableChapterImageExtraction} onChange={v => set('ExtractChapterImagesDuringLibraryScan', v)} />
                            </Section>
                        </>
                    )}
                    {/* eslint-enable react/jsx-no-bind */}

                    {tab === 'tools' && (
                        <>
                            <Section title={globalize.translate('MngRefreshSection')}>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, p: 1 }}>
                                    <ToolButton icon={<RefreshRoundedIcon />} title={globalize.translate('MngScan')} help={globalize.translate('MngScanHelp')} onClick={runScan} busy={refresh.isPending && refresh.variables === 'scan'} color={accent} />
                                    <ToolButton icon={<SearchRoundedIcon />} title={globalize.translate('MngMissing')} help={globalize.translate('MngMissingHelp')} onClick={runMissing} busy={refresh.isPending && refresh.variables === 'missing'} color={accent} />
                                    <ToolButton icon={<AutoFixHighRoundedIcon />} title={globalize.translate('MngReplace')} help={globalize.translate('MngReplaceHelp')} onClick={askReplace} busy={refresh.isPending && refresh.variables === 'replace'} color='#ffa726' />
                                    <ToolButton icon={<ImageRoundedIcon />} title={globalize.translate('EditImages')} help={globalize.translate('MngImagesHelp')} onClick={openImages} color={accent} />
                                </Box>
                            </Section>

                            <Section title={globalize.translate('MngCopySection')}>
                                <Row title={globalize.translate('MngCopy')} help={globalize.translate('MngCopyHelp')}>
                                    <TextField
                                        select
                                        size='small'
                                        sx={selectSx}
                                        value={copyFrom}
                                        // eslint-disable-next-line react/jsx-no-bind
                                        onChange={e => onCopyFrom(e.target.value)}
                                        SelectProps={{ displayEmpty: true }}
                                    >
                                        <MenuItem value='' disabled><ContentCopyRoundedIcon sx={{ fontSize: '1rem', mr: 1 }} />{globalize.translate('MngChooseLibrary')}</MenuItem>
                                        {otherLibraries.map(f => <MenuItem key={f.ItemId} value={f.ItemId!}>{f.Name}</MenuItem>)}
                                    </TextField>
                                </Row>
                                <Row title={globalize.translate('MngApplyLanguage')} help={globalize.translate('MngApplyLanguageHelp', [ draft.PreferredMetadataLanguage, draft.MetadataCountryCode ].filter(Boolean).join('-') || '—')}>
                                    <Button
                                        size='small'
                                        startIcon={applyLanguage.isPending ? <CircularProgress size={14} /> : <LanguageRoundedIcon />}
                                        disabled={applyLanguage.isPending || !draft.PreferredMetadataLanguage}
                                        onClick={runApplyLanguage}
                                        sx={{ textTransform: 'none', color: accent }}
                                    >
                                        {globalize.translate('MngApply')}
                                    </Button>
                                </Row>
                            </Section>

                        </>
                    )}
                </Box>

                {/* Footer */}
                <Box sx={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 1.75,
                    borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,10,20,0.9)'
                }}>
                    <Typography sx={{ flex: 1, fontSize: '0.8rem', color: dirty ? accent : 'rgba(255,255,255,0.4)' }}>
                        {dirty ? globalize.translate('MngUnsaved') : globalize.translate('MngNoChanges')}
                    </Typography>
                    <Button onClick={onClose} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.7)' }}>
                        {globalize.translate('ButtonCancel')}
                    </Button>
                    <Button
                        variant='contained'
                        onClick={onSave}
                        disabled={!dirty || save.isPending}
                        startIcon={save.isPending ? <CircularProgress size={16} /> : undefined}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', background: `linear-gradient(135deg, ${accent}, #aa5cc3)` }}
                    >
                        {globalize.translate('Save')}
                    </Button>
                </Box>
            </Dialog>

            <ChangeLibraryTypeDialog open={changeTypeOpen} virtualFolder={virtualFolder} onClose={closeChangeType} />

            <ConfirmDialog
                open={confirmReplace}
                title={globalize.translate('MngReplace')}
                text={globalize.translate('MngReplaceConfirm')}
                confirmButtonText={globalize.translate('MngReplace')}
                confirmButtonColor='warning'
                onConfirm={runReplace}
                onCancel={cancelReplace}
            />

            <ConfirmDialog
                open={!!removePath}
                title={globalize.translate('HeaderRemoveMediaLocation')}
                text={`${globalize.translate('MngRemoveFolderConfirm')}\n\n${removePath || ''}`}
                confirmButtonText={globalize.translate('ButtonRemove')}
                confirmButtonColor='error'
                onConfirm={confirmRemove}
                onCancel={cancelRemove}
            />
        </>
    );
};

export default LibraryManageDialog;
