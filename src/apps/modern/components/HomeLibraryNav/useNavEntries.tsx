/**
 * The "My media" entries of the user (each library and the universes), in the order the user chose. Shared by the
 * bar of the home screen and the TV menu.
 */
import React, { useCallback } from 'react';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';

import { appRouter } from 'components/router/appRouter';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import LibraryIcon from '../LibraryIcon';
import type { NavEntry } from './NavCustomizeDialog';
import { UNIVERSES_KEY, type NavSettings, orderKeys } from './navSettings';

export interface LinkEntry extends NavEntry {
    /** Route of the library (or the universes), without the leading "#". */
    to: string;
}

export const useNavEntries = () => {
    const { user } = useApi();
    const { data } = useUserViews({ userId: user?.Id });
    const views = data?.Items;

    /** Every entry in the order of these settings (the hidden ones too: the customize dialog lists them). */
    const entriesFor = useCallback((settings: NavSettings): LinkEntry[] => {
        const byKey = new Map<string, LinkEntry>();
        (views || []).forEach(view => {
            byKey.set(view.Id!, {
                key: view.Id!,
                name: view.Name || '',
                icon: <LibraryIcon item={view} />,
                to: appRouter.getRouteUrl(view, { context: view.CollectionType }).substring(1)
            });
        });
        byKey.set(UNIVERSES_KEY, { key: UNIVERSES_KEY, name: globalize.translate('UniTitle'), icon: <PublicRoundedIcon />, to: '/universes' });
        return orderKeys((views || []).map(v => v.Id!), settings).map(k => byKey.get(k)!).filter(Boolean);
    }, [ views ]);

    return { hasViews: !!views?.length, entriesFor };
};
