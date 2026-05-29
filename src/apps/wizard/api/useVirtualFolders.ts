import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ServerConnections } from 'lib/jellyfin-apiclient';

const QUERY_KEY = 'WizardVirtualFolders';

const getClient = () => {
    const client = ServerConnections.currentApiClient();
    if (!client) throw new Error('No API client available');
    return client;
};

/** Fetches the list of configured media library virtual folders. */
export const useVirtualFolders = () => useQuery({
    queryKey: [ QUERY_KEY ],
    queryFn: async () => {
        const client = getClient();
        return client.getJSON(client.getUrl('Library/VirtualFolders')) as Promise<Array<{
            Name?: string;
            ItemId?: string;
            CollectionType?: string;
            Locations?: string[];
        }>>;
    }
});

/** Creates a new media library virtual folder with the given name, type, and paths. */
export const useAddVirtualFolder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: { name: string; collectionType: string; paths: string[] }) => {
            const client = getClient();
            return client.ajax({
                type: 'POST',
                url: client.getUrl('Library/VirtualFolders', {
                    name: params.name,
                    collectionType: params.collectionType,
                    paths: params.paths,
                    refreshLibrary: false
                }),
                contentType: 'application/json'
            });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [ QUERY_KEY ] });
        }
    });
};

/** Removes a media library virtual folder by name. */
export const useDeleteVirtualFolder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (name: string) => {
            const client = getClient();
            return client.ajax({
                type: 'DELETE',
                url: client.getUrl('Library/VirtualFolders', { name, refreshLibrary: false })
            });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [ QUERY_KEY ] });
        }
    });
};
