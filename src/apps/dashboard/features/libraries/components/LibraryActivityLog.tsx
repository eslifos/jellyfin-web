/**
 * Readable library activity log for the libraries page, always visible: what the scanner added, removed,
 * analyzed, downloaded or failed, newest first, with filters. It replaces reading the container log.
 */
import React, { type FC, useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

import globalize from 'lib/globalize';

import { activityLabelKey, KIND_COLORS, type LibraryActivityItem, type LibraryActivityKind, useLibraryActivity } from '../api/useLibraryActivity';

type Filter = 'all' | 'changes' | 'work' | 'errors';

const FILTERS: { id: Filter, label: string, kinds?: LibraryActivityKind[] }[] = [
    { id: 'all', label: 'LibLogAll' },
    { id: 'changes', label: 'LibLogChanges', kinds: [ 'Added', 'Removed' ] },
    { id: 'work', label: 'LibLogWork', kinds: [ 'Metadata', 'Images', 'Analyzing', 'Trickplay', 'ChapterImages', 'PostScan' ] },
    { id: 'errors', label: 'LibLogErrors', kinds: [ 'Error' ] }
];

/** "Checking" and "Reading folder" fill the log quickly; they are only shown when asked for. */
const NOISY = new Set<LibraryActivityKind>([ 'Checking', 'Scanning' ]);

// Read when drawn: the language can change after the page was loaded
const clockTime = (date: Date) => date.toLocaleTimeString(globalize.getCurrentDateTimeLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const fileName = (path?: string | null) => (path ? path.split(/[\\/]/).pop() : undefined);

const LogRow: FC<{ line: LibraryActivityItem }> = ({ line }) => {
    const color = KIND_COLORS[line.Kind] ?? '#00a4dc';
    const file = line.Kind === 'Error' ? line.File : fileName(line.File);
    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '72px 168px 1fr' }, gap: { xs: 0.25, sm: 1.5 }, alignItems: 'baseline', py: 0.75, px: 1, borderBottom: '1px solid rgba(255,255,255,0.05)', minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
                {clockTime(new Date(line.StartedUtc))}
            </Typography>
            <Box>
                <Box component='span' sx={{ display: 'inline-block', px: 0.9, py: 0.15, borderRadius: '6px', fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color, background: `${color}1f`, border: `1px solid ${color}55` }}>
                    {globalize.translate(activityLabelKey(line.Kind))}
                </Box>
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography noWrap title={line.Title ?? undefined} sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {line.Title}
                    {line.LibraryName && <Box component='span' sx={{ fontWeight: 400, color: 'rgba(255,255,255,0.45)', ml: 0.75 }}>{`· ${line.LibraryName}`}</Box>}
                </Typography>
                {file && file !== line.Title && (
                    <Typography noWrap title={line.File ?? undefined} sx={{ fontSize: '0.7rem', color: line.Kind === 'Error' ? '#ef9a9a' : 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                        {file}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

const LibraryActivityLog: FC = () => {
    const activity = useLibraryActivity(false, 500);
    const [ filter, setFilter ] = useState<Filter>('all');
    const [ showNoisy, setShowNoisy ] = useState(false);
    const [ search, setSearch ] = useState('');

    const lines = useMemo(() => {
        const kinds = FILTERS.find(f => f.id === filter)?.kinds;
        const q = search.trim().toLowerCase();
        return activity.log.filter(l =>
            (kinds ? kinds.includes(l.Kind) : (showNoisy || !NOISY.has(l.Kind)))
            && (!q || `${l.Title ?? ''} ${l.File ?? ''} ${l.LibraryName ?? ''}`.toLowerCase().includes(q))
        ).slice(0, 300);
    }, [ activity.log, filter, showNoisy, search ]);

    const onSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []);
    const toggleNoisy = useCallback(() => setShowNoisy(v => !v), []);

    return (
        <Paper elevation={0} sx={{ p: 2, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(14,17,34,0.6)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <ReceiptLongIcon sx={{ color: '#00a4dc' }} />
                <Typography sx={{ fontWeight: 800, mr: 'auto' }}>{globalize.translate('LibLogTitle')}</Typography>
                <TextField size='small' placeholder={globalize.translate('Search')} value={search} onChange={onSearch} sx={{ width: { xs: '100%', sm: 220 } }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                {FILTERS.map(f => (
                    <FilterChip key={f.id} id={f.id} label={globalize.translate(f.label)} active={filter === f.id} onSelect={setFilter} />
                ))}
                {filter === 'all' && (
                    <Chip size='small' variant={showNoisy ? 'filled' : 'outlined'} label={globalize.translate('LibLogShowChecks')} onClick={toggleNoisy} />
                )}
            </Box>
            <Box sx={{ maxHeight: 480, overflowY: 'auto', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {lines.length ? lines.map(l => <LogRow key={`${l.StartedUtc}-${l.ItemId ?? l.Title}-${l.Kind}`} line={l} />) : (
                    <Typography sx={{ p: 2, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('LibLogEmpty')}</Typography>
                )}
            </Box>
            <Typography sx={{ mt: 1, fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{globalize.translate('LibLogHelp')}</Typography>
        </Paper>
    );
};

const FilterChip: FC<{ id: Filter, label: string, active: boolean, onSelect: (id: Filter) => void }> = ({ id, label, active, onSelect }) => {
    const onClick = useCallback(() => onSelect(id), [ onSelect, id ]);
    return <Chip size='small' color={active ? 'primary' : 'default'} variant={active ? 'filled' : 'outlined'} label={label} onClick={onClick} />;
};

export default LibraryActivityLog;
