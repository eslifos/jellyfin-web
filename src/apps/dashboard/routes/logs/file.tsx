import React, { type FC, memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import SensorsIcon from '@mui/icons-material/Sensors';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import WrapTextIcon from '@mui/icons-material/WrapText';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import Toast from 'apps/dashboard/components/Toast';
import { useServerLog } from 'apps/dashboard/features/logs/api/useServerLog';
import { LEVEL_COLORS, LOG_KINDS, type LogLevel, type LogLine, formatSize, logKind, parseLog } from 'apps/dashboard/features/logs/utils/logTypes';
import { Badge } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import globalize from 'lib/globalize';
import { copy } from 'scripts/clipboard';

/** Lines rendered at once; older ones are hidden behind a button. */
const MAX_LINES = 3000;
const LEVELS: LogLevel[] = [ 'FTL', 'ERR', 'WRN', 'INF', 'DBG' ];
const LEVEL_LABELS: Record<LogLevel, string> = { FTL: 'LogLvlFatal', ERR: 'LogLvlError', WRN: 'LogLvlWarning', INF: 'LogLvlInfo', DBG: 'LogLvlDebug', VRB: 'LogLvlVerbose' };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const Highlight: FC<{ text: string; re?: RegExp }> = ({ text, re }) => {
    if (!re) return <>{text}</>;
    const parts = text.split(re);
    return (
        <>
            {parts.map((p, i) => (i % 2 === 1 ?
                <Box key={i} component='mark' sx={{ background: '#ffca28', color: '#000', borderRadius: '3px', px: '2px' }}>{p}</Box> :
                <React.Fragment key={i}>{p}</React.Fragment>))}
        </>
    );
};

const Line: FC<{ line: LogLine; re?: RegExp; wrap: boolean }> = memo(({ line, re, wrap }) => {
    const color = line.level ? LEVEL_COLORS[line.level] : 'rgba(255,255,255,0.8)';
    const important = line.level === 'ERR' || line.level === 'FTL';
    return (
        <Box sx={{
            display: 'flex', gap: 1.5, px: 1, minHeight: '1.45em',
            background: important ? 'rgba(239,83,80,0.07)' : (line.level === 'WRN' && 'rgba(255,202,40,0.05)') || 'transparent',
            borderLeft: `2px solid ${line.start && line.level ? color : 'transparent'}`,
            '&:hover': { background: 'rgba(255,255,255,0.04)' }
        }}>
            <Box component='span' sx={{ color: 'rgba(255,255,255,0.25)', userSelect: 'none', minWidth: '4.5ch', textAlign: 'right', flexShrink: 0 }}>{line.n}</Box>
            <Box component='span' sx={{
                color: line.start ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.6)',
                whiteSpace: wrap ? 'pre-wrap' : 'pre', wordBreak: wrap ? 'break-word' : 'normal', flex: 1, minWidth: 0
            }}>
                {line.start && line.level ? (
                    <>
                        <Highlight text={line.text.slice(0, line.text.indexOf(']') + 1)} re={re} />
                        {' '}
                        <Box component='span' sx={{ color, fontWeight: 700 }}>[{line.level}]</Box>
                        <Highlight text={line.text.slice(line.text.indexOf(`[${line.level}]`) + line.level.length + 2)} re={re} />
                    </>
                ) : <Highlight text={line.text} re={re} />}
            </Box>
        </Box>
    );
});
Line.displayName = 'LogLine';

export const Component = () => {
    const { file: fileName } = useParams();
    const [ params ] = useSearchParams();
    const viewerRef = useRef<HTMLDivElement | null>(null);
    const [ live, setLive ] = useState(params.get('live') === '1');
    const [ follow, setFollow ] = useState(params.get('live') === '1');
    const [ wrap, setWrap ] = useState(true);
    const [ query, setQuery ] = useState('');
    const [ onlyMatches, setOnlyMatches ] = useState(true);
    const [ levels, setLevels ] = useState<LogLevel[]>([]);
    const [ showAll, setShowAll ] = useState(false);
    const [ toast, setToast ] = useState(false);
    const deferredQuery = useDeferredValue(query);

    const { isError, isPending, data: log, refetch, dataUpdatedAt } = useServerLog(fileName ?? '', live ? 2000 : false);

    const lines = useMemo(() => parseLog(log || ''), [ log ]);

    const counts = useMemo(() => {
        const c: Partial<Record<LogLevel, number>> = {};
        lines.forEach(l => {
            if (l.start && l.level) c[l.level] = (c[l.level] || 0) + 1;
        });
        return c;
    }, [ lines ]);

    const re = useMemo(() => (deferredQuery ? new RegExp(`(${escapeRe(deferredQuery)})`, 'gi') : undefined), [ deferredQuery ]);

    const filtered = useMemo(() => {
        const q = deferredQuery.toLowerCase();
        return lines.filter(l => {
            if (levels.length && (!l.level || !levels.includes(l.level))) return false;
            if (q && onlyMatches && !l.text.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [ deferredQuery, levels, lines, onlyMatches ]);

    const matchCount = useMemo(() => (deferredQuery ? lines.filter(l => l.text.toLowerCase().includes(deferredQuery.toLowerCase())).length : 0), [ deferredQuery, lines ]);
    const hidden = showAll ? 0 : Math.max(0, filtered.length - MAX_LINES);
    const visible = hidden ? filtered.slice(hidden) : filtered;

    const toBottom = useCallback(() => {
        const el = viewerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, []);
    const toTop = useCallback(() => {
        const el = viewerRef.current;
        if (el) el.scrollTop = 0;
        setFollow(false);
    }, []);

    useEffect(() => {
        if (follow) toBottom();
    }, [ follow, visible.length, dataUpdatedAt, toBottom ]);

    const onScroll = useCallback(() => {
        const el = viewerRef.current;
        if (!el || !live) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        setFollow(atBottom);
    }, [ live ]);

    const toggleLive = useCallback(() => {
        if (!live) setFollow(true);
        setLive(!live);
    }, [ live ]);
    const toggleLevel = useCallback((lvl: LogLevel) => setLevels(cur => (cur.includes(lvl) ? cur.filter(x => x !== lvl) : [ ...cur, lvl ])), []);
    const onCopy = useCallback(async () => {
        await copy(filtered.length === lines.length ? (log || '') : filtered.map(l => l.text).join('\n'));
        setToast(true);
    }, [ filtered, lines.length, log ]);
    const onDownload = useCallback(() => {
        if (!log || !fileName) return;
        const url = URL.createObjectURL(new Blob([ log ], { type: 'text/plain' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }, [ fileName, log ]);
    const retry = useCallback(() => void refetch(), [ refetch ]);
    const closeToast = useCallback(() => setToast(false), []);
    const toggleWrap = useCallback(() => setWrap(v => !v), []);
    const showEverything = useCallback(() => setShowAll(true), []);

    const kind = LOG_KINDS[logKind(fileName)];
    const bytes = log ? new Blob([ log ]).size : 0;

    return (
        <Page id='logPage' title={fileName} className='mainAnimatedPage type-interior fullWidthContent'>
            <Toast open={toast} onClose={closeToast} message={globalize.translate('CopyLogSuccess')} />
            <Box className='content-primary' sx={{ pb: 4 }}>
                <Button component={Link} to='/dashboard/logs' startIcon={<ArrowBackIcon />} size='small' sx={{ mb: 1, mt: 1 }}>{globalize.translate('TabLogs')}</Button>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                    <Box sx={{
                        width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${kind.color}1f`, border: `1px solid ${kind.color}44`, '& svg': { color: kind.color }
                    }}>{kind.icon}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography component='h1' sx={{ fontFamily: 'monospace', fontSize: { xs: '1rem', md: '1.25rem' }, fontWeight: 700, overflowWrap: 'anywhere' }}>{fileName}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                            <Badge label={globalize.translate(kind.labelKey)} color={kind.color} />
                            {log && <Badge label={formatSize(bytes)} color='#aa5cc3' />}
                            {log && <Badge label={globalize.translate('LogLines', lines.length)} color='#26c6da' />}
                            {live && <Badge label={globalize.translate('LogLive')} color='#4caf50' dot />}
                        </Box>
                    </Box>
                </Box>

                {isError && (
                    <Alert severity='error' sx={{ mb: 2 }} action={<Button color='inherit' size='small' onClick={retry}>{globalize.translate('Retry')}</Button>}>
                        {globalize.translate('LogLoadFailure')}
                    </Alert>
                )}

                {isPending ? <Loading /> : !isError && (
                    <Paper elevation={0} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
                        {/* Toolbar */}
                        <Box sx={{ p: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <TextField
                                size='small'
                                placeholder={globalize.translate('LogFind')}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                sx={{ flex: '1 1 220px' }}
                                slotProps={{ input: {
                                    startAdornment: <InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment>,
                                    endAdornment: query ? <InputAdornment position='end'><Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{matchCount}</Typography></InputAdornment> : undefined
                                } }}
                            />
                            {query && (
                                <Box component='label' sx={{ display: 'flex', alignItems: 'center', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                                    <Switch size='small' checked={onlyMatches} onChange={(_, v) => setOnlyMatches(v)} />
                                    {globalize.translate('LogOnlyMatches')}
                                </Box>
                            )}
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {LEVELS.filter(l => counts[l]).map(l => {
                                    const on = levels.includes(l);
                                    const c = LEVEL_COLORS[l];
                                    return (
                                        <Box key={l} component='button' type='button' onClick={() => toggleLevel(l)} sx={{
                                            all: 'unset', cursor: 'pointer', px: 1, py: 0.4, borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700,
                                            color: on ? '#000' : c, background: on ? c : `${c}17`, border: `1px solid ${c}55`
                                        }}>
                                            {globalize.translate(LEVEL_LABELS[l])} · {counts[l]}
                                        </Box>
                                    );
                                })}
                            </Box>
                            <Box sx={{ flex: 1 }} />
                            <Button size='small' variant={live ? 'contained' : 'outlined'} color={live ? 'success' : 'primary'} startIcon={<SensorsIcon />} onClick={toggleLive}>
                                {globalize.translate(live ? 'Unwatch' : 'Watch')}
                            </Button>
                            <Tooltip title={globalize.translate('LogWrap')}>
                                <IconButton size='small' onClick={toggleWrap} sx={{ color: wrap ? '#00a4dc' : undefined }}><WrapTextIcon fontSize='small' /></IconButton>
                            </Tooltip>
                            <Tooltip title={globalize.translate('LogTop')}><IconButton size='small' onClick={toTop}><VerticalAlignTopIcon fontSize='small' /></IconButton></Tooltip>
                            <Tooltip title={globalize.translate('LogBottom')}><IconButton size='small' onClick={toBottom}><VerticalAlignBottomIcon fontSize='small' /></IconButton></Tooltip>
                            <Tooltip title={globalize.translate(filtered.length === lines.length ? 'Copy' : 'LogCopyFiltered')}>
                                <IconButton size='small' onClick={onCopy}><ContentCopyIcon fontSize='small' /></IconButton>
                            </Tooltip>
                            <Tooltip title={globalize.translate('Download')}><IconButton size='small' onClick={onDownload}><FileDownloadIcon fontSize='small' /></IconButton></Tooltip>
                        </Box>

                        {(levels.length > 0 || (query && onlyMatches)) && (
                            <Box sx={{ px: 1.5, py: 0.75, fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                {globalize.translate('LogShowing', filtered.length, lines.length)}
                            </Box>
                        )}

                        {/* Viewer */}
                        <Box ref={viewerRef} onScroll={onScroll} sx={{
                            height: 'calc(100vh - 300px)', minHeight: 320, overflow: 'auto', py: 1,
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.76rem', lineHeight: 1.45,
                            background: 'rgba(0,0,0,0.35)'
                        }}>
                            {hidden > 0 && (
                                <Box sx={{ textAlign: 'center', py: 1 }}>
                                    <Button size='small' onClick={showEverything}>{globalize.translate('LogShowOlder', hidden)}</Button>
                                </Box>
                            )}
                            {visible.length ? visible.map(l => <Line key={l.n} line={l} re={re} wrap={wrap} />) : (
                                <Typography sx={{ p: 2, color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{globalize.translate('LogNoLines')}</Typography>
                            )}
                        </Box>

                        {live && !follow && (
                            <Box sx={{ p: 1, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <Button size='small' startIcon={<VerticalAlignBottomIcon />} onClick={() => { setFollow(true); toBottom(); }}>{globalize.translate('LogFollow')}</Button>
                            </Box>
                        )}
                    </Paper>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'LogPage';
