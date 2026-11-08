import React, { useMemo, useState } from 'react';
import type { TaskInfo } from '@jellyfin/sdk/lib/generated-client/models/task-info';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ErrorIcon from '@mui/icons-material/Error';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SearchIcon from '@mui/icons-material/Search';
import UpcomingIcon from '@mui/icons-material/Upcoming';
import { useNavigate } from 'react-router-dom';

import { StatTile } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import {
    IconBox, RunButton, TaskProgressBar, TaskTile, categoryStyle, isRunning, nextRun, relativeTime
} from 'apps/dashboard/features/tasks/components/TaskCosmic';
import useLiveTasks from 'apps/dashboard/features/tasks/hooks/useLiveTasks';
import { getCategories, getTasksByCategory } from 'apps/dashboard/features/tasks/utils/tasks';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import globalize from 'lib/globalize';

import { PageHeader, SectionCard } from '../../components/cosmic';

type Filter = 'all' | 'running' | 'failed' | 'manual';
const SOON_MS = 24 * 3600 * 1000;

const RunningRow = ({ task }: { task: TaskInfo }) => {
    const navigate = useNavigate();
    const { color, icon } = categoryStyle(task.Category);
    return (
        <Box onClick={() => navigate(`/dashboard/tasks/${task.Id}`)} sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px', cursor: 'pointer',
            background: 'rgba(0,164,220,0.06)', border: '1px solid rgba(0,164,220,0.25)'
        }}>
            <IconBox color={color} size={36}>{icon}</IconBox>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.88rem', fontWeight: 600 }}>{task.Name}</Typography>
                <TaskProgressBar task={task} color='#00a4dc' />
            </Box>
            <RunButton task={task} />
        </Box>
    );
};

export const Component = () => {
    const { data: tasks, isPending } = useLiveTasks({ isHidden: false });
    const [ query, setQuery ] = useState('');
    const [ filter, setFilter ] = useState<Filter>('all');
    const [ category, setCategory ] = useState('');

    const all = useMemo(() => tasks || [], [ tasks ]);
    const categories = useMemo(() => getCategories(all), [ all ]);

    const stats = useMemo(() => {
        const now = Date.now();
        return {
            total: all.length,
            running: all.filter(isRunning).length,
            failed: all.filter(t => !isRunning(t) && t.LastExecutionResult?.Status === 'Failed').length,
            manual: all.filter(t => !t.Triggers?.length).length,
            soon: all.filter(t => {
                const n = nextRun(t);
                return n && n.getTime() - now < SOON_MS;
            }).length
        };
    }, [ all ]);

    const running = useMemo(() => all.filter(isRunning), [ all ]);

    /** Next few scheduled runs across all tasks. */
    const upcoming = useMemo(() => all
        .map(t => ({ task: t, at: nextRun(t) }))
        .filter((x): x is { task: TaskInfo; at: Date } => !!x.at)
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .slice(0, 6), [ all ]);

    const matches = (t: TaskInfo) => {
        const q = query.toLowerCase();
        if (q && !`${t.Name} ${t.Description}`.toLowerCase().includes(q)) return false;
        if (filter === 'running') return isRunning(t);
        if (filter === 'failed') return !isRunning(t) && t.LastExecutionResult?.Status === 'Failed';
        if (filter === 'manual') return !t.Triggers?.length;
        return true;
    };

    if (isPending) return <Loading />;

    const toggle = (f: Filter) => setFilter(cur => (cur === f ? 'all' : f));
    const shownCategories = (category ? [ category ] : categories)
        .map(c => ({ name: c, items: getTasksByCategory(all, c).filter(matches) }))
        .filter(g => g.items.length);

    return (
        <Page id='scheduledTasksPage' title={globalize.translate('TabScheduledTasks')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={globalize.translate('TabScheduledTasks')} subtitle={globalize.translate('TskSubtitle')} />

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5, mb: 2.5 }}>
                    <StatTile icon={<ScheduleIcon />} label={globalize.translate('TskTotal')} value={stats.total} color='#00a4dc' active={filter === 'all'} onClick={() => setFilter('all')} />
                    <StatTile icon={<PlayCircleIcon />} label={globalize.translate('TskRunning')} value={stats.running} color='#26c6da' active={filter === 'running'} onClick={() => toggle('running')} />
                    <StatTile icon={<ErrorIcon />} label={globalize.translate('TskFailedLast')} value={stats.failed} color='#ef5350' active={filter === 'failed'} onClick={() => toggle('failed')} />
                    <StatTile icon={<UpcomingIcon />} label={globalize.translate('TskNext24h')} value={stats.soon} color='#4caf50' />
                    <StatTile icon={<EventBusyIcon />} label={globalize.translate('TskManualOnly')} value={stats.manual} color='#90a4ae' active={filter === 'manual'} onClick={() => toggle('manual')} />
                </Box>

                {(running.length > 0 || upcoming.length > 0) && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mb: 1 }}>
                        <SectionCard title={globalize.translate('TskRunningNow')} icon={<PlayCircleIcon />} accentColor='#00a4dc'>
                            {running.length ? (
                                <Stack spacing={1}>{running.map(t => <RunningRow key={t.Id} task={t} />)}</Stack>
                            ) : (
                                <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('TskNothingRunning')}</Typography>
                            )}
                        </SectionCard>
                        <SectionCard title={globalize.translate('TskUpcoming')} icon={<UpcomingIcon />} accentColor='#4caf50'>
                            <Stack spacing={0.75}>
                                {upcoming.map(({ task, at }) => {
                                    const { color } = categoryStyle(task.Category);
                                    return (
                                        <Box key={task.Id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.5 }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
                                            <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: '0.84rem' }}>{task.Name}</Typography>
                                            <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.55)', flexShrink: 0 }} title={at.toLocaleString()}>
                                                {relativeTime(at)}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </SectionCard>
                    </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
                    <TextField size='small' placeholder={globalize.translate('TskSearch')} value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 240px' }}
                        slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment> } }} />
                    <TextField select size='small' label={globalize.translate('PlgCategory')} value={category} onChange={e => setCategory(e.target.value)} sx={{ minWidth: 200 }}
                        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                        <MenuItem value=''>{globalize.translate('All')}</MenuItem>
                        {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                </Box>

                {shownCategories.length === 0 ? (
                    <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: '16px' }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.55)' }}>{globalize.translate('TskNoMatch')}</Typography>
                    </Paper>
                ) : shownCategories.map(g => {
                    const { color } = categoryStyle(g.name);
                    return (
                        <Box key={g.name} sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color }}>
                                    {g.name} · {g.items.length}
                                </Typography>
                                <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${color}66, transparent)` }} />
                            </Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 2 }}>
                                {g.items.map(t => <TaskTile key={t.Id} task={t} />)}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Page>
    );
};

Component.displayName = 'TasksPage';
