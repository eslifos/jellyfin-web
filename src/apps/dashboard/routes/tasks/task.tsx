import React, { type FC, useCallback, useState } from 'react';
import { DayOfWeek } from '@jellyfin/sdk/lib/generated-client/models/day-of-week';
import type { TaskTriggerInfo } from '@jellyfin/sdk/lib/generated-client/models/task-trigger-info';
import { TaskTriggerInfoType } from '@jellyfin/sdk/lib/generated-client/models/task-trigger-info-type';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DateRangeIcon from '@mui/icons-material/DateRange';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import EventIcon from '@mui/icons-material/Event';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RepeatIcon from '@mui/icons-material/Repeat';
import TimerIcon from '@mui/icons-material/Timer';
import TodayIcon from '@mui/icons-material/Today';
import UpcomingIcon from '@mui/icons-material/Upcoming';
import { Link, useParams } from 'react-router-dom';

import { InfoTile } from 'apps/dashboard/features/playback/components/PlaybackCards';
import { useTask } from 'apps/dashboard/features/tasks/api/useTask';
import { useUpdateTask } from 'apps/dashboard/features/tasks/api/useUpdateTask';
import NewTriggerForm from 'apps/dashboard/features/tasks/components/NewTriggerForm';
import {
    IconBox, ResultBadge, RunButton, STATUS_COLORS, TaskProgressBar, categoryStyle, duration, isRunning, nextRun, nextRunOf, relativeTime
} from 'apps/dashboard/features/tasks/components/TaskCosmic';
import useLiveTasks from 'apps/dashboard/features/tasks/hooks/useLiveTasks';
import { getTriggerFriendlyName } from 'apps/dashboard/features/tasks/utils/edit';
import ConfirmDialog from 'components/ConfirmDialog';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useLocale } from 'hooks/useLocale';
import globalize from 'lib/globalize';

import { SectionCard } from '../../components/cosmic';

const HOUR_TICKS = 36e9;

const TRIGGER_STYLE: Record<string, { icon: React.ReactNode; color: string }> = {
    DailyTrigger: { icon: <TodayIcon />, color: '#00a4dc' },
    WeeklyTrigger: { icon: <DateRangeIcon />, color: '#aa5cc3' },
    IntervalTrigger: { icon: <RepeatIcon />, color: '#4caf50' },
    StartupTrigger: { icon: <PowerSettingsNewIcon />, color: '#ff9800' }
};

const PRESETS: { key: string; trigger: TaskTriggerInfo }[] = [
    { key: 'TskPresetDaily3', trigger: { Type: TaskTriggerInfoType.DailyTrigger, TimeOfDayTicks: 3 * HOUR_TICKS } },
    { key: 'TskPresetWeekly', trigger: { Type: TaskTriggerInfoType.WeeklyTrigger, DayOfWeek: DayOfWeek.Sunday, TimeOfDayTicks: 3 * HOUR_TICKS } },
    { key: 'TskPreset12h', trigger: { Type: TaskTriggerInfoType.IntervalTrigger, IntervalTicks: 12 * HOUR_TICKS } },
    { key: 'TskPresetStartup', trigger: { Type: TaskTriggerInfoType.StartupTrigger } }
];

const sameTrigger = (a: TaskTriggerInfo, b: TaskTriggerInfo) => (
    a.Type === b.Type && (a.TimeOfDayTicks || 0) === (b.TimeOfDayTicks || 0) && (a.IntervalTicks || 0) === (b.IntervalTicks || 0)
    && (a.Type !== 'WeeklyTrigger' || a.DayOfWeek === b.DayOfWeek)
);

const fullDate = (d?: string | null) => (d ? new Date(d).toLocaleString(globalize.getCurrentDateTimeLocale(), { dateStyle: 'medium', timeStyle: 'medium' }) : '—');

const Row: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.05)', '&:last-child': { borderBottom: 0 } }}>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{label}</Typography>
        <Box sx={{ ml: 'auto', fontSize: '0.84rem', color: 'rgba(255,255,255,0.88)', textAlign: 'right' }}>{children}</Box>
    </Box>
);

export const Component = () => {
    const { id: taskId } = useParams();
    const { dateFnsLocale } = useLocale();
    const updateTask = useUpdateTask();
    const { data: liveTasks } = useLiveTasks({ isHidden: false });
    const { data: fetched, isLoading } = useTask({ taskId: taskId || '' });
    const [ addOpen, setAddOpen ] = useState(false);
    const [ toDelete, setToDelete ] = useState<TaskTriggerInfo | null>(null);
    const [ showError, setShowError ] = useState(false);

    // Prefer the live (websocket) copy so progress updates in real time.
    const task = liveTasks?.find(t => t.Id === taskId) || fetched;

    const saveTriggers = useCallback((triggers: TaskTriggerInfo[]) => {
        if (task?.Id) updateTask.mutate({ taskId: task.Id, taskTriggerInfo: triggers });
    }, [ task?.Id, updateTask ]);

    const onAdd = useCallback((trigger: TaskTriggerInfo) => {
        saveTriggers([ ...(task?.Triggers || []), trigger ]);
        setAddOpen(false);
    }, [ saveTriggers, task?.Triggers ]);

    const confirmDelete = useCallback(() => {
        saveTriggers((task?.Triggers || []).filter(t => t !== toDelete));
        setToDelete(null);
    }, [ saveTriggers, task?.Triggers, toDelete ]);

    const openAdd = useCallback(() => setAddOpen(true), []);
    const closeAdd = useCallback(() => setAddOpen(false), []);
    const cancelDelete = useCallback(() => setToDelete(null), []);
    const toggleError = useCallback(() => setShowError(v => !v), []);

    if (isLoading || !task) return <Loading />;

    const { color, icon } = categoryStyle(task.Category);
    const running = isRunning(task);
    const last = task.LastExecutionResult;
    const status = last?.Status;
    const next = nextRun(task);
    const triggers = task.Triggers || [];
    const missingPresets = PRESETS.filter(p => !triggers.some(t => sameTrigger(t, p.trigger)));

    return (
        <Page id='scheduledTaskPage' title={task.Name || ''} className='mainAnimatedPage type-interior fullWidthContent'>
            <ConfirmDialog
                open={!!toDelete}
                title={globalize.translate('HeaderDeleteTaskTrigger')}
                text={globalize.translate('MessageDeleteTaskTrigger')}
                onCancel={cancelDelete}
                onConfirm={confirmDelete}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('ButtonRemove')}
            />
            <NewTriggerForm open={addOpen} title={globalize.translate('ButtonAddScheduledTaskTrigger')} onClose={closeAdd} onAdd={onAdd} />

            <Box className='content-primary' sx={{ pb: 6 }}>
                <Button component={Link} to='/dashboard/tasks' startIcon={<ArrowBackIcon />} size='small' sx={{ mb: 1.5, mt: 1 }}>
                    {globalize.translate('TabScheduledTasks')}
                </Button>

                <Paper elevation={0} sx={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', p: { xs: 2, md: 2.5 }, mb: 2.5 }}>
                    <Box sx={{ position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem', height: '2px', background: `linear-gradient(90deg, transparent, ${color}, #aa5cc3, transparent)` }} />
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <IconBox color={color} size={56}>{icon}</IconBox>
                        <Box sx={{ flex: 1, minWidth: 220 }}>
                            <Typography component='h1' sx={{
                                fontSize: { xs: '1.45rem', md: '1.85rem' }, fontWeight: 800, lineHeight: 1.2,
                                background: 'linear-gradient(135deg, #fff 20%, #00a4dc 60%, #aa5cc3 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                            }}>
                                {task.Name}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                                <ResultBadge task={task} />
                                <Typography sx={{ fontSize: '0.78rem', color }}>{task.Category}</Typography>
                            </Box>
                            {task.Description && <Typography sx={{ mt: 1.25, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, maxWidth: '90ch' }}>{task.Description}</Typography>}
                        </Box>
                        <RunButton task={task} size='medium' />
                    </Box>
                    {running && <Box sx={{ mt: 2 }}><TaskProgressBar task={task} color='#00a4dc' /></Box>}
                </Paper>

                {updateTask.isError && <Alert severity='error' sx={{ mb: 2 }}>{globalize.translate('TskSaveError')}</Alert>}

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, mb: 2.5 }}>
                    <InfoTile icon={<HistoryIcon />} label={globalize.translate('TskLastRun')} value={last?.EndTimeUtc ? relativeTime(last.EndTimeUtc) : globalize.translate('TskNeverRan')} color='#00a4dc' />
                    <InfoTile icon={<TimerIcon />} label={globalize.translate('TskDuration')} value={duration(last?.StartTimeUtc, last?.EndTimeUtc) || '—'} color='#aa5cc3' />
                    <InfoTile icon={<UpcomingIcon />} label={globalize.translate('TskNextRun')} value={next ? relativeTime(next) : '—'} color='#4caf50' secondary={next ? next.toLocaleString() : undefined} />
                    <InfoTile icon={<EventIcon />} label={globalize.translate('TskTriggers')} value={triggers.length} color='#ff9800' />
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 2 }}>
                    <SectionCard title={globalize.translate('TskSchedule')} icon={<EventIcon />} accentColor='#ff9800' description={globalize.translate('TskScheduleHelp')}>
                        <Stack spacing={1}>
                            {triggers.length === 0 && (
                                <Alert severity='info'>{globalize.translate('TskNoTriggers')}</Alert>
                            )}
                            {triggers.map((t, i) => {
                                const style = TRIGGER_STYLE[t.Type || ''] || TRIGGER_STYLE.DailyTrigger;
                                const tn = nextRunOf(t, last?.EndTimeUtc);
                                const limit = t.MaxRuntimeTicks ? t.MaxRuntimeTicks / HOUR_TICKS : 0;
                                return (
                                    <Box key={`${t.Type}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${style.color}33` }}>
                                        <IconBox color={style.color} size={36}>{style.icon}</IconBox>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600 }}>{getTriggerFriendlyName(t, dateFnsLocale)}</Typography>
                                            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                                                {tn ? `${globalize.translate('TskNext')}: ${relativeTime(tn)}` : globalize.translate('TskWhenServerStarts')}
                                                {limit ? ` · ${globalize.translate(limit === 1 ? 'ValueTimeLimitSingleHour' : 'ValueTimeLimitMultiHour', limit)}` : ''}
                                            </Typography>
                                        </Box>
                                        <Tooltip title={globalize.translate('ButtonRemove')}>
                                            <IconButton size='small' onClick={() => setToDelete(t)} disabled={updateTask.isPending} sx={{ color: '#ef5350' }}><DeleteIcon fontSize='small' /></IconButton>
                                        </Tooltip>
                                    </Box>
                                );
                            })}
                        </Stack>

                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', mb: 1 }}>{globalize.translate('TskQuickAdd')}</Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {missingPresets.map(p => (
                                    <Button key={p.key} size='small' variant='outlined' startIcon={TRIGGER_STYLE[p.trigger.Type || '']?.icon} onClick={() => onAdd(p.trigger)} disabled={updateTask.isPending}>
                                        {globalize.translate(p.key)}
                                    </Button>
                                ))}
                                <Button size='small' variant='contained' startIcon={<AddIcon />} onClick={openAdd}>{globalize.translate('TskCustom')}</Button>
                            </Box>
                        </Box>
                    </SectionCard>

                    <SectionCard title={globalize.translate('TskLastResult')} icon={<HourglassBottomIcon />} accentColor={status ? (STATUS_COLORS[status] || '#90a4ae') : '#90a4ae'}>
                        {last?.StartTimeUtc ? (
                            <Box>
                                <Row label={globalize.translate('LabelStatus')}><ResultBadge task={{ ...task, State: 'Idle' }} /></Row>
                                <Row label={globalize.translate('TskStarted')}>{fullDate(last.StartTimeUtc)}</Row>
                                <Row label={globalize.translate('TskEnded')}>{fullDate(last.EndTimeUtc)}</Row>
                                <Row label={globalize.translate('TskDuration')}>{duration(last.StartTimeUtc, last.EndTimeUtc) || '—'}</Row>
                                {last.ErrorMessage && (
                                    <Box sx={{ mt: 1.5 }}>
                                        <Alert severity='error' action={last.LongErrorMessage ? (
                                            <IconButton size='small' color='inherit' onClick={toggleError}>
                                                <ExpandMoreIcon sx={{ transform: showError ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                            </IconButton>
                                        ) : undefined}>
                                            {last.ErrorMessage}
                                        </Alert>
                                        <Collapse in={showError}>
                                            <Box component='pre' sx={{ mt: 1, p: 1.25, borderRadius: '10px', background: 'rgba(0,0,0,0.35)', fontSize: '0.72rem', color: '#ffab91', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto' }}>
                                                {last.LongErrorMessage}
                                            </Box>
                                        </Collapse>
                                    </Box>
                                )}
                                <Button component={Link} to='/dashboard/logs' size='small' startIcon={<DescriptionIcon />} sx={{ mt: 1.5 }}>{globalize.translate('TskSeeLogs')}</Button>
                            </Box>
                        ) : (
                            <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('TskNeverRanHelp')}</Typography>
                        )}
                    </SectionCard>
                </Box>
            </Box>
        </Page>
    );
};

Component.displayName = 'TaskPage';
