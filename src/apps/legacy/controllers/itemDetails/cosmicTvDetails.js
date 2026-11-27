/**
 * The details page on the TV, read and used with the remote:
 *  - the main button says what OK does: "Play", "Resume S2:E5 · 20 min left" or "Next: S2:E6"; the secondary ones
 *    are icons that show their name when focused (cosmicDetails.scss);
 *  - a series has its seasons in a column on the left and the episodes of the chosen one on the right (16:9 picture,
 *    number, title, length, progress and two lines of synopsis); down from the buttons goes to the pending episode;
 *  - below, "More like this", "Cast & crew" and "Extras", in that order.
 */
import escapeHtml from 'escape-html';

import imageLoader from 'components/images/imageLoader';
import layoutManager from 'components/layoutManager';
import { playbackManager } from 'components/playback/playbackmanager';
import globalize from 'lib/globalize';
import { scrollBehavior } from 'utils/reducedMotion';

const TICKS_PER_MINUTE = 600000000;

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

/** TV: "More like this" first, then the cast, then the extras (named so). */
export function arrangeTvSections(page) {
    if (!layoutManager.tv) return;
    const similar = page.querySelector('#similarCollapsible');
    const cast = page.querySelector('#castCollapsible');
    if (similar && cast && similar.nextElementSibling !== cast) cast.before(similar);
    const extrasTitle = page.querySelector('#specialsCollapsible .sectionTitle');
    if (extrasTitle) extrasTitle.textContent = globalize.translate('Extras');
}

const episodeHtml = (apiClient, episode, pendingId) => {
    const tag = episode.ImageTags?.Primary;
    const image = tag ? apiClient.getScaledImageUrl(episode.Id, { type: 'Primary', maxWidth: 480, tag }) : '';
    const played = episode.UserData?.Played;
    const progress = isResumable(episode) ? Math.min(100, (episode.UserData.PlaybackPositionTicks / episode.RunTimeTicks) * 100) : 0;
    const meta = [ `${episode.IndexNumber ?? ''}`.trim(), episode.RunTimeTicks ? formatMinutes(episode.RunTimeTicks) : '' ]
        .filter(Boolean).join(' · ');
    return `<button type="button" class="cosmicTvEpisode${episode.Id === pendingId ? ' cosmicTvEpisode-pending' : ''}" data-id="${episode.Id}">`
        + '<span class="cosmicTvEpisode-image">'
        + (image ? `<img class="lazy" data-src="${image}" alt="">` : '<span class="material-icons" aria-hidden="true">movie</span>')
        + (progress ? `<span class="cosmicTvEpisode-progress"><span style="width:${progress.toFixed(1)}%"></span></span>` : '')
        + (played ? '<span class="cosmicTvEpisode-played material-icons check" aria-hidden="true"></span>' : '')
        + '</span>'
        + '<span class="cosmicTvEpisode-text">'
        + `<span class="cosmicTvEpisode-meta">${escapeHtml(meta)}</span>`
        + `<span class="cosmicTvEpisode-title">${escapeHtml(episode.Name || '')}</span>`
        + (episode.Overview ? `<span class="cosmicTvEpisode-overview">${escapeHtml(episode.Overview)}</span>` : '')
        + '</span></button>';
};

/** The listeners of the episodes of each page (a page reloads with another item, or the same one updated). */
const cleanups = new WeakMap();

/**
 * TV, a series: seasons on the left, the episodes of the chosen one on the right. Replaces the next up card and the
 * row of season posters of the other layouts.
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

    const seasonsColumn = () => section.querySelector('.cosmicTvSeasons');
    const episodesColumn = () => section.querySelector('.cosmicTvEpisodeList');
    const selectedSeason = () => seasonsColumn()?.querySelector('[aria-selected="true"]');

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
        for (const button of seasonsColumn().querySelectorAll('.cosmicTvSeason')) {
            button.setAttribute('aria-selected', String(button.dataset.id === seasonId));
        }
        return loadEpisodes(seasonId).then(episodes => {
            if (seasonId !== selectedSeasonId) return;
            const list = episodesColumn();
            list.innerHTML = episodes.map(e => episodeHtml(apiClient, e, pending?.Id)).join('');
            imageLoader.lazyChildren(list);
        });
    };

    const pendingEpisode = () => episodesColumn()?.querySelector('.cosmicTvEpisode-pending')
        ?? episodesColumn()?.querySelector('.cosmicTvEpisode');

    const focusEpisode = el => {
        if (!el) return false;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
        return true;
    };

    // Down from the buttons: to the pending episode (of its season)
    const onButtonsKeyDown = e => {
        if (e.key !== 'ArrowDown' || e.defaultPrevented) return;
        const pendingSeason = pending?.SeasonId;
        const go = pendingSeason && pendingSeason !== selectedSeasonId ? showSeason(pendingSeason) : Promise.resolve();
        e.preventDefault();
        void go.then(() => focusEpisode(pendingEpisode()) || seasonsColumn()?.querySelector('.cosmicTvSeason')?.focus());
    };

    const onSectionKeyDown = e => {
        const target = e.target;
        if (!(target instanceof HTMLElement) || e.defaultPrevented) return;
        // A season: right goes into its episodes (the pending one when there)
        if (target.classList.contains('cosmicTvSeason') && e.key === 'ArrowRight') {
            e.preventDefault();
            focusEpisode(pendingEpisode());
        // An episode: left goes back to its season (not to the season beside it)
        } else if (target.classList.contains('cosmicTvEpisode') && e.key === 'ArrowLeft') {
            e.preventDefault();
            selectedSeason()?.focus();
        }
    };

    // The focus on a season shows its episodes (a moment after, so going through the column stays smooth)
    const onFocusIn = e => {
        const target = e.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains('cosmicTvSeason')) return;
        window.clearTimeout(selectTimer);
        selectTimer = window.setTimeout(() => {
            void showSeason(target.dataset.id);
        }, 250);
    };

    const onClick = e => {
        const target = e.target instanceof Element ? e.target : null;
        const season = target?.closest('.cosmicTvSeason');
        if (season instanceof HTMLElement) {
            void showSeason(season.dataset.id).then(() => focusEpisode(pendingEpisode()));
            return;
        }
        const episode = target?.closest('.cosmicTvEpisode');
        if (episode instanceof HTMLElement) {
            void loadEpisodes(selectedSeasonId).then(episodes => {
                const chosen = episodes.find(ep => ep.Id === episode.dataset.id);
                if (!chosen) return;
                void playbackManager.play({
                    ids: [ chosen.Id ],
                    serverId: item.ServerId,
                    startPositionTicks: isResumable(chosen) ? chosen.UserData.PlaybackPositionTicks : 0
                });
            });
        }
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

        section.innerHTML = `<h2 class="sectionTitle">${escapeHtml(globalize.translate('Episodes'))}</h2>`
            + '<div class="cosmicTvEpisodes-body">'
            + `<div class="cosmicTvSeasons" role="tablist" aria-label="${escapeHtml(globalize.translate('HeaderSeasons'))}">`
            + seasons.map(s => `<button type="button" role="tab" class="cosmicTvSeason" aria-selected="false" data-id="${s.Id}">${escapeHtml(s.Name || '')}</button>`).join('')
            + '</div><div class="cosmicTvEpisodeList"></div></div>';
        section.classList.remove('hide');
        void showSeason(pending?.SeasonId && seasons.some(s => s.Id === pending.SeasonId) ? pending.SeasonId : seasons[0].Id);
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
