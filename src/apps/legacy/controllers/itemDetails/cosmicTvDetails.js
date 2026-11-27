/**
 * The details page on the TV, read and used with the remote:
 *  - the banner fits the screen with its buttons; the main one says what OK does ("Play", "Resume S2:E5 · 20 min
 *    left", "Next: S2:E6"), the others are icons that show their name when focused (cosmicDetails.scss);
 *  - a series has its seasons as tabs and a row of the episodes of the chosen one, with their synopses on demand;
 *  - below, "More like this", "Cast & crew" and "Extras", in that order.
 */
import escapeHtml from 'escape-html';

import imageLoader from 'components/images/imageLoader';
import layoutManager from 'components/layoutManager';
import { playbackManager } from 'components/playback/playbackmanager';
import { focusTvMenu } from 'apps/modern/components/TvMenu/tvMenu';
import globalize from 'lib/globalize';
import { scrollBehavior } from 'utils/reducedMotion';

const TICKS_PER_MINUTE = 600000000;
const OVERVIEW_KEY = 'cosmicTvEpisodeOverview';

const isTvSeries = item => layoutManager.tv && item.Type === 'Series';

/** "45 min", "1 h 20 min". */
const formatMinutes = ticks => {
    const total = Math.max(1, Math.ceil(ticks / TICKS_PER_MINUTE));
    const hours = Math.floor(total / 60);
    return hours ? globalize.translate('TvHoursMinutes', hours, total % 60) : globalize.translate('TvMinutes', total);
};

const remaining = item => formatMinutes((item.RunTimeTicks || 0) - (item.UserData?.PlaybackPositionTicks || 0));

const isResumable = item => (item.UserData?.PlaybackPositionTicks || 0) > 0 && (item.RunTimeTicks || 0) > 0;

/** "S2:E5" (T2:E5 in Spanish). */
const episodeCode = episode => globalize.translate('TvEpisodeCode', episode.ParentIndexNumber ?? 0, episode.IndexNumber ?? 0);

const setLabel = (button, text) => {
    button.title = text;
    button.setAttribute('aria-label', text);
    const label = button.querySelector('.detailButton-label');
    if (label) label.textContent = text;
};

/** The main button for a series: the episode OK plays, as the server sees it (next up). */
const seriesPlayLabel = (series, episode) => {
    if (!episode) return globalize.translate('Play');
    if (isResumable(episode)) return globalize.translate('TvResumeEpisodeLeft', episodeCode(episode), remaining(episode));
    const started = (series.UserData?.PlayedPercentage || 0) > 0 || !!series.UserData?.LastPlayedDate;
    return globalize.translate(started ? 'TvNextEpisode' : 'TvPlayEpisode', episodeCode(episode));
};

/**
 * TV: the names of the play buttons. A movie or an episode now; a series once its next episode is known
 * (renderTvEpisodes).
 */
export function setTvPlayLabels(page, item) {
    if (!layoutManager.tv) return;
    for (const button of page.querySelectorAll('.btnReplay')) setLabel(button, globalize.translate('TvFromStart'));
    // The heart is the user's list on the TV (the menu's "My list")
    for (const button of page.querySelectorAll('.btnUserRating')) setLabel(button, globalize.translate('TvMyList'));
    // A series: the label of its next episode, once known (renderTvEpisodes); the usual one meanwhile
    if (item.Type === 'Series') {
        const known = page.dataset.tvPlayLabel;
        if (known) for (const button of page.querySelectorAll('.btnPlay')) setLabel(button, known);
        return;
    }
    const text = isResumable(item) ? globalize.translate('TvResumeLeft', remaining(item)) : globalize.translate('Play');
    for (const button of page.querySelectorAll('.btnPlay')) setLabel(button, text);
}

/**
 * TV, once per page: "More like this" first, then the cast, then the extras (named so); and the banner kept in view
 * while its buttons have the focus: the page shows as much of the top as it can (logo, title, data) with the buttons
 * still on screen, instead of scrolling the logo away to center them.
 */
export function arrangeTvSections(page) {
    if (!layoutManager.tv) return;
    const similar = page.querySelector('#similarCollapsible');
    const cast = page.querySelector('#castCollapsible');
    if (similar && cast && similar.nextElementSibling !== cast) cast.before(similar);
    const extrasTitle = page.querySelector('#specialsCollapsible .sectionTitle');
    if (extrasTitle) extrasTitle.textContent = globalize.translate('Extras');

    page.addEventListener('focusin', e => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target?.closest('.cosmicHero')) return;
        // After the focus manager has scrolled to the element
        window.setTimeout(() => {
            const buttons = page.querySelector('.mainDetailButtons');
            if (!buttons) return;
            const bottom = buttons.getBoundingClientRect().bottom + window.scrollY;
            window.scrollTo({ top: Math.max(0, bottom + 48 - window.innerHeight), behavior: scrollBehavior() });
        }, 60);
    });
}

const readOverviewPref = () => {
    try {
        return localStorage.getItem(OVERVIEW_KEY) === 'true';
    } catch {
        return false;
    }
};

const saveOverviewPref = shown => {
    try {
        localStorage.setItem(OVERVIEW_KEY, String(shown));
    } catch {
        // Not kept: shown or hidden for this visit only
    }
};

const episodeHtml = (apiClient, episode, pendingId) => {
    const tag = episode.ImageTags?.Primary;
    const image = tag ? apiClient.getScaledImageUrl(episode.Id, { type: 'Primary', maxWidth: 560, tag }) : '';
    const played = episode.UserData?.Played;
    const progress = isResumable(episode) ? Math.min(100, (episode.UserData.PlaybackPositionTicks / episode.RunTimeTicks) * 100) : 0;
    const meta = [
        episode.IndexNumber == null ? '' : globalize.translate('TvEpisodeShort', episode.IndexNumber),
        episode.RunTimeTicks ? formatMinutes(episode.RunTimeTicks) : ''
    ].filter(Boolean).join(' · ');
    const pendingClass = episode.Id === pendingId ? ' cosmicTvEpisode-pending' : '';
    const picture = image ? `<img class="lazy" data-src="${image}" alt="">` : '<span class="material-icons" aria-hidden="true">movie</span>';
    const bar = progress ? `<span class="cosmicTvEpisode-progress"><span style="width:${progress.toFixed(1)}%"></span></span>` : '';
    const check = played ? '<span class="cosmicTvEpisode-played material-icons check" aria-hidden="true"></span>' : '';
    const overview = episode.Overview ? `<span class="cosmicTvEpisode-overview">${escapeHtml(episode.Overview)}</span>` : '';
    return `<button type="button" class="cosmicTvEpisode${pendingClass}" data-id="${episode.Id}">`
        + `<span class="cosmicTvEpisode-image">${picture}${bar}${check}</span>`
        + `<span class="cosmicTvEpisode-meta">${escapeHtml(meta)}</span>`
        + `<span class="cosmicTvEpisode-title">${escapeHtml(episode.Name || '')}</span>`
        + overview
        + '</button>';
};

const seasonBarHtml = seasons => {
    const tabs = seasons.map(s => `<button type="button" role="tab" class="cosmicTvSeason" aria-selected="false" data-id="${s.Id}">${escapeHtml(s.Name || '')}</button>`).join('');
    return `<h2 class="sectionTitle">${escapeHtml(globalize.translate('Episodes'))}</h2>`
        + '<div class="cosmicTvSeasonBar">'
        + `<div class="cosmicTvSeasonTabs" role="tablist" aria-label="${escapeHtml(globalize.translate('HeaderSeasons'))}">${tabs}</div>`
        + '<button type="button" class="cosmicTvOverviewToggle" aria-pressed="false">'
        + '<span class="material-icons" aria-hidden="true">notes</span><span class="cosmicTvOverviewToggle-text"></span></button>'
        + '</div>'
        + '<div class="cosmicTvEpisodeRow"></div>';
};

/** The listeners of the episodes of each page (a page reloads with another item, or the same one updated). */
const cleanups = new WeakMap();

/**
 * TV, a series: the seasons as tabs and, under them, a row of the episodes of the chosen one (16:9 pictures, number,
 * length, title, progress). The synopses stay hidden until the button beside the tabs shows them (remembered).
 * Replaces the next up card and the row of season posters of the other layouts.
 *  - down from the buttons: the pending episode;
 *  - a tab with the focus shows its season; down from it: its episodes;
 *  - up from an episode: the tab of its season; OK: plays it (resumes it when started).
 */
export function renderTvEpisodes(page, item, apiClient) {
    const section = page.querySelector('.cosmicTvEpisodes');
    // Its place: the next up card and the season posters (hidden by cosmicDetails.scss: they load later)
    page.classList.toggle('cosmicTvSeriesPage', isTvSeries(item));
    delete page.dataset.tvPlayLabel;
    if (!section) return;
    cleanups.get(section)?.();
    cleanups.delete(section);
    if (!isTvSeries(item)) {
        section.classList.add('hide');
        section.innerHTML = '';
        return;
    }

    const userId = apiClient.getCurrentUserId();
    const episodesBySeason = new Map();
    let pending = null;
    let selectedSeasonId = null;
    let selectTimer;

    const tabs = () => section.querySelector('.cosmicTvSeasonTabs');
    const row = () => section.querySelector('.cosmicTvEpisodeRow');
    const selectedTab = () => tabs()?.querySelector('.cosmicTvSeason[aria-selected="true"]');

    const loadEpisodes = seasonId => {
        if (!episodesBySeason.has(seasonId)) {
            episodesBySeason.set(seasonId, apiClient.getEpisodes(item.Id, {
                seasonId,
                userId,
                Fields: 'Overview,PrimaryImageAspectRatio'
            }).then(result => result.Items || []));
        }
        return episodesBySeason.get(seasonId);
    };

    const showSeason = seasonId => {
        if (seasonId === selectedSeasonId) return Promise.resolve();
        selectedSeasonId = seasonId;
        for (const tab of tabs().querySelectorAll('.cosmicTvSeason')) {
            tab.setAttribute('aria-selected', String(tab.dataset.id === seasonId));
        }
        return loadEpisodes(seasonId).then(episodes => {
            if (seasonId !== selectedSeasonId) return;
            const list = row();
            list.innerHTML = episodes.map(e => episodeHtml(apiClient, e, pending?.Id)).join('');
            list.scrollLeft = 0;
            imageLoader.lazyChildren(list);
        });
    };

    const pendingEpisode = () => row()?.querySelector('.cosmicTvEpisode-pending') ?? row()?.querySelector('.cosmicTvEpisode');

    /**
     * The episode first in its row (the ones before it scroll away whole, none is left cut at the edge), and the
     * whole section (tabs and row) on screen.
     */
    const focusEpisode = el => {
        if (!el) return false;
        el.focus({ preventScroll: true });
        const list = row();
        const padding = parseFloat(getComputedStyle(list).paddingLeft) || 0;
        const offset = el.getBoundingClientRect().left - list.getBoundingClientRect().left - padding;
        list.scrollTo({ left: Math.max(0, list.scrollLeft + offset), behavior: scrollBehavior() });
        section.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
        return true;
    };

    /** The seasons bar in order: the tabs, then the synopses button. */
    const barItems = () => [ ...section.querySelectorAll('.cosmicTvSeason, .cosmicTvOverviewToggle') ];

    // Down from the buttons: to the pending episode (of its season)
    const onButtonsKeyDown = e => {
        if (e.key !== 'ArrowDown' || e.defaultPrevented) return;
        const pendingSeason = pending?.SeasonId;
        const go = pendingSeason && pendingSeason !== selectedSeasonId ? showSeason(pendingSeason) : Promise.resolve();
        e.preventDefault();
        void go.then(() => focusEpisode(pendingEpisode()) || selectedTab()?.focus());
    };

    const onEpisodeKey = (e, episode) => {
        if (e.key === 'ArrowUp') {
            // Up goes to the tab of its season (not to the tab above it)
            e.preventDefault();
            selectedTab()?.focus();
            return;
        }
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        // Along the row; left from the first one opens the TV menu (as everywhere), the last one stays put
        const next = e.key === 'ArrowLeft' ? episode.previousElementSibling : episode.nextElementSibling;
        e.preventDefault();
        e.stopPropagation();
        if (next instanceof HTMLElement) focusEpisode(next);
        else if (e.key === 'ArrowLeft') focusTvMenu(episode);
    };

    const onSectionKeyDown = e => {
        const target = e.target;
        if (!(target instanceof HTMLElement) || e.defaultPrevented) return;
        if (target.classList.contains('cosmicTvSeason') && e.key === 'ArrowDown') {
            // A tab: down goes into its episodes (once they are there)
            e.preventDefault();
            window.clearTimeout(selectTimer);
            void showSeason(target.dataset.id).then(() => focusEpisode(pendingEpisode()));
        } else if (target.classList.contains('cosmicTvOverviewToggle') && e.key === 'ArrowDown') {
            e.preventDefault();
            focusEpisode(pendingEpisode());
        } else if (target.matches('.cosmicTvSeason, .cosmicTvOverviewToggle') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            // Along the bar, tab by tab and then the button (the first one keeps left for the TV menu)
            const items = barItems();
            const next = items[items.indexOf(target) + (e.key === 'ArrowLeft' ? -1 : 1)];
            e.preventDefault();
            e.stopPropagation();
            if (next) next.focus();
            else if (e.key === 'ArrowLeft') focusTvMenu(target);
        } else if (target.classList.contains('cosmicTvEpisode')) {
            onEpisodeKey(e, target);
        }
    };

    // The focus on a tab shows its season (a moment after, so going along the tabs stays smooth)
    const onFocusIn = e => {
        const target = e.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains('cosmicTvSeason')) return;
        window.clearTimeout(selectTimer);
        selectTimer = window.setTimeout(() => {
            void showSeason(target.dataset.id);
        }, 250);
    };

    const setOverviewShown = shown => {
        section.classList.toggle('cosmicTvEpisodes-overviews', shown);
        const toggle = section.querySelector('.cosmicTvOverviewToggle');
        if (!toggle) return;
        toggle.setAttribute('aria-pressed', String(shown));
        toggle.querySelector('.cosmicTvOverviewToggle-text').textContent = globalize.translate(shown ? 'TvHideSynopses' : 'TvShowSynopses');
    };

    const playEpisode = id => {
        void loadEpisodes(selectedSeasonId).then(episodes => {
            const chosen = episodes.find(ep => ep.Id === id);
            if (!chosen) return;
            void playbackManager.play({
                ids: [ chosen.Id ],
                serverId: item.ServerId,
                startPositionTicks: isResumable(chosen) ? chosen.UserData.PlaybackPositionTicks : 0
            });
        });
    };

    const onClick = e => {
        const target = e.target instanceof Element ? e.target : null;
        if (target?.closest('.cosmicTvOverviewToggle')) {
            const shown = !section.classList.contains('cosmicTvEpisodes-overviews');
            setOverviewShown(shown);
            saveOverviewPref(shown);
            return;
        }
        const tab = target?.closest('.cosmicTvSeason');
        if (tab instanceof HTMLElement) {
            window.clearTimeout(selectTimer);
            void showSeason(tab.dataset.id).then(() => focusEpisode(pendingEpisode()));
            return;
        }
        const episode = target?.closest('.cosmicTvEpisode');
        if (episode instanceof HTMLElement) playEpisode(episode.dataset.id);
    };

    const buttons = page.querySelector('.mainDetailButtons');
    buttons?.addEventListener('keydown', onButtonsKeyDown);
    section.addEventListener('keydown', onSectionKeyDown);
    section.addEventListener('focusin', onFocusIn);
    section.addEventListener('click', onClick);

    Promise.all([
        apiClient.getSeasons(item.Id, { userId }),
        apiClient.getNextUpEpisodes({ SeriesId: item.Id, UserId: userId, Fields: 'MediaSourceCount' })
    ]).then(([ seasonsResult, nextUp ]) => {
        const seasons = seasonsResult.Items || [];
        pending = nextUp.Items?.[0] ?? null;
        page.dataset.tvPlayLabel = seriesPlayLabel(item, pending);
        for (const button of page.querySelectorAll('.btnPlay')) setLabel(button, page.dataset.tvPlayLabel);
        if (!seasons.length) {
            section.classList.add('hide');
            return;
        }

        section.innerHTML = seasonBarHtml(seasons);
        setOverviewShown(readOverviewPref());
        section.classList.remove('hide');
        const first = pending?.SeasonId && seasons.some(s => s.Id === pending.SeasonId) ? pending.SeasonId : seasons[0].Id;
        void showSeason(first);
    }).catch(err => {
        console.error('[cosmicTvDetails] could not load the episodes', err);
        section.classList.add('hide');
    });

    cleanups.set(section, () => {
        window.clearTimeout(selectTimer);
        buttons?.removeEventListener('keydown', onButtonsKeyDown);
        section.removeEventListener('keydown', onSectionKeyDown);
        section.removeEventListener('focusin', onFocusIn);
        section.removeEventListener('click', onClick);
    });
}
