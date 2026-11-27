/**
 * TV: the one search screen (the "Search" of the TV menu and #/search), made for the remote.
 *  - left: a keyboard in a grid of 6 columns (letters, then space, delete, clear, "123"/"ABC" and, in the TV app,
 *    voice search), over the text typed so far;
 *  - right: the results, updated with every letter, in rows of Movies, Series, People and Genres; with nothing typed,
 *    the profile's recent searches and what is most watched (SearchStart).
 * Voice: the TV app's NativeInterface.startVoiceSearch() listens, and sends the words back with the
 * "cosmicvoicesearch" event ({ detail: { text } }).
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { getGenreApi } from '@jellyfin/sdk/lib/utils/api/genre-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import BackspaceRoundedIcon from '@mui/icons-material/BackspaceRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import SpaceBarRoundedIcon from '@mui/icons-material/SpaceBarRounded';
import { useQuery } from '@tanstack/react-query';
import React, { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounceValue } from 'usehooks-ts';

import { Card, Row, hashColor, toCard } from 'apps/modern/components/QuickHome/parts';
import SearchStart from 'apps/modern/components/SearchStart';
import { addRecentSearch, normalizeSearch } from 'apps/modern/components/SearchStart/recentSearches';
import { useApi } from 'hooks/useApi';
import useSearchParam from 'hooks/useSearchParam';
import globalize from 'lib/globalize';

import './tvSearch.scss';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
/** Letters of some languages beyond a–z, added to the keyboard in that language. */
const EXTRA_LETTERS: Record<string, string> = { es: 'ñ', pt: 'ç', fr: 'ç', ca: 'ç', de: 'äöüß' };
const SYMBOLS = '1234567890-\'.:&!?';
const RESULTS_LIMIT = 20;
const QUERY_PARAM = 'query';
/** The event the TV app fires with the words heard. */
export const VOICE_EVENT = 'cosmicvoicesearch';

interface NativeVoice {
    startVoiceSearch?: () => void;
}

const nativeVoice = () => (window as unknown as { NativeInterface?: NativeVoice }).NativeInterface;
const hasVoice = () => typeof nativeVoice()?.startVoiceSearch === 'function';

const lettersOfLocale = () => {
    const language = (globalize.getCurrentLocale() || '').toLowerCase().split(/[-_]/)[0];
    return [ ...LETTERS, ...(EXTRA_LETTERS[language] ?? '') ];
};

/** The results of a search, by group (only the groups with something). */
const useTvSearchResults = (term: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ 'TvSearch', user?.Id, term ],
        queryFn: async ({ signal }) => {
            const items = (types: BaseItemKind[]) => getLibraryApi(api!).getItems({
                userId: user!.Id, searchTerm: term, includeItemTypes: types, recursive: true,
                limit: RESULTS_LIMIT, imageTypeLimit: 1, enableTotalRecordCount: false
            }, { signal }).then(r => r.data.Items ?? []);
            const [ movies, series, people, genres ] = await Promise.all([
                items([ BaseItemKind.Movie ]),
                items([ BaseItemKind.Series ]),
                items([ BaseItemKind.Person ]),
                getGenreApi(api!).getGenres({ userId: user!.Id, searchTerm: term, limit: 12 }, { signal }).then(r => r.data.Items ?? [])
            ]);
            return { movies, series, people, genres };
        },
        enabled: !!api && !!user?.Id && !!term,
        staleTime: 60 * 1000,
        placeholderData: previous => previous
    });
};

const Key: FC<{ value: string, label?: React.ReactNode, title?: string, wide?: boolean, onPress: (value: string) => void }> = ({ value, label, title, wide, onPress }) => {
    const onClick = useCallback(() => onPress(value), [ onPress, value ]);
    return (
        <button type='button' className={wide ? 'tvs-key tvs-key-wide' : 'tvs-key'} onClick={onClick} aria-label={title} title={title}>
            {label ?? value}
        </button>
    );
};

const TvSearch: FC = () => {
    const { api, __legacyApiClient__: legacy, user } = useApi();
    const serverId = legacy?.serverId();
    const [ query, setQuery ] = useSearchParam(QUERY_PARAM);
    const [ term ] = useDebounceValue(normalizeSearch(query), 300);
    const [ symbols, setSymbols ] = useState(false);
    const keyboard = useRef<HTMLDivElement>(null);
    const letters = useMemo(lettersOfLocale, []);
    const { data, isFetching } = useTvSearchResults(term);
    const [ voice ] = useState(hasVoice);

    // Arriving, the remote is on the first key
    useEffect(() => {
        keyboard.current?.querySelector<HTMLButtonElement>('.tvs-key')?.focus();
    }, []);

    // The words heard by the TV app
    useEffect(() => {
        const onVoice = (e: Event) => {
            const text = (e as CustomEvent<{ text?: string }>).detail?.text;
            if (text) setQuery(normalizeSearch(text));
        };
        window.addEventListener(VOICE_EVENT, onVoice);
        return () => window.removeEventListener(VOICE_EVENT, onVoice);
    }, [ setQuery ]);

    const onPress = useCallback((value: string) => {
        switch (value) {
            case 'delete':
                setQuery(query.slice(0, -1));
                break;
            case 'clear':
                setQuery('');
                break;
            case 'space':
                if (query && !query.endsWith(' ')) setQuery(query + ' ');
                break;
            case 'symbols':
                setSymbols(s => !s);
                break;
            case 'voice':
                nativeVoice()?.startVoiceSearch?.();
                break;
            default:
                setQuery(query + value);
        }
    }, [ query, setQuery ]);

    // A search is kept among the recent ones when one of its results is opened
    const onResultOpened = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).closest('a, button')) addRecentSearch(user?.Id, term);
    }, [ term, user?.Id ]);

    const keys = symbols ? [ ...SYMBOLS ] : letters;
    const card = (item: BaseItemDto) => toCard(item);
    const empty = !!term && !isFetching && data && !data.movies.length && !data.series.length && !data.people.length && !data.genres.length;

    let results: React.ReactNode;
    if (!term) {
        results = <SearchStart onPick={setQuery} />;
    } else if (empty) {
        results = <p className='tvs-empty'>{globalize.translate('SearchResultsEmpty', term)}</p>;
    } else if (api && data) {
        results = (
            <div className='qh qh-search' onClickCapture={onResultOpened}>
                {data.movies.length > 0 && (
                    <Row title={globalize.translate('Movies')} accent='#00a4dc'>
                        {data.movies.map(i => <Card key={i.Id} api={api} card={card(i)} shape='poster' serverId={serverId} />)}
                    </Row>
                )}
                {data.series.length > 0 && (
                    <Row title={globalize.translate('Series')} accent='#aa5cc3'>
                        {data.series.map(i => <Card key={i.Id} api={api} card={card(i)} shape='poster' serverId={serverId} />)}
                    </Row>
                )}
                {data.people.length > 0 && (
                    <Row title={globalize.translate('People')} accent='#e91e63'>
                        {data.people.map(i => <Card key={i.Id} api={api} card={card(i)} shape='round' serverId={serverId} />)}
                    </Row>
                )}
                {data.genres.length > 0 && (
                    <section className='qh-row' data-focus-row=''>
                        <header className='qh-row-head'><h3 className='qh-row-title'>{globalize.translate('Genres')}</h3></header>
                        <div className='qh-genre-list'>
                            {data.genres.map(g => (
                                <a key={g.Id} className='qh-genre' href={`#/genre?genreId=${g.Id}`} style={{ '--qh-genre': hashColor(g.Name ?? '') } as React.CSSProperties}>
                                    <span className='qh-genre-name'>{g.Name}</span>
                                </a>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        );
    }

    return (
        <div className='tvs'>
            <div className='tvs-side'>
                <div className='tvs-query' aria-live='polite'>
                    {query ? <span>{query}</span> : <span className='tvs-placeholder'>{globalize.translate('Search')}</span>}
                    <span className='tvs-caret' aria-hidden='true' />
                </div>
                <div ref={keyboard} className='tvs-keys' role='group' aria-label={globalize.translate('Search')}>
                    {keys.map(k => <Key key={k} value={k} onPress={onPress} />)}
                </div>
                <div className='tvs-keys tvs-keys-actions'>
                    <Key value='space' label={<SpaceBarRoundedIcon />} title={globalize.translate('TvKeySpace')} onPress={onPress} />
                    <Key value='delete' label={<BackspaceRoundedIcon />} title={globalize.translate('TvKeyDelete')} onPress={onPress} />
                    <Key value='clear' label={<ClearRoundedIcon />} title={globalize.translate('TvKeyClear')} onPress={onPress} />
                    <Key value='symbols' label={symbols ? 'ABC' : '123'} title={globalize.translate(symbols ? 'TvKeyLetters' : 'TvKeyNumbers')} onPress={onPress} />
                    {voice && <Key value='voice' label={<MicRoundedIcon />} title={globalize.translate('TvVoiceSearch')} wide onPress={onPress} />}
                </div>
            </div>
            <div className='tvs-results'>{results}</div>
        </div>
    );
};

export default TvSearch;
