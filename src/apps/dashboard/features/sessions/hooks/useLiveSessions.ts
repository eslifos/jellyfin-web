import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import { useEffect } from 'react';

import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';

import { QUERY_KEY, useSessions } from '../api/useSessions';
import filterSessions from '../utils/filterSessions';

const QUERY_PARAMS = {
    activeWithinSeconds: 960
};

/** Asked again every few seconds too, in case the live messages of the server do not arrive. */
const POLL_MS = 3000;

/**
 * Sessions of the server, live: the server sends the whole list on every change (playback started, changed,
 * stopped, session ended), and it replaces what the page had, so finished streams go away at once.
 */
const useLiveSessions = () => {
    const { api } = useApi();

    const sessionsQuery = useSessions(QUERY_PARAMS, POLL_MS);

    useEffect(() => {
        // Return function for unsubscribing
        return api?.subscribe([ OutboundWebSocketMessageType.Sessions ], ({ Data }) => {
            queryClient.setQueryData([ QUERY_KEY, QUERY_PARAMS ], filterSessions((Data ?? []) as SessionInfoDto[]));
        });
    }, [ api ]);

    return sessionsQuery;
};

export default useLiveSessions;
