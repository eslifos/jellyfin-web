/**
 * Viewing profiles (server: Jellyfin.Api ProfilesController).
 *
 * A master account can have up to 5 profiles including itself. Each extra
 * profile is a hidden Jellyfin user, so watch progress, playlists and
 * favorites are separate. Switching asks the server for a session of the
 * profile and hands it to the api client like a normal login.
 *
 * A profile can be a kids profile (only the libraries chosen for it), and the
 * account can have a PIN, typed with the remote to leave a secondary profile.
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
    /** Only the libraries chosen for it (servers before kids profiles do not send it). */
    IsKids?: boolean
    /** The libraries of a kids profile. */
    KidsLibraryIds?: string[]
}

export interface ProfileList {
    MasterId: string
    MaxProfiles: number
    CanManage: boolean
    /** The account has a PIN to leave its secondary profiles. */
    HasPin?: boolean
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

/** Makes a profile a kids profile that sees only `libraryIds`, or (`isKids` false) a normal one again. */
export const setKidsProfile = async (profileId: string, isKids: boolean, libraryIds: string[] = [], apiClient?: ApiClient): Promise<Profile> => {
    const client = getClient(apiClient);
    if (!client) throw new Error('No api client');
    return client.ajax({
        type: 'POST',
        url: client.getUrl(`Profiles/${profileId}/Kids`),
        data: JSON.stringify({ IsKids: isKids, LibraryIds: isKids ? libraryIds : [] }),
        contentType: 'application/json',
        dataType: 'json'
    }) as Promise<Profile>;
};

/** Sets the PIN of the account (4 to 8 digits), or removes it with `null`. */
export const setProfilePin = async (pin: string | null, apiClient?: ApiClient) => {
    const client = getClient(apiClient);
    if (!client) throw new Error('No api client');
    await client.ajax({
        type: 'POST',
        url: client.getUrl('Profiles/Pin'),
        data: JSON.stringify({ Pin: pin ?? '' }),
        contentType: 'application/json'
    });
};

/** A PIN is 4 to 8 digits. */
export const isValidPin = (pin: string) => /^\d{4,8}$/.test(pin);

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

const askAccountPin = async (problem?: 'wrong' | 'locked'): Promise<string | null> => {
    const { askPin } = await import('components/profiles/PinDialog');
    const { default: globalize } = await import('lib/globalize');
    const message = { wrong: 'ProfilePinWrong', locked: 'ProfilePinLocked' };
    return askPin({
        title: globalize.translate('ProfilePinTitle'),
        description: globalize.translate(problem ? message[problem] : 'ProfilePinHelp'),
        error: Boolean(problem)
    });
};

/** What leaving a secondary profile asks for: the PIN of the account when it has one, else its password. */
const askSecret = (hasPin: boolean, status: number | undefined, wrong: boolean) => {
    if (!hasPin) return askAccountPassword(wrong);
    if (status === 429) return askAccountPin('locked');
    return askAccountPin(wrong ? 'wrong' : undefined);
};

/** The body of a switch: the PIN or the password typed, nothing before asking. */
const switchBody = (secret: string | null | undefined, hasPin: boolean) => {
    if (!secret) return {};
    return hasPin ? { Pin: secret } : { Password: secret };
};

/**
 * Switches the session to another profile and reloads the app on `target`.
 * Leaving a secondary profile needs the account PIN (`hasPin`) or else its password (the server answers 428 until
 * one is sent, 403 when it is wrong and 429 after too many wrong PINs).
 */
export const switchProfile = async (profileId: string, target = '/home', hasPin = false) => {
    const client = getClient();
    if (!client) throw new Error('No api client');

    let secret: string | null | undefined;
    let result: AuthResult | undefined;
    for (let attempt = 0; attempt < 6 && !result; attempt++) {
        try {
            result = await client.ajax({
                type: 'POST',
                url: client.getUrl(`Profiles/${profileId}/Switch`),
                data: JSON.stringify(switchBody(secret, hasPin)),
                contentType: 'application/json',
                dataType: 'json'
            }) as AuthResult;
        } catch (err) {
            const status = statusOf(err);
            const wrong = status === 403 && Boolean(secret);
            if (status !== 428 && status !== 429 && !wrong) throw err;
            secret = await askSecret(hasPin, status, wrong);
            if (!secret) return; // cancelled: stay on the current profile
        }
    }
    if (!result) throw new Error('Profile switch failed');
    await enterProfile(client, result, target);
};

/** The session of the new profile, and the app opened again with it on `target`. */
const enterProfile = async (client: LegacyClient, result: AuthResult, target: string) => {
    if (client.onAuthenticated) {
        await client.onAuthenticated(client, result);
    } else {
        client.setAuthenticationInfo(result.AccessToken, result.User.Id);
    }

    // Full reload so every cached query, view and setting belongs to the new profile
    try {
        sessionStorage.setItem(SWITCHED_KEY, '1');
    } catch {
        // Not kept: "Who is watching?" may be offered once more on TV
    }
    window.location.hash = `#${target}`;
    window.location.reload();
};

/** A profile was chosen (the app reloads as it): "Who is watching?" is not asked again on opening. */
const SWITCHED_KEY = 'cosmicProfileSwitched';
let pickerShown = false;

/** "Who is watching?" was shown in this opening of the app (or a profile was just chosen there). */
export const markProfilePickerShown = () => {
    pickerShown = true;
};

/** Whether "Who is watching?" should open now: once per opening of the app, not after choosing a profile. */
export const shouldOfferProfilePicker = () => {
    if (pickerShown) return false;
    pickerShown = true;
    try {
        if (sessionStorage.getItem(SWITCHED_KEY)) {
            sessionStorage.removeItem(SWITCHED_KEY);
            return false;
        }
    } catch {
        // Without storage it is offered (choosing reloads, and then it is not offered: the flag is in memory)
    }
    return true;
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
