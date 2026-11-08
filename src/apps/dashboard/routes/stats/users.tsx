import React, { type FC, useMemo, useState } from 'react';
import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import GroupIcon from '@mui/icons-material/Group';
import HomeIcon from '@mui/icons-material/Home';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import TimerIcon from '@mui/icons-material/Timer';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useNavigate } from 'react-router-dom';

import { Badge, StatTile, toggleSx } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import useLiveSessions from 'apps/dashboard/features/sessions/hooks/useLiveSessions';
import { KIND_COLORS, type UserStats, formatDuration, isLocalAddress, useUserStats } from 'apps/dashboard/features/stats/api/playbackStats';
import { relativeTime } from 'apps/dashboard/features/tasks/components/TaskCosmic';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import UserAvatar from 'components/UserAvatar';
import { useApi } from 'hooks/useApi';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';

import { PageHeader } from '../../components/cosmic';

type Sort = 'seen' | 'time' | 'plays' | 'recent' | 'name';
const DAY_MS = 24 * 3600 * 1000;

interface Row {
    user: UserDto;
    stats?: UserStats;
    session?: SessionInfoDto;
    lastSeen?: number;
}

/** Tiny 30 day bar chart. */
const Sparkline: FC<{ values: number[] }> = ({ values }) => {
    const max = Math.max(1, ...values);
    return (
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 34 }} aria-hidden>
            {values.map((v, i) => (
                <Box key={i} sx={{ flex: 1, height: v > 0 ? `${Math.max(8, (v / max) * 100)}%` : '2px', borderRadius: '2px 2px 0 0', background: v > 0 ? KIND_COLORS.episode : 'rgba(255,255,255,0.08)' }} />
            ))}
        </Box>
    );
};

const Stat: FC<{ value: string; label: string }> = ({ value, label }) => (
    <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{value}</Typography>
        <Typography noWrap sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>{label}</Typography>
    </Box>
);

const UserCard: FC<{ row: Row; share: number }> = ({ row, share }) => {
    const { api } = useApi();
    const navigate = useNavigate();
    const { user, stats, session } = row;
    const now = session?.NowPlayingItem;
    const last = stats?.LastPlay;
    const watching = !!now;
    const accent = watching ? '#4caf50' : '#00a4dc';

    // What to show in the media box: what is playing now, or the last recorded play.
    const media = now ? {
        id: now.Type === 'Episode' && now.SeriesId ? now.SeriesId : now.Id,
        title: now.SeriesName || now.Name,
        sub: now.Type === 'Episode' ? `S${now.ParentIndexNumber ?? 0} · E${now.IndexNumber ?? 0} · ${now.Name}` : (now.ProductionYear ? String(now.ProductionYear) : ''),
        device: `${session?.Client ?? ''} · ${session?.DeviceName ?? ''}`
    } : last ? {
        id: last.ItemType === 'Episode' && last.SeriesId ? last.SeriesId : last.ItemId,
        title: last.SeriesName || last.ItemName,
        sub: last.ItemType === 'Episode' ? `S${last.ParentIndexNumber ?? 0} · E${last.IndexNumber ?? 0} · ${last.ItemName}` : (last.ProductionYear ? String(last.ProductionYear) : ''),
        device: `${last.Client ?? ''} · ${last.DeviceName ?? ''}`
    } : null;
    const img = media?.id && api ? getImageApi(api).getItemImageUrlById(media.id, ImageType.Primary, { maxHeight: 96 }) : undefined;
    const address = session?.RemoteEndPoint || last?.RemoteAddress;
    const local = isLocalAddress(address);

    return (
        <Paper elevation={0} onClick={() => navigate(`/dashboard/history?userId=${user.Id}`)} sx={{
            position: 'relative', overflow: 'hidden', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, cursor: 'pointer', borderRadius: '18px',
            border: `1px solid ${accent}${watching ? '88' : '33'}`, boxShadow: watching ? `0 0 26px ${accent}33` : '0 8px 28px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s, border-color 0.2s', '&:hover': { transform: 'translateY(-2px)', borderColor: `${accent}aa` }
        }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1.25rem', right: '1.25rem', height: '2px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ position: 'relative' }}>
                    <UserAvatar user={user} size={44} />
                    {watching && <Box sx={{ position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: '50%', background: '#4caf50', border: '2px solid #0b0f1e' }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>{user.Name}</Typography>
                    <Typography noWrap sx={{ fontSize: '0.74rem', color: watching ? '#4caf50' : 'rgba(255,255,255,0.55)' }}>
                        {watching ? `● ${globalize.translate('PvuWatchingNow')}` : row.lastSeen ? globalize.translate('PvuLastSeen', relativeTime(row.lastSeen)) : globalize.translate('PvuNeverSeen')}
                        {stats?.FirstPlayUtc ? ` · ${globalize.translate('PvuSince', new Date(stats.FirstPlayUtc).toLocaleDateString(globalize.getCurrentDateTimeLocale(), { month: 'short', year: 'numeric' }))}` : ''}
                    </Typography>
                </Box>
                <Tooltip title={globalize.translate('PvuShareHelp')}>
                    <span><Badge label={`${share}%`} color='#aa5cc3' /></span>
                </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.25, p: 1, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', minHeight: 70, alignItems: 'center' }}>
                {media ? (
                    <>
                        <Box component='img' src={img} alt='' loading='lazy' sx={{ width: 36, height: 54, objectFit: 'cover', borderRadius: '6px', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }} />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.64rem', letterSpacing: '1px', textTransform: 'uppercase', color: watching ? '#4caf50' : 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
                                {globalize.translate(watching ? 'PvuNowPlaying' : 'PvuLastPlayed')}
                            </Typography>
                            <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff' }}>{media.title}</Typography>
                            {media.sub && <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>{media.sub}</Typography>}
                            <Typography noWrap sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)' }}>{media.device}</Typography>
                        </Box>
                    </>
                ) : (
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', px: 0.5 }}>{globalize.translate('PvuNothingYet')}</Typography>
                )}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                <Stat value={String(stats?.Plays ?? 0)} label={globalize.translate('StsPlays')} />
                <Stat value={formatDuration(stats?.WatchedSeconds ?? 0)} label={globalize.translate('PvuWatched')} />
                <Stat value={stats?.WatchedSeconds30 ? formatDuration(stats.WatchedSeconds30) : '—'} label={globalize.translate('PvuLast30')} />
            </Box>

            <Tooltip title={globalize.translate('PvuSparkHelp')}>
                <Box><Sparkline values={stats?.Daily30 || new Array(30).fill(0)} /></Box>
            </Tooltip>
            <Box sx={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', mt: -0.5 }}>
                <Box sx={{ width: `${share}%`, height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #ff9800, #ef5350)' }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'rgba(255,255,255,0.5)', '& svg': { fontSize: '0.95rem' } }}>
                {address ? (local ? <HomeIcon /> : <PublicIcon />) : null}
                <Typography noWrap sx={{ fontSize: '0.72rem' }}>
                    {address ? `${globalize.translate(local ? 'PvuLocal' : 'PvuRemote')} · ${address}` : globalize.translate('PvuNoAddress')}
                    {stats?.TopClient ? ` · ${globalize.translate('PvuUsesMost', stats.TopClient)}` : ''}
                </Typography>
            </Box>
        </Paper>
    );
};

export const Component = () => {
    const { data: users, isPending: usersPending } = useUsers();
    const { data: stats, isPending: statsPending } = useUserStats();
    const { data: sessions } = useLiveSessions();
    const [ sort, setSort ] = useState<Sort>('seen');
    const [ query, setQuery ] = useState('');

    const rows = useMemo<Row[]>(() => (users || []).map(user => {
        const s = stats?.find(x => x.UserId.replace(/-/g, '') === (user.Id || '').replace(/-/g, ''));
        const session = (sessions || []).find(x => x.UserId === user.Id && x.NowPlayingItem);
        const seen = [ user.LastActivityDate, s?.LastPlayUtc ].filter(Boolean).map(d => Date.parse(d as string));
        return { user, stats: s, session, lastSeen: seen.length ? Math.max(...seen) : undefined };
    }), [ sessions, stats, users ]);

    const totalSeconds = useMemo(() => rows.reduce((t, r) => t + (r.stats?.WatchedSeconds ?? 0), 0), [ rows ]);

    const visible = useMemo(() => {
        const q = query.toLowerCase();
        return rows
            .filter(r => !q || (r.user.Name || '').toLowerCase().includes(q))
            .sort((a, b) => {
                if (!!b.session !== !!a.session) return b.session ? 1 : -1;
                switch (sort) {
                    case 'time': return (b.stats?.WatchedSeconds ?? 0) - (a.stats?.WatchedSeconds ?? 0);
                    case 'plays': return (b.stats?.Plays ?? 0) - (a.stats?.Plays ?? 0);
                    case 'recent': return (b.stats?.WatchedSeconds30 ?? 0) - (a.stats?.WatchedSeconds30 ?? 0);
                    case 'name': return (a.user.Name || '').localeCompare(b.user.Name || '');
                    default: return (b.lastSeen ?? 0) - (a.lastSeen ?? 0);
                }
            });
    }, [ query, rows, sort ]);

    if (usersPending || statsPending) return <Loading />;

    const activeMonth = rows.filter(r => (r.stats?.Plays30 ?? 0) > 0).length;
    const watchingNow = rows.filter(r => r.session).length;
    const seenToday = rows.filter(r => r.lastSeen && Date.now() - r.lastSeen < DAY_MS).length;

    return (
        <Page id='userStatsPage' title={globalize.translate('PvuTitle')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary'>
                <PageHeader title={globalize.translate('PvuTitle')} subtitle={globalize.translate('PvuSubtitle')} />

                {stats === null && <Alert severity='info' sx={{ mb: 2 }}>{globalize.translate('StsServerOld')}</Alert>}

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1.5, mb: 2.5 }}>
                    <StatTile icon={<GroupIcon />} label={globalize.translate('PvuPeople')} value={rows.length} color='#00a4dc' />
                    <StatTile icon={<TrendingUpIcon />} label={globalize.translate('PvuActiveMonth')} value={activeMonth} color='#26c6da' />
                    <StatTile icon={<PlayCircleIcon />} label={globalize.translate('PvuWatchingNowTile')} value={watchingNow} color='#4caf50' />
                    <StatTile icon={<GroupIcon />} label={globalize.translate('PvuSeenToday')} value={seenToday} color='#aa5cc3' />
                    <StatTile icon={<TimerIcon />} label={globalize.translate('PvuTotalWatched')} value={formatDuration(totalSeconds)} color='#ff9800' />
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2.5 }}>
                    <TextField size='small' placeholder={globalize.translate('PvuSearch')} value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 220px' }}
                        slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment> } }} />
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('PvuSort')}</Typography>
                    <ToggleButtonGroup size='small' exclusive value={sort} onChange={(_, v: Sort | null) => v && setSort(v)} sx={toggleSx}>
                        <ToggleButton value='seen'>{globalize.translate('PvuSortSeen')}</ToggleButton>
                        <ToggleButton value='time'>{globalize.translate('PvuSortTime')}</ToggleButton>
                        <ToggleButton value='plays'>{globalize.translate('StsPlays')}</ToggleButton>
                        <ToggleButton value='recent'>{globalize.translate('PvuLast30')}</ToggleButton>
                        <ToggleButton value='name'>{globalize.translate('Name')}</ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 2 }}>
                    {visible.map(r => (
                        <UserCard key={r.user.Id} row={r} share={totalSeconds ? Math.round(((r.stats?.WatchedSeconds ?? 0) / totalSeconds) * 100) : 0} />
                    ))}
                </Box>
            </Box>
        </Page>
    );
};

Component.displayName = 'UserStatsPage';
