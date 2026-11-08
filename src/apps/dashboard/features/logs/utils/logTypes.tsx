import React from 'react';
import DnsIcon from '@mui/icons-material/Dns';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import ArticleIcon from '@mui/icons-material/Article';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import StreamIcon from '@mui/icons-material/Stream';

export type LogKind = 'server' | 'transcode' | 'remux' | 'direct' | 'other';

export const LOG_KINDS: Record<LogKind, { labelKey: string; color: string; icon: React.ReactNode }> = {
    server: { labelKey: 'LogKindServer', color: '#00a4dc', icon: <DnsIcon /> },
    transcode: { labelKey: 'LogKindTranscode', color: '#ff9800', icon: <MovieFilterIcon /> },
    remux: { labelKey: 'LogKindRemux', color: '#aa5cc3', icon: <SwapHorizIcon /> },
    direct: { labelKey: 'LogKindDirect', color: '#4caf50', icon: <StreamIcon /> },
    other: { labelKey: 'LogKindOther', color: '#90a4ae', icon: <ArticleIcon /> }
};

/** Classifies a log file by its name (log_20261107.log, FFmpeg.Transcode-..., etc). */
export const logKind = (name?: string | null): LogKind => {
    const n = (name || '').toLowerCase();
    if (n.includes('transcode')) return 'transcode';
    if (n.includes('remux')) return 'remux';
    if (n.includes('directstream')) return 'direct';
    if (/^(log_|jellyfin)/.test(n)) return 'server';
    return 'other';
};

export const formatSize = (bytes?: number | null) => {
    if (!bytes) return '0 B';
    const units = [ 'B', 'KB', 'MB', 'GB' ];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v < 10 && i ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
};

export type LogLevel = 'FTL' | 'ERR' | 'WRN' | 'INF' | 'DBG' | 'VRB';

export const LEVEL_COLORS: Record<LogLevel, string> = {
    FTL: '#ff1744', ERR: '#ef5350', WRN: '#ffca28', INF: '#4fc3f7', DBG: '#90a4ae', VRB: '#78909c'
};

const LEVEL_RE = /^\[[^\]]+\]\s\[(FTL|ERR|WRN|INF|DBG|VRB)\]/;

export interface LogLine { n: number; text: string; level?: LogLevel; start: boolean }

/** Splits a log into lines; continuation lines (stack traces) inherit the level of their entry. */
export const parseLog = (text: string): LogLine[] => {
    const lines = text.split(/\r?\n/);
    let current: LogLevel | undefined;
    return lines.map((line, i) => {
        const m = LEVEL_RE.exec(line);
        if (m) current = m[1] as LogLevel;
        return { n: i + 1, text: line, level: current, start: !!m };
    });
};
