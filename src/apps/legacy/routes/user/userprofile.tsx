/**
 * User profile — photo, greeting and the user's own watch statistics
 * (totals, streaks, 30-day activity, habits, top titles, recent plays),
 * plus the password form. Stats come from the custom /PlaybackStats/Me endpoint;
 * admins can open any user's profile and see that user's stats.
 */
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { useQuery } from '@tanstack/react-query';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client';
import React, { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BarChartIcon from '@mui/icons-material/BarChart';
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DevicesIcon from '@mui/icons-material/Devices';
import HistoryIcon from '@mui/icons-material/History';
import LockIcon from '@mui/icons-material/Lock';
import MovieIcon from '@mui/icons-material/Movie';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PieChartIcon from '@mui/icons-material/PieChart';
import TvIcon from '@mui/icons-material/Tv';

import { appHost } from 'components/apphost';
import confirm from 'components/confirm/confirm';
import Loading from 'components/loading/LoadingComponent';
import loading from 'components/loading/loading';
import Page from 'components/Page';
import toast from 'components/toast/toast';
import { useIsProfileUser } from 'components/profiles/useProfiles';
import { useUser } from 'hooks/api/useUser';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';
import { KIND_COLORS, type HistoryEntry, type StatsDay, type StatsRank, formatDuration } from 'apps/dashboard/features/stats/api/playbackStats';
import BarChart, { type BarDatum } from 'apps/dashboard/features/stats/components/BarChart';
import { relativeTime } from 'apps/dashboard/features/tasks/components/TaskCosmic';

interface PersonalStats {
    WatchedSeconds30: number;
    Plays30: number;
    Finished30: number;
    CurrentStreakDays: number;
    BestStreakDays: number;
    BingeSeriesId?: string | null;
    BingeSeriesName?: string | null;
    BingeEpisodes: number;
    BingeDate?: string | null;
    OthersWatching: number;
    TotalPlays?: number;
    TotalWatchedSeconds?: number;
    TotalEpisodeSeconds?: number;
    TotalMovieSeconds?: number;
    EpisodesFinished?: number;
    MoviesFinished?: number;
    ActiveDays?: number;
    FirstPlayUtc?: string | null;
    Daily?: StatsDay[];
    PlaysByHour?: number[];
    SecondsByWeekday?: number[];
    TopSeries?: StatsRank[];
    TopMovies?: StatsRank[];
    TopClients?: StatsRank[];
    Recent?: HistoryEntry[];
}

const ACCENT = '#00a4dc';
const locale = () => globalize.getCurrentDateTimeLocale();

const timeZone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return undefined;
    }
};

const greetingKey = () => {
    const h = new Date().getHours();
    if (h < 12) return 'HomeGoodMorning';
    if (h < 19) return 'HomeGoodAfternoon';
    return 'HomeGoodEvening';
};

/** undefined while loading, null when the server has no stats endpoint (old image). */
const usePersonalStats = (userId: string | undefined, self: boolean) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'PlaybackStatsMe', self ? 'me' : userId ],
        queryFn: async ({ signal }) => {
            try {
                const res = await api!.axiosInstance.get<PersonalStats>(`${api!.basePath}/PlaybackStats/Me`, {
                    headers: { Authorization: api!.authorizationHeader },
                    params: { timeZone: timeZone(), userId: self ? undefined : userId },
                    signal
                });
                return res.data;
            } catch {
                return null;
            }
        },
        enabled: !!api && !!user,
        refetchInterval: 60 * 1000,
        staleTime: 30 * 1000
    });
};

/* ---------- small building blocks ---------- */

const Card: FC<{ title: string; icon: React.ReactNode; color?: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, color = ACCENT, action, children }) => (
    <Box sx={{
        p: { xs: 2, md: 2.5 }, borderRadius: '20px', minWidth: 0,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)'
    }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', color, background: `${color}22`, '& svg': { fontSize: '1.15rem' } }}>{icon}</Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#fff', flex: 1 }}>{title}</Typography>
            {action}
        </Box>
        {children}
    </Box>
);

const Tile: FC<{ value: React.ReactNode; label: string; color: string }> = ({ value, label, color }) => (
    <Box sx={{
        px: 1.75, py: 1.5, borderRadius: '16px', minWidth: 0,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderTop: `2px solid ${color}`
    }}>
        <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{value}</Typography>
        <Typography noWrap sx={{ fontSize: '0.66rem', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>{label}</Typography>
    </Box>
);

const Empty: FC<{ text: string }> = ({ text }) => (
    <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{text}</Typography>
);

/** Horizontal posters of the most watched series or movies. */
const PosterRow: FC<{ rows: StatsRank[] }> = ({ rows }) => {
    const { api } = useApi();
    if (!rows.length) return <Empty text={globalize.translate('StsEmpty')} />;
    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 1.5 }}>
            {rows.map((r, i) => (
                <Box key={r.Id || i} component={Link} to={`/details?id=${r.Id}`} sx={{ textDecoration: 'none', color: 'inherit', minWidth: 0, '&:hover img': { transform: 'scale(1.04)', borderColor: 'rgba(0,164,220,0.6)' } }}>
                    <Box sx={{ position: 'relative', aspectRatio: '2 / 3', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                        {api && r.Id && (
                            <Box component='img' src={getImageApi(api).getItemImageUrlById(r.Id, ImageType.Primary, { maxHeight: 300 })} alt='' loading='lazy'
                                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', border: '1px solid transparent', borderRadius: '12px', transition: 'transform 0.2s, border-color 0.2s' }} />
                        )}
                        <Box sx={{
                            position: 'absolute', top: 6, left: 6, minWidth: 22, height: 22, px: 0.5, borderRadius: '8px', display: 'grid', placeItems: 'center',
                            fontSize: '0.72rem', fontWeight: 800, color: i < 3 ? '#1a1300' : '#fff', background: i < 3 ? '#ffca28' : 'rgba(0,0,0,0.65)'
                        }}>{i + 1}</Box>
                    </Box>
                    <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff', mt: 0.75 }}>{r.Name || '—'}</Typography>
                    <Typography noWrap sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>{formatDuration(r.WatchedSeconds)} · {r.Plays}×</Typography>
                </Box>
            ))}
        </Box>
    );
};

/** One stacked bar splitting all-time watch time into episodes / movies / other. */
const SplitBar: FC<{ stats: PersonalStats }> = ({ stats }) => {
    const total = stats.TotalWatchedSeconds || 0;
    const ep = stats.TotalEpisodeSeconds || 0;
    const mv = stats.TotalMovieSeconds || 0;
    const parts = [
        { key: 'e', label: globalize.translate('StsEpisodes'), value: ep, color: KIND_COLORS.episode },
        { key: 'm', label: globalize.translate('StsMovies'), value: mv, color: KIND_COLORS.movie },
        { key: 'o', label: globalize.translate('StsOther'), value: Math.max(0, total - ep - mv), color: KIND_COLORS.other }
    ].filter(p => p.value > 0);
    if (!total) return <Empty text={globalize.translate('StsEmpty')} />;
    return (
        <Box>
            <Box sx={{ display: 'flex', gap: '2px', height: 14, borderRadius: '7px', overflow: 'hidden' }}>
                {parts.map(p => <Box key={p.key} sx={{ flexGrow: p.value, flexBasis: 0, background: p.color }} />)}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                {parts.map(p => (
                    <Box key={p.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '3px', background: p.color, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', flex: 1 }}>{p.label}</Typography>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{formatDuration(p.value)}</Typography>
                        <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', width: 40, textAlign: 'right' }}>{Math.round((p.value / total) * 100)}%</Typography>
                    </Box>
                ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mt: 2.5 }}>
                <Tile value={stats.EpisodesFinished ?? 0} label={globalize.translate('PrfEpisodesFinished')} color={KIND_COLORS.episode} />
                <Tile value={stats.MoviesFinished ?? 0} label={globalize.translate('PrfMoviesFinished')} color={KIND_COLORS.movie} />
            </Box>
        </Box>
    );
};

const RecentList: FC<{ rows: HistoryEntry[] }> = ({ rows }) => {
    const { api } = useApi();
    if (!rows.length) return <Empty text={globalize.translate('StsEmpty')} />;
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {rows.map(r => {
                const isEpisode = r.ItemType === 'Episode';
                const imageId = isEpisode && r.SeriesId ? r.SeriesId : r.ItemId;
                const title = isEpisode ? (r.SeriesName || r.ItemName) : r.ItemName;
                const sub = isEpisode
                    ? `S${r.ParentIndexNumber ?? '?'}·E${r.IndexNumber ?? '?'} · ${r.ItemName || ''}`
                    : (r.ProductionYear ? String(r.ProductionYear) : globalize.translate('StsMovie'));
                return (
                    <Box key={r.Id} component={Link} to={`/details?id=${r.ItemId}`} sx={{
                        display: 'flex', alignItems: 'center', gap: 1.25, p: 1, borderRadius: '12px', textDecoration: 'none', color: 'inherit',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', '&:hover': { borderColor: 'rgba(0,164,220,0.4)' }
                    }}>
                        {api && <Box component='img' src={getImageApi(api).getItemImageUrlById(imageId, ImageType.Primary, { maxHeight: 90 })} alt='' loading='lazy'
                            sx={{ width: 30, height: 45, objectFit: 'cover', borderRadius: '6px', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }} />}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 600, color: '#fff' }}>{title || '—'}</Typography>
                            <Typography noWrap sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{sub}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                                {r.Completed && <CheckCircleIcon sx={{ fontSize: '0.85rem', color: '#4caf50' }} />}
                                {formatDuration(r.WatchedSeconds)}
                            </Typography>
                            <Typography sx={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.45)' }}>{relativeTime(r.StartedUtc)}</Typography>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
};

const ClientList: FC<{ rows: StatsRank[] }> = ({ rows }) => {
    const max = Math.max(1, ...rows.map(r => r.WatchedSeconds));
    if (!rows.length) return <Empty text={globalize.translate('StsEmpty')} />;
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {rows.map((r, i) => (
                <Box key={`${r.Name}-${i}`}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography noWrap sx={{ fontSize: '0.84rem', color: '#fff', fontWeight: 600 }}>{r.Name || '—'}</Typography>
                        <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)', flexShrink: 0 }}>{formatDuration(r.WatchedSeconds)} · {r.Plays}×</Typography>
                    </Box>
                    <Box sx={{ mt: 0.5, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                        <Box sx={{ width: `${(r.WatchedSeconds / max) * 100}%`, height: '100%', borderRadius: 2, background: KIND_COLORS.episode }} />
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

/** Stable gradient per name, for the letter avatar. */
const AVATAR_GRADIENTS = [
    [ '#00a4dc', '#7b2ff7' ], [ '#ff6a00', '#ee0979' ], [ '#11998e', '#38ef7d' ], [ '#fc466b', '#3f5efb' ],
    [ '#f7971e', '#ffd200' ], [ '#8e2de2', '#4a00e0' ], [ '#00b4db', '#0083b0' ], [ '#e53935', '#e35d5b' ]
];
const avatarGradient = (name: string) => {
    let hash = 0;
    for (const ch of name) hash = ((hash * 31) + ch.charCodeAt(0)) | 0;
    const [ a, b ] = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
};

const fieldSx = {
    '& .MuiOutlinedInput-root': {
        borderRadius: '12px', background: 'rgba(255,255,255,0.04)', color: '#fff',
        '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
        '&:hover fieldset': { borderColor: 'rgba(0,164,220,0.5)' },
        '&.Mui-focused fieldset': { borderColor: ACCENT }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
    '& .MuiInputLabel-root.Mui-focused': { color: ACCENT }
} as const;

/** Change-password popup (same rules as the classic form). */
const PasswordDialog: FC<{ open: boolean; onClose: () => void; user: UserDto; canReset: boolean }> = ({ open, onClose, user, canReset }) => {
    const [ current, setCurrent ] = useState('');
    const [ next, setNext ] = useState('');
    const [ confirmNext, setConfirmNext ] = useState('');
    const [ error, setError ] = useState<string | null>(null);
    const [ saving, setSaving ] = useState(false);
    const needsCurrent = !!user.HasConfiguredPassword;

    useEffect(() => {
        if (open) {
            setCurrent('');
            setNext('');
            setConfirmNext('');
            setError(null);
        }
    }, [ open ]);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user.Id) return;
        if (next !== confirmNext) {
            setError(globalize.translate('PasswordMatchError'));
            return;
        }
        if (!next && user.Policy?.IsAdministrator) {
            setError(globalize.translate('PasswordMissingSaveError'));
            return;
        }
        setSaving(true);
        setError(null);
        window.ApiClient.updateUserPassword(user.Id, needsCurrent ? current : '', next).then(() => {
            setSaving(false);
            toast(globalize.translate('PasswordSaved'));
            void queryClient.invalidateQueries({ queryKey: [ 'User' ] });
            onClose();
        }, () => {
            setSaving(false);
            setError(globalize.translate('MessageInvalidUser'));
        });
    };

    const onReset = () => {
        if (!user.Id) return;
        const id = user.Id;
        confirm(globalize.translate('PasswordResetConfirmation'), globalize.translate('ResetPassword')).then(() => {
            window.ApiClient.resetUserPassword(id).then(() => {
                toast(globalize.translate('PasswordResetComplete'));
                void queryClient.invalidateQueries({ queryKey: [ 'User' ] });
                onClose();
            }).catch(err => {
                console.error('[userprofile] failed to reset password', err);
            });
        }).catch(() => {
            // dialog closed
        });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth='xs'
            PaperProps={{
                component: 'form',
                onSubmit,
                sx: {
                    borderRadius: '22px', p: { xs: 2.5, sm: 3 }, color: '#fff',
                    background: 'linear-gradient(160deg, rgba(18,22,42,0.98), rgba(10,12,26,0.98))',
                    border: '1px solid rgba(0,164,220,0.25)', boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 40px rgba(0,164,220,0.12)'
                }
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', color: ACCENT, background: 'rgba(0,164,220,0.15)' }}>
                    <LockIcon />
                </Box>
                <Box>
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 800 }}>{globalize.translate('PrfChangePassword')}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>{user.Name}</Typography>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {needsCurrent && (
                    <TextField type='password' label={globalize.translate('LabelCurrentPassword')} value={current}
                        onChange={e => setCurrent(e.target.value)} autoComplete='current-password' autoFocus fullWidth sx={fieldSx} />
                )}
                <TextField type='password' label={globalize.translate('LabelNewPassword')} value={next}
                    onChange={e => setNext(e.target.value)} autoComplete='new-password' autoFocus={!needsCurrent} fullWidth sx={fieldSx} />
                <TextField type='password' label={globalize.translate('LabelNewPasswordConfirm')} value={confirmNext}
                    onChange={e => setConfirmNext(e.target.value)} autoComplete='new-password' fullWidth sx={fieldSx} />
                {error && <Alert severity='error' variant='outlined' sx={{ borderRadius: '12px' }}>{error}</Alert>}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 3, flexWrap: 'wrap' }}>
                {canReset && needsCurrent && (
                    <Button onClick={onReset} sx={{ textTransform: 'none', color: '#ef5350', mr: 'auto' }}>
                        {globalize.translate('ResetPassword')}
                    </Button>
                )}
                <Box sx={{ flex: 1 }} />
                <Button onClick={onClose} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.7)', borderRadius: '12px' }}>
                    {globalize.translate('ButtonCancel')}
                </Button>
                <Button type='submit' variant='contained' disabled={saving} sx={{
                    textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 2.5,
                    background: 'linear-gradient(135deg, #00a4dc, #0077b6)'
                }}>
                    {globalize.translate('SavePassword')}
                </Button>
            </Box>
        </Dialog>
    );
};

/* ---------- page ---------- */

const UserProfile: FC = () => {
    const [ searchParams ] = useSearchParams();
    const { user: loggedInUser } = useApi();
    const userId = searchParams.get('userId') || loggedInUser?.Id || undefined;
    const { data: user, isPending: isUserPending } = useUser({ userId });
    const isProfileUser = useIsProfileUser(userId);
    const isSelf = !!loggedInUser?.Id && loggedInUser.Id === userId;
    const { data: stats, isPending: isStatsPending } = usePersonalStats(userId, isSelf);
    const fileInput = useRef<HTMLInputElement>(null);
    const [ passwordOpen, setPasswordOpen ] = useState(false);
    const openPassword = useCallback(() => setPasswordOpen(true), []);
    const closePassword = useCallback(() => setPasswordOpen(false), []);
    const libraryMenu = useMemo(async () => ((await import('scripts/libraryMenu')).default), []);

    useEffect(() => {
        if (user?.Name) void libraryMenu.then(menu => menu.setTitle(user.Name));
    }, [ user?.Name, libraryMenu ]);

    const canEditImage = !!user && (!!loggedInUser?.Policy?.IsAdministrator || !!user.Policy?.EnableUserPreferenceAccess);
    const canUpload = canEditImage && appHost.supports('fileinput');

    const refreshUser = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: [ 'User' ] });
    }, []);

    const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId || !/image.*/.exec(file.type)) return;
        loading.show();
        window.ApiClient.uploadUserImage(userId, ImageType.Primary, file).then(() => {
            loading.hide();
            refreshUser();
        }).catch(err => {
            loading.hide();
            toast(globalize.translate('FileReadError'));
            console.error('[userprofile] failed to upload image', err);
        });
    }, [ userId, refreshUser ]);

    const onDeleteImage = useCallback(() => {
        if (!userId) return;
        confirm(globalize.translate('DeleteImageConfirmation'), globalize.translate('DeleteImage')).then(() => {
            loading.show();
            window.ApiClient.deleteUserImage(userId, ImageType.Primary).then(() => {
                loading.hide();
                refreshUser();
            }).catch(err => {
                loading.hide();
                console.error('[userprofile] failed to delete image', err);
            });
        }).catch(() => {
            // dialog closed
        });
    }, [ userId, refreshUser ]);

    const dailyData = useMemo<BarDatum[]>(() => {
        const days = stats?.Daily || [];
        const n = days.length;
        return days.map((d, i) => {
            const date = new Date(`${d.Date}T12:00:00`);
            return {
                id: d.Date,
                label: i % 5 === 0 || i === n - 1 ? (i === n - 1 ? globalize.translate('StsToday') : date.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })) : '',
                title: `${date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })} · ${globalize.translate('StsPlaysN', d.Plays)}`,
                segments: [
                    { key: 'e', label: globalize.translate('StsEpisodes'), value: d.EpisodeSeconds, color: KIND_COLORS.episode },
                    { key: 'm', label: globalize.translate('StsMovies'), value: d.MovieSeconds, color: KIND_COLORS.movie },
                    { key: 'o', label: globalize.translate('StsOther'), value: d.OtherSeconds, color: KIND_COLORS.other }
                ]
            };
        });
    }, [ stats ]);

    const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(locale(), { hour: 'numeric' });
    const dayLabel = (i: number, style: 'short' | 'long') => new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: style }); // 2024-01-01 is a Monday

    const hourData = useMemo<BarDatum[]>(() => (stats?.PlaysByHour || []).map((v, h) => ({
        id: `h${h}`,
        label: h % 3 === 0 ? hourLabel(h) : '',
        title: `${hourLabel(h)} – ${hourLabel((h + 1) % 24)}`,
        segments: [ { key: 'p', label: globalize.translate('StsPlaysStarted'), value: v, color: KIND_COLORS.episode } ]
    })), [ stats ]);

    const weekdayData = useMemo<BarDatum[]>(() => (stats?.SecondsByWeekday || []).map((v, i) => ({
        id: `w${i}`,
        label: dayLabel(i, 'short'),
        title: dayLabel(i, 'long'),
        segments: [ { key: 's', label: globalize.translate('StsWatchTime'), value: v, color: KIND_COLORS.episode } ]
    })), [ stats ]);

    if (isUserPending || !user) return <Loading />;

    const imageUrl = user.PrimaryImageTag && user.Id
        ? window.ApiClient.getUserImageUrl(user.Id, { tag: user.PrimaryImageTag, type: 'Primary' })
        : null;
    const initial = (user.Name || '?').trim().charAt(0).toUpperCase() || '?';
    const canChangePassword = isProfileUser === false && (!!loggedInUser?.Policy?.IsAdministrator || !!user.Policy?.EnableUserPreferenceAccess);
    const canResetPassword = !!loggedInUser?.Policy?.IsAdministrator && !user.Policy?.IsAdministrator;
    const hasStats = !!stats && (stats.TotalPlays ?? stats.Plays30) > 0;
    const hours = stats?.PlaysByHour || [];
    const week = stats?.SecondsByWeekday || [];
    const favHour = hours.some(v => v > 0) ? hours.indexOf(Math.max(...hours)) : -1;
    const favDay = week.some(v => v > 0) ? week.indexOf(Math.max(...week)) : -1;
    const binge = stats && stats.BingeEpisodes > 1 && stats.BingeSeriesName ? stats : null;
    const bingeDate = binge?.BingeDate ? new Date(`${binge.BingeDate}T12:00:00`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const since = stats?.FirstPlayUtc ? new Date(stats.FirstPlayUtc).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) : null;

    const grid2 = { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 2 } as const;

    return (
        <Page
            id='userProfilePage'
            title={globalize.translate('Profile')}
            className='mainAnimatedPage libraryPage userPreferencesPage userPasswordPage noSecondaryNavPage'
        >
            <Box className='padded-bottom-page' sx={{ px: { xs: '4%', md: '3.3%' }, pt: 2, maxWidth: 1400, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>

                {/* Hero */}
                <Box sx={{
                    position: 'relative', overflow: 'hidden', borderRadius: '24px', p: { xs: 2.5, md: 3.5 },
                    border: '1px solid rgba(0,164,220,0.2)',
                    background: 'radial-gradient(120% 140% at 0% 0%, rgba(0,164,220,0.22), transparent 55%), radial-gradient(100% 120% at 100% 100%, rgba(170,92,195,0.2), transparent 55%), rgba(10,14,30,0.85)'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3.5 }, flexWrap: 'wrap' }}>
                        <Box sx={{ position: 'relative', flexShrink: 0 }}>
                            <Box sx={{
                                width: { xs: 96, md: 132 }, height: { xs: 96, md: 132 }, borderRadius: '50%',
                                display: 'grid', placeItems: 'center',
                                background: imageUrl ? `center / cover no-repeat url(${imageUrl})` : avatarGradient(user.Name || '?'),
                                border: '3px solid rgba(0,164,220,0.55)', boxShadow: '0 0 32px rgba(0,164,220,0.35)'
                            }}>
                                {!imageUrl && (
                                    <Typography component='span' sx={{ fontSize: { xs: '2.6rem', md: '3.6rem' }, fontWeight: 800, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.35)', userSelect: 'none' }}>
                                        {initial}
                                    </Typography>
                                )}
                            </Box>
                            {canUpload && (
                                <Tooltip title={globalize.translate(user.PrimaryImageTag ? 'PrfChangePhoto' : 'ButtonAddImage')}>
                                    <IconButton
                                        onClick={() => { if (fileInput.current) { fileInput.current.value = ''; fileInput.current.click(); } }}
                                        aria-label={globalize.translate('PrfChangePhoto')}
                                        sx={{ position: 'absolute', right: -2, bottom: -2, width: 38, height: 38, background: ACCENT, color: '#fff', border: '3px solid #0b0f1f', '&:hover': { background: '#0090c4' } }}
                                    >
                                        <PhotoCameraIcon sx={{ fontSize: '1.05rem' }} />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <input ref={fileInput} type='file' accept='image/*' hidden onChange={onFile} />
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 220 }}>
                            <Typography component='h1' sx={{ fontSize: { xs: '1.6rem', md: '2.1rem' }, fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>
                                {isSelf ? <>{globalize.translate(greetingKey(), user.Name || '')} 👋</> : user.Name}
                            </Typography>
                            {stats && (
                                <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <Box component='span' sx={{ width: 8, height: 8, borderRadius: '50%', background: '#4caf50', boxShadow: '0 0 8px #4caf50', flexShrink: 0 }} />
                                    {stats.OthersWatching
                                        ? globalize.translate(stats.OthersWatching === 1 ? 'HomeOnlineOne' : 'HomeOnlineMany', stats.OthersWatching)
                                        : globalize.translate('HomeOnline')}
                                </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                                {user.Policy?.IsAdministrator && <Chip text={globalize.translate('PrfAdmin')} color='#ffca28' />}
                                {since && <Chip text={globalize.translate('PrfSince', since)} color={ACCENT} />}
                                {!!stats?.CurrentStreakDays && <Chip text={`🔥 ${globalize.translate('PrfStreakChip', stats.CurrentStreakDays)}`} color='#ff9800' />}
                            </Box>
                            {canChangePassword && (
                                <Button
                                    size='small'
                                    startIcon={<LockIcon />}
                                    onClick={openPassword}
                                    sx={{
                                        mt: 1.75, textTransform: 'none', fontWeight: 600, borderRadius: '12px', px: 1.75,
                                        color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
                                        '&:hover': { background: 'rgba(0,164,220,0.15)', borderColor: 'rgba(0,164,220,0.5)' }
                                    }}
                                >
                                    {globalize.translate('PrfChangePassword')}
                                </Button>
                            )}
                        </Box>

                        {canEditImage && user.PrimaryImageTag && (
                            <Button size='small' startIcon={<DeleteOutlineIcon />} onClick={onDeleteImage}
                                sx={{ alignSelf: 'flex-start', color: 'rgba(255,255,255,0.6)', textTransform: 'none', '&:hover': { color: '#ef5350' } }}>
                                {globalize.translate('DeleteImage')}
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* Stats */}
                {isStatsPending && <Loading />}
                {!isStatsPending && stats === null && <Alert severity='info' variant='outlined'>{globalize.translate('StsServerOld')}</Alert>}
                {!isStatsPending && stats && !hasStats && <Alert severity='info' variant='outlined'>{globalize.translate('PrfNoData')}</Alert>}

                {hasStats && stats && (
                    <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' }, gap: 1.25 }}>
                            <Tile value={formatDuration(stats.TotalWatchedSeconds ?? 0)} label={globalize.translate('PrfTotalWatched')} color={ACCENT} />
                            <Tile value={formatDuration(stats.WatchedSeconds30)} label={globalize.translate('HomeWatched30')} color='#3987e5' />
                            <Tile value={stats.Plays30} label={globalize.translate('HomePlaysFinished', stats.Finished30)} color='#aa5cc3' />
                            <Tile value={<>{stats.CurrentStreakDays > 0 ? '🔥 ' : ''}{stats.CurrentStreakDays}</>} label={globalize.translate('HomeStreak')} color='#ff9800' />
                            <Tile value={stats.BestStreakDays} label={globalize.translate('HomeBestStreak')} color='#4caf50' />
                            <Tile value={stats.ActiveDays ?? 0} label={globalize.translate('PrfActiveDays')} color='#199e70' />
                        </Box>

                        {binge && (
                            <Box component={Link} to={`/details?id=${binge.BingeSeriesId}`} sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderRadius: '16px',
                                textDecoration: 'none', color: 'inherit', background: 'rgba(255,152,0,0.07)', border: '1px solid rgba(255,152,0,0.3)',
                                '&:hover': { borderColor: 'rgba(255,152,0,0.6)' }
                            }}>
                                <Typography sx={{ fontSize: '1.6rem' }}>🍿</Typography>
                                <Typography sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.88)' }}>
                                    {globalize.translate('HomeBinge', binge.BingeEpisodes, binge.BingeSeriesName || '', bingeDate)}
                                </Typography>
                            </Box>
                        )}

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2 }}>
                            <Card title={globalize.translate('PrfActivity30')} icon={<BarChartIcon />}>
                                <BarChart
                                    data={dailyData}
                                    height={190}
                                    formatValue={formatDuration}
                                    ariaLabel={globalize.translate('PrfActivity30')}
                                    legend={[
                                        { key: 'e', label: globalize.translate('StsEpisodes'), color: KIND_COLORS.episode },
                                        { key: 'm', label: globalize.translate('StsMovies'), color: KIND_COLORS.movie },
                                        { key: 'o', label: globalize.translate('StsOther'), color: KIND_COLORS.other }
                                    ]}
                                />
                            </Card>
                            <Card title={globalize.translate('PrfSplit')} icon={<PieChartIcon />} color='#d95926'>
                                <SplitBar stats={stats} />
                            </Card>
                        </Box>

                        <Box sx={grid2}>
                            <Card title={globalize.translate('StsTimeOfDay')} icon={<AccessTimeIcon />} color='#aa5cc3'>
                                <BarChart data={hourData} height={150} formatValue={v => String(Math.round(v))} ariaLabel={globalize.translate('StsTimeOfDay')} />
                                {favHour >= 0 && <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', mt: 1.5 }}>{globalize.translate('PrfFavHour')}: <b>{hourLabel(favHour)}</b></Typography>}
                            </Card>
                            <Card title={globalize.translate('StsDayOfWeek')} icon={<CalendarViewWeekIcon />} color='#aa5cc3'>
                                <BarChart data={weekdayData} height={150} formatValue={formatDuration} ariaLabel={globalize.translate('StsDayOfWeek')} />
                                {favDay >= 0 && <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', mt: 1.5 }}>{globalize.translate('PrfFavDay')}: <b>{dayLabel(favDay, 'long')}</b></Typography>}
                            </Card>
                        </Box>

                        <Box sx={grid2}>
                            <Card title={globalize.translate('PrfTopSeries')} icon={<TvIcon />} color={KIND_COLORS.episode}>
                                <PosterRow rows={stats.TopSeries || []} />
                            </Card>
                            <Card title={globalize.translate('PrfTopMovies')} icon={<MovieIcon />} color={KIND_COLORS.movie}>
                                <PosterRow rows={stats.TopMovies || []} />
                            </Card>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2 }}>
                            <Card title={globalize.translate('PrfRecent')} icon={<HistoryIcon />}>
                                <RecentList rows={stats.Recent || []} />
                            </Card>
                            <Card title={globalize.translate('PrfApps')} icon={<DevicesIcon />} color='#199e70'>
                                <ClientList rows={stats.TopClients || []} />
                            </Card>
                        </Box>
                    </>
                )}

            </Box>
            <PasswordDialog open={passwordOpen} onClose={closePassword} user={user} canReset={canResetPassword} />
        </Page>
    );
};

const Chip: FC<{ text: string; color: string }> = ({ text, color }) => (
    <Box component='span' sx={{
        px: 1.25, py: 0.4, borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
        color, background: `${color}1f`, border: `1px solid ${color}55`
    }}>{text}</Box>
);

export default UserProfile;
