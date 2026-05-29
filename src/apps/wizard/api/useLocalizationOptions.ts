import { useQuery } from '@tanstack/react-query';
import { ServerConnections } from 'lib/jellyfin-apiclient';

const getClient = () => {
    const client = ServerConnections.currentApiClient();
    if (!client) throw new Error('No API client available');
    return client;
};

/** Fetches all available UI culture/language options from the server. */
export const useLocalizationOptions = () => useQuery({
    queryKey: [ 'LocalizationOptions' ],
    queryFn: async () => {
        const client = getClient();
        return client.getJSON(client.getUrl('Localization/Options')) as Promise<Array<{ Name: string; Value: string }>>;
    },
    staleTime: Infinity
});

/** Fetches all available country options for metadata region settings. */
export const useLocalizationCountries = () => useQuery({
    queryKey: [ 'LocalizationCountries' ],
    queryFn: async () => {
        const client = getClient();
        return client.getJSON(client.getUrl('Localization/Countries')) as Promise<Array<{ DisplayName: string; TwoLetterISORegionName: string }>>;
    },
    staleTime: Infinity
});
