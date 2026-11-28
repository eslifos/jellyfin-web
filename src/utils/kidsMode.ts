/**
 * Kids profile: the app shows bigger cards (the class "cosmic-kids" on the page, card.scss and quickHome.scss). Which
 * libraries a kids profile sees is kept by the server; this is only how it looks. The last answer is remembered, so
 * the next opening starts with the right size before the server answers.
 */
import { fetchProfiles, type ProfileList } from './profiles';

export const KIDS_CLASS = 'cosmic-kids';
const STORAGE_KEY = 'cosmicKidsMode';

/** Whether the profile of the session is a kids profile. */
export const isKidsSession = (list?: ProfileList) => Boolean(list?.Profiles.find(p => p.IsCurrent)?.IsKids);

/** Whether the page is in kids mode now. */
export const isKidsMode = () => document.body.classList.contains(KIDS_CLASS);

const setKidsMode = (on: boolean) => {
    document.body.classList.toggle(KIDS_CLASS, on);
    try {
        if (on) localStorage.setItem(STORAGE_KEY, '1');
        else localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Not remembered: the next opening starts normal until the server answers
    }
};

/** On signing in (or with another profile): the remembered mode at once, then the one of the server. */
export const applyKidsMode = async () => {
    try {
        if (localStorage.getItem(STORAGE_KEY)) document.body.classList.add(KIDS_CLASS);
    } catch {
        // Without storage it waits for the server
    }
    try {
        setKidsMode(isKidsSession(await fetchProfiles()));
    } catch (err) {
        // A server without profiles, or no network: as it was
        console.warn('[kidsMode] could not read the profile', err);
    }
};
