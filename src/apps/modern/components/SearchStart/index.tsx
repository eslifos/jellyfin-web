/**
 * What the search shows before anything is typed (the search page and the search window): the user's recent
 * searches, what they were watching and the latest added titles. The rows and cards are the ones of the home screen,
 * so they look the same and work with the remote control too. With a library given (searching inside it) only its
 * titles are shown.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import React, { type FC, useCallback, useMemo } from 'react';

import { useLatestMedia } from 'apps/legacy/features/libraries/api/useLatestMedia';
import { useResumeItems } from 'apps/legacy/features/libraries/api/useResumeItems';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { Card, type HomeCard, type ProgressCard, Row, Wide, toCard, useHomePage } from '../QuickHome/parts';
import { clearRecentSearches, removeRecentSearch, useRecentSearches } from './recentSearches';

import './searchStart.scss';

const TICKS_PER_PERCENT = 100;
/** Rows of the home screen that hold what is most watched this week. */
const MOST_WATCHED_ROWS = new Set([ 'top10movies', 'top10series' ]);
const MOST_WATCHED_MAX = 12;
/** Ids compared without dashes and in lower case (the server may send either form). */
const normId = (id?: string | null) => (id || '').replace(/-/g, '').toLowerCase();

/** The picture of a card to resume: its own wide art, the one of its series, or its cover. */
const pictureOf = (item: BaseItemDto): Pick<ProgressCard, 'ImageItemId' | 'ImageType' | 'ImageTag'> => {
    const id = item.Id ?? '';
    if (item.ImageTags?.Thumb) return { ImageItemId: id, ImageType: ImageType.Thumb, ImageTag: item.ImageTags.Thumb };
    if (item.ParentThumbItemId && item.ParentThumbImageTag) return { ImageItemId: item.ParentThumbItemId, ImageType: ImageType.Thumb, ImageTag: item.ParentThumbImageTag };
    if (item.BackdropImageTags?.length) return { ImageItemId: id, ImageType: ImageType.Backdrop, ImageTag: item.BackdropImageTags[0] };
    if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) return { ImageItemId: item.ParentBackdropItemId, ImageType: ImageType.Backdrop, ImageTag: item.ParentBackdropImageTags[0] };
    return { ImageItemId: id, ImageType: ImageType.Primary, ImageTag: item.ImageTags?.Primary };
};

const episodeLabel = (item: BaseItemDto) => (item.ParentIndexNumber != null && item.IndexNumber != null ? `T${item.ParentIndexNumber}:E${item.IndexNumber}` : null);

const toProgress = (item: BaseItemDto): ProgressCard => {
    const position = item.UserData?.PlaybackPositionTicks ?? 0;
    const length = item.RunTimeTicks ?? 0;
    const isEpisode = item.Type === 'Episode';
    return {
        Id: item.Id ?? '',
        Name: isEpisode ? item.SeriesName ?? item.Name ?? '' : item.Name ?? '',
        Subtitle: isEpisode ? [ episodeLabel(item), item.Name ].filter(Boolean).join(' · ') : item.ProductionYear?.toString(),
        Type: item.Type ?? '',
        Progress: item.UserData?.PlayedPercentage ?? (length ? (position / length) * TICKS_PER_PERCENT : 0),
        RemainingTicks: length > position ? length - position : null,
        PositionTicks: position,
        ...pictureOf(item)
    };
};

/** A new episode is shown as its series, with its poster (the still of an episode is wide). */
const toLatestCard = (item: BaseItemDto): HomeCard => (item.Type === 'Episode' && item.SeriesId ? {
    Id: item.SeriesId,
    Name: item.SeriesName ?? item.Name ?? '',
    Type: 'Series',
    PrimaryTag: item.SeriesPrimaryImageTag
} : toCard(item));

interface SearchStartProps {
    /** Only the titles of this library (search opened from a library). */
    parentId?: string;
    /** A recent search was chosen: it is searched again. */
    onPick: (term: string) => void;
    /** Something was opened or played (the search window closes). */
    onNavigate?: () => void;
}

const SearchStart: FC<SearchStartProps> = ({ parentId, onPick, onNavigate }) => {
    const { api, user, __legacyApiClient__: legacy } = useApi();
    const serverId = legacy?.serverId();
    const recent = useRecentSearches(user?.Id);

    const { data: resume } = useResumeItems({
        parentId,
        limit: 12,
        mediaTypes: [ MediaType.Video ],
        imageTypeLimit: 1,
        enableImageTypes: [ ImageType.Primary, ImageType.Backdrop, ImageType.Thumb ],
        enableTotalRecordCount: false
    });
    const { data: latest } = useLatestMedia({
        parentId,
        limit: 24,
        imageTypeLimit: 1,
        enableImageTypes: [ ImageType.Primary ]
    });

    // Most watched: the weekly top 10 of movies and shows the server prepares for the home screen (no new request)
    const { data: homePage } = useHomePage();
    const mostWatched = useMemo(() => {
        const blocks = (homePage?.Blocks ?? []).filter(b => !parentId || normId(b.LibraryId) === normId(parentId));
        const rows = blocks.flatMap(b => b.Rows.filter(r => MOST_WATCHED_ROWS.has(r.Key)).map(r => r.Items));
        // One of each row in turn, so movies and shows share the row
        const mixed: HomeCard[] = [];
        for (let i = 0; rows.some(r => i < r.length); i++) {
            for (const row of rows) if (row[i]) mixed.push(row[i]);
        }
        const seen = new Set<string>();
        return mixed.filter(c => !seen.has(c.Id) && !!seen.add(c.Id)).slice(0, MOST_WATCHED_MAX);
    }, [ homePage, parentId ]);

    const continueCards = useMemo(() => (resume?.Items ?? []).filter(i => i.Id).map(toProgress), [ resume ]);
    const latestCards = useMemo(() => {
        // Several new episodes of a series are one card
        const seen = new Set<string>();
        return (latest ?? []).map(toLatestCard).filter(c => {
            if (!c.Id || seen.has(c.Id)) return false;
            seen.add(c.Id);
            return true;
        }).slice(0, 18);
    }, [ latest ]);

    const pick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const term = e.currentTarget.dataset.term;
        if (term) onPick(term);
    }, [ onPick ]);
    const remove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const term = e.currentTarget.dataset.term;
        if (term) removeRecentSearch(user?.Id, term);
    }, [ user?.Id ]);
    const clear = useCallback(() => clearRecentSearches(user?.Id), [ user?.Id ]);
    // Opening a card or playing leaves the search
    const onOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).closest('.qh-card, .qh-wide')) onNavigate?.();
    }, [ onNavigate ]);

    if (!api) return null;
    const empty = !recent.length && !mostWatched.length && !continueCards.length && !latestCards.length;

    return (
        // Only listens to the links and buttons inside
        <div className='qh qh-search' onClickCapture={onOpen}>
            {recent.length > 0 && (
                <section className='qh-row' aria-label={globalize.translate('SrchRecent')}>
                    <header className='qh-row-head'>
                        <h3 className='qh-row-title'>{globalize.translate('SrchRecent')}</h3>
                        <button type='button' className='qh-row-more qh-search-clear' onClick={clear}>{globalize.translate('SrchClearRecent')}</button>
                    </header>
                    <ul className='qh-search-recent'>
                        {recent.map(term => (
                            <li key={term} className='qh-search-term'>
                                <button type='button' className='qh-search-pick' data-term={term} onClick={pick}>
                                    <HistoryRoundedIcon aria-hidden='true' />
                                    <span>{term}</span>
                                </button>
                                <button type='button' className='qh-search-remove' data-term={term} onClick={remove} aria-label={globalize.translate('SrchRemoveRecent', term)} title={globalize.translate('SrchRemoveRecent', term)}>
                                    <CloseRoundedIcon aria-hidden='true' />
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {mostWatched.length > 0 && (
                <Row title={globalize.translate('QhMostWatched')} hint={globalize.translate('QhTopHint')} accent='#ffca28'>
                    {mostWatched.map(c => <Card key={c.Id} api={api} card={c} shape='poster' serverId={serverId} />)}
                </Row>
            )}
            {continueCards.length > 0 && (
                <Row title={globalize.translate('HeaderContinueWatching')} accent='#00a4dc'>
                    {continueCards.map(c => <Wide key={c.Id} api={api} card={c} serverId={serverId} />)}
                </Row>
            )}
            {latestCards.length > 0 && (
                <Row title={globalize.translate('HeaderLatestMedia')} accent='#aa5cc3'>
                    {latestCards.map(c => <Card key={c.Id} api={api} card={c} shape='poster' serverId={serverId} />)}
                </Row>
            )}
            {empty && <p className='qh-search-hint'>{globalize.translate('SrchStartTyping')}</p>}
        </div>
    );
};

export default SearchStart;
