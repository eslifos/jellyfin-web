/**
 * The encrypted offline downloads of every phone and tablet, as the server sees them (live): shared by the
 * dashboard home panel and the downloads monitor page.
 */
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

export interface Transcode {
    CompletionPercentage?: number | null;
    Framerate?: number | null;
    BitRate?: number | null;
    BytesTranscoded?: number | null;
    SourceVideo?: string | null;
    SourceAudio?: string | null;
}

export interface Download {
    ItemId: string;
    Name: string;
    GroupName?: string | null;
    Type?: string | null;
    Quality?: string | null;
    Status: string;
    Reason?: string | null;
    Done: number;
    Total: number;
    Bytes: number;
    EstimatedBytes: number;
    SpeedBytesPerSecond: number;
    EtaSeconds?: number | null;
    UserName: string;
    DeviceName: string;
    Client?: string | null;
    StartedAt: string;
    UpdatedAt: string;
    CompletedAt?: string | null;
    Transcode?: Transcode | null;
}

export const ACTIVE = new Set([ 'queued', 'preparing', 'downloading' ]);

export const STATUS_COLORS: Record<string, string> = {
    preparing: '#ffb547',
    downloading: '#00a4dc',
    queued: '#90a4ae',
    paused: '#90a4ae',
    done: '#2ec4b6',
    error: '#ef5350'
};

export const bytes = (n: number) => {
    if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
    if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${Math.round(n / 1024)} KB`;
};

export const duration = (seconds?: number | null) => {
    if (seconds == null || !isFinite(seconds)) return '—';
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h) return `${h} h ${m} min`;
    return m ? `${m} min ${s % 60} s` : `${s} s`;
};

export const ago = (iso: string) => duration((Date.now() - Date.parse(iso)) / 1000);

export const time = (iso: string) => new Date(iso).toLocaleTimeString(globalize.getCurrentDateTimeLocale(), { hour: '2-digit', minute: '2-digit' });

export const percentOf = (d: Download) => {
    if (d.Status === 'done') return 100;
    return d.Total ? Math.round((d.Done / d.Total) * 100) : 0;
};

const reasonText = (reason?: string | null) => {
    switch (reason) {
        case 'space': return globalize.translate('DmReasonSpace');
        case 'wifi': return globalize.translate('DmReasonWifi');
        case 'network': return globalize.translate('DmReasonNetwork');
        case 'server': return globalize.translate('DmReasonServer');
        case 'silent': return globalize.translate('DmReasonSilent');
        default: return undefined;
    }
};

/** The step the download is in, in words. */
export const stepText = (d: Download) => {
    switch (d.Status) {
        case 'preparing': return globalize.translate('DmStepPreparing');
        case 'downloading': return globalize.translate('DmStepDownloading', d.Done, d.Total);
        case 'queued': return reasonText(d.Reason) ?? globalize.translate('DmStepQueued');
        case 'paused': return reasonText(d.Reason) ?? globalize.translate('DmStepPaused');
        case 'done': return globalize.translate('DmStepDone', d.CompletedAt ? time(d.CompletedAt) : '');
        case 'error': return reasonText(d.Reason) ?? globalize.translate('DmStepError');
        default: return d.Status;
    }
};

/** Downloads of every device, asked again every few seconds. */
export const useDownloadMonitor = (refetchInterval: number) => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'DownloadMonitor' ],
        queryFn: async ({ signal }) => (await api!.axiosInstance.get<Download[]>(`${api!.basePath}/Downloads/Monitor`, {
            headers: { Authorization: api!.authorizationHeader },
            signal
        })).data,
        enabled: !!api,
        refetchInterval
    });
};
