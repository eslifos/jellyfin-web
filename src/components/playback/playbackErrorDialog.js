/**
 * The dialog of a playback error: what happened in plain words, one action that may fix it and "Go back".
 * The technical message is folded under "Show details". The actions play the same item again from where it
 * stopped: the same way, with a lower quality (only for that try) or another version.
 */
import escapeHtml from 'escape-html';

import actionsheet from 'components/actionSheet/actionSheet';
import dialog from 'components/dialog/dialog';
import globalize from 'lib/globalize';

import {
    PLAYBACK_ERROR_ACTIONS, PLAYBACK_ERROR_TEXTS, classifyPlaybackError, lowerBitrate, playbackErrorAction
} from './playbackError';

import './playbackErrorDialog.scss';

/**
 * @param {object} attempt What was being played: { item, playOptions, maxBitrate }.
 * @returns {object[]} The versions (media sources) of the item.
 */
const versionsOf = attempt => attempt?.item?.MediaSources ?? [];

const chooseVersion = async (attempt) => {
    const current = attempt.playOptions?.mediaSourceId;
    const items = versionsOf(attempt).map(source => ({
        id: source.Id,
        name: source.Name || source.Container || source.Id,
        selected: source.Id === current
    }));
    return actionsheet.show({ title: globalize.translate('PbErrOtherVersion'), items, positionTo: null });
};

/**
 * Shows the error and runs the action chosen.
 * @param {object} playbackManager The playback manager (to play again).
 * @param {string} code Translation key of the technical message (PlaybackError.*, PlaybackErrorNoCompatibleStream…).
 * @param {object} [attempt] What was being played, when known.
 * @returns {Promise<void>} When the dialog is closed.
 */
export async function showPlaybackError(playbackManager, code, attempt) {
    const kind = classifyPlaybackError(code);
    const action = attempt?.item ? playbackErrorAction(kind, versionsOf(attempt).length) : 'back';
    const texts = PLAYBACK_ERROR_TEXTS[kind];
    const technical = globalize.translate(code);

    const html = `<p class="playbackErrorText">${escapeHtml(globalize.translate(texts.text))}</p>`
        + '<details class="playbackErrorDetails">'
        + `<summary>${escapeHtml(globalize.translate('PbErrDetails'))}</summary>`
        + `<p>${escapeHtml(technical)}</p><code>${escapeHtml(code)}</code>`
        + '</details>';

    const buttons = [];
    if (action !== 'back') buttons.push({ id: action, name: globalize.translate(PLAYBACK_ERROR_ACTIONS[action]), type: 'submit' });
    buttons.push({ id: 'back', name: globalize.translate(PLAYBACK_ERROR_ACTIONS.back), type: action === 'back' ? 'submit' : 'cancel' });

    let chosen;
    try {
        chosen = await dialog.show({ title: globalize.translate(texts.title), html, buttons });
    } catch {
        return; // Closed with Back / Escape
    }
    if (!chosen || chosen === 'back' || !attempt?.item) return;

    const options = { ...attempt.playOptions, items: [ attempt.item ] };
    if (chosen === 'lowerQuality') {
        options.maxBitrate = lowerBitrate(attempt.maxBitrate);
    } else if (chosen === 'otherVersion') {
        try {
            options.mediaSourceId = await chooseVersion(attempt);
        } catch {
            return; // No version chosen
        }
        // The tracks of the version that failed may not exist in the new one
        delete options.audioStreamIndex;
        delete options.subtitleStreamIndex;
    }
    await playbackManager.play(options);
}

export default { showPlaybackError };
