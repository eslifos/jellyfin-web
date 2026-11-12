import React, { useCallback, useMemo, useState } from 'react';
import type { VirtualFolderInfo } from '@jellyfin/sdk/lib/generated-client/models/virtual-folder-info';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Folder from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HistoryIcon from '@mui/icons-material/History';
import ImageIcon from '@mui/icons-material/Image';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StorageIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

import ConfirmDialog from 'components/ConfirmDialog';
import InputDialog from 'components/InputDialog';
import imageeditor from 'components/imageeditor/imageeditor';
import RefreshDialog from 'components/refreshdialog/refreshdialog';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { getLibraryIcon } from 'utils/image';

import { invalidateVirtualFolders } from '../api/invalidateVirtualFolders';
import { useLibraryScan } from '../api/useLibraryScans';
import type { LibraryStats } from '../api/useLibraryStats';
import { useRemoveVirtualFolder } from '../api/useRemoveVirtualFolder';
import { useRenameVirtualFolder } from '../api/useRenameVirtualFolder';
import getCollectionTypeOptions from '../utils/collectionTypeOptions';
import ChangeLibraryTypeDialog from './ChangeLibraryTypeDialog';
import LibraryManageDialog from './LibraryManageDialog';
import {
    formatFullDate,
    formatNumber,
    formatRelative,
    formatRuntime,
    formatSize,
    getLibraryAccent,
    getMainStats
} from '../utils/libraryUi';

type LibraryCardProps = {
    virtualFolder: VirtualFolderInfo;
    stats?: LibraryStats;
    isStatsPending?: boolean;
};

const MAX_LOCATIONS = 2;

const InfoRow = ({ icon, label, value, tooltip, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; tooltip?: string; color: string }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Box sx={{ color, display: 'flex', '& svg': { fontSize: '1rem' } }}>{icon}</Box>
        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{label}</Typography>
        <Tooltip title={tooltip || ''} placement='top' disableHoverListener={!tooltip}>
            <Typography noWrap sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', ml: 'auto', minWidth: 0, textAlign: 'right' }}>
                {value}
            </Typography>
        </Tooltip>
    </Box>
);

const LibraryCard = ({ virtualFolder, stats, isStatsPending }: LibraryCardProps) => {
    const { api, user } = useApi();
    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);
    const [ isRenameLibraryDialogOpen, setIsRenameLibraryDialogOpen ] = useState(false);
    const [ isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen ] = useState(false);
    const [ showAllLocations, setShowAllLocations ] = useState(false);
    const [ isChangeTypeOpen, setIsChangeTypeOpen ] = useState(false);
    const [ isManageOpen, setIsManageOpen ] = useState(false);
    const renameVirtualFolder = useRenameVirtualFolder();
    const removeVirtualFolder = useRemoveVirtualFolder();

    const accent = getLibraryAccent(virtualFolder.CollectionType);
    const options = virtualFolder.LibraryOptions;
    const locations = virtualFolder.Locations || [];
    const visibleLocations = showAllLocations ? locations : locations.slice(0, MAX_LOCATIONS);

    const imageUrl = useMemo(() => {
        if (virtualFolder.PrimaryImageItemId && virtualFolder.ItemId && api) {
            return getImageApi(api)
                .getItemImageUrlById(virtualFolder.ItemId, ImageType.Primary, { maxWidth: 640 });
        }
    }, [ api, virtualFolder ]);

    const typeName = getCollectionTypeOptions().find(t => t.value == virtualFolder.CollectionType)?.name
        || globalize.translate('Other');

    const scan = useLibraryScan(virtualFolder.ItemId);
    const isScanning = !!scan;
    const scanProgress = scan?.progress ?? null;
    const mainStats = getMainStats(virtualFolder.CollectionType, stats);

    const optionChips = useMemo(() => {
        const chips: string[] = [];
        if (options?.EnableRealtimeMonitor) chips.push(globalize.translate('LibRealtime'));
        if (options?.PreferredMetadataLanguage) {
            chips.push(`${options.PreferredMetadataLanguage.toUpperCase()}${options.MetadataCountryCode ? '-' + options.MetadataCountryCode : ''}`);
        }
        if (options?.MetadataSavers?.includes('Nfo')) chips.push('NFO');
        if (options?.SaveLocalMetadata) chips.push(globalize.translate('LibLocalArtwork'));
        if (options?.EnableTrickplayImageExtraction) chips.push('Trickplay');
        if (options?.EnableChapterImageExtraction) chips.push(globalize.translate('LibChapterImages'));
        if (options?.AutomaticRefreshIntervalDays) chips.push(globalize.translate('LibAutoRefresh', options.AutomaticRefreshIntervalDays));
        return chips;
    }, [ options ]);

    const closeMenu = useCallback(() => setAnchorEl(null), []);
    const onActionClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(e.currentTarget), []);

    const openRenameDialog = useCallback(() => {
        setAnchorEl(null);
        setIsRenameLibraryDialogOpen(true);
    }, []);

    const hideRenameLibraryDialog = useCallback(() => setIsRenameLibraryDialogOpen(false), []);

    const renameLibrary = useCallback((newName: string) => {
        if (virtualFolder.Name) {
            renameVirtualFolder.mutate({
                refreshLibrary: true,
                newName: newName,
                name: virtualFolder.Name
            }, {
                onSettled: hideRenameLibraryDialog
            });
        }
    }, [ renameVirtualFolder, virtualFolder, hideRenameLibraryDialog ]);

    const showRefreshDialog = useCallback(() => {
        setAnchorEl(null);
        void new RefreshDialog({
            itemIds: [ virtualFolder.ItemId ],
            serverId: ServerConnections.currentApiClient()?.serverId(),
            mode: 'scan'
        }).show();
    }, [ virtualFolder ]);

    const showMediaLibraryEditor = useCallback(() => {
        setAnchorEl(null);
        setIsManageOpen(true);
    }, []);
    const closeManage = useCallback(() => setIsManageOpen(false), []);

    const showImageEditor = useCallback(() => {
        setAnchorEl(null);
        void imageeditor.show({
            itemId: virtualFolder.ItemId,
            serverId: ServerConnections.currentApiClient()?.serverId()
        }).then(() => {
            invalidateVirtualFolders(user);
        }).catch(() => {
            /* pop up closed */
        });
    }, [ user, virtualFolder ]);

    const showDeleteLibraryDialog = useCallback(() => {
        setAnchorEl(null);
        setIsConfirmDeleteDialogOpen(true);
    }, []);

    const onCancelDeleteLibrary = useCallback(() => setIsConfirmDeleteDialogOpen(false), []);

    const onConfirmDeleteLibrary = useCallback(() => {
        if (virtualFolder.Name) {
            removeVirtualFolder.mutate({
                name: virtualFolder.Name,
                refreshLibrary: true
            }, {
                onSettled: () => setIsConfirmDeleteDialogOpen(false)
            });
        }
    }, [ virtualFolder, removeVirtualFolder ]);

    const openChangeType = useCallback(() => {
        setAnchorEl(null);
        setIsChangeTypeOpen(true);
    }, []);
    const closeChangeType = useCallback(() => setIsChangeTypeOpen(false), []);

    const toggleLocations = useCallback(() => setShowAllLocations(v => !v), []);

    return (
        <>
            <InputDialog
                title={globalize.translate('ButtonRename')}
                open={isRenameLibraryDialogOpen}
                onClose={hideRenameLibraryDialog}
                label={globalize.translate('LabelNewName')}
                helperText={globalize.translate('MessageRenameMediaFolder')}
                initialText={virtualFolder.Name || ''}
                confirmButtonText={globalize.translate('ButtonRename')}
                onConfirm={renameLibrary}
            />

            <LibraryManageDialog open={isManageOpen} virtualFolder={virtualFolder} onClose={closeManage} />
            <ChangeLibraryTypeDialog open={isChangeTypeOpen} virtualFolder={virtualFolder} onClose={closeChangeType} />

            <ConfirmDialog
                open={isConfirmDeleteDialogOpen}
                title={globalize.translate('HeaderRemoveMediaFolder')}
                text={
                    globalize.translate('MessageAreYouSureYouWishToRemoveMediaFolder') + '\n\n'
                    + globalize.translate('MessageTheFollowingLocationWillBeRemovedFromLibrary') + '\n\n'
                    + locations.join('\n')
                }
                confirmButtonText={globalize.translate('Delete')}
                confirmButtonColor='error'
                onConfirm={onConfirmDeleteLibrary}
                onCancel={onCancelDeleteLibrary}
            />

            <Paper elevation={0} sx={{
                position: 'relative', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
                borderRadius: '18px', border: `1px solid ${accent}2e`,
                boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 24px ${accent}12`,
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                '&:hover': { transform: 'translateY(-3px)', borderColor: `${accent}66`, boxShadow: `0 12px 40px rgba(0,0,0,0.45), 0 0 30px ${accent}26` }
            }}>
                {/* ── Banner ── */}
                <Box
                    onClick={showMediaLibraryEditor}
                    sx={{
                        position: 'relative', height: 150, cursor: 'pointer', flexShrink: 0,
                        background: imageUrl
                            ? `url("${imageUrl}") center / cover no-repeat`
                            : `radial-gradient(circle at 30% 20%, ${accent}55, transparent 60%), linear-gradient(135deg, ${accent}30, rgba(10,12,22,0.9))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    {!imageUrl && (
                        <Icon sx={{ fontSize: 64, color: `${accent}cc` }}>{getLibraryIcon(virtualFolder.CollectionType)}</Icon>
                    )}
                    <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,8,16,0.15) 30%, rgba(8,8,16,0.92) 100%)' }} />

                    <Chip
                        size='small'
                        icon={<Icon sx={{ fontSize: '0.95rem !important', color: `${accent} !important` }}>{getLibraryIcon(virtualFolder.CollectionType)}</Icon>}
                        label={typeName}
                        sx={{
                            position: 'absolute', top: 12, left: 12, height: 24, fontSize: '0.7rem', fontWeight: 600,
                            color: '#fff', background: 'rgba(8,10,22,0.7)', backdropFilter: 'blur(10px)', border: `1px solid ${accent}55`
                        }}
                    />
                    <IconButton
                        size='small'
                        onClick={(e) => { e.stopPropagation(); onActionClick(e); }}
                        sx={{
                            position: 'absolute', top: 8, right: 8, color: '#fff',
                            background: 'rgba(8,10,22,0.6)', backdropFilter: 'blur(10px)',
                            '&:hover': { background: `${accent}55` }
                        }}
                    >
                        <MoreVertIcon fontSize='small' />
                    </IconButton>

                    <Box sx={{ position: 'absolute', left: 16, right: 16, bottom: 12 }}>
                        <Typography noWrap sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
                            {virtualFolder.Name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                            {stats ? `${formatNumber(stats.ItemCount)} ${globalize.translate('Items').toLowerCase()}` : ' '}
                        </Typography>
                    </Box>
                </Box>

                {/* Accent line / scan progress */}
                {isScanning ? (
                    <Box>
                        <LinearProgress
                            variant={scanProgress ? 'determinate' : 'indeterminate'}
                            value={scanProgress ?? 0}
                            sx={{ height: 4, background: `${accent}22`, '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${accent}, #aa5cc3)` } }}
                        />
                        <Typography sx={{ px: 2, pt: 0.75, fontSize: '0.72rem', color: accent, fontWeight: 600 }}>
                            {globalize.translate('LibScanning')}
                            {scanProgress == null ? ` · ${globalize.translate('LibScanQueued')}` : ` ${Math.floor(scanProgress)}%`}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent} 40%, #aa5cc3 60%, transparent)` }} />
                )}

                <Box sx={{ p: 2, pt: 1.75, display: 'flex', flexDirection: 'column', gap: 1.75, flex: 1 }}>
                    {/* ── Main counters ── */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(mainStats.length, 1)}, minmax(0, 1fr))`, gap: 1 }}>
                        {isStatsPending && !stats ? (
                            [ 0, 1, 2 ].map(i => <Skeleton key={i} variant='rounded' height={58} sx={{ borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.05)' }} />)
                        ) : mainStats.map(stat => (
                            <Box key={stat.label} sx={{
                                p: 1.25, borderRadius: '12px', textAlign: 'center', minWidth: 0,
                                background: `${accent}10`, border: `1px solid ${accent}26`
                            }}>
                                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                                    {formatNumber(stat.value)}
                                </Typography>
                                <Typography noWrap sx={{ fontSize: '0.66rem', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
                                    {stat.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    {/* ── Details ── */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <InfoRow icon={<StorageIcon />} color={accent} label={globalize.translate('LibTotalSize')} value={stats ? formatSize(stats.TotalSize) : '—'} />
                        {(!stats || stats.TotalRunTimeTicks > 0) && (
                            <InfoRow icon={<ScheduleIcon />} color={accent} label={globalize.translate('LibTotalRuntime')} value={stats ? formatRuntime(stats.TotalRunTimeTicks) : '—'} />
                        )}
                        <InfoRow
                            icon={<HistoryIcon />}
                            color={accent}
                            label={globalize.translate('LibLastScan')}
                            value={stats ? formatRelative(stats.LastScanDate) : '—'}
                            tooltip={formatFullDate(stats?.LastScanDate)}
                        />
                        <InfoRow
                            icon={<NewReleasesIcon />}
                            color={accent}
                            label={globalize.translate('LibLastAdded')}
                            value={stats?.LastAddedName ? `${stats.LastAddedName} · ${formatRelative(stats.LastAddedDate)}` : '—'}
                            tooltip={stats?.LastAddedName ? `${stats.LastAddedName} — ${formatFullDate(stats.LastAddedDate)}` : undefined}
                        />
                    </Box>

                    {/* ── Locations ── */}
                    <Box>
                        <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', mb: 0.75 }}>
                            {globalize.translate('LibLocations')} ({locations.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {visibleLocations.map(path => (
                                <Box key={path} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                                    <FolderOpenIcon sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.35)' }} />
                                    <Tooltip title={path} placement='top'>
                                        <Typography noWrap sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', minWidth: 0 }}>
                                            {path}
                                        </Typography>
                                    </Tooltip>
                                </Box>
                            ))}
                            {locations.length > MAX_LOCATIONS && (
                                <Typography
                                    component='button'
                                    type='button'
                                    onClick={toggleLocations}
                                    sx={{ alignSelf: 'flex-start', p: 0, border: 0, background: 'none', cursor: 'pointer', fontSize: '0.72rem', color: accent }}
                                >
                                    {showAllLocations ? globalize.translate('LibShowLess') : `+${locations.length - MAX_LOCATIONS}`}
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    {/* ── Options ── */}
                    {optionChips.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {optionChips.map(chip => (
                                <Chip key={chip} size='small' label={chip} sx={{
                                    height: 22, fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)',
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)'
                                }} />
                            ))}
                        </Box>
                    )}

                    {/* ── Actions ── */}
                    <Box sx={{ display: 'flex', gap: 1, mt: 'auto', pt: 0.5 }}>
                        <Button
                            fullWidth
                            variant='outlined'
                            size='small'
                            startIcon={<SettingsIcon />}
                            onClick={showMediaLibraryEditor}
                            sx={{ borderRadius: '10px', borderColor: `${accent}66`, color: accent, '&:hover': { borderColor: accent, background: `${accent}14` } }}
                        >
                            {globalize.translate('LibManage')}
                        </Button>
                        <Button
                            fullWidth
                            variant='text'
                            size='small'
                            startIcon={<RefreshIcon />}
                            onClick={showRefreshDialog}
                            sx={{ borderRadius: '10px', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.04)', '&:hover': { background: 'rgba(255,255,255,0.09)' } }}
                        >
                            {globalize.translate('LibScan')}
                        </Button>
                    </Box>
                </Box>
            </Paper>

            <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={closeMenu}>
                <MenuItem onClick={showImageEditor}>
                    <ListItemIcon><ImageIcon /></ListItemIcon>
                    <ListItemText>{globalize.translate('EditImages')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={showMediaLibraryEditor}>
                    <ListItemIcon><Folder /></ListItemIcon>
                    <ListItemText>{globalize.translate('ManageLibrary')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={openRenameDialog}>
                    <ListItemIcon><EditIcon /></ListItemIcon>
                    <ListItemText>{globalize.translate('ButtonRename')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={openChangeType}>
                    <ListItemIcon><SwapHorizIcon /></ListItemIcon>
                    <ListItemText>{globalize.translate('LibChangeType')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={showRefreshDialog}>
                    <ListItemIcon><RefreshIcon /></ListItemIcon>
                    <ListItemText>{globalize.translate('ScanLibrary')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={showDeleteLibraryDialog} sx={{ color: '#ef5350' }}>
                    <ListItemIcon><DeleteIcon sx={{ color: '#ef5350' }} /></ListItemIcon>
                    <ListItemText>{globalize.translate('ButtonRemove')}</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
};

export default LibraryCard;
