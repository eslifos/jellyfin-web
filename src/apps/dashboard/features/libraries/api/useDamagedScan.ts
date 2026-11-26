/**
 * The library health check, a block at a time: each block of videos is listed and asked which of them were analyzed
 * (a video width saved), so the damaged ones show up while the rest is still being checked instead of after two
 * reads of the whole library.
 *
 * First, at once: how many videos there are, how many were analyzed, and the videos saved with no size (width 0),
 * which are normally all the damaged ones: then it is done in a couple of seconds. When the counts say some are
 * still missing (saved with no width at all), the blocks are read until they are all found.
 */
import { useCallback, useEffect, useState } from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { LocationType } from '@jellyfin/sdk/lib/generated-client/models/location-type';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';

import { useApi } from 'hooks/useApi';

export const VIDEO_TYPES = [ BaseItemKind.Movie, BaseItemKind.Episode, BaseItemKind.Video, BaseItemKind.MusicVideo ];

/** Videos listed per block. */
const BLOCK = 300;
/** Ids asked per "which were analyzed" request (they go in the address, which proxies limit to about 8 KB). */
const IDS_PER_CHECK = 150;
/** Blocks read at the same time. */
const PARALLEL_BLOCKS = 4;
/** A finished check is shown again without reading anything for this long. */
const FRESH_MS = 60 * 1000;

export interface DamagedScan {
    /** Videos in the library. */
    total: number;
    /** Videos checked so far. */
    checked: number;
    /** Videos whose file could not be analyzed, found so far. */
    damaged: BaseItemDto[];
    /** How many damaged videos there are in all (known from the counts, before they are found). */
    expected: number | null;
    done: boolean;
    /** The check stopped (what was found up to there stays). */
    failed: boolean;
}

const EMPTY: DamagedScan = { total: 0, checked: 0, damaged: [], expected: null, done: false, failed: false };

/** The last finished check, to come back to the page without checking everything again. */
let lastFinished: { at: number; scan: DamagedScan } | undefined;

const freshFinished = () => (lastFinished && Date.now() - lastFinished.at < FRESH_MS ? lastFinished.scan : undefined);

const inGroups = <T>(list: T[], size: number) => {
    const groups: T[][] = [];
    for (let i = 0; i < list.length; i += size) groups.push(list.slice(i, i + size));
    return groups;
};

export const useDamagedScan = () => {
    const { api } = useApi();
    const [ scan, setScan ] = useState<DamagedScan>(() => freshFinished() ?? EMPTY);
    // Each restart checks everything again; the first one may use a fresh finished check
    const [ round, setRound ] = useState(0);

    useEffect(() => {
        if (!api) return;
        if (round === 0 && freshFinished()) return;

        // Leaving the page stops the check (the dashboard is not opened on the old TV browsers this rule is about)
        // eslint-disable-next-line compat/compat
        const controller = new AbortController();
        const { signal } = controller;
        const lib = getLibraryApi(api);
        const base = {
            recursive: true,
            includeItemTypes: VIDEO_TYPES,
            locationTypes: [ LocationType.FileSystem ],
            enableImages: false,
            enableUserData: false
        };

        const check = async () => {
            let state: DamagedScan = { ...EMPTY };
            const update = (change: Partial<DamagedScan>) => {
                state = { ...state, ...change };
                setScan(state);
            };
            setScan(state);
            try {
                // How many videos, how many were analyzed (the difference is how many to find) and the ones with size 0
                const [ all, analyzed, noSize ] = await Promise.all([
                    lib.getItems({ ...base, limit: 0, enableTotalRecordCount: true }, { signal }),
                    lib.getItems({ ...base, minWidth: 1, limit: 0, enableTotalRecordCount: true }, { signal }),
                    lib.getItems({ ...base, maxWidth: 0, fields: [ ItemFields.Path, ItemFields.DateCreated ], enableTotalRecordCount: false }, { signal })
                ]);
                const total = all.data.TotalRecordCount ?? 0;
                const expected = Math.max(0, total - (analyzed.data.TotalRecordCount ?? 0));
                const damaged = noSize.data.Items || [];
                update({ total, expected, damaged, done: damaged.length >= expected });

                let next = 0;
                const found = () => state.damaged.length >= expected;
                const readBlocks = async () => {
                    while (!signal.aborted && !found() && next < total) {
                        const start = next;
                        next += BLOCK;
                        const block = await lib.getItems({
                            ...base,
                            fields: [ ItemFields.Path, ItemFields.DateCreated ],
                            sortBy: [ ItemSortBy.SortName ],
                            startIndex: start,
                            limit: BLOCK,
                            enableTotalRecordCount: false
                        }, { signal });
                        const items = block.data.Items || [];
                        const ids = items.map(i => i.Id).filter((id): id is string => Boolean(id));
                        const checks = await Promise.all(inGroups(ids, IDS_PER_CHECK).map(group => lib.getItems({
                            ...base, ids: group, minWidth: 1, enableTotalRecordCount: false
                        }, { signal })));
                        const ok = new Set(checks.flatMap(r => (r.data.Items || []).map(i => i.Id)));
                        const seen = new Set(state.damaged.map(i => i.Id));
                        update({
                            checked: Math.min(total, state.checked + items.length),
                            damaged: [ ...state.damaged, ...items.filter(i => !ok.has(i.Id) && !seen.has(i.Id)) ]
                        });
                        if (!items.length) break;
                    }
                };
                if (expected > 0) await Promise.all(Array.from({ length: PARALLEL_BLOCKS }, readBlocks));
                update({ done: true });
                lastFinished = { at: Date.now(), scan: state };
            } catch (err) {
                if (signal.aborted) return;
                console.error('[LibraryHealth] check stopped', err);
                update({ done: true, failed: true });
            }
        };
        void check();
        return () => controller.abort();
    }, [ api, round ]);

    const restart = useCallback(() => {
        lastFinished = undefined;
        setRound(r => r + 1);
    }, []);

    return { scan, restart };
};
