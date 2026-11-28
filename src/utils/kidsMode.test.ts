import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchProfiles = vi.fn();
vi.mock('./profiles', () => ({ fetchProfiles: () => fetchProfiles() }));

import { applyKidsMode, isKidsMode, isKidsSession, KIDS_CLASS } from './kidsMode';

const list = (kids: boolean) => ({
    MasterId: 'm', MaxProfiles: 5, CanManage: false,
    Profiles: [
        { Id: 'm', Name: 'Account', IsMaster: true, IsCurrent: false, IsDisabled: false },
        { Id: 'k', Name: 'Kid', IsMaster: false, IsCurrent: true, IsDisabled: false, IsKids: kids }
    ]
});

describe('kidsMode', () => {
    afterEach(() => {
        document.body.classList.remove(KIDS_CLASS);
        localStorage.clear();
    });

    it('knows a kids session by its current profile', () => {
        expect(isKidsSession(list(true))).toBe(true);
        expect(isKidsSession(list(false))).toBe(false);
        expect(isKidsSession()).toBe(false);
    });

    it('puts the page in kids mode, and out of it, as the server says', async () => {
        fetchProfiles.mockResolvedValueOnce(list(true));
        await applyKidsMode();
        expect(isKidsMode()).toBe(true);

        fetchProfiles.mockResolvedValueOnce(list(false));
        await applyKidsMode();
        expect(isKidsMode()).toBe(false);
    });

    it('keeps the remembered mode when the server does not answer', async () => {
        fetchProfiles.mockResolvedValueOnce(list(true));
        await applyKidsMode();
        document.body.classList.remove(KIDS_CLASS);

        fetchProfiles.mockRejectedValueOnce(new Error('offline'));
        await applyKidsMode();
        expect(isKidsMode()).toBe(true);
    });
});
