/**
 * Shared Cosmic Dark cards for the dashboard playback pages:
 * active streams, a scheduled task launcher and small info tiles.
 */
import React, { type FC, useCallback, useMemo } from 'react';
import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import { PlaystateCommand } from '@jellyfin/sdk/lib/generated-client/models/playstate-command';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

import { SectionCard } from 'apps/dashboard/components/cosmic';
import { StreamRow } from 'apps/dashboard/components/widgets/ResourceMonitorWidget';
import { useSendPlayStateCommand } from 'apps/dashboard/features/sessions/api/usePlayPauseSession';
import useLiveSessions from 'apps/dashboard/features/sessions/hooks/useLiveSessions';
import { useStartTask } from 'apps/dashboard/features/tasks/api/useStartTask';
import useLiveTasks from 'apps/dashboard/features/tasks/hooks/useLiveTasks';
import playmethodhelper from 'components/playback/playmethodhelper';
import globalize from 'lib/globalize';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';

/** Small stat tile used in the header row of the playback pages. */
export const InfoTile: FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; color: string; secondary?: React.ReactNode }> = ({ icon, label, value, color, secondary }) => (
    <Paper elevation={0} sx={{
        position: 'relative', overflow: 'hidden', p: 2, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0,
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
            <Typography noWrap component='div' sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>{value}</Typography>
            <Typography noWrap sx={{ fontSize: '0.66rem', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{label}</Typography>
            {secondary && (
                <Typography noWrap component='div' sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{secondary}</Typography>
            )}
        </Box>
    </Paper>
);

export const InfoGrid: FC<{ children: React.ReactNode }> = ({ children }) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2, mb: 2.5 }}>
        {children}
    </Box>
);

/** Two column layout used by the playback pages. */
export const TwoColumns: FC<{ children: React.ReactNode }> = ({ children }) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
        {children}
    </Box>
);

export const Column: FC<{ children: React.ReactNode }> = ({ children }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>{children}</Box>
);

const StreamWithStop: FC<{ session: SessionInfoDto }> = ({ session }) => {
    const sendCommand = useSendPlayStateCommand();
    const stop = useCallback(() => {
        if (session.Id) sendCommand.mutate({ sessionId: session.Id, command: PlaystateCommand.Stop });
    }, [ session.Id, sendCommand ]);

    return (
        <Box sx={{ position: 'relative' }}>
            <StreamRow session={session} />
            <Tooltip title={globalize.translate('PbStopPlayback')}>
                <IconButton
                    size='small'
                    onClick={stop}
                    disabled={sendCommand.isPending}
                    sx={{ position: 'absolute', bottom: 6, right: 6, color: '#ef5350', '&:hover': { background: 'rgba(239,83,80,0.12)' } }}
                >
                    <StopCircleIcon fontSize='small' />
                </IconButton>
            </Tooltip>
        </Box>
    );
};

interface ActiveStreamsCardProps {
    title: string;
    icon: React.ReactNode;
    accentColor: string;
    /** Only show sessions that are being transcoded. */
    transcodesOnly?: boolean;
    description?: string;
}

/** Live list of what is playing right now (updates through the websocket). */
export const ActiveStreamsCard: FC<ActiveStreamsCardProps> = ({ title, icon, accentColor, transcodesOnly, description }) => {
    const { data: sessions } = useLiveSessions();

    const streams = useMemo(() => (sessions || []).filter(s => {
        if (!s.NowPlayingItem) return false;
        if (!transcodesOnly) return true;
        return playmethodhelper.getDisplayPlayMethod(s) === 'Transcode';
    }), [ sessions, transcodesOnly ]);

    return (
        <SectionCard title={`${title} (${streams.length})`} icon={icon} accentColor={accentColor} description={description}>
            {streams.length === 0 ? (
                <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', textAlign: 'center', py: 2 }}>
                    {globalize.translate(transcodesOnly ? 'PbNoTranscodes' : 'ResourceNoStreams')}
                </Typography>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {streams.map(s => <StreamWithStop key={s.Id} session={s} />)}
                </Box>
            )}
        </SectionCard>
    );
};

interface TaskCardProps {
    taskKey: string;
    title: string;
    icon: React.ReactNode;
    accentColor: string;
    description?: string;
    children?: React.ReactNode;
}

/** Shows a scheduled task with its last run and a button to run it now. */
export const TaskCard: FC<TaskCardProps> = ({ taskKey, title, icon, accentColor, description, children }) => {
    const { data: tasks } = useLiveTasks({ isHidden: false });
    const startTask = useStartTask();
    const task = tasks?.find(t => t.Key === taskKey);
    const isRunning = !!task && task.State !== TaskState.Idle;

    const run = useCallback(() => {
        if (task?.Id) startTask.mutate({ taskId: task.Id });
    }, [ task, startTask ]);

    const lastRun = task?.LastExecutionResult?.EndTimeUtc
        ? formatDistanceToNow(new Date(task.LastExecutionResult.EndTimeUtc), getLocaleWithSuffix())
        : globalize.translate('Never');
    const lastStatus = task?.LastExecutionResult?.Status;

    return (
        <SectionCard title={title} icon={icon} accentColor={accentColor} description={description}>
            {children}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{task?.Name || taskKey}</Typography>
                    <Typography noWrap sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.45)' }}>
                        {globalize.translate('PbLastRun')}: {lastRun}
                        {lastStatus && lastStatus !== 'Completed' ? ` · ${lastStatus}` : ''}
                    </Typography>
                    {isRunning && (
                        <LinearProgress
                            variant={task?.CurrentProgressPercentage != null ? 'determinate' : 'indeterminate'}
                            value={task?.CurrentProgressPercentage ?? 0}
                            sx={{ mt: 1, height: 4, borderRadius: 2, background: `${accentColor}22`, '& .MuiLinearProgress-bar': { background: accentColor } }}
                        />
                    )}
                </Box>
                <Button
                    variant='outlined'
                    size='small'
                    startIcon={<PlayArrowIcon />}
                    onClick={run}
                    disabled={!task || isRunning}
                    sx={{ borderRadius: '10px', borderColor: `${accentColor}66`, color: accentColor, whiteSpace: 'nowrap' }}
                >
                    {isRunning ? `${Math.round(task?.CurrentProgressPercentage ?? 0)}%` : globalize.translate('PbRunNow')}
                </Button>
            </Box>
        </SectionCard>
    );
};

/** Centered save button used by all the playback pages. */
export const SaveBar: FC<{ isSubmitting: boolean; disabled?: boolean }> = ({ isSubmitting, disabled }) => (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
            type='submit'
            variant='contained'
            size='large'
            disabled={isSubmitting || disabled}
            startIcon={isSubmitting ? <CircularProgress size={16} color='inherit' /> : <SaveIcon />}
            sx={{ px: 8, py: 1.4, fontWeight: 600 }}
        >
            {globalize.translate('Save')}
        </Button>
    </Box>
);
