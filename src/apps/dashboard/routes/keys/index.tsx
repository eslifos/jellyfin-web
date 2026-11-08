import React, { type FC, useCallback, useMemo, useState } from 'react';
import type { AuthenticationInfo } from '@jellyfin/sdk/lib/generated-client/models/authentication-info';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AppsIcon from '@mui/icons-material/Apps';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import BoltIcon from '@mui/icons-material/Bolt';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyIcon from '@mui/icons-material/Key';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

import { useApiKeys } from 'apps/dashboard/features/keys/api/useApiKeys';
import { useCreateKey } from 'apps/dashboard/features/keys/api/useCreateKey';
import { useRevokeKey } from 'apps/dashboard/features/keys/api/useRevokeKey';
import { Badge, StatTile } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import ConfirmDialog from 'components/ConfirmDialog';
import InputDialog from 'components/InputDialog';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import globalize from 'lib/globalize';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';

import { PageHeader, SectionCard } from '../../components/cosmic';

const DAY = 24 * 3600 * 1000;
const ACTIVE_DAYS = 7;
const IDLE_DAYS = 90;
const COLORS = [ '#00a4dc', '#aa5cc3', '#4caf50', '#ff9800', '#26c6da', '#ef5350', '#ffca28', '#7e57c2' ];

const colorFor = (name?: string | null) => {
    let h = 0;
    for (const ch of name || '') h = ((h * 31) + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
};

/** The server reports year 1 when a key was never used. */
const lastUse = (k: AuthenticationInfo) => {
    const t = k.DateLastActivity ? Date.parse(k.DateLastActivity) : NaN;
    return Number.isNaN(t) || new Date(t).getFullYear() < 2000 ? undefined : t;
};
const relative = (t?: number) => (t ? formatDistanceToNow(t, getLocaleWithSuffix()) : '');
const fullDate = (s?: string | null) => (s ? new Date(s).toLocaleString(globalize.getCurrentDateTimeLocale(), { dateStyle: 'medium', timeStyle: 'short' }) : '');
const mask = (token: string) => `${token.slice(0, 4)}${'•'.repeat(20)}${token.slice(-4)}`;

type Filter = 'all' | 'active' | 'idle' | 'never';
type Sort = 'created' | 'used' | 'name';

const useCopy = () => {
    const [ copied, setCopied ] = useState<string | null>(null);
    const copy = useCallback((id: string, text: string) => {
        void navigator.clipboard?.writeText(text).then(() => {
            setCopied(id);
            setTimeout(() => setCopied(c => (c === id ? null : c)), 1500);
        });
    }, []);
    return { copied, copy };
};

const KeyCard: FC<{ apiKey: AuthenticationInfo; isNew: boolean; onRevoke: (token: string) => void }> = ({ apiKey, isNew, onRevoke }) => {
    const [ visible, setVisible ] = useState(isNew);
    const { copied, copy } = useCopy();
    const token = apiKey.AccessToken || '';
    const color = colorFor(apiKey.AppName);
    const used = lastUse(apiKey);
    const age = used ? Date.now() - used : undefined;
    let usage = { label: globalize.translate('KeyNeverUsed'), color: '#90a4ae' };
    if (age !== undefined && age < ACTIVE_DAYS * DAY) usage = { label: globalize.translate('KeyActive'), color: '#4caf50' };
    else if (age !== undefined && age > IDLE_DAYS * DAY) usage = { label: globalize.translate('KeyIdle'), color: '#ff9800' };
    else if (age !== undefined) usage = { label: globalize.translate('KeyRecent'), color: '#26c6da' };

    const toggle = useCallback(() => setVisible(v => !v), []);
    const doCopy = useCallback(() => copy('k', token), [ copy, token ]);
    const revoke = useCallback(() => onRevoke(token), [ onRevoke, token ]);

    return (
        <Paper elevation={0} sx={{
            position: 'relative', overflow: 'hidden', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderRadius: '16px',
            border: `1px solid ${isNew ? '#4caf50aa' : `${color}33`}`, boxShadow: isNew ? '0 0 24px #4caf5040' : `0 8px 28px rgba(0,0,0,0.3)`,
            transition: 'border-color 0.2s', '&:hover': { borderColor: `${color}77` }
        }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1.25rem', right: '1.25rem', height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                    width: 44, height: 44, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${color}1f`, border: `1px solid ${color}44`, color, fontWeight: 800, fontSize: '1.1rem'
                }}>
                    {(apiKey.AppName || '?').charAt(0).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700, color: '#fff' }}>{apiKey.AppName || globalize.translate('Unknown')}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                        {isNew && <Badge label={globalize.translate('KeyNew')} color='#4caf50' />}
                        <Badge label={usage.label} color={usage.color} dot />
                    </Box>
                </Box>
                <Tooltip title={globalize.translate('ButtonRevoke')}>
                    <IconButton onClick={revoke} sx={{ color: '#ef5350' }}><DeleteIcon /></IconButton>
                </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 1, pl: 1.25, borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <KeyIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)', mr: 0.5 }} />
                <Typography sx={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {visible ? token : mask(token)}
                </Typography>
                <Tooltip title={globalize.translate(visible ? 'KeyHide' : 'KeyShow')}>
                    <IconButton size='small' onClick={toggle}>{visible ? <VisibilityOffIcon sx={{ fontSize: '1rem' }} /> : <VisibilityIcon sx={{ fontSize: '1rem' }} />}</IconButton>
                </Tooltip>
                <Tooltip title={globalize.translate(copied ? 'LtvCopied' : 'KeyCopy')}>
                    <IconButton size='small' onClick={doCopy}><ContentCopyIcon sx={{ fontSize: '1rem' }} /></IconButton>
                </Tooltip>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Box>
                    <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{globalize.translate('HeaderDateIssued')}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{fullDate(apiKey.DateCreated)}</Typography>
                </Box>
                <Box>
                    <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{globalize.translate('KeyLastUsed')}</Typography>
                    <Tooltip title={used ? fullDate(new Date(used).toISOString()) : ''}>
                        <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{used ? relative(used) : globalize.translate('KeyNeverUsed')}</Typography>
                    </Tooltip>
                </Box>
            </Box>
        </Paper>
    );
};

export const Component = () => {
    const { data, isLoading, isError } = useApiKeys();
    const revokeKey = useRevokeKey();
    const createKey = useCreateKey();
    const { copied, copy } = useCopy();
    const [ createOpen, setCreateOpen ] = useState(false);
    const [ toRevoke, setToRevoke ] = useState('');
    const [ query, setQuery ] = useState('');
    const [ filter, setFilter ] = useState<Filter>('all');
    const [ sort, setSort ] = useState<Sort>('created');
    const [ newApp, setNewApp ] = useState<string | null>(null);

    const keys = useMemo(() => data?.Items || [], [ data ]);

    const stats = useMemo(() => {
        const now = Date.now();
        const uses = keys.map(lastUse);
        return {
            total: keys.length,
            active: uses.filter(t => t && now - t < ACTIVE_DAYS * DAY).length,
            idle: uses.filter(t => t && now - t > IDLE_DAYS * DAY).length,
            never: uses.filter(t => !t).length,
            apps: new Set(keys.map(k => k.AppName)).size
        };
    }, [ keys ]);

    /** The key created in this visit (newest with the chosen app name). */
    const newToken = useMemo(() => {
        if (!newApp) return undefined;
        return keys.filter(k => k.AppName === newApp).sort((a, b) => Date.parse(b.DateCreated || '') - Date.parse(a.DateCreated || ''))[0]?.AccessToken || undefined;
    }, [ keys, newApp ]);

    const list = useMemo(() => {
        const now = Date.now();
        const q = query.toLowerCase();
        const filtered = keys.filter(k => {
            if (q && !(k.AppName || '').toLowerCase().includes(q) && !(k.AccessToken || '').toLowerCase().includes(q)) return false;
            const t = lastUse(k);
            if (filter === 'active') return !!t && now - t < ACTIVE_DAYS * DAY;
            if (filter === 'idle') return !!t && now - t > IDLE_DAYS * DAY;
            if (filter === 'never') return !t;
            return true;
        });
        return filtered.sort((a, b) => {
            if (a.AccessToken === newToken) return -1;
            if (b.AccessToken === newToken) return 1;
            if (sort === 'name') return (a.AppName || '').localeCompare(b.AppName || '');
            if (sort === 'used') return (lastUse(b) || 0) - (lastUse(a) || 0);
            return Date.parse(b.DateCreated || '') - Date.parse(a.DateCreated || '');
        });
    }, [ filter, keys, newToken, query, sort ]);

    const openCreate = useCallback(() => setCreateOpen(true), []);
    const closeCreate = useCallback(() => setCreateOpen(false), []);
    const onCreate = useCallback((name: string) => {
        createKey.mutate({ app: name }, {
            onSuccess: () => setNewApp(name),
            onSettled: () => setCreateOpen(false)
        });
    }, [ createKey ]);
    const onRevoke = useCallback((token: string) => setToRevoke(token), []);
    const cancelRevoke = useCallback(() => setToRevoke(''), []);
    const confirmRevoke = useCallback(() => {
        revokeKey.mutate({ key: toRevoke }, { onSettled: () => setToRevoke('') });
    }, [ revokeKey, toRevoke ]);
    const toggleFilter = useCallback((f: Filter) => setFilter(cur => (cur === f ? 'all' : f)), []);

    if (isLoading) return <Loading />;

    const origin = window.location.origin + window.location.pathname.replace(/\/web\/.*$/, '').replace(/\/$/, '');
    const sample = newToken || globalize.translate('KeyPlaceholder');
    const examples = [
        { id: 'header', label: globalize.translate('KeyExampleHeader'), code: `curl -H 'Authorization: MediaBrowser Token="${sample}"' ${origin}/System/Info` },
        { id: 'query', label: globalize.translate('KeyExampleQuery'), code: `${origin}/Items/Counts?api_key=${sample}` }
    ];

    return (
        <Page id='apiKeysPage' title={globalize.translate('HeaderApiKeys')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('HeaderApiKeys')}
                    subtitle={globalize.translate('HeaderApiKeysHelp')}
                    actions={(
                        <Button variant='contained' size='small' startIcon={<AddIcon />} onClick={openCreate}>{globalize.translate('HeaderNewApiKey')}</Button>
                    )}
                />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('ApiKeysLoadError')}</Alert>
                ) : (
                    <>
                        {createKey.isError && <Alert severity='error' sx={{ mb: 2 }}>{globalize.translate('KeyCreateError')}</Alert>}
                        {revokeKey.isError && <Alert severity='error' sx={{ mb: 2 }}>{globalize.translate('KeyRevokeError')}</Alert>}
                        {newToken && (
                            <Alert severity='success' sx={{ mb: 2, alignItems: 'center' }} action={(
                                <Button color='inherit' size='small' startIcon={<ContentCopyIcon />} onClick={() => copy('new', newToken)}>
                                    {globalize.translate(copied === 'new' ? 'LtvCopied' : 'KeyCopy')}
                                </Button>
                            )}>
                                {globalize.translate('KeyCreated', newApp || '')}
                            </Alert>
                        )}

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5, mb: 2.5 }}>
                            <StatTile icon={<KeyIcon />} label={globalize.translate('KeyTotal')} value={stats.total} color='#00a4dc' active={filter === 'all'} onClick={() => setFilter('all')} />
                            <StatTile icon={<BoltIcon />} label={globalize.translate('KeyActive7d')} value={stats.active} color='#4caf50' active={filter === 'active'} onClick={() => toggleFilter('active')} />
                            <StatTile icon={<BedtimeIcon />} label={globalize.translate('KeyIdle90d')} value={stats.idle} color='#ff9800' active={filter === 'idle'} onClick={() => toggleFilter('idle')} />
                            <StatTile icon={<KeyIcon />} label={globalize.translate('KeyNeverUsed')} value={stats.never} color='#90a4ae' active={filter === 'never'} onClick={() => toggleFilter('never')} />
                            <StatTile icon={<AppsIcon />} label={globalize.translate('KeyApps')} value={stats.apps} color='#aa5cc3' />
                        </Box>

                        {keys.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
                                <TextField size='small' placeholder={globalize.translate('KeySearch')} value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 240px' }}
                                    slotProps={{ input: { startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment> } }} />
                                <TextField select size='small' label={globalize.translate('LabelSortBy')} value={sort} onChange={e => setSort(e.target.value as Sort)} sx={{ minWidth: 170 }} slotProps={{ inputLabel: { shrink: true } }}>
                                    <MenuItem value='created'>{globalize.translate('HeaderDateIssued')}</MenuItem>
                                    <MenuItem value='used'>{globalize.translate('KeyLastUsed')}</MenuItem>
                                    <MenuItem value='name'>{globalize.translate('HeaderApp')}</MenuItem>
                                </TextField>
                            </Box>
                        )}

                        {keys.length === 0 ? (
                            <Paper elevation={0} sx={{ p: 4, mb: 2.5, textAlign: 'center', borderRadius: '16px' }}>
                                <KeyIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.25)' }} />
                                <Typography sx={{ fontWeight: 700, mt: 1 }}>{globalize.translate('KeyNone')}</Typography>
                                <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', mt: 0.5, mb: 2 }}>{globalize.translate('KeyNoneHelp')}</Typography>
                                <Button variant='contained' startIcon={<AddIcon />} onClick={openCreate}>{globalize.translate('HeaderNewApiKey')}</Button>
                            </Paper>
                        ) : (
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 2, mb: 2.5 }}>
                                {list.map(k => <KeyCard key={k.AccessToken} apiKey={k} isNew={k.AccessToken === newToken} onRevoke={onRevoke} />)}
                                {list.length === 0 && <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('KeyNoMatch')}</Typography>}
                            </Box>
                        )}

                        <SectionCard title={globalize.translate('KeyHowTo')} icon={<CodeIcon />} accentColor='#26c6da' description={globalize.translate('KeyHowToHelp')}>
                            <Stack spacing={1.5}>
                                {examples.map(ex => (
                                    <Box key={ex.id}>
                                        <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)', mb: 0.5 }}>{ex.label}</Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 1, pl: 1.25, borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            <Typography sx={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.76rem', color: '#9be7ff', overflowX: 'auto', whiteSpace: 'nowrap' }}>{ex.code}</Typography>
                                            <Tooltip title={globalize.translate(copied === ex.id ? 'LtvCopied' : 'KeyCopy')}>
                                                <IconButton size='small' onClick={() => copy(ex.id, ex.code)}><ContentCopyIcon sx={{ fontSize: '1rem' }} /></IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                ))}
                                <Alert severity='warning' sx={{ fontSize: '0.8rem' }}>{globalize.translate('KeySecurity')}</Alert>
                            </Stack>
                        </SectionCard>
                    </>
                )}
            </Box>

            <ConfirmDialog
                open={!!toRevoke}
                title={globalize.translate('HeaderConfirmRevokeApiKey')}
                text={globalize.translate('MessageConfirmRevokeApiKey')}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('ButtonRevoke')}
                onConfirm={confirmRevoke}
                onCancel={cancelRevoke}
            />
            <InputDialog
                open={createOpen}
                title={globalize.translate('HeaderNewApiKey')}
                label={globalize.translate('LabelAppName')}
                helperText={globalize.translate('LabelAppNameExample')}
                confirmButtonText={globalize.translate('Create')}
                onConfirm={onCreate}
                onClose={closeCreate}
            />
        </Page>
    );
};

Component.displayName = 'ApiKeysPage';
