import type { Api } from '@jellyfin/sdk';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

/** Response of the custom /ResourceMonitor endpoint (Jellyfin.Api ResourceMonitorController). */
export interface ServerResources {
    CpuUsagePercent?: number | null
    ProcessCpuPercent: number
    CpuCores: number
    LoadAverage?: number[] | null
    MemoryTotalBytes?: number | null
    MemoryAvailableBytes?: number | null
    ContainerMemoryUsedBytes?: number | null
    ContainerMemoryLimitBytes?: number | null
    ProcessMemoryBytes: number
    ManagedHeapBytes: number
    NetworkReceiveBytesPerSecond?: number | null
    NetworkTransmitBytesPerSecond?: number | null
    NetworkReceiveTotalBytes?: number | null
    NetworkTransmitTotalBytes?: number | null
    FfmpegProcessCount: number
    ThreadCount: number
    UptimeSeconds: number
}

export const REFRESH_INTERVAL_MS = 3000;

const fetchServerResources = async (api: Api, signal?: AbortSignal) => {
    const response = await api.axiosInstance.get<ServerResources>(`${api.basePath}/ResourceMonitor`, {
        headers: { Authorization: api.authorizationHeader },
        signal
    });
    return response.data;
};

export const useServerResources = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'ServerResources' ],
        queryFn: ({ signal }) => fetchServerResources(api!, signal),
        enabled: !!api,
        refetchInterval: REFRESH_INTERVAL_MS,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        retry: false
    });
};
