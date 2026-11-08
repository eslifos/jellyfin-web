import type { Api } from '@jellyfin/sdk';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

/** Mirrors MediaBrowser.Model.MediaInfo.VobSubRepairStatus on the server. */
export type VobSubStatus = 'NotNeeded' | 'NeedsRepair' | 'Repaired' | 'Failed' | 'ToolsMissing' | 'Unsupported';

export interface VobSubResult {
    Status: VobSubStatus;
    Message?: string | null;
    Path?: string | null;
    BrokenTracks?: number[];
    Size?: string | null;
    BackupPath?: string | null;
}

const headers = (api: Api) => ({ Authorization: api.authorizationHeader });

/** Custom server endpoint: repairs the broken VobSub tracks of an item (can take minutes). */
export const repairVobSub = async (api: Api, itemId: string, keepBackup: boolean) => {
    const res = await api.axiosInstance.post<VobSubResult>(
        `${api.basePath}/LibraryHealth/VobSub/${itemId}/Repair`,
        null,
        { params: { keepBackup }, headers: headers(api), timeout: 0 }
    );
    return res.data;
};

/** mkvtoolnix version on the server; empty string when missing, null when the endpoint does not exist (old server). */
export const useVobSubTools = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'VobSubTools' ],
        queryFn: async ({ signal }) => {
            try {
                const res = await api!.axiosInstance.get<string>(`${api!.basePath}/LibraryHealth/VobSub/Tools`, { headers: headers(api!), signal });
                return { version: res.data || '', serverSupports: true };
            } catch (err) {
                const status = (err as { response?: { status?: number } }).response?.status;
                if (status === 404) return { version: '', serverSupports: false };
                throw err;
            }
        },
        enabled: !!api,
        staleTime: 5 * 60 * 1000,
        retry: false
    });
};

export interface RepairBackup {
    ItemId: string;
    Name?: string | null;
    Path?: string | null;
    Size: number;
    DateModified: string;
}

export const BACKUPS_KEY = 'RepairBackups';

/** .bak copies left next to repaired files (custom endpoint; empty on old servers). */
export const useRepairBackups = (enabled: boolean) => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ BACKUPS_KEY ],
        queryFn: async ({ signal }) => {
            const res = await api!.axiosInstance.get<RepairBackup[]>(`${api!.basePath}/LibraryHealth/Backups`, { headers: headers(api!), signal, timeout: 0 });
            return res.data || [];
        },
        enabled: !!api && enabled,
        staleTime: 30 * 1000
    });
};

/** Deletes the backups of the given items, or all of them when the list is empty. */
export const deleteRepairBackups = async (api: Api, itemIds: string[]) => {
    const res = await api.axiosInstance.post<RepairBackup[]>(`${api.basePath}/LibraryHealth/Backups/Delete`, itemIds, {
        headers: { ...headers(api), 'Content-Type': 'application/json' },
        timeout: 0
    });
    return res.data || [];
};
