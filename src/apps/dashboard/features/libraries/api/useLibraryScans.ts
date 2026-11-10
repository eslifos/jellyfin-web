/**
 * Live progress of library scans (one library or all), for administrators.
 * The server sends "RefreshProgress" over the websocket for each library while it is scanned;
 * the virtual folders list gives the state on load and is polled while a scan runs.
 */
import { useEffect, useMemo, useState } from 'react';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import type { RefreshProgressMessage } from '@jellyfin/sdk/lib/generated-client/models/refresh-progress-message';

import { useApi } from 'hooks/useApi';

import { useVirtualFolders } from './useVirtualFolders';

export interface LibraryScan {
    id: string;
    name: string;
    collectionType?: string | null;
    /** 0-100, or null while queued. */
    progress: number | null;
}

const norm = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

/** Live progress by library id (normalized, without dashes). */
const live = new Map<string, { progress: number; at: number }>();
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | undefined;

const notify = () => listeners.forEach(l => l());

export const useLibraryScans = () => {
    const { api, user } = useApi();
    const isAdmin = !!user?.Policy?.IsAdministrator;
    const [ tick, setTick ] = useState(0);
    const [ polling, setPolling ] = useState(false);
    const { data: folders, refetch } = useVirtualFolders(isAdmin && polling ? 3000 : false, isAdmin);

    // One websocket subscription shared by every component using the hook
    useEffect(() => {
        if (!api || !isAdmin) return;
        const listener = () => setTick(t => t + 1);
        listeners.add(listener);
        if (!unsubscribe) {
            unsubscribe = api.subscribe([ OutboundWebSocketMessageType.RefreshProgress ], ({ Data }: RefreshProgressMessage) => {
                const id = norm(Data?.ItemId);
                if (!id) return;
                const progress = Number.parseFloat(Data?.Progress ?? '0') || 0;
                live.set(id, { progress, at: Date.now() });
                notify();
            });
        }
        return () => {
            listeners.delete(listener);
            if (!listeners.size) {
                unsubscribe?.();
                unsubscribe = undefined;
            }
        };
    }, [ api, isAdmin ]);

    const scans = useMemo<LibraryScan[]>(() => {
        if (!isAdmin || !folders) return [];
        const now = Date.now();
        const result: LibraryScan[] = [];
        for (const f of folders) {
            const id = norm(f.ItemId);
            const ws = live.get(id);
            let progress: number | null | undefined;
            // A websocket update newer than 30 s wins over the (polled) server state
            if (ws && now - ws.at < 30000) {
                progress = ws.progress >= 100 ? undefined : ws.progress;
            } else if (f.RefreshStatus === 'Active' || (f.RefreshProgress != null && f.RefreshProgress < 100)) {
                progress = f.RefreshProgress ?? 0;
            } else if (f.RefreshStatus === 'Queued') {
                progress = null;
            }
            if (progress !== undefined) {
                result.push({ id: f.ItemId || id, name: f.Name || '', collectionType: f.CollectionType, progress });
            }
        }
        return result;
    }, [ folders, isAdmin, tick ]);

    // Poll while something runs; refresh once when a library starts or finishes
    const active = scans.length > 0;
    useEffect(() => {
        setPolling(active);
        if (isAdmin) void refetch();
    }, [ active, isAdmin, refetch ]);

    return scans;
};

/** Progress of one library, or undefined when it is not being scanned. */
export const useLibraryScan = (itemId?: string | null) => {
    const scans = useLibraryScans();
    return scans.find(s => norm(s.id) === norm(itemId));
};
