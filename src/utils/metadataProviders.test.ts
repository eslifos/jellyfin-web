import { describe, expect, it, vi } from 'vitest';

import { AUDIOBOOK_PROVIDER_ID, providerLabel } from './metadataProviders';

// The real module loads the whole app: only the texts are needed
vi.mock('lib/globalize', () => ({
    default: {
        translate: (key: string) => ({ ProviderAudiobooksOnline: 'Online audiobooks' }[key] ?? key)
    }
}));

describe('Utils: metadataProviders', () => {
    it('Should keep the identifier the server uses', () => {
        expect(AUDIOBOOK_PROVIDER_ID).toBe('Audiolibros en línea');
    });

    it('Should show the audiobook provider in the language of the app', () => {
        expect(providerLabel(AUDIOBOOK_PROVIDER_ID)).toBe('Online audiobooks');
    });

    it('Should show the other providers with their own name', () => {
        expect(providerLabel('TheMovieDb')).toBe('TheMovieDb');
        expect(providerLabel('')).toBe('');
    });
});
