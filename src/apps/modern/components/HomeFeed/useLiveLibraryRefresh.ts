/**
 * Keeps the start screens (and the coming up page) up to date while a library is being scanned: when the server reports new or updated
 * items (with their images already downloaded), the rows that show new content are fetched again.
 * The updates are grouped (a scan sends many messages) and the shuffled rows are left alone so they don't jump.
 */
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import type { Query } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';

/** Wait for the burst of messages to calm down before refreshing. */
const SETTLE_MS = 8000;
/** At most one refresh in this time, even during a long scan. */
const MIN_GAP_MS = 45000;

/** Rows that are shuffled or don't depend on new items. */
const KEEP = /random|unwatched|discover|collections|artists|sorted|spotlight|genres|studios|resume|nextup|listening/i;

const isRefreshable = (userId: string | undefined) => (query: Query) => {
    const key = query.queryKey;
    if (key[1] !== userId) return false;
    if (key[0] === 'Upcoming') return true;
    if (key[0] !== 'HomeFeed') return false;
    return !key.some(part => typeof part === 'string' && KEEP.test(part));
};

export const useLiveLibraryRefresh = () => {
    const { api, user } = useApi();
    const userId = user?.Id;

    useEffect(() => {
        if (!api || !userId) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let last = 0;

        const run = () => {
            timer = undefined;
            last = Date.now();
            queryClient.invalidateQueries({ predicate: isRefreshable(userId), refetchType: 'active' }).catch(console.error);
        };

        const onChange = () => {
            if (timer) return;
            const wait = Math.max(SETTLE_MS, last + MIN_GAP_MS - Date.now());
            timer = setTimeout(run, wait);
        };

        const unsubscribe = api.subscribe([ OutboundWebSocketMessageType.LibraryChanged ], onChange);
        return () => {
            if (timer) clearTimeout(timer);
            unsubscribe();
        };
    }, [ api, userId ]);
};
