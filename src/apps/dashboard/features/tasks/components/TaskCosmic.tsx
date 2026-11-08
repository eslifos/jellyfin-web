/**
 * Cosmic building blocks for the scheduled tasks pages.
 */
import React, { type FC, useCallback } from 'react';
import type { TaskInfo } from '@jellyfin/sdk/lib/generated-client/models/task-info';
import type { TaskTriggerInfo } from '@jellyfin/sdk/lib/generated-client/models/task-trigger-info';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import AppsIcon from '@mui/icons-material/Apps';
import BuildIcon from '@mui/icons-material/Build';
import ExtensionIcon from '@mui/icons-material/Extension';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StopIcon from '@mui/icons-material/Stop';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';
import formatDistance from 'date-fns/formatDistance';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import { useNavigate } from 'react-router-dom';

import { Badge } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import globalize from 'lib/globalize';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';

import { useStartTask } from '../api/useStartTask';
import { useStopTask } from '../api/useStopTask';

const TICKS_PER_MS = 1e4;
const DAY_MS = 24 * 3600 * 1000;
const DAYS = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ];

/* ---------- helpers ---------- */

export const isRunning = (t?: TaskInfo) => !!t && t.State !== TaskState.Idle;

export const relativeTime = (d?: string | number | Date | null) => (d ? formatDistanceToNow(new Date(d), getLocaleWithSuffix()) : '');

export const duration = (start?: string | null, end?: string | null) => {
    if (!start || !end) return '';
    const ms = Date.parse(end) - Date.parse(start);
    if (ms < 1000) return '< 1 s';
    if (ms < 60000) return `${Math.round(ms / 1000)} s`;
    return formatDistance(0, ms, { locale: getLocaleWithSuffix().locale });
};

/** Next time a trigger fires, or undefined for startup triggers. */
export const nextRunOf = (trigger: TaskTriggerInfo, lastEnd?: string | null, now = new Date()) => {
    const timeMs = (trigger.TimeOfDayTicks || 0) / TICKS_PER_MS;
    switch (trigger.Type) {
        case 'DailyTrigger': {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            d.setTime(d.getTime() + timeMs);
            if (d <= now) d.setTime(d.getTime() + DAY_MS);
            return d;
        }
        case 'WeeklyTrigger': {
            const target = DAYS.indexOf(trigger.DayOfWeek || 'Sunday');
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            d.setTime(d.getTime() + timeMs);
            let add = (target - d.getDay() + 7) % 7;
            if (add === 0 && d <= now) add = 7;
            d.setDate(d.getDate() + add);
            return d;
        }
        case 'IntervalTrigger': {
            const interval = (trigger.IntervalTicks || 0) / TICKS_PER_MS;
            if (!interval) return undefined;
            const base = lastEnd ? Date.parse(lastEnd) : now.getTime();
            let next = base + interval;
            while (next <= now.getTime()) next += interval;
            return new Date(next);
        }
        default:
            return undefined;
    }
};

export const nextRun = (task: TaskInfo) => {
    const dates = (task.Triggers || [])
        .map(t => nextRunOf(t, task.LastExecutionResult?.EndTimeUtc))
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime());
    return dates[0];
};

export const STATUS_COLORS: Record<string, string> = { Completed: '#4caf50', Failed: '#ef5350', Cancelled: '#ffca28', Aborted: '#ff7043' };
const STATUS_KEYS: Record<string, string> = { Completed: 'TskCompleted', Failed: 'LabelFailed', Cancelled: 'LabelCancelled', Aborted: 'LabelAbortedByServerShutdown' };

export const ResultBadge: FC<{ task: TaskInfo }> = ({ task }) => {
    if (isRunning(task)) {
        return <Badge label={globalize.translate(task.State === TaskState.Cancelling ? 'LabelStopping' : 'TskRunning')} color='#00a4dc' dot />;
    }
    const status = task.LastExecutionResult?.Status;
    if (!status) return <Badge label={globalize.translate('TskNeverRan')} color='#90a4ae' />;
    return <Badge label={globalize.translate(STATUS_KEYS[status] || status)} color={STATUS_COLORS[status] || '#90a4ae'} dot />;
};

const PALETTE = [ '#00a4dc', '#aa5cc3', '#4caf50', '#ff9800', '#26c6da', '#ef5350', '#ffca28', '#7e57c2' ];

/** Icon and color for a task category (names come localized from the server). */
export const categoryStyle = (category?: string | null) => {
    const c = (category || '').toLowerCase();
    if (/bibliot|library/.test(c)) return { color: '#00a4dc', icon: <LibraryBooksIcon /> };
    if (/mant|maint/.test(c)) return { color: '#ff9800', icon: <BuildIcon /> };
    if (/tv/.test(c)) return { color: '#ef5350', icon: <LiveTvIcon /> };
    if (/aplic|applic|app/.test(c)) return { color: '#aa5cc3', icon: <AppsIcon /> };
    if (/trick/.test(c)) return { color: '#26c6da', icon: <ViewCarouselIcon /> };
    if (/subt/.test(c)) return { color: '#66bb6a', icon: <SubtitlesIcon /> };
    if (/plug|compl|extens/.test(c)) return { color: '#ffca28', icon: <ExtensionIcon /> };
    let h = 0;
    for (const ch of c) h = ((h * 31) + ch.charCodeAt(0)) >>> 0;
    return { color: PALETTE[h % PALETTE.length], icon: <ScheduleIcon /> };
};

export const IconBox: FC<{ color: string; children: React.ReactNode; size?: number }> = ({ color, children, size = 42 }) => (
    <Box sx={{
        width: size, height: size, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1f`, border: `1px solid ${color}44`, '& svg': { color, fontSize: size * 0.5 }
    }}>
        {children}
    </Box>
);

export const TaskProgressBar: FC<{ task: TaskInfo; color: string }> = ({ task, color }) => {
    const pct = task.CurrentProgressPercentage;
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
                variant={pct != null ? 'determinate' : 'indeterminate'}
                value={pct ?? 0}
                sx={{ flex: 1, height: 6, borderRadius: 3, background: `${color}22`, '& .MuiLinearProgress-bar': { background: color, borderRadius: 3 } }}
            />
            {pct != null && <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color, minWidth: 38, textAlign: 'right' }}>{Math.round(pct)}%</Typography>}
        </Box>
    );
};

/** Run / stop button for a task. */
export const RunButton: FC<{ task: TaskInfo; size?: 'small' | 'medium' }> = ({ task, size = 'small' }) => {
    const start = useStartTask();
    const stop = useStopTask();
    const running = isRunning(task);

    const onClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!task.Id) return;
        if (running) stop.mutate({ taskId: task.Id });
        else start.mutate({ taskId: task.Id });
    }, [ running, start, stop, task.Id ]);

    return (
        <Button
            size={size}
            variant={running ? 'outlined' : 'contained'}
            color={running ? 'error' : 'primary'}
            onClick={onClick}
            disabled={start.isPending || stop.isPending || task.State === TaskState.Cancelling}
            startIcon={running ? <StopIcon /> : <PlayArrowIcon />}
            sx={{ whiteSpace: 'nowrap', borderRadius: '10px' }}
        >
            {globalize.translate(running ? 'TskStop' : 'TskRun')}
        </Button>
    );
};

export const TaskTile: FC<{ task: TaskInfo }> = ({ task }) => {
    const navigate = useNavigate();
    const { color, icon } = categoryStyle(task.Category);
    const running = isRunning(task);
    const status = task.LastExecutionResult?.Status;
    const failed = !running && status === 'Failed';
    const accent = (failed && '#ef5350') || (running && '#00a4dc') || color;
    const next = nextRun(task);
    const open = useCallback(() => navigate(`/dashboard/tasks/${task.Id}`), [ navigate, task.Id ]);
    const last = task.LastExecutionResult;

    return (
        <Paper elevation={0} onClick={open} sx={{
            position: 'relative', overflow: 'hidden', p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.25, cursor: 'pointer', borderRadius: '16px',
            border: `1px solid ${accent}${running || failed ? '77' : '33'}`, boxShadow: running ? `0 0 22px ${accent}30` : '0 8px 28px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s, border-color 0.2s', '&:hover': { transform: 'translateY(-2px)', borderColor: `${accent}99` }
        }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1.25rem', right: '1.25rem', height: '2px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <IconBox color={color}>{icon}</IconBox>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem', lineHeight: 1.3 }}>{task.Name}</Typography>
                    <Box sx={{ mt: 0.5 }}><ResultBadge task={task} /></Box>
                </Box>
            </Box>
            {task.Description && (
                <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {task.Description}
                </Typography>
            )}
            {running && <TaskProgressBar task={task} color='#00a4dc' />}
            <Box sx={{ mt: 'auto', pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
                        {last?.EndTimeUtc ? `${globalize.translate('TskLast')}: ${relativeTime(last.EndTimeUtc)} · ${duration(last.StartTimeUtc, last.EndTimeUtc)}` : globalize.translate('TskNeverRan')}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.72rem', color: next ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)' }}>
                        {next ? `${globalize.translate('TskNext')}: ${relativeTime(next)}` : globalize.translate(task.Triggers?.length ? 'TskOnStartupOnly' : 'TskManualOnly')}
                    </Typography>
                </Box>
                <RunButton task={task} />
            </Box>
        </Paper>
    );
};
