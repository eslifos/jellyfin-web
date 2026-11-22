import type { Api } from '@jellyfin/sdk/lib/api';
import type { UserViewApiGetUserViewsRequest } from '@jellyfin/sdk/lib/generated-client/api/user-view-api';
import { getUserViewApi } from '@jellyfin/sdk/lib/utils/api/user-view-api';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from '../useApi';

const fetchUserViews = async (
    api: Api,
    params?: UserViewApiGetUserViewsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getUserViewApi(api)
        .getUserViews(params, options);
    return response.data;
};

export const getUserViewsQuery = (
    api?: Api,
    params?: UserViewApiGetUserViewsRequest
) => queryOptions({
    queryKey: [ 'User', params?.userId, 'Views', params ],
    // No abort signal: the menus and the pages share this answer, and a screen that closes must not cancel
    // it for the others (it made "Uncaught CancelledError" in the console)
    queryFn: () => fetchUserViews(api!, params),
    staleTime: 60 * 1000,
    enabled: !!api
});

export const useUserViews = (
    params?: UserViewApiGetUserViewsRequest
) => {
    const { api, user } = useApi();
    return useQuery(getUserViewsQuery(api, {
        ...params,
        userId: params?.userId || user?.Id
    }));
};
