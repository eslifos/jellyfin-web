/**
 * What the library scan and metadata refreshes are working on right now (custom /Library/Activity endpoint),
 * like Plex's activity list: current work, a live log of the latest steps and the running scheduled tasks.
 * Polled every 1.5 s while something runs, every 10 s otherwise.
 */
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

export type LibraryActivityKind = 'Checking' | 'Scanning' | 'Metadata' | 'Images' | 'Analyzing' | 'Trickplay' | 'ChapterImages' | 'PostScan' | 'Added' | 'Removed' | 'Error';

export interface LibraryActivityItem {
    ItemId?: string | null;
    Title?: string | null;
    File?: string | null;
    Kind: LibraryActivityKind;
    LibraryId?: string | null;
    LibraryName?: string | null;
    StartedUtc: string;
}

export interface RunningTask {
    Id?: string | null;
    Key?: string | null;
    Name?: string | null;
    Progress?: number | null;
}

export interface LibraryActivity {
    current: LibraryActivityItem[];
    log: LibraryActivityItem[];
    tasks: RunningTask[];
}

interface Response {
    Current?: LibraryActivityItem[];
    Log?: LibraryActivityItem[];
    Tasks?: RunningTask[];
}

const KIND_LABELS: Record<LibraryActivityKind, string> = {
    Checking: 'LibActChecking',
    Scanning: 'LibActScanning',
    Metadata: 'LibActMetadata',
    Images: 'LibActImages',
    Analyzing: 'LibActAnalyzing',
    Trickplay: 'LibActTrickplay',
    ChapterImages: 'LibActChapterImages',
    PostScan: 'LibActPostScan',
    Added: 'LibActAdded',
    Removed: 'LibActRemoved',
    Error: 'LibActError'
};

/** Colour of each kind of work, so the live log can be scanned at a glance. */
export const KIND_COLORS: Record<LibraryActivityKind, string> = {
    Checking: 'rgba(255,255,255,0.45)',
    Scanning: '#26c6da',
    Metadata: '#00a4dc',
    Images: '#aa5cc3',
    Analyzing: '#ff9800',
    Trickplay: '#ef5350',
    ChapterImages: '#ec407a',
    PostScan: '#4caf50',
    Added: '#66bb6a',
    Removed: '#ffa726',
    Error: '#ef5350'
};

/** Translation key of the kind of work. */
export const activityLabelKey = (kind: LibraryActivityKind) => KIND_LABELS[kind] ?? 'LibActChecking';

export const normId = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

/** The library scan itself is shown per library, so it is left out of the task list. */
const HIDDEN_TASKS = new Set([ 'RefreshLibrary' ]);

const EMPTY: LibraryActivity = { current: [], log: [], tasks: [] };

export const useLibraryActivity = (busy: boolean, logCount = 40): LibraryActivity => {
    const { api, user } = useApi();
    const isAdmin = !!user?.Policy?.IsAdministrator;

    const { data } = useQuery({
        queryKey: [ 'LibraryActivity', logCount ],
        queryFn: async ({ signal }): Promise<LibraryActivity> => {
            const response = await api!.axiosInstance.get<Response>(`${api!.basePath}/Library/Activity`, {
                headers: { Authorization: api!.authorizationHeader },
                params: { logCount },
                signal
            });
            return {
                current: response.data.Current ?? [],
                log: response.data.Log ?? [],
                tasks: (response.data.Tasks ?? []).filter(t => !HIDDEN_TASKS.has(t.Key ?? ''))
            };
        },
        enabled: !!api && isAdmin,
        refetchInterval: query => {
            const d = query.state.data;
            return busy || (d?.current.length ?? 0) > 0 || (d?.tasks.length ?? 0) > 0 ? 1500 : 10000;
        },
        refetchOnWindowFocus: false,
        retry: false
    });

    return data ?? EMPTY;
};
