/**
 * Joins the SyncPlay group of an invitation link (#/home?syncPlayGroup=<id>) once the user is signed in.
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useJoinSyncPlayGroup } from 'apps/modern/features/syncPlay/hooks/api/useJoinSyncPlayGroup';
import toast from 'components/toast/toast';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { INVITE_PARAM } from '../utils/invite';

const SyncPlayInviteHandler = () => {
    const { api, user } = useApi();
    const [ params, setParams ] = useSearchParams();
    const joinGroup = useJoinSyncPlayGroup();
    const handled = useRef<string | null>(null);
    const groupId = params.get(INVITE_PARAM);

    useEffect(() => {
        if (!groupId || !api || !user || handled.current === groupId) return;
        handled.current = groupId;

        joinGroup.mutate({ joinGroupRequestDto: { GroupId: groupId } }, {
            onSuccess: () => toast({ text: globalize.translate('SpJoinedFromInvite') }),
            onError: () => toast({ text: globalize.translate('SpInviteInvalid') })
        });

        const next = new URLSearchParams(params);
        next.delete(INVITE_PARAM);
        setParams(next, { replace: true });
    }, [ api, groupId, joinGroup, params, setParams, user ]);

    return null;
};

export default SyncPlayInviteHandler;
