import { getLiveTvApi } from '@jellyfin/sdk/lib/utils/api/live-tv-api';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

const REFRESH_MS = 30000;

/** Counts and lists used by the Live TV dashboard pages. */
export const useLiveTvOverview = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ 'LiveTvOverview' ],
        queryFn: async ({ signal }) => {
            const liveTv = getLiveTvApi(api!);
            const settle = async <T>(promise: Promise<{ data: T }>) => {
                try {
                    return (await promise).data;
                } catch {
                    return undefined;
                }
            };

            const [ info, channels, recordings, timers, seriesTimers ] = await Promise.all([
                settle(liveTv.getLiveTvInfo({ signal })),
                settle(liveTv.getLiveTvChannels({ limit: 0, enableImages: false, enableUserData: false }, { signal })),
                settle(liveTv.getRecordings({ limit: 0, enableImages: false, enableUserData: false, enableTotalRecordCount: true }, { signal })),
                settle(liveTv.getTimers({}, { signal })),
                settle(liveTv.getSeriesTimers({}, { signal }))
            ]);

            const timerItems = (timers?.Items || [])
                .slice()
                .sort((a, b) => Date.parse(a.StartDate || '') - Date.parse(b.StartDate || ''));

            return {
                info,
                channelCount: channels?.TotalRecordCount ?? 0,
                recordingCount: recordings?.TotalRecordCount ?? 0,
                timers: timerItems,
                recordingNow: timerItems.filter(t => t.Status === 'InProgress').length,
                scheduled: timerItems.filter(t => t.Status !== 'InProgress' && t.Status !== 'Completed' && t.Status !== 'Cancelled').length,
                seriesCount: seriesTimers?.TotalRecordCount ?? seriesTimers?.Items?.length ?? 0
            };
        },
        enabled: !!api,
        refetchInterval: REFRESH_MS
    });
};
