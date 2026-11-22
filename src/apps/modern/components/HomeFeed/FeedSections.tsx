/**
 * Self-loading sections used by the library start screens and the genre page. Each one hides itself when
 * it has nothing to show, and tells the jump bar it exists through SectionRegistry.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import Box from '@mui/material/Box';
import { useQuery } from '@tanstack/react-query';
import React, { type FC, type ReactNode, createContext, useContext, useEffect } from 'react';

import { useApi } from 'hooks/useApi';

import FeedCard from './FeedCard';
import { FeedSection, RowTitle, ScrollRow } from './FeedRow';
import { type CardShape, naturalShape } from './feedUtils';

export const FEED_FIELDS = [ ItemFields.PrimaryImageAspectRatio, ItemFields.ParentId ];
export const FEED_IMAGES = [ ImageType.Primary, ImageType.Backdrop, ImageType.Thumb ];
export const FEED_LIMIT = 24;

/** Sections report whether they have content, so the jump bar only links to visible ones. */
export const SectionRegistry = createContext<((id: string, present: boolean) => void) | null>(null);

export const useRegister = (id: string, present: boolean) => {
    const register = useContext(SectionRegistry);
    useEffect(() => {
        register?.(id, present);
        return () => register?.(id, false);
    }, [ register, id, present ]);
};

export type ItemsParams = Record<string, unknown>;

/** Items query (getItems) with the feed defaults. */
export const useFeedItems = (key: unknown[], params: ItemsParams, enabled = true, staleTime = 5 * 60 * 1000) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'HomeFeed', user?.Id, 'items', ...key ],
        queryFn: async ({ signal }) => {
            // "Unplayed" on series makes the server go through every episode of every series (minutes on big
            // libraries), so it is only kept for movies, books and music; rows with series are just random
            const filters = Array.isArray(params.filters) ? params.filters as ItemFilter[] : [];
            const types = Array.isArray(params.includeItemTypes) ? params.includeItemTypes as BaseItemKind[] : [];
            const withSeries = types.length === 0 || types.includes(BaseItemKind.Series);
            const dropUnplayed = withSeries && filters.includes(ItemFilter.IsUnplayed);
            return (await getLibraryApi(api!).getItems({
                userId: user?.Id, recursive: true, limit: FEED_LIMIT, fields: FEED_FIELDS, enableImageTypes: FEED_IMAGES, imageTypeLimit: 1, ...params,
                ...(dropUnplayed ? { filters: filters.filter(f => f !== ItemFilter.IsUnplayed) } : {})
            }, { signal })).data.Items ?? [];
        },
        enabled: !!api && !!user?.Id && enabled,
        staleTime
    });
};

interface ItemsSectionProps {
    id: string;
    title: string;
    icon?: ReactNode;
    accent?: string;
    subtitle?: string;
    items?: BaseItemDto[];
    shape?: CardShape;
    resume?: boolean;
    round?: boolean;
    context?: string | null;
    /** Minimum number of items to show the row. */
    min?: number;
}

/** A section with one row of cards. */
export const ItemsSection: FC<ItemsSectionProps> = ({ id, title, icon, accent, subtitle, items, shape, resume, round, context, min = 1 }) => {
    const present = (items?.length ?? 0) >= min;
    useRegister(id, present);
    if (!present) return null;
    return (
        <FeedSection id={id} title={title} icon={icon} accent={accent} subtitle={subtitle}>
            <ScrollRow>
                {items!.map(item => <FeedCard key={item.Id} item={item} shape={shape ?? naturalShape(item)} resume={resume} round={round} context={context} />)}
            </ScrollRow>
        </FeedSection>
    );
};

/** A section with any content (tiles, upcoming cards…) that hides when empty. */
export const CustomSection: FC<{ id: string, title: string, icon?: ReactNode, accent?: string, subtitle?: string, present: boolean, children: ReactNode }> = ({ id, title, icon, accent, subtitle, present, children }) => {
    useRegister(id, present);
    if (!present) return null;
    return (
        <FeedSection id={id} title={title} icon={icon} accent={accent} subtitle={subtitle}>
            <ScrollRow>{children}</ScrollRow>
        </FeedSection>
    );
};

/** Several rows inside one glass panel (e.g. "Movies" on the genre page). */
export const PanelSection: FC<{ id: string, title: string, icon?: ReactNode, accent?: string, subtitle?: string, to?: string, rows: { key: string, title: string, icon?: ReactNode, items?: BaseItemDto[], shape?: CardShape }[] }> = ({ id, title, icon, accent, subtitle, to, rows }) => {
    const visible = rows.filter(r => r.items?.length);
    useRegister(id, visible.length > 0);
    if (!visible.length) return null;
    return (
        <FeedSection id={id} title={title} icon={icon} accent={accent} subtitle={subtitle} to={to} panel>
            {visible.map(r => (
                <Box key={r.key} sx={{ mt: 1 }}>
                    <RowTitle title={r.title} icon={r.icon} />
                    <ScrollRow>
                        {r.items!.map(item => <FeedCard key={item.Id} item={item} shape={r.shape ?? naturalShape(item)} />)}
                    </ScrollRow>
                </Box>
            ))}
        </FeedSection>
    );
};
