import { useMutation } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';

/** Deletes one activity log entry (custom server endpoint) and reloads the lists. */
export const useDeleteLogEntry = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: async (id: number) => {
            if (!api) throw new Error('No api');
            await api.axiosInstance.delete(`${api.basePath}/System/ActivityLog/Entries/${id}`, {
                headers: { Authorization: api.authorizationHeader }
            });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [ 'ActivityLogEntries' ] });
        }
    });
};
