import React, { type FC, useMemo, useState } from 'react';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import DevicesIcon from '@mui/icons-material/Devices';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupIcon from '@mui/icons-material/Group';
import HistoryIcon from '@mui/icons-material/History';
import MemoryIcon from '@mui/icons-material/Memory';
import MovieIcon from '@mui/icons-material/Movie';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TimerIcon from '@mui/icons-material/Timer';
import TvIcon from '@mui/icons-material/Tv';
import { Link } from 'react-router-dom';

import { toggleSx } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import { KIND_COLORS, type StatsRank, type StatsTotals, formatDuration, useStatsOverview } from 'apps/dashboard/features/stats/api/playbackStats';
import BarChart, { type BarDatum } from 'apps/dashboard/features/stats/components/BarChart';
import { relativeTime } from 'apps/dashboard/features/tasks/components/TaskCosmic';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { PageHeader, SectionCard } from '../../components/cosmic';

const RANGES = [ 7, 30, 90, 365 ];
const RANGE_KEY = 'dashboardStatsRange';
const locale = () => globalize.getCurrentDateTimeLocale();

const readRange = () => {
    try {
        const v = parseInt(localStorage.getItem(RANGE_KEY) || '', 10);
        return RANGES.includes(v) ? v : 30;
    } catch {
        return 30;
    }
};

/** Short axis format for seconds: 12h, 30m. */
const axisDuration = (s: number) => (s >= 3600 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 60)}m`);

/** Percent change vs the previous period, or null when there is nothing to compare. */
const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

const Delta: FC<{ value: number | null }> = ({ value }) => {
    if (value === null) return null;
    const up = value >= 0;
    return (
        <Typography component='span' sx={{ fontSize: '0.72rem', fontWeight: 700, color: up ? '#4caf50' : '#ef5350', ml: 0.75 }}>
            {up ? '▲' : '▼'} {Math.abs(value)}%
        </Typography>
    );
};

const KpiTile: FC<{ icon: React.ReactNode; color: string; value: string; label: string; change?: number | null }> = ({ icon, color, value, label, change }) => (
    <Paper elevation={0} sx={{ position: 'relative', overflow: 'hidden', p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: '16px' }}>
        <Box sx={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <Box sx={{
            width: 42, height: 42, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: `${color}1f`, border: `1px solid ${color}44`, '& svg': { color, fontSize: '1.3rem' }
        }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>
                {value}<Delta value={change ?? null} />
            </Typography>
            <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>{label}</Typography>
        </Box>
    </Paper>
);

const RankList: FC<{ rows: StatsRank[]; kind: 'user' | 'series' | 'movie' | 'plain'; emptyKey: string }> = ({ rows, kind, emptyKey }) => {
    const { api } = useApi();
    const max = Math.max(1, ...rows.map(r => r.WatchedSeconds));
    if (!rows.length) return <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate(emptyKey)}</Typography>;

    return (
        <Stack spacing={1}>
            {rows.map((r, i) => {
                const img = (kind === 'series' || kind === 'movie') && r.Id && api
                    ? getImageApi(api).getItemImageUrlById(r.Id, ImageType.Primary, { maxHeight: 90 })
                    : undefined;
                const link = (kind === 'series' || kind === 'movie') && r.Id ? `/details?id=${r.Id}` : (kind === 'user' && r.Id ? `/dashboard/users/${r.Id}/profile` : undefined);
                const content = (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', '&:hover': link ? { borderColor: 'rgba(0,164,220,0.4)' } : undefined }}>
                        <Typography sx={{ width: 18, textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: i < 3 ? '#ffca28' : 'rgba(255,255,255,0.4)' }}>{i + 1}</Typography>
                        {img && <Box component='img' src={img} alt='' loading='lazy' sx={{ width: 30, height: 45, objectFit: 'cover', borderRadius: '6px', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }} />}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 600, color: '#fff' }}>{r.Name || '—'}</Typography>
                            <Typography noWrap sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                                {formatDuration(r.WatchedSeconds)} · {globalize.translate('StsPlaysN', r.Plays)}
                                {kind !== 'user' && kind !== 'plain' && r.Users > 1 ? ` · ${globalize.translate('StsUsersN', r.Users)}` : ''}
                                {r.LastPlayedUtc && kind === 'user' ? ` · ${relativeTime(r.LastPlayedUtc)}` : ''}
                            </Typography>
                            <Box sx={{ mt: 0.5, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                                <Box sx={{ width: `${(r.WatchedSeconds / max) * 100}%`, height: '100%', borderRadius: 2, background: '#3987e5' }} />
                            </Box>
                        </Box>
                    </Box>
                );
                return link ? <Box key={`${r.Id}-${r.Name}`} component={Link} to={link} sx={{ textDecoration: 'none', color: 'inherit' }}>{content}</Box> : <Box key={`${r.Name}-${i}`}>{content}</Box>;
            })}
        </Stack>
    );
};

export const Component = () => {
    const [ days, setDays ] = useState(readRange);
    const { data, isPending, isError } = useStatsOverview(days);
    const [ showTable, setShowTable ] = useState(false);

    const onRange = (_: unknown, v: number | null) => {
        if (!v) return;
        setDays(v);
        try {
            localStorage.setItem(RANGE_KEY, String(v));
        } catch {
            // storage blocked
        }
    };

    const dailyData = useMemo<BarDatum[]>(() => {
        if (!data) return [];
        const n = data.Daily.length;
        const every = Math.ceil(n / 8);
        return data.Daily.map((d, i) => {
            const date = new Date(`${d.Date}T12:00:00`);
            return {
                id: d.Date,
                label: i % every === 0 || i === n - 1 ? (i === n - 1 ? globalize.translate('StsToday') : date.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })) : '',
                title: `${date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })} · ${globalize.translate('StsPlaysN', d.Plays)}`,
                segments: [
                    { key: 'e', label: globalize.translate('StsEpisodes'), value: d.EpisodeSeconds, color: KIND_COLORS.episode },
                    { key: 'm', label: globalize.translate('StsMovies'), value: d.MovieSeconds, color: KIND_COLORS.movie },
                    { key: 'o', label: globalize.translate('StsOther'), value: d.OtherSeconds, color: KIND_COLORS.other }
                ]
            };
        });
    }, [ data ]);

    const hourData = useMemo<BarDatum[]>(() => (data?.PlaysByHour || []).map((v, h) => {
        const d = new Date(2000, 0, 1, h);
        const label = d.toLocaleTimeString(locale(), { hour: 'numeric' });
        return {
            id: `h${h}`,
            label: h % 3 === 0 ? label : '',
            title: `${label} – ${new Date(2000, 0, 1, (h + 1) % 24).toLocaleTimeString(locale(), { hour: 'numeric' })}`,
            segments: [ { key: 'p', label: globalize.translate('StsPlaysStarted'), value: v, color: KIND_COLORS.episode } ]
        };
    }), [ data ]);

    const weekdayData = useMemo<BarDatum[]>(() => (data?.SecondsByWeekday || []).map((v, i) => {
        const d = new Date(2024, 0, 1 + i); // 2024-01-01 is a Monday
        return {
            id: `w${i}`,
            label: d.toLocaleDateString(locale(), { weekday: 'short' }),
            title: d.toLocaleDateString(locale(), { weekday: 'long' }),
            segments: [ { key: 's', label: globalize.translate('StsWatchTime'), value: v, color: KIND_COLORS.episode } ]
        };
    }), [ data ]);

    if (isPending) return <Loading />;

    const cur: StatsTotals | undefined = data?.Current;
    const prev: StatsTotals | undefined = data?.Previous;
    const busiestHour = data ? data.PlaysByHour.indexOf(Math.max(...data.PlaysByHour)) : -1;
    const busiestDay = data ? data.SecondsByWeekday.indexOf(Math.max(...data.SecondsByWeekday)) : -1;
    const hasData = !!cur && cur.Plays > 0;

    return (
        <Page id='statsPage' title={globalize.translate('StsTitle')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary'>
                <PageHeader
                    title={globalize.translate('StsTitle')}
                    subtitle={globalize.translate('StsSubtitle')}
                    actions={(
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                            <ToggleButtonGroup size='small' exclusive value={days} onChange={onRange} sx={toggleSx}>
                                {RANGES.map(r => <ToggleButton key={r} value={r}>{globalize.translate(r === 365 ? 'StsOneYear' : 'StsNDays', r)}</ToggleButton>)}
                            </ToggleButtonGroup>
                            <Button size='small' variant='outlined' component={Link} to='/dashboard/history' startIcon={<HistoryIcon />}>{globalize.translate('HisTitle')}</Button>
                        </Box>
                    )}
                />

                {data === null ? (
                    <Alert severity='info'>{globalize.translate('StsServerOld')}</Alert>
                ) : isError || !data || !cur || !prev ? (
                    <Alert severity='error'>{globalize.translate('StsLoadError')}</Alert>
                ) : (
                    <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5, mb: 1 }}>
                            <KpiTile icon={<PlayArrowIcon />} color='#00a4dc' value={String(cur.Plays)} label={globalize.translate('StsPlaysPerDay', (cur.Plays / days).toFixed(1))} change={delta(cur.Plays, prev.Plays)} />
                            <KpiTile icon={<TimerIcon />} color='#aa5cc3' value={formatDuration(cur.WatchedSeconds)} label={globalize.translate('StsWatchPerDay', formatDuration(cur.WatchedSeconds / days))} change={delta(cur.WatchedSeconds, prev.WatchedSeconds)} />
                            <KpiTile icon={<GroupIcon />} color='#26c6da' value={String(cur.ActiveUsers)} label={globalize.translate('StsActiveUsers')} change={delta(cur.ActiveUsers, prev.ActiveUsers)} />
                            <KpiTile icon={<ScheduleIcon />} color='#ffca28' value={formatDuration(cur.AverageSessionSeconds)} label={globalize.translate('StsAvgSession')} />
                            <KpiTile icon={<DoneAllIcon />} color='#4caf50' value={`${cur.CompletedPercent}%`} label={globalize.translate('StsFinished')} />
                            <KpiTile icon={<MemoryIcon />} color='#ff7043' value={`${cur.TranscodePercent}%`} label={globalize.translate('StsTranscoded')} />
                        </Box>
                        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', mb: 2.5 }}>{globalize.translate('StsCompareNote', days)}</Typography>

                        {!hasData && <Alert severity='info' sx={{ mb: 2.5 }}>{globalize.translate('StsNoData')}</Alert>}

                        <SectionCard title={globalize.translate('StsWatchPerDayTitle')} icon={<ShowChartIcon />} accentColor='#3987e5'>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1, mb: 1 }}>
                                <Button size='small' onClick={() => setShowTable(v => !v)}>{globalize.translate(showTable ? 'StsShowChart' : 'StsShowTable')}</Button>
                            </Box>
                            {showTable ? (
                                <Box component='table' sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', '& th, & td': { textAlign: 'left', py: 0.5, px: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }, '& th': { color: 'rgba(255,255,255,0.55)', fontWeight: 600 } }}>
                                    <thead><tr><th>{globalize.translate('StsDate')}</th><th>{globalize.translate('StsEpisodes')}</th><th>{globalize.translate('StsMovies')}</th><th>{globalize.translate('StsOther')}</th><th>{globalize.translate('StsPlays')}</th></tr></thead>
                                    <tbody>
                                        {[ ...data.Daily ].reverse().filter(d => d.Plays > 0).map(d => (
                                            <tr key={d.Date}><td>{d.Date}</td><td>{formatDuration(d.EpisodeSeconds)}</td><td>{formatDuration(d.MovieSeconds)}</td><td>{formatDuration(d.OtherSeconds)}</td><td>{d.Plays}</td></tr>
                                        ))}
                                    </tbody>
                                </Box>
                            ) : (
                                <BarChart
                                    data={dailyData}
                                    height={220}
                                    formatValue={axisDuration}
                                    ariaLabel={globalize.translate('StsWatchPerDayTitle')}
                                    legend={[
                                        { key: 'e', label: globalize.translate('StsEpisodes'), color: KIND_COLORS.episode },
                                        { key: 'm', label: globalize.translate('StsMovies'), color: KIND_COLORS.movie },
                                        { key: 'o', label: globalize.translate('StsOther'), color: KIND_COLORS.other }
                                    ]}
                                />
                            )}
                        </SectionCard>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                            <SectionCard title={globalize.translate('StsTimeOfDay')} icon={<AccessTimeIcon />} accentColor='#3987e5' description={globalize.translate('StsTimeOfDayHelp')}>
                                <BarChart data={hourData} height={160} formatValue={v => String(Math.round(v))} ariaLabel={globalize.translate('StsTimeOfDay')} />
                                {hasData && busiestHour >= 0 && (
                                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', mt: 1 }}>
                                        {globalize.translate('StsBusiest')}: <b>{hourData[busiestHour]?.title}</b>
                                    </Typography>
                                )}
                            </SectionCard>
                            <SectionCard title={globalize.translate('StsDayOfWeek')} icon={<CalendarViewWeekIcon />} accentColor='#3987e5' description={globalize.translate('StsDayOfWeekHelp')}>
                                <BarChart data={weekdayData} height={160} formatValue={axisDuration} ariaLabel={globalize.translate('StsDayOfWeek')} />
                                {hasData && busiestDay >= 0 && (
                                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', mt: 1 }}>
                                        {globalize.translate('StsBusiest')}: <b>{weekdayData[busiestDay]?.title}</b>
                                    </Typography>
                                )}
                            </SectionCard>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}>
                            <SectionCard title={globalize.translate('StsTopUsers')} icon={<EmojiEventsIcon />} accentColor='#ffca28'>
                                <RankList rows={data.TopUsers} kind='user' emptyKey='StsEmpty' />
                            </SectionCard>
                            <SectionCard title={globalize.translate('StsTopSeries')} icon={<TvIcon />} accentColor='#3987e5'>
                                <RankList rows={data.TopSeries} kind='series' emptyKey='StsEmpty' />
                            </SectionCard>
                            <SectionCard title={globalize.translate('StsTopMovies')} icon={<MovieIcon />} accentColor='#d95926'>
                                <RankList rows={data.TopMovies} kind='movie' emptyKey='StsEmpty' />
                            </SectionCard>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                            <SectionCard title={globalize.translate('StsClients')} icon={<DevicesIcon />} accentColor='#26c6da'>
                                <RankList rows={data.TopClients} kind='plain' emptyKey='StsEmpty' />
                            </SectionCard>
                            <SectionCard title={globalize.translate('StsPlayMethods')} icon={<MemoryIcon />} accentColor='#ff7043' description={globalize.translate('StsPlayMethodsHelp')}>
                                <RankList rows={data.PlayMethods.map(m => ({ ...m, Name: globalize.translate(`StsMethod_${m.Name}`) }))} kind='plain' emptyKey='StsEmpty' />
                            </SectionCard>
                        </Box>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'StatsPage';
