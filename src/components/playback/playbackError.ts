/**
 * Playback errors in four cases a person understands, each with the one action that may fix it:
 *  - format: this device cannot play the file → another version of it, else a lower quality (the server converts it);
 *  - server: busy, rate limited or not allowed to convert for this user → try again;
 *  - network: the stream stopped loading → a lower quality, that needs less internet;
 *  - missing: the file (or its disc) is not there → only going back.
 * The technical message stays available under "Show details".
 */

export type PlaybackErrorKind = 'format' | 'server' | 'network' | 'missing';
export type PlaybackErrorAction = 'lowerQuality' | 'retry' | 'otherVersion' | 'back';

/** The translation key of each error (the keys have dots, so a Map) and its case. */
const KINDS = new Map<string, PlaybackErrorKind>([
    [ 'PlaybackErrorNoCompatibleStream', 'format' ],
    [ 'PlaybackError.NoCompatibleStream', 'format' ],
    [ 'PlaybackError.MEDIA_NOT_SUPPORTED', 'format' ],
    [ 'PlaybackError.MEDIA_DECODE_ERROR', 'format' ],
    [ 'PlaybackError.ASS_RENDER_ERROR', 'format' ],
    [ 'PlaybackError.PLAYER_ERROR', 'format' ],
    [ 'PlaybackError.SERVER_ERROR', 'server' ],
    [ 'PlaybackError.RateLimitExceeded', 'server' ],
    [ 'PlaybackError.NotAllowed', 'server' ],
    [ 'PlaybackError.NETWORK_ERROR', 'network' ],
    [ 'PlaybackError.FATAL_HLS_ERROR', 'network' ],
    [ 'PlaybackError.NO_MEDIA_ERROR', 'missing' ],
    [ 'PlaybackErrorPlaceHolder', 'missing' ],
    [ 'ErrorPlayerNotFound', 'missing' ]
]);

/** The case of an error, from the translation key the player gives it (anything unknown: try again). */
export const classifyPlaybackError = (code?: string | null): PlaybackErrorKind => KINDS.get(code ?? '') ?? 'server';

/**
 * The action offered for a case.
 * @param {PlaybackErrorKind} kind The case.
 * @param {number} versions How many versions (media sources) the item has.
 * @returns {PlaybackErrorAction} The action.
 */
export const playbackErrorAction = (kind: PlaybackErrorKind, versions = 1): PlaybackErrorAction => {
    switch (kind) {
        case 'format': return versions > 1 ? 'otherVersion' : 'lowerQuality';
        case 'network': return 'lowerQuality';
        case 'missing': return 'back';
        default: return 'retry';
    }
};

/** Steps of "lower quality", in bits per second: the first one under what was tried. */
const QUALITY_STEPS = [ 8_000_000, 4_000_000, 2_000_000, 1_000_000, 420_000 ];

/**
 * The quality of the next try: the first step under the one that failed (4 Mbps when it is not known).
 * @param {number | null | undefined} current The maximum bitrate that was tried.
 * @returns {number} The lower maximum, never under the last step.
 */
export const lowerBitrate = (current?: number | null): number => {
    if (!current || current <= 0) return QUALITY_STEPS[1];
    return QUALITY_STEPS.find(step => step < current) ?? QUALITY_STEPS[QUALITY_STEPS.length - 1];
};

/** Translation keys of each case: title and simple message. */
export const PLAYBACK_ERROR_TEXTS: Record<PlaybackErrorKind, { title: string, text: string }> = {
    format: { title: 'PbErrFormatTitle', text: 'PbErrFormatText' },
    server: { title: 'PbErrServerTitle', text: 'PbErrServerText' },
    network: { title: 'PbErrNetworkTitle', text: 'PbErrNetworkText' },
    missing: { title: 'PbErrMissingTitle', text: 'PbErrMissingText' }
};

/** Translation key of each action button. */
export const PLAYBACK_ERROR_ACTIONS: Record<PlaybackErrorAction, string> = {
    lowerQuality: 'PbErrLowerQuality',
    retry: 'PbErrRetry',
    otherVersion: 'PbErrOtherVersion',
    back: 'PbErrBack'
};
