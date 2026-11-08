import React, { type FC, useState } from 'react';
import type { ActivityLogEntry } from '@jellyfin/sdk/lib/generated-client/models/activity-log-entry';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { LogLevel } from '@jellyfin/sdk/lib/generated-client/models/log-level';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import { Link } from 'react-router-dom';

import UserAvatar from 'components/UserAvatar';
import { getTypeInfo, getTypeLabel, severityColor } from 'apps/dashboard/features/activity/utils/activityTypes';
import globalize from 'lib/globalize';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';

export interface ActivityActions {
    onDelete: (entry: ActivityLogEntry) => void;
    onFilterType: (type: string) => void;
    onFilterUser: (name: string) => void;
}

interface ActivityViewProps extends ActivityActions {
    entries: ActivityLogEntry[];
    users: Record<string, UserDto>;
    deletingId?: number | null;
}

const AVATAR_SIZE = 20;

const locale = () => globalize.getCurrentDateTimeLocale();
const relative = (date?: string | null) => (date ? formatDistanceToNow(new Date(date), getLocaleWithSuffix()) : '');
const fullDate = (date?: string | null) => (date ? new Date(date).toLocaleString(locale(), { dateStyle: 'long', timeStyle: 'medium' }) : '');
const clock = (date?: string | null) => (date ? new Date(date).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '');

const dayKey = (date?: string | null) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const dayLabel = (date?: string | null) => {
    if (!date) return '—';
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (dayKey(date) === dayKey(today.toISOString())) return globalize.translate('ActToday');
    if (dayKey(date) === dayKey(yesterday.toISOString())) return globalize.translate('Yesterday');
    return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: today.getFullYear() === d.getFullYear() ? undefined : 'numeric' });
};

export const userName = (entry: ActivityLogEntry, users: Record<string, UserDto>) => (
    (entry.UserId && users[entry.UserId]?.Name) || ''
);

export const SeverityBadge: FC<{ level?: LogLevel | null }> = ({ level }) => {
    if (!level) return null;
    const color = severityColor(level);
    return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.2, borderRadius: '8px', fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap', color, background: `${color}1a`, border: `1px solid ${color}44` }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            {globalize.translate(`LogLevel.${level}`)}
        </Box>
    );
};

const TypeChip: FC<{ type?: string | null; onClick?: () => void }> = ({ type, onClick }) => {
    const { color } = getTypeInfo(type);
    return (
        <Tooltip title={onClick ? globalize.translate('ActFilterByThis') : ''}>
            <Box component='button' type='button' onClick={onClick} sx={{
                display: 'inline-flex', alignItems: 'center', px: 1, py: 0.2, borderRadius: '8px', fontSize: '0.66rem', fontWeight: 600,
                color, background: `${color}14`, border: `1px solid ${color}33`, cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit',
                '&:hover': onClick ? { background: `${color}26` } : {}
            }}>
                {getTypeLabel(type)}
            </Box>
        </Tooltip>
    );
};

const TypeIcon: FC<{ type?: string | null; level?: LogLevel | null; size?: number }> = ({ type, level, size = 40 }) => {
    const info = getTypeInfo(type);
    const isProblem = level === LogLevel.Error || level === LogLevel.Critical;
    const color = isProblem ? severityColor(level) : info.color;
    return (
        <Box sx={{
            width: size, height: size, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${color}1f`, border: `1px solid ${color}44`, '& svg': { color, fontSize: size * 0.5 }
        }}>
            {info.icon}
        </Box>
    );
};

const EntryActions: FC<{ entry: ActivityLogEntry; deleting: boolean; onDelete: (e: ActivityLogEntry) => void }> = ({ entry, deleting, onDelete }) => (
    <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
        {entry.ItemId && (
            <Tooltip title={globalize.translate('LabelMediaDetails')}>
                <IconButton size='small' component={Link} to={`/details?id=${entry.ItemId}`} sx={{ color: '#00a4dc' }}>
                    <PermMediaIcon fontSize='small' />
                </IconButton>
            </Tooltip>
        )}
        <Tooltip title={globalize.translate('ActDeleteEntry')}>
            <span>
                <IconButton size='small' disabled={deleting} onClick={() => onDelete(entry)} sx={{ color: 'rgba(239,83,80,0.8)' }}>
                    <DeleteIcon fontSize='small' />
                </IconButton>
            </span>
        </Tooltip>
    </Box>
);

const EntryCard: FC<{ entry: ActivityLogEntry; users: Record<string, UserDto>; deleting: boolean } & ActivityActions> = ({ entry, users, deleting, onDelete, onFilterType, onFilterUser }) => {
    const [ open, setOpen ] = useState(false);
    const user = entry.UserId ? users[entry.UserId] : undefined;
    const name = userName(entry, users);
    const isProblem = entry.Severity === LogLevel.Error || entry.Severity === LogLevel.Critical || entry.Severity === LogLevel.Warning;
    const accent = isProblem ? severityColor(entry.Severity) : getTypeInfo(entry.Type).color;
    const details = entry.Overview && entry.Overview !== entry.ShortOverview ? entry.Overview : '';

    return (
        <Paper elevation={0} sx={{
            position: 'relative', overflow: 'hidden', p: 1.5, pl: 2, borderRadius: '14px',
            border: `1px solid ${isProblem ? `${accent}44` : 'rgba(255,255,255,0.07)'}`,
            transition: 'border-color 0.2s', '&:hover': { borderColor: `${accent}77` }
        }}>
            <Box sx={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: '3px', borderRadius: '0 3px 3px 0', background: accent }} />
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <TypeIcon type={entry.Type} level={entry.Severity} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', lineHeight: 1.35, wordBreak: 'break-word' }}>{entry.Name}</Typography>
                    {entry.ShortOverview && (
                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', mt: 0.25, wordBreak: 'break-word' }}>{entry.ShortOverview}</Typography>
                    )}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 1 }}>
                        <TypeChip type={entry.Type} onClick={entry.Type ? () => onFilterType(entry.Type!) : undefined} />
                        {entry.Severity !== LogLevel.Information && <SeverityBadge level={entry.Severity} />}
                        {name && (
                            <Tooltip title={globalize.translate('ActFilterByThis')}>
                                <Box component='button' type='button' onClick={() => onFilterUser(name)} sx={{
                                    display: 'inline-flex', alignItems: 'center', gap: 0.6, p: 0, pr: 0.75, border: 'none', background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '8px', color: 'rgba(255,255,255,0.75)', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit',
                                    '& .MuiAvatar-root': { width: 20, height: 20, fontSize: '0.62rem' }, '&:hover': { background: 'rgba(255,255,255,0.1)' }
                                }}>
                                    {user && <UserAvatar user={user} size={AVATAR_SIZE} />}
                                    {name}
                                </Box>
                            </Tooltip>
                        )}
                        {details && (
                            <Box component='button' type='button' onClick={() => setOpen(o => !o)} sx={{
                                display: 'inline-flex', alignItems: 'center', gap: 0.25, border: 'none', background: 'none', p: 0, cursor: 'pointer',
                                color: '#00a4dc', fontSize: '0.7rem', fontWeight: 600, fontFamily: 'inherit'
                            }}>
                                {globalize.translate('ActDetails')}
                                <ExpandMoreIcon sx={{ fontSize: '1rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
                            </Box>
                        )}
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                    <Tooltip title={fullDate(entry.Date)}>
                        <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{clock(entry.Date)}</Typography>
                    </Tooltip>
                    <EntryActions entry={entry} deleting={deleting} onDelete={onDelete} />
                </Box>
            </Box>
            {details && (
                <Collapse in={open} unmountOnExit>
                    <Box component='pre' sx={{
                        m: 0, mt: 1.25, p: 1.25, borderRadius: '10px', maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        fontSize: '0.72rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        {details}
                    </Box>
                </Collapse>
            )}
        </Paper>
    );
};

/** Entries grouped by day, newest group first (keeps the order received). */
export const ActivityTimelineView: FC<ActivityViewProps> = ({ entries, users, deletingId, ...actions }) => {
    const groups: { key: string; label: string; items: ActivityLogEntry[] }[] = [];
    for (const entry of entries) {
        const key = dayKey(entry.Date);
        let group = groups[groups.length - 1];
        if (group?.key !== key) {
            group = { key, label: dayLabel(entry.Date), items: [] };
            groups.push(group);
        }
        group.items.push(entry);
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {groups.map(group => (
                <Box key={group.key}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
                        <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#00a4dc', whiteSpace: 'nowrap' }}>
                            {group.label}
                        </Typography>
                        <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(0,164,220,0.35), transparent)' }} />
                        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{group.items.length}</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))', gap: 1.25 }}>
                        {group.items.map(entry => (
                            <EntryCard key={entry.Id} entry={entry} users={users} deleting={deletingId === entry.Id} {...actions} />
                        ))}
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export const ActivityTableView: FC<ActivityViewProps> = ({ entries, users, deletingId, onDelete, onFilterType, onFilterUser }) => {
    const headSx = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.08)', whiteSpace: 'nowrap' };
    const cellSx = { borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.82rem' };

    return (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '16px' }}>
            <Table size='small'>
                <TableHead>
                    <TableRow>
                        <TableCell sx={headSx}>{globalize.translate('LabelTime')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('LabelLevel')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('LabelType')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('LabelUser')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('LabelName')}</TableCell>
                        <TableCell sx={headSx}>{globalize.translate('LabelOverview')}</TableCell>
                        <TableCell sx={headSx} align='right' />
                    </TableRow>
                </TableHead>
                <TableBody>
                    {entries.map(entry => {
                        const user = entry.UserId ? users[entry.UserId] : undefined;
                        const name = userName(entry, users);
                        return (
                            <TableRow key={entry.Id} hover>
                                <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                                    <Tooltip title={fullDate(entry.Date)}><span>{relative(entry.Date)}</span></Tooltip>
                                </TableCell>
                                <TableCell sx={cellSx}><SeverityBadge level={entry.Severity} /></TableCell>
                                <TableCell sx={cellSx}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TypeIcon type={entry.Type} level={entry.Severity} size={28} />
                                        <TypeChip type={entry.Type} onClick={entry.Type ? () => onFilterType(entry.Type!) : undefined} />
                                    </Box>
                                </TableCell>
                                <TableCell sx={cellSx}>
                                    {name ? (
                                        <Box component='button' type='button' onClick={() => onFilterUser(name)} sx={{
                                            display: 'flex', alignItems: 'center', gap: 1, border: 'none', background: 'none', p: 0, cursor: 'pointer',
                                            color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit', '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.7rem' }
                                        }}>
                                            {user && <UserAvatar user={user} size={AVATAR_SIZE} />}
                                            {name}
                                        </Box>
                                    ) : <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{globalize.translate('LabelSystem')}</Typography>}
                                </TableCell>
                                <TableCell sx={{ ...cellSx, maxWidth: 360 }}>{entry.Name}</TableCell>
                                <TableCell sx={{ ...cellSx, maxWidth: 260, color: 'rgba(255,255,255,0.6)' }}>
                                    <Tooltip title={entry.Overview || ''}>
                                        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.ShortOverview || entry.Overview}</Box>
                                    </Tooltip>
                                </TableCell>
                                <TableCell sx={cellSx} align='right'>
                                    <EntryActions entry={entry} deleting={deletingId === entry.Id} onDelete={onDelete} />
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
};
