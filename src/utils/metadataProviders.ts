/**
 * Metadata and image providers are saved in the library options by the name the server gives them, so that name is
 * an identifier: it is kept as it is and only what is shown is translated.
 */
import globalize from 'lib/globalize';

/** The server's audiobook provider (AudiobookMetadata.ProviderName): Audible, Apple Books, Google Books and Open Library. */
export const AUDIOBOOK_PROVIDER_ID = 'Audiolibros en línea';

/** Providers named by Cosmic itself, shown in the language of the app. */
const TRANSLATED_PROVIDERS: Record<string, string> = {
    [AUDIOBOOK_PROVIDER_ID]: 'ProviderAudiobooksOnline'
};

/**
 * What is shown for a provider.
 * @param {string} name The name the server gives it (its identifier).
 * @returns {string} The translated label for Cosmic's own providers, the same name for the rest.
 */
export const providerLabel = (name: string): string => {
    const key = TRANSLATED_PROVIDERS[name];
    return key ? globalize.translate(key) : name;
};
