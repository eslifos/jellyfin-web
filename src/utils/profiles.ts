/**
 * Viewing profiles (server: Jellyfin.Api ProfilesController).
 *
 * A master account can have up to 5 profiles including itself. Each extra
 * profile is a hidden Jellyfin user, so watch progress, playlists and
 * favorites are separate. Switching asks the server for a session of the
 * profile and hands it to the api client like a normal login.
 */
import type { ApiClient } from 'jellyfin-apiclient';

import { ServerConnections } from 'lib/jellyfin-apiclient';

export interface Profile {
    Id: string
    Name: string
    PrimaryImageTag?: string | null
    IsMaster: boolean
    IsCurrent: boolean
    IsDisabled: boolean
}

export interface ProfileList {
    MasterId: string
    MaxProfiles: number
    CanManage: boolean
    Profiles: Profile[]
}

export interface ProfileLink {
    ProfileId: string
    MasterId: string
}

interface AuthResult {
    AccessToken: string
    ServerId: string
    User: { Id: string }
}

type LegacyClient = ApiClient & {
    ajax: (options: Record<string, unknown>) => Promise<unknown>
    onAuthenticated?: (client: ApiClient, result: AuthResult) => Promise<void>
};

const getClient = (apiClient?: ApiClient) => (apiClient ?? ServerConnections.currentApiClient()) as LegacyClient | undefined;

export const getProfileImageUrl = (profile: Pick<Profile, 'Id' | 'PrimaryImageTag'>, size = 200, apiClient?: ApiClient) => {
    const client = getClient(apiClient);
    if (!client || !profile.PrimaryImageTag) return undefined;
    return client.getUrl(`Users/${profile.Id}/Images/Primary`, { tag: profile.PrimaryImageTag, width: size, quality: 90 });
};

export const fetchProfiles = async (userId?: string, apiClient?: ApiClient): Promise<ProfileList | undefined> => {
    const client = getClient(apiClient);
    if (!client) return undefined;
    return client.getJSON(client.getUrl('Profiles', userId ? { userId } : undefined)) as Promise<ProfileList>;
};

export const fetchProfileLinks = async (apiClient?: ApiClient): Promise<ProfileLink[]> => {
    const client = getClient(apiClient);
    if (!client) return [];
    return client.getJSON(client.getUrl('Profiles/Links')) as Promise<ProfileLink[]>;
};

export const createProfile = async (name: string, userId?: string, apiClient?: ApiClient): Promise<Profile> => {
    const client = getClient(apiClient);
    if (!client) throw new Error('No api client');
    return client.ajax({
        type: 'POST',
        url: client.getUrl('Profiles', userId ? { userId } : undefined),
        data: JSON.stringify({ Name: name }),
        contentType: 'application/json',
        dataType: 'json'
    }) as Promise<Profile>;
};

export const deleteProfile = async (profileId: string, apiClient?: ApiClient) => {
    const client = getClient(apiClient);
    if (!client) throw new Error('No api client');
    await client.ajax({ type: 'DELETE', url: client.getUrl(`Profiles/${profileId}`) });
};

const statusOf = (err: unknown) => (err as { status?: number } | undefined)?.status;

const askAccountPassword = async (wrong: boolean): Promise<string | null> => {
    const [ { default: prompt }, { default: globalize } ] = await Promise.all([
        import('components/prompt/prompt'),
        import('lib/globalize')
    ]);
    try {
        return await prompt({
            title: globalize.translate('ProfileSwitchPasswordTitle'),
            label: globalize.translate('LabelPassword'),
            description: globalize.translate(wrong ? 'ProfileSwitchPasswordWrong' : 'ProfileSwitchPasswordHelp'),
            inputType: 'password',
            confirmText: globalize.translate('ButtonOk')
        }) as string;
    } catch {
        return null; // cancelled
    }
};

/**
 * Switches the session to another profile and reloads the app on `target`.
 * Leaving a secondary profile needs the account password (the server answers 428 until it is sent).
 */
export const switchProfile = async (profileId: string, target = '/home') => {
    const client = getClient();
    if (!client) throw new Error('No api client');

    let password: string | null | undefined;
    let wrong = false;
    let result: AuthResult | undefined;
    for (let attempt = 0; attempt < 4 && !result; attempt++) {
        try {
            result = await client.ajax({
                type: 'POST',
                url: client.getUrl(`Profiles/${profileId}/Switch`),
                data: JSON.stringify(password ? { Password: password } : {}),
                contentType: 'application/json',
                dataType: 'json'
            }) as AuthResult;
        } catch (err) {
            const status = statusOf(err);
            if (status !== 428 && !(status === 403 && password)) throw err;
            wrong = status === 403;
            password = await askAccountPassword(wrong);
            if (!password) return; // cancelled: stay on the current profile
        }
    }
    if (!result) throw new Error('Profile switch failed');

    if (client.onAuthenticated) {
        await client.onAuthenticated(client, result);
    } else {
        client.setAuthenticationInfo(result.AccessToken, result.User.Id);
    }

    // Full reload so every cached query, view and setting belongs to the new profile
    window.location.hash = `#${target}`;
    window.location.reload();
};

/** Where to go after a login: the profile picker when the account has more than one profile. */
export const getPostLoginUrl = async (target: string, apiClient?: ApiClient) => {
    try {
        const list = await fetchProfiles(undefined, apiClient);
        if (list && list.Profiles.length > 1) {
            return `/profiles?next=${encodeURIComponent(target)}`;
        }
    } catch (err) {
        console.warn('[profiles] could not load profiles after login', err);
    }
    return target;
};
