import type { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import React, { type FC, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounceValue } from 'usehooks-ts';

import SearchFields from 'apps/legacy/features/search/components/SearchFields';
import SearchResults from 'apps/legacy/features/search/components/SearchResults';
import SearchStart from 'apps/modern/components/SearchStart';
import { addRecentSearch } from 'apps/modern/components/SearchStart/recentSearches';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import useSearchParam from 'hooks/useSearchParam';
import globalize from 'lib/globalize';

const COLLECTION_TYPE_PARAM = 'collectionType';
const PARENT_ID_PARAM = 'parentId';
const QUERY_PARAM = 'query';

const Search: FC = () => {
    const { user } = useApi();
    const [searchParams] = useSearchParams();
    const parentIdQuery = searchParams.get(PARENT_ID_PARAM) || undefined;
    const collectionTypeQuery = (searchParams.get(COLLECTION_TYPE_PARAM) || undefined) as CollectionType | undefined;
    const [ query, setQuery ] = useSearchParam(QUERY_PARAM);
    const [debouncedQuery] = useDebounceValue(query, 500);

    // A search is kept among the recent ones when it was used: Enter, or a result opened
    const remember = useCallback((term: string) => addRecentSearch(user?.Id, term), [ user?.Id ]);
    const onResultOpened = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).closest('a, button, .card, .itemAction')) remember(debouncedQuery);
    }, [ debouncedQuery, remember ]);

    return (
        <Page
            id='searchPage'
            title={globalize.translate('Search')}
            className='mainAnimatedPage libraryPage allLibraryPage noSecondaryNavPage'
        >
            <SearchFields query={query} onSearch={setQuery} onCommit={remember} />
            {!debouncedQuery ? (
                <SearchStart parentId={parentIdQuery} onPick={setQuery} />
            ) : (
                // Only listens to the results inside
                <div onClickCapture={onResultOpened}>
                    <SearchResults
                        parentId={parentIdQuery}
                        collectionType={collectionTypeQuery}
                        query={debouncedQuery}
                    />
                </div>
            )}
        </Page>
    );
};

export default Search;
