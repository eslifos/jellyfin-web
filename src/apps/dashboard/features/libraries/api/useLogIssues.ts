import type { Api } from '@jellyfin/sdk';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { useQuery } from '@tanstack/react-query';

import { logKind } from 'apps/dashboard/features/logs/utils/logTypes';
import { useApi } from 'hooks/useApi';

/** How many of the newest server logs are scanned. */
const LOGS_TO_SCAN = 3;

export type ProbeReason = 'json' | 'unreadable' | 'timeout' | 'other';

export interface ProbeIssue {
    path: string;
    reason: ProbeReason;
    message: string;
    date: string;
}

export interface TvdbMiss {
    tvdbId: string;
    episode: string;
    name: string;
    date: string;
}

export interface LogIssues {
    probe: Map<string, ProbeIssue>;
    tvdb: TvdbMiss[];
    scannedFiles: string[];
}

const PROBE_RE = /^\[([^\]]+)\] \[ERR\].*Error in "Probe Provider" for "(.+)"$/;
const TVDB_RE = /^\[([^\]]+)\] \[ERR\].*TvdbEpisodeProvider: Episode (S\d+E\d+) not found for series "(\d+)":"(.*)"$/;

const classify = (message: string): ProbeReason => {
    if (/Expected depth to be zero|JsonException|JsonReaderException/i.test(message)) return 'json';
    if (/streams and format are both null/i.test(message)) return 'unreadable';
    if (/timed out|TaskCanceled/i.test(message)) return 'timeout';
    return 'other';
};

/** Reads the newest server logs and extracts probe failures and TVDB misses. */
const fetchLogIssues = async (api: Api, signal?: AbortSignal): Promise<LogIssues> => {
    const system = getSystemApi(api);
    const { data: files } = await system.getServerLogs({ signal });
    const serverLogs = files
        .filter(f => logKind(f.Name) === 'server')
        .sort((a, b) => Date.parse(b.DateModified || '') - Date.parse(a.DateModified || ''))
        .slice(0, LOGS_TO_SCAN);

    const probe = new Map<string, ProbeIssue>();
    const tvdb: TvdbMiss[] = [];

    // Oldest first, so newer errors overwrite older ones.
    for (const file of serverLogs.reverse()) {
        if (!file.Name) continue;
        const { data } = await system.getLogFile({ name: file.Name }, { signal });
        const text = typeof data === 'string' ? data : String(data);
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const p = PROBE_RE.exec(line);
            if (p) {
                const message = (lines[i + 1] || '').trim();
                probe.set(p[2], { path: p[2], reason: classify(message), message, date: p[1] });
                continue;
            }
            const t = TVDB_RE.exec(line);
            if (t) tvdb.push({ date: t[1], episode: t[2], tvdbId: t[3], name: t[4] });
        }
    }

    return { probe, tvdb, scannedFiles: serverLogs.map(f => f.Name || '') };
};

export const useLogIssues = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'LibraryLogIssues' ],
        queryFn: ({ signal }) => fetchLogIssues(api!, signal),
        enabled: !!api,
        staleTime: 60 * 1000
    });
};
