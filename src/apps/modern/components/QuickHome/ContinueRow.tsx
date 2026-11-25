/**
 * The "Continue watching" row of the home screen with a menu on each card ("⋮", right click or a long press):
 *  - remove it from the row: its playback position goes back to 0; an undo notice at the bottom puts it back;
 *  - mark it as watched.
 * Both use the user data API of the server; the card leaves the row at once and the row is read again after.
 */
import type { Api } from '@jellyfin/sdk';
import { getUserDataApi } from '@jellyfin/sdk/lib/utils/api/user-data-api';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import React, { type FC, useCallback, useMemo, useState } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { type ProgressCard, Row, Wide } from './parts';

/** How long the notice (and its undo) stays. */
const NOTICE_MS = 7000;

interface Notice {
    card: ProgressCard;
    kind: 'removed' | 'played' | 'failed';
}

interface ContinueRowProps {
    id?: string;
    api: Api;
    cards: ProgressCard[];
    title: string;
    accent?: string;
    serverId?: string;
}

const ContinueRow: FC<ContinueRowProps> = ({ id, api, cards, title, accent, serverId }) => {
    const { user } = useApi();
    const userId = user?.Id;
    const [ hidden, setHidden ] = useState<ReadonlySet<string>>(new Set());
    const [ menu, setMenu ] = useState<{ card: ProgressCard, anchor: HTMLElement } | null>(null);
    const [ notice, setNotice ] = useState<Notice | null>(null);

    const shown = useMemo(() => cards.filter(c => !hidden.has(c.Id)), [ cards, hidden ]);
    const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: [ 'QuickHome', userId, 'personal' ] }), [ userId ]);
    const hide = useCallback((cardId: string, value: boolean) => setHidden(prev => {
        const next = new Set(prev);
        if (value) next.add(cardId);
        else next.delete(cardId);
        return next;
    }), []);

    const openMenu = useCallback((card: ProgressCard, anchor: HTMLElement) => setMenu({ card, anchor }), []);
    const closeMenu = useCallback(() => setMenu(null), []);
    const closeNotice = useCallback(() => setNotice(null), []);

    const setPosition = useCallback((card: ProgressCard, ticks: number) => getUserDataApi(api).updateItemUserData({
        itemId: card.Id,
        userId,
        updateUserItemDataDto: { PlaybackPositionTicks: ticks }
    }), [ api, userId ]);

    // Each action leaves the row at once; if the server says no, the card comes back with a notice
    const run = useCallback(async (card: ProgressCard, kind: 'removed' | 'played', action: () => Promise<unknown>) => {
        setMenu(null);
        hide(card.Id, true);
        try {
            await action();
            setNotice({ card, kind });
            void refresh();
        } catch {
            hide(card.Id, false);
            setNotice({ card, kind: 'failed' });
        }
    }, [ hide, refresh ]);

    const remove = useCallback(() => {
        if (menu) void run(menu.card, 'removed', () => setPosition(menu.card, 0));
    }, [ menu, run, setPosition ]);
    const markPlayed = useCallback(() => {
        if (menu) void run(menu.card, 'played', () => getUserDataApi(api).markPlayedItem({ itemId: menu.card.Id, userId }));
    }, [ api, menu, run, userId ]);

    // Undo: its position again, so it goes back to where it was in the row
    const undo = useCallback(async () => {
        if (!notice) return;
        const { card } = notice;
        setNotice(null);
        try {
            await setPosition(card, card.PositionTicks);
            hide(card.Id, false);
            void refresh();
        } catch {
            setNotice({ card, kind: 'failed' });
        }
    }, [ hide, notice, refresh, setPosition ]);

    let message = '';
    if (notice?.kind === 'removed') message = globalize.translate('QhRemovedFrom', title);
    else if (notice?.kind === 'played') message = globalize.translate('QhMarkedWatched');
    else if (notice) message = globalize.translate('QhActionFailed');

    if (!shown.length && !notice) return null;

    return (
        <>
            {shown.length > 0 && (
                <Row id={id} title={title} accent={accent}>
                    {shown.map(c => <Wide key={c.Id} api={api} card={c} serverId={serverId} onMenu={openMenu} />)}
                </Row>
            )}
            <Menu
                open={!!menu}
                anchorEl={menu?.anchor}
                onClose={closeMenu}
                slotProps={{ paper: { sx: { borderRadius: '14px', minWidth: 240 } } }}
            >
                <MenuItem onClick={remove} sx={{ minHeight: 48 }}>
                    <ListItemIcon><RemoveCircleOutlineRoundedIcon fontSize='small' /></ListItemIcon>
                    {globalize.translate('QhRemoveFrom', title)}
                </MenuItem>
                <MenuItem onClick={markPlayed} sx={{ minHeight: 48 }}>
                    <ListItemIcon><CheckCircleOutlineRoundedIcon fontSize='small' /></ListItemIcon>
                    {globalize.translate('QhMarkWatched')}
                </MenuItem>
            </Menu>
            <Snackbar
                open={!!notice}
                message={message}
                autoHideDuration={NOTICE_MS}
                onClose={closeNotice}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                // Above the floating bottom bar
                sx={{ bottom: 'calc(var(--jf-bottom-bar-space, 24px) + 8px) !important' }}
                action={notice?.kind === 'removed' ? (
                    <Button color='primary' onClick={undo} sx={{ minHeight: 44, fontWeight: 800 }}>
                        {globalize.translate('QhUndo')}
                    </Button>
                ) : undefined}
            />
        </>
    );
};

export default ContinueRow;
