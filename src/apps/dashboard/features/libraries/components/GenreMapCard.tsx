/**
 * The genre map of the server (GenreMap API): what each genre that arrives in English becomes in the language of
 * the library ("Comedy" → "Comedia"), so the same genre is not listed twice. It is applied when items are saved;
 * "Unify now" runs the task that fixes what is already saved.
 */
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MergeTypeRoundedIcon from '@mui/icons-material/MergeTypeRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type ChangeEvent, type FC, useCallback, useEffect, useMemo, useState } from 'react';

import { SectionCard } from 'apps/dashboard/components/cosmic';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { TEXT_TERTIARY } from 'themes/cosmic/textColors';

const ACCENT = '#26a69a';
const UNIFY_TASK_KEY = 'UnifyGenres';

interface Entry {
    From: string;
    To: string;
    IsDefault: boolean;
}

interface Language {
    Language: string;
    Entries: Entry[];
    IsCustom: boolean;
    InUse: boolean;
}

/** A row being edited (the id keeps the fields in place while typing). */
interface Row {
    id: number;
    from: string;
    to: string;
    isDefault: boolean;
}

type Notice = { severity: 'success' | 'error' | 'info', text: string } | null;

let nextId = 0;
const toRows = (entries: Entry[]): Row[] => entries.map(e => ({ id: nextId++, from: e.From, to: e.To, isDefault: e.IsDefault }));
const withoutRow = (rows: Row[], id: number) => rows.filter(r => r.id !== id);
const withValue = (rows: Row[], id: number, field: 'from' | 'to', value: string) =>
    rows.map(r => (r.id === id ? { ...r, [field]: value, isDefault: false } : r));

/** "es" → "español", in the language of the app. */
const languageName = (code: string) => {
    try {
        const names = new Intl.DisplayNames([ globalize.getCurrentDateTimeLocale() ], { type: 'language' });
        return names.of(code) ?? code;
    } catch {
        return code;
    }
};

const GenreMapCard: FC = () => {
    const { api } = useApi();
    const [ languages, setLanguages ] = useState<Language[] | null>(null);
    const [ selected, setSelected ] = useState<string>('');
    const [ rows, setRows ] = useState<Row[]>([]);
    const [ dirty, setDirty ] = useState(false);
    const [ search, setSearch ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const [ notice, setNotice ] = useState<Notice>(null);

    const request = useCallback(async (path: string, init?: RequestInit) => {
        if (!api) throw new Error('No api');
        const response = await fetch(`${api.basePath}${path}`, {
            ...init,
            headers: { Authorization: api.authorizationHeader, 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(String(response.status));
        return response;
    }, [ api ]);

    const load = useCallback(async (keep?: string) => {
        const map = await (await request('/GenreMap')).json() as { Languages: Language[] };
        setLanguages(map.Languages);
        const language = map.Languages.find(l => l.Language === keep) ?? map.Languages[0];
        setSelected(language?.Language ?? '');
        setRows(toRows(language?.Entries ?? []));
        setDirty(false);
    }, [ request ]);

    useEffect(() => {
        load().catch(() => setNotice({ severity: 'error', text: globalize.translate('GmLoadError') }));
    }, [ load ]);

    const current = languages?.find(l => l.Language === selected);

    const pick = useCallback((code: string) => () => {
        const language = languages?.find(l => l.Language === code);
        setSelected(code);
        setRows(toRows(language?.Entries ?? []));
        setDirty(false);
        setSearch('');
        setNotice(null);
    }, [ languages ]);

    const edit = useCallback((id: number, field: 'from' | 'to') => (e: ChangeEvent<HTMLInputElement>) => {
        setRows(prev => withValue(prev, id, field, e.target.value));
        setDirty(true);
    }, []);
    const remove = useCallback((id: number) => () => {
        setRows(prev => withoutRow(prev, id));
        setDirty(true);
    }, []);
    const add = useCallback(() => {
        setRows(prev => [ { id: nextId++, from: '', to: '', isDefault: false }, ...prev ]);
        setSearch('');
        setDirty(true);
    }, []);
    const onSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []);

    const incomplete = rows.some(r => !r.from.trim() !== !r.to.trim());
    const shown = useMemo(() => {
        const q = search.trim().toLocaleLowerCase();
        return q ? rows.filter(r => r.from.toLocaleLowerCase().includes(q) || r.to.toLocaleLowerCase().includes(q)) : rows;
    }, [ rows, search ]);

    const save = useCallback(async () => {
        setBusy(true);
        setNotice(null);
        try {
            const entries = rows.filter(r => r.from.trim() && r.to.trim()).map(r => ({ From: r.from.trim(), To: r.to.trim() }));
            await request(`/GenreMap/${encodeURIComponent(selected)}`, { method: 'POST', body: JSON.stringify({ Entries: entries }) });
            await load(selected);
            setNotice({ severity: 'success', text: globalize.translate('GmSaved') });
        } catch {
            setNotice({ severity: 'error', text: globalize.translate('GmSaveError') });
        } finally {
            setBusy(false);
        }
    }, [ load, request, rows, selected ]);

    const reset = useCallback(async () => {
        setBusy(true);
        setNotice(null);
        try {
            await request(`/GenreMap/${encodeURIComponent(selected)}`, { method: 'DELETE' });
            await load(selected);
            setNotice({ severity: 'success', text: globalize.translate('GmResetDone') });
        } catch {
            setNotice({ severity: 'error', text: globalize.translate('GmSaveError') });
        } finally {
            setBusy(false);
        }
    }, [ load, request, selected ]);

    const unify = useCallback(async () => {
        setBusy(true);
        setNotice(null);
        try {
            const tasks = await (await request('/ScheduledTasks?isHidden=false')).json() as { Id: string, Key: string }[];
            const task = tasks.find(t => t.Key === UNIFY_TASK_KEY);
            if (!task) throw new Error('No task');
            await request(`/ScheduledTasks/Running/${task.Id}`, { method: 'POST' });
            setNotice({ severity: 'info', text: globalize.translate('GmUnifyStarted') });
        } catch {
            setNotice({ severity: 'error', text: globalize.translate('GmUnifyError') });
        } finally {
            setBusy(false);
        }
    }, [ request ]);

    const onSave = useCallback(() => {
        void save();
    }, [ save ]);
    const onReset = useCallback(() => {
        void reset();
    }, [ reset ]);
    const onUnify = useCallback(() => {
        void unify();
    }, [ unify ]);

    if (!languages) {
        return (
            <SectionCard title={globalize.translate('GmTitle')} icon={<CategoryRoundedIcon />} accentColor={ACCENT} description={globalize.translate('GmHelp')}>
                {notice ? <Alert severity={notice.severity}>{notice.text}</Alert> : <CircularProgress size={24} />}
            </SectionCard>
        );
    }

    return (
        <SectionCard
            title={globalize.translate('GmTitle')}
            icon={<CategoryRoundedIcon />}
            accentColor={ACCENT}
            description={globalize.translate('GmHelp')}
        >
            <Stack spacing={2}>
                {/* Languages: the ones the libraries use first */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }} role='tablist' aria-label={globalize.translate('GmLanguage')}>
                    {languages.map(l => (
                        <Chip
                            key={l.Language}
                            role='tab'
                            aria-selected={l.Language === selected}
                            label={(
                                <span>
                                    {languageName(l.Language)}
                                    {l.InUse && <Box component='span' sx={{ ml: 0.75, opacity: 0.75, fontSize: '0.75em' }}>· {globalize.translate('GmInUse')}</Box>}
                                </span>
                            )}
                            onClick={pick(l.Language)}
                            color={l.Language === selected ? 'primary' : 'default'}
                            variant={l.Language === selected ? 'filled' : 'outlined'}
                            sx={{ minHeight: 36, fontWeight: 700 }}
                        />
                    ))}
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <TextField
                        size='small'
                        value={search}
                        onChange={onSearch}
                        placeholder={globalize.translate('GmSearch')}
                        aria-label={globalize.translate('GmSearch')}
                        sx={{ flex: '1 1 220px' }}
                        slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchRoundedIcon fontSize='small' /></InputAdornment> } }}
                    />
                    <Button variant='outlined' startIcon={<AddRoundedIcon />} onClick={add} sx={{ minHeight: 40 }}>
                        {globalize.translate('GmAdd')}
                    </Button>
                    {current?.IsCustom && <Chip size='small' label={globalize.translate('GmCustom')} sx={{ fontWeight: 700 }} />}
                </Box>

                {/* Each equivalence: as it arrives → as it is saved */}
                <Stack spacing={1} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
                    {shown.length === 0 && (
                        <Typography sx={{ color: TEXT_TERTIARY, fontSize: '0.9rem', py: 1 }}>{globalize.translate('GmEmpty')}</Typography>
                    )}
                    {shown.map(r => (
                        <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                                size='small'
                                value={r.from}
                                onChange={edit(r.id, 'from')}
                                placeholder={globalize.translate('GmFrom')}
                                aria-label={globalize.translate('GmFrom')}
                                sx={{ flex: 1, minWidth: 0 }}
                            />
                            <ArrowForwardRoundedIcon sx={{ color: TEXT_TERTIARY, flexShrink: 0 }} aria-hidden='true' />
                            <TextField
                                size='small'
                                value={r.to}
                                onChange={edit(r.id, 'to')}
                                placeholder={globalize.translate('GmTo')}
                                aria-label={globalize.translate('GmTo')}
                                sx={{ flex: 1, minWidth: 0 }}
                            />
                            <IconButton onClick={remove(r.id)} aria-label={globalize.translate('GmRemove', r.from || '—')} sx={{ width: 44, height: 44, flexShrink: 0 }}>
                                <DeleteOutlineRoundedIcon fontSize='small' />
                            </IconButton>
                        </Box>
                    ))}
                </Stack>

                {incomplete && <Alert severity='warning'>{globalize.translate('GmIncomplete')}</Alert>}
                {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Button
                        variant='contained'
                        onClick={onSave}
                        disabled={busy || !dirty || incomplete}
                        startIcon={busy ? <CircularProgress size={16} color='inherit' /> : <SaveRoundedIcon />}
                        sx={{ minHeight: 44 }}
                    >
                        {globalize.translate('Save')}
                    </Button>
                    <Button variant='outlined' onClick={onUnify} disabled={busy || dirty} startIcon={<MergeTypeRoundedIcon />} sx={{ minHeight: 44 }}>
                        {globalize.translate('GmUnifyNow')}
                    </Button>
                    {current?.IsCustom && (
                        <Button variant='text' color='warning' onClick={onReset} disabled={busy} startIcon={<RestartAltRoundedIcon />} sx={{ minHeight: 44 }}>
                            {globalize.translate('GmReset')}
                        </Button>
                    )}
                </Box>
            </Stack>
        </SectionCard>
    );
};

export default GenreMapCard;
