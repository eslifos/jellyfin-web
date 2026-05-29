import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ServerConnections } from 'lib/jellyfin-apiclient';

export const QUERY_KEY = 'StartupConfiguration';

const getClient = () => {
    const client = ServerConnections.currentApiClient();
    if (!client) throw new Error('No API client available');
    return client;
};

/** Performs a GET then PATCH on Startup/Configuration to preserve existing fields. */
const patchStartupConfig = async (patch: Record<string, unknown>) => {
    const client = getClient();
    const current = await client.getJSON(client.getUrl('Startup/Configuration'));
    const merged = { ...current, ...patch };
    return client.ajax({
        type: 'POST',
        url: client.getUrl('Startup/Configuration'),
        data: JSON.stringify(merged),
        contentType: 'application/json'
    });
};

/** Fetches the initial startup wizard configuration. */
export const useStartupConfig = () => useQuery({
    queryKey: [ QUERY_KEY ],
    queryFn: async () => {
        const client = getClient();
        return client.getJSON(client.getUrl('Startup/Configuration'));
    }
});

/** Updates server name and UI culture while preserving all other config fields. */
export const useUpdateStartupConfig = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (dto: { ServerName?: string; UICulture?: string }) =>
            patchStartupConfig(dto as Record<string, unknown>),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [ QUERY_KEY ] });
        }
    });
};

/** Updates metadata language and country while preserving all other config fields. */
export const useUpdateMetadataSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (dto: { MetadataCountryCode: string; PreferredMetadataLanguage: string }) =>
            patchStartupConfig(dto as Record<string, unknown>),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [ QUERY_KEY ] });
        }
    });
};

/** Creates the initial administrator user account. */
export const useUpdateStartupUser = () => useMutation({
    mutationFn: async (dto: { Name?: string; Password?: string }) => {
        const client = getClient();
        return client.ajax({
            type: 'POST',
            url: client.getUrl('Startup/User'),
            data: JSON.stringify(dto),
            contentType: 'application/json'
        });
    }
});

/** Configures remote access and UPnP port mapping settings. */
export const useSetRemoteAccess = () => useMutation({
    mutationFn: async (dto: { EnableRemoteAccess: boolean; EnableAutomaticPortMapping: boolean }) => {
        const client = getClient();
        return client.ajax({
            type: 'POST',
            url: client.getUrl('Startup/RemoteAccess'),
            data: JSON.stringify(dto),
            contentType: 'application/json'
        });
    }
});

/** Marks the startup wizard as completed on the server. */
export const useCompleteWizard = () => useMutation({
    mutationFn: async () => {
        const client = getClient();
        return client.ajax({ type: 'POST', url: client.getUrl('Startup/Complete') });
    }
});
