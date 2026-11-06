import React, { useCallback, useMemo, useState } from 'react';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Add from '@mui/icons-material/Add';
import AlbumIcon from '@mui/icons-material/Album';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import MovieIcon from '@mui/icons-material/Movie';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StorageIcon from '@mui/icons-material/Storage';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';

import { invalidateVirtualFolders } from 'apps/dashboard/features/libraries/api/invalidateVirtualFolders';
import { QUERY_KEY as STATS_QUERY_KEY, refreshLibraryStats, useLibraryStats } from 'apps/dashboard/features/libraries/api/useLibraryStats';
import { useVirtualFolders } from 'apps/dashboard/features/libraries/api/useVirtualFolders';
import LibraryCard from 'apps/dashboard/features/libraries/components/LibraryCard';
import getCollectionTypeOptions from 'apps/dashboard/features/libraries/utils/collectionTypeOptions';
import { formatNumber, formatRelative, formatRuntime, formatSize } from 'apps/dashboard/features/libraries/utils/libraryUi';
import { useStartTask } from 'apps/dashboard/features/tasks/api/useStartTask';
import useLiveTasks from 'apps/dashboard/features/tasks/hooks/useLiveTasks';
import Loading from 'components/loading/LoadingComponent';
import MediaLibraryCreator from 'components/mediaLibraryCreator/mediaLibraryCreator';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader } from '../../components/cosmic';

const SummaryTile = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) => (
    <Paper elevation={0} sx={{
        position: 'relative', overflow: 'hidden', p: 2, display: 'flex', alignItems: 'center', gap: 1.5,
        borderRadius: '16px', border: `1px solid ${color}2e`, boxShadow: `0 8px 28px rgba(0,0,0,0.3), 0 0 18px ${color}10`
    }}>
        <Box sx={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <Box sx={{
            width: 42, height: 42, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${color}1f`, border: `1px solid ${color}40`, color, '& svg': { fontSize: '1.3rem' }
        }}>
            {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{value}</Typography>
            <Typography noWrap sx={{ fontSize: '0.68rem', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{label}</Typography>
        </Box>
    </Paper>
);

export const Component = () => {
    const { api, user } = useApi();
    const startTask = useStartTask();
    const { data: tasks, isPending: isLiveTasksPending } = useLiveTasks({ isHidden: false });

    const librariesTask = useMemo(() => (
        tasks?.find((value) => value.Key === 'RefreshLibrary')
    ), [ tasks ]);
    const isScanRunning = !!librariesTask && librariesTask.State !== TaskState.Idle;

    const { data: virtualFolders, isPending: isVirtualFoldersPending, isError: isVirtualFoldersError } = useVirtualFolders(isScanRunning ? 3000 : false);
    const { data: stats, isPending: isStatsPending, dataUpdatedAt } = useLibraryStats();
    const [ isRefreshingStats, setIsRefreshingStats ] = useState(false);

    const statsById = useMemo(() => new Map((stats || []).map(s => [ s.ItemId.replace(/-/g, ''), s ])), [ stats ]);

    const totals = useMemo(() => {
        const t = { items: 0, size: 0, runtime: 0, movies: 0, series: 0, episodes: 0, songs: 0, albums: 0 };
        for (const s of stats || []) {
            t.items += s.ItemCount;
            t.size += s.TotalSize;
            t.runtime += s.TotalRunTimeTicks;
            t.movies += s.MovieCount;
            t.series += s.SeriesCount;
            t.episodes += s.EpisodeCount;
            t.songs += s.SongCount;
            t.albums += s.AlbumCount;
        }
        return t;
    }, [ stats ]);

    const showMediaLibraryCreator = useCallback(() => {
        const mediaLibraryCreator = new MediaLibraryCreator({
            collectionTypeOptions: getCollectionTypeOptions(),
            refresh: true
        }) as Promise<boolean>;

        void mediaLibraryCreator.then((hasChanges: boolean) => {
            if (hasChanges) invalidateVirtualFolders(user);
        });
    }, [ user ]);

    const onScanLibraries = useCallback(() => {
        if (librariesTask?.Id) {
            startTask.mutate({
                taskId: librariesTask.Id
            });
        }
    }, [ startTask, librariesTask ]);

    const onRefreshStats = useCallback(() => {
        if (!api) return;
        setIsRefreshingStats(true);
        refreshLibraryStats(api)
            .then(data => queryClient.setQueryData([ STATS_QUERY_KEY ], data))
            .catch(err => console.error('[Libraries] failed to refresh stats', err))
            .finally(() => setIsRefreshingStats(false));
    }, [ api ]);

    if (isVirtualFoldersPending || isLiveTasksPending) return <Loading />;

    const libraryCount = virtualFolders?.length || 0;

    const summaryTiles = [
        { icon: <VideoLibraryIcon />, label: globalize.translate('HeaderLibraries'), value: formatNumber(libraryCount), color: '#00a4dc' },
        { icon: <AutorenewIcon />, label: globalize.translate('LibTotalItems'), value: stats ? formatNumber(totals.items) : '—', color: '#aa5cc3' },
        { icon: <StorageIcon />, label: globalize.translate('LibTotalSize'), value: stats ? formatSize(totals.size) : '—', color: '#26c6da' },
        { icon: <ScheduleIcon />, label: globalize.translate('LibTotalRuntime'), value: stats ? formatRuntime(totals.runtime) : '—', color: '#ff9800' },
        ...(totals.movies ? [ { icon: <MovieIcon />, label: globalize.translate('Movies'), value: formatNumber(totals.movies), color: '#00a4dc' } ] : []),
        ...(totals.series ? [ { icon: <LiveTvIcon />, label: `${globalize.translate('Series')} · ${globalize.translate('Episodes')}`, value: `${formatNumber(totals.series)} · ${formatNumber(totals.episodes)}`, color: '#aa5cc3' } ] : []),
        ...(totals.songs ? [ { icon: <AlbumIcon />, label: `${globalize.translate('Albums')} · ${globalize.translate('Songs')}`, value: `${formatNumber(totals.albums)} · ${formatNumber(totals.songs)}`, color: '#4caf50' } ] : [])
    ];

    return (
        <Page
            id='mediaLibraryPage'
            title={globalize.translate('HeaderLibraries')}
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('HeaderLibraries')}
                    subtitle={globalize.translate('LibLibrariesCount', libraryCount)}
                    actions={(
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                            <Button variant='contained' startIcon={<Add />} onClick={showMediaLibraryCreator} sx={{ borderRadius: '12px', fontWeight: 600 }}>
                                {globalize.translate('ButtonAddMediaLibrary')}
                            </Button>
                            <Button
                                variant='outlined'
                                startIcon={<RefreshIcon />}
                                onClick={onScanLibraries}
                                loading={isScanRunning}
                                loadingPosition='start'
                                sx={{ borderRadius: '12px', fontWeight: 600 }}
                            >
                                {globalize.translate('ButtonScanAllLibraries')}
                            </Button>
                        </Box>
                    )}
                />

                {isVirtualFoldersError ? (
                    <Alert severity='error'>{globalize.translate('LibrariesLoadError')}</Alert>
                ) : (
                    <>
                        {/* ── Scan progress ── */}
                        {librariesTask && librariesTask.State === TaskState.Running && (
                            <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: '16px', border: '1px solid rgba(0,164,220,0.3)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#00a4dc' }}>{globalize.translate('LibScanning')}</Typography>
                                    <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                                        {librariesTask.CurrentProgressPercentage != null ? `${Math.round(librariesTask.CurrentProgressPercentage)}%` : ''}
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant={librariesTask.CurrentProgressPercentage != null ? 'determinate' : 'indeterminate'}
                                    value={librariesTask.CurrentProgressPercentage ?? 0}
                                    sx={{ height: 6, borderRadius: 3, background: 'rgba(0,164,220,0.15)', '& .MuiLinearProgress-bar': { borderRadius: 3, background: 'linear-gradient(90deg, #00a4dc, #aa5cc3)' } }}
                                />
                            </Paper>
                        )}

                        {/* ── Summary ── */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 2, mb: 1.5 }}>
                            {summaryTiles.map(tile => <SummaryTile key={tile.label} {...tile} />)}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mb: 2.5 }}>
                            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                                {dataUpdatedAt ? globalize.translate('LibStatsUpdated', formatRelative(new Date(dataUpdatedAt).toISOString())) : ''}
                            </Typography>
                            <Tooltip title={globalize.translate('LibRefreshStats')}>
                                <span>
                                    <IconButton size='small' onClick={onRefreshStats} disabled={isRefreshingStats} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                        <RefreshIcon fontSize='small' sx={isRefreshingStats ? { animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } } : undefined} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>

                        {/* ── Libraries ── */}
                        {libraryCount === 0 ? (
                            <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: '18px' }}>
                                <VideoLibraryIcon sx={{ fontSize: 56, color: 'rgba(0,164,220,0.6)', mb: 1 }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>{globalize.translate('LibNoLibraries')}</Typography>
                                <Button variant='contained' startIcon={<Add />} onClick={showMediaLibraryCreator}>
                                    {globalize.translate('ButtonAddMediaLibrary')}
                                </Button>
                            </Paper>
                        ) : (
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 2.5, alignItems: 'stretch' }}>
                                {virtualFolders?.map(virtualFolder => (
                                    <LibraryCard
                                        key={virtualFolder.ItemId}
                                        virtualFolder={virtualFolder}
                                        stats={virtualFolder.ItemId ? statsById.get(virtualFolder.ItemId.replace(/-/g, '')) : undefined}
                                        isStatsPending={isStatsPending}
                                    />
                                ))}
                            </Box>
                        )}
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'LibrariesPage';
