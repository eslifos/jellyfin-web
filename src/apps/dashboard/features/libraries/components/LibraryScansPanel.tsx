/**
 * Live view of the library work (dashboard home, libraries page and the floating indicator):
 * each scan with its progress and the files being worked on, running tasks, and a live log of the
 * latest steps (reading folders, checking items, metadata, images, ffprobe, trickplay...).
 */
import React, { type FC, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import SyncIcon from '@mui/icons-material/Sync';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { getScheduledTaskApi } from '@jellyfin/sdk/lib/utils/api/scheduled-task-api';

import { useApi } from 'hooks/useApi';

import globalize from 'lib/globalize';

import { type LibraryScan, useLibraryScans } from '../api/useLibraryScans';
import {
    activityLabelKey,
    KIND_COLORS,
    type LibraryActivity,
    type LibraryActivityItem,
    normId,
    type RunningTask,
    useLibraryActivity
} from '../api/useLibraryActivity';
import { getLibraryAccent } from '../utils/libraryUi';
import { TEXT_TERTIARY } from 'themes/cosmic/textColors';

/** A turning icon while something is busy. Give it the class BUSY_SPIN: it keeps turning when motion is reduced. */
export const spinSx = { animation: 'jfScanSpin 1.4s linear infinite', '@keyframes jfScanSpin': { to: { transform: 'rotate(360deg)' } } } as const;
export const BUSY_SPIN = 'jf-busy-spin';

/** Rows shown per library, so a busy scan does not fill the screen. */
const ROWS_PER_LIBRARY = 4;

const mutedSx = { fontSize: '0.7rem', color: TEXT_TERTIARY } as const;

const progressSx = (accent: string) => ({
    height: 6, borderRadius: 3, background: `${accent}22`,
    '& .MuiLinearProgress-bar': { borderRadius: 3, background: `linear-gradient(90deg, ${accent}, #aa5cc3)` }
});

/**
 * Stops the scan of one library (or a running task). What was already read stays; scanning again
 * carries on with the rest.
 */
const StopButton: FC<{ libraryId?: string | null, taskId?: string | null }> = ({ libraryId, taskId }) => {
    const { api } = useApi();
    const [ busy, setBusy ] = useState(false);

    const stop = useCallback(() => {
        if (!api) return;
        setBusy(true);
        const request = taskId ?
            getScheduledTaskApi(api).stopTask({ taskId }) :
            api.axiosInstance.post(`${api.basePath}/Library/Activity/${libraryId}/Stop`, null, {
                headers: { Authorization: api.authorizationHeader }
            });
        request
            .catch(console.error)
            .finally(() => window.setTimeout(() => setBusy(false), 4000));
    }, [ api, libraryId, taskId ]);

    if (!api || (!libraryId && !taskId)) return null;

    return (
        <Tooltip title={globalize.translate(taskId ? 'LibScanStopTask' : 'LibScanStop')}>
            <span>
                <IconButton aria-label={globalize.translate(taskId ? 'LibScanStopTask' : 'LibScanStop')} size='small' onClick={stop} disabled={busy} sx={{ p: 0.25, color: '#ff6b6b', '&:hover': { background: 'rgba(255,107,107,0.12)' } }}>
                    <StopCircleIcon sx={{ fontSize: '1.15rem' }} />
                </IconButton>
            </span>
        </Tooltip>
    );
};

export const ScanRow: FC<{ scan: LibraryScan }> = ({ scan }) => {
    const accent = getLibraryAccent(scan.collectionType ?? undefined);
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{scan.name}</Typography>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: accent }}>
                    {scan.progress == null ? globalize.translate('LibScanQueued') : `${Math.floor(scan.progress)}%`}
                </Typography>
                <StopButton libraryId={scan.id} />
            </Box>
            <LinearProgress
                variant={scan.progress == null || scan.progress === 0 ? 'indeterminate' : 'determinate'}
                value={scan.progress ?? 0}
                sx={progressSx(accent)}
            />
        </Box>
    );
};

const TaskRow: FC<{ task: RunningTask }> = ({ task }) => (
    <Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
            <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{task.Name}</Typography>
            {task.Progress != null && (
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#4caf50' }}>{`${Math.floor(task.Progress)}%`}</Typography>
            )}
            <StopButton taskId={task.Id} />
        </Box>
        <LinearProgress
            variant={task.Progress ? 'determinate' : 'indeterminate'}
            value={task.Progress ?? 0}
            sx={progressSx('#4caf50')}
        />
    </Box>
);

const KindLabel: FC<{ item: LibraryActivityItem }> = ({ item }) => (
    <Typography component='span' sx={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: KIND_COLORS[item.Kind] ?? '#00a4dc' }}>
        {globalize.translate(activityLabelKey(item.Kind))}
    </Typography>
);

/** One file being worked on: kind of work + title + file name, with a small spinner. */
export const ActivityRow: FC<{ item: LibraryActivityItem }> = ({ item }) => {
    const showFile = !!item.File && item.File !== item.Title;
    return (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
            <SyncIcon className={BUSY_SPIN} sx={{ fontSize: '0.9rem', mt: '2px', color: KIND_COLORS[item.Kind] ?? '#00a4dc', ...spinSx }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <KindLabel item={item} />
                <Typography noWrap title={item.Title ?? undefined} sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3 }}>{item.Title}</Typography>
                {showFile && (
                    <Typography noWrap title={item.File ?? undefined} sx={{ ...mutedSx, fontFamily: 'monospace', lineHeight: 1.3 }}>
                        {item.File}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

const ActivityList: FC<{ items: LibraryActivityItem[] }> = ({ items }) => {
    if (!items.length) return null;
    const extra = items.length - ROWS_PER_LIBRARY;
    return (
        <Box sx={{ display: 'grid', gap: 0.9, mt: 1, pl: 1.25, borderLeft: '2px solid rgba(255,255,255,0.08)' }}>
            {items.slice(0, ROWS_PER_LIBRARY).map(a => <ActivityRow key={`${a.ItemId ?? a.Title}-${a.Kind}`} item={a} />)}
            {extra > 0 && <Typography sx={mutedSx}>{globalize.translate('LibActMore', extra)}</Typography>}
        </Box>
    );
};

// Read when drawn: the language can change after the page was loaded
const clockTime = (date: Date) => date.toLocaleTimeString(globalize.getCurrentDateTimeLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Latest steps, newest first, like a log: time, kind of work, title and library. */
export const LiveLog: FC<{ log: LibraryActivityItem[], max?: number }> = ({ log, max = 15 }) => {
    if (!log.length) return null;
    return (
        <Box sx={{ mt: 1.75 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', mb: 0.75 }}>
                {globalize.translate('LibActLog')}
            </Typography>
            <Box sx={{ display: 'grid', gap: 0.35, p: 1, borderRadius: '10px', background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.06)', maxHeight: 260, overflowY: 'auto' }}>
                {log.slice(0, max).map((l, i) => (
                    <Box key={`${l.StartedUtc}-${l.ItemId ?? l.Title}-${l.Kind}`} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', minWidth: 0, opacity: 1 - (i / (max * 1.6)) }}>
                        <Typography component='span' sx={{ ...mutedSx, fontFamily: 'monospace', flexShrink: 0 }}>{clockTime(new Date(l.StartedUtc))}</Typography>
                        <Box sx={{ flexShrink: 0, minWidth: 108 }}><KindLabel item={l} /></Box>
                        <Typography component='span' noWrap title={l.File ?? l.Title ?? undefined} sx={{ fontSize: '0.75rem', flex: 1, minWidth: 0 }}>
                            {l.Title}
                            {l.LibraryName && <Box component='span' sx={{ ...mutedSx, ml: 0.75 }}>{`· ${l.LibraryName}`}</Box>}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

/**
 * Scans with their progress and the files each one is working on, libraries that are only refreshing
 * items (new files found, manual refreshes), post-scan work, running tasks and the live log.
 */
export const ScanActivityList: FC<{ scans: LibraryScan[], activity: LibraryActivity, logRows?: number }> = ({ scans, activity, logRows }) => {
    const scanIds = new Set(scans.map(s => normId(s.id)));
    const others = new Map<string, LibraryActivityItem[]>();
    const general: LibraryActivityItem[] = [];
    for (const a of activity.current) {
        if (!a.LibraryId) {
            general.push(a);
            continue;
        }
        const id = normId(a.LibraryId);
        if (!scanIds.has(id)) others.set(id, [ ...(others.get(id) ?? []), a ]);
    }

    return (
        <Box>
            <Box sx={{ display: 'grid', gap: 1.75 }}>
                {scans.map(s => (
                    <Box key={s.id}>
                        <ScanRow scan={s} />
                        <ActivityList items={activity.current.filter(a => normId(a.LibraryId) === normId(s.id))} />
                    </Box>
                ))}
                {[ ...others.values() ].map(items => (
                    <Box key={items[0].LibraryId}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{items[0].LibraryName}</Typography>
                            <StopButton libraryId={items[0].LibraryId} />
                        </Box>
                        <ActivityList items={items} />
                    </Box>
                ))}
                {general.length > 0 && <ActivityList items={general} />}
                {activity.tasks.map(t => <TaskRow key={t.Key ?? t.Name} task={t} />)}
            </Box>
            <LiveLog log={activity.log} max={logRows} />
        </Box>
    );
};

const LibraryScansPanel: FC = () => {
    const scans = useLibraryScans();
    const activity = useLibraryActivity(scans.length > 0);
    if (!scans.length && !activity.current.length && !activity.tasks.length) return null;

    return (
        <Paper elevation={0} sx={{ position: 'relative', overflow: 'hidden', p: 2, borderRadius: '16px', border: '1px solid rgba(0,164,220,0.3)', boxShadow: '0 0 22px rgba(0,164,220,0.12)' }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '2px', background: 'linear-gradient(90deg, transparent, #00a4dc, #aa5cc3, transparent)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <SyncIcon className={BUSY_SPIN} sx={{ color: '#00a4dc', ...spinSx }} />
                <Typography sx={{ fontWeight: 800 }}>{globalize.translate(scans.length ? 'LibScansTitle' : 'LibActTitle')}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', ml: 'auto' }}>{globalize.translate('LibScansHelp')}</Typography>
            </Box>
            <ScanActivityList scans={scans} activity={activity} />
        </Paper>
    );
};

export default LibraryScansPanel;
