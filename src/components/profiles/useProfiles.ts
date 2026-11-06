import { useCallback, useEffect, useState } from 'react';

import { fetchProfiles, type Profile, type ProfileList, switchProfile } from 'utils/profiles';

/** Loads the profiles of the current account and exposes select/refresh helpers. */
export const useProfiles = (enabled = true) => {
    const [ list, setList ] = useState<ProfileList>();
    const [ isLoading, setIsLoading ] = useState(enabled);
    const [ isError, setIsError ] = useState(false);
    const [ busyId, setBusyId ] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsError(false);
        try {
            setList(await fetchProfiles());
        } catch (err) {
            console.error('[useProfiles] failed to load profiles', err);
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (enabled) void refresh();
    }, [ enabled, refresh ]);

    /** Switch to `profile` (or just continue when it is already the current one). */
    const select = useCallback(async (profile: Profile, target: string, onCurrent?: () => void) => {
        if (profile.IsCurrent) {
            onCurrent?.();
            return;
        }
        setBusyId(profile.Id);
        try {
            await switchProfile(profile.Id, target);
        } catch (err) {
            console.error('[useProfiles] failed to switch profile', err);
            setBusyId(null);
            setIsError(true);
        }
    }, []);

    return { list, isLoading, isError, busyId, refresh, select };
};

/**
 * Whether `userId` (or the current user when omitted) is a secondary viewing
 * profile. `undefined` while loading.
 */
export const useIsProfileUser = (userId?: string) => {
    const [ isProfile, setIsProfile ] = useState<boolean>();

    useEffect(() => {
        let cancelled = false;
        fetchProfiles(userId)
            .then(list => {
                if (cancelled) return;
                const target = list?.Profiles.find(p => (userId ? p.Id === userId : p.IsCurrent));
                setIsProfile(target ? !target.IsMaster : false);
            })
            .catch(() => {
                if (!cancelled) setIsProfile(false);
            });
        return () => {
            cancelled = true;
        };
    }, [ userId ]);

    return isProfile;
};
