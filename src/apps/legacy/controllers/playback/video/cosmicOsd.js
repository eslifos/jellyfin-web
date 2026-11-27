/**
 * Modern video OSD pieces:
 * - one side menu with the video info and every playback option (audio, subtitles, quality, speed…)
 * - a side menu with the play queue
 * - the title block over the progress bar and, under the controls, the overview, ratings and cast
 */
import escapeHtml from 'escape-html';

import { playbackManager } from 'components/playback/playbackmanager';
import qualityoptions from 'components/qualityOptions';
import focusManager from 'components/focusManager';
import layoutManager from 'components/layoutManager';
import datetime from 'scripts/datetime';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import toast from 'components/toast/toast';
import { scrollBehavior } from 'utils/reducedMotion';
import { getSubtitleStatus, onSubtitleStatus } from 'components/playback/subtitleStatus';
import { getVideoElement, promptRemotePlayback, watchRemotePlayback } from 'components/playback/remotePlayback';
import './cosmicOsd.scss';

const t = (key, ...args) => globalize.translate(key, ...args);
const icon = (name) => `<span class="material-icons ${name}" aria-hidden="true"></span>`;

const resolutionLabel = (stream) => {
    if (!stream?.Height && !stream?.Width) return '';
    const w = stream.Width || 0;
    const h = stream.Height || 0;
    if (w >= 3800 || h >= 2100) return '4K';
    if (w >= 2500 || h >= 1400) return '1440p';
    if (w >= 1900 || h >= 1000) return '1080p';
    if (w >= 1260 || h >= 700) return '720p';
    return h ? `${h}p` : '';
};

const hdrLabel = (stream) => {
    const range = stream?.VideoRangeType || stream?.VideoRange;
    if (!range || range === 'SDR' || range === 'Unknown') return '';
    if (String(range).startsWith('DOVI')) return 'Dolby Vision';
    return String(range).replace('HDR10Plus', 'HDR10+');
};

const formatBitrate = (bps) => {
    if (!bps) return '';
    return bps >= 1e6 ? `${(bps / 1e6).toFixed(1)} Mbps` : `${Math.round(bps / 1e3)} kbps`;
};

const formatSize = (bytes) => {
    if (!bytes) return '';
    return bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(2)} GB` : `${Math.round(bytes / 1048576)} MB`;
};

const formatRuntime = (ticks) => {
    if (!ticks) return '';
    const minutes = Math.round(ticks / 600000000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h} h ${m} min` : `${m} min`;
};

const episodeLabel = (item) => {
    if (item.Type !== 'Episode' || item.IndexNumber == null) return '';
    const season = item.ParentIndexNumber ?? 1;
    let label = t('VpEpisodeNumber', season, item.IndexNumber);
    if (item.IndexNumberEnd) label += `-${item.IndexNumberEnd}`;
    return label;
};

export default function createCosmicOsd(view, hooks) {
    const settingsPanel = view.querySelector('.cosmicOsdSettingsPanel');
    const queuePanel = view.querySelector('.cosmicOsdQueuePanel');
    const titleBlock = view.querySelector('.cosmicOsdTitleBlock');
    const details = view.querySelector('.cosmicOsdDetails');
    const detailsBody = details.querySelector('.cosmicOsdDetailsBody');
    const detailsPeek = details.querySelector('.cosmicOsdDetailsPeek');
    const btnQueue = view.querySelector('.btnCosmicQueue');
    const btnCast = view.querySelector('.btnCosmicCast');
    let castVideo = null;
    let stopCastWatch = null;

    let openPanel = null;
    let settingsView = 'main';
    let currentItem = null;
    let detailsItemId = null;
    let refreshTimer = null;
    const detailsCache = new Map();

    const getPlayer = () => hooks.getPlayer();
    const getApiClient = () => currentItem?.ServerId ? ServerConnections.getApiClient(currentItem.ServerId) : null;

    // ---------- Side panels ----------

    function setPanel(name) {
        openPanel = name;
        settingsPanel.classList.toggle('cosmicOsdPanel-open', name === 'settings');
        queuePanel.classList.toggle('cosmicOsdPanel-open', name === 'queue');
        settingsPanel.setAttribute('aria-hidden', name === 'settings' ? 'false' : 'true');
        queuePanel.setAttribute('aria-hidden', name === 'queue' ? 'false' : 'true');
        view.classList.toggle('cosmicOsd-panelOpen', !!name);
        hooks.onChange();
    }

    function focusFirst(panel) {
        if (!layoutManager.tv) return;
        setTimeout(() => {
            const target = panel.querySelector('.cosmicPanelOption.selected, .cosmicQueueItem-current, .cosmicPanelRow, button');
            if (target) focusManager.focus(target);
        }, 50);
    }

    function toggleSettings() {
        if (openPanel === 'settings') {
            setPanel(null);
            return;
        }
        settingsView = 'main';
        void renderSettings();
        setPanel('settings');
        focusFirst(settingsPanel);
    }

    function toggleQueue() {
        if (openPanel === 'queue') {
            setPanel(null);
            return;
        }
        setPanel('queue');
        void renderQueue().then(() => {
            queuePanel.querySelector('.cosmicQueueItem-current')?.scrollIntoView({ block: 'center' });
            focusFirst(queuePanel);
        });
    }

    const backButton = () => `<button type="button" class="cosmicPanelIconButton" data-view="main" title="${escapeHtml(t('ButtonBack'))}">${icon('arrow_back')}</button>`;
    const headerIcon = (iconName) => `<span class="cosmicPanelHeaderIcon">${icon(iconName)}</span>`;

    const panelHeader = (title, iconName, back) => `
        <div class="cosmicPanelHeader">
            ${back ? backButton() : headerIcon(iconName)}
            <h3>${escapeHtml(title)}</h3>
            <button type="button" class="cosmicPanelIconButton" data-action="close" title="${escapeHtml(t('ButtonClose'))}">${icon('close')}</button>
        </div>`;

    const row = (viewName, iconName, label, value, action) => `
        <button type="button" class="cosmicPanelRow" ${action ? `data-action="${action}"` : `data-view="${viewName}"`}>
            ${icon(iconName)}
            <span class="cosmicPanelRowLabel">${escapeHtml(label)}</span>
            <span class="cosmicPanelRowValue">${escapeHtml(value || '')}</span>
            ${action ? '' : icon('chevron_right')}
        </button>`;

    const emptyHtml = (text) => `<p class="cosmicPanelEmpty">${escapeHtml(text)}</p>`;

    const option = (kind, value, name, aside, selected) => `
        <button type="button" class="cosmicPanelOption${selected ? ' selected' : ''}" data-select="${kind}" data-value="${escapeHtml(String(value))}">
            ${icon(selected ? 'radio_button_checked' : 'radio_button_unchecked')}
            <span class="cosmicPanelOptionText">${escapeHtml(name || '')}${aside ? `<small>${escapeHtml(aside)}</small>` : ''}</span>
        </button>`;

    /** The subtitle chosen is being read out of the video file by the server, or that failed. */
    function subtitleNotice(index) {
        const status = getSubtitleStatus();
        if (status.streamIndex !== index) return null;
        return status.state === 'idle' ? null : status;
    }

    function subtitleNoticeHtml(index) {
        const notice = subtitleNotice(index);
        if (!notice) return '';
        if (notice.state === 'preparing') {
            return `<p class="cosmicPanelNote" role="status">${icon('hourglass_top')}<span>${escapeHtml(t('SubtitlesPreparing'))}</span></p>`;
        }
        return `<div class="cosmicPanelNote cosmicPanelNote-error" role="alert">${icon('error_outline')}<span>${escapeHtml(t('SubtitlesFailed'))}</span>`
            + `<button type="button" class="cosmicPanelNoteAction" data-action="subretry">${escapeHtml(t('Retry'))}</button></div>`;
    }

    /** What the subtitles row says: the subtitle chosen, or that it is being prepared / failed. */
    function subtitleRowValue(subs) {
        const notice = subtitleNotice(subs.index);
        if (notice?.state === 'preparing') return t('SubtitlesPreparing');
        if (notice?.state === 'failed') return t('SubtitlesFailedShort');
        return subs.current ? subs.current.DisplayTitle : t('VpSubtitlesOff');
    }

    function subtitleState(player) {
        const streams = playbackManager.subtitleTracks(player);
        const index = playbackManager.getSubtitleStreamIndex(player) ?? -1;
        const current = streams.find(s => s.Index === index);
        const secondary = playbackManager.secondarySubtitleTracks(player);
        const canSecondary = playbackManager.playerHasSecondarySubtitleSupport(player)
            && streams.length > 1 && secondary.length > 0 && index !== -1
            && playbackManager.trackHasSecondarySubtitleSupport(playbackManager.getSubtitleStream(player, index), player);
        return { streams, index, current, secondary, canSecondary };
    }

    function qualityOptions(player) {
        const videoStream = playbackManager.currentMediaSource(player)?.MediaStreams?.find(s => s.Type === 'Video');
        return qualityoptions.getVideoQualityOptions({
            currentMaxBitrate: playbackManager.getMaxStreamingBitrate(player),
            isAutomaticBitrateEnabled: playbackManager.enableAutomaticBitrateDetection(player),
            videoCodec: videoStream?.Codec,
            videoBitRate: videoStream?.BitRate,
            videoWidth: videoStream?.Width,
            videoHeight: videoStream?.Height,
            enableAuto: true
        });
    }

    function videoInfoHtml(player) {
        const state = playbackManager.getPlayerState(player);
        const source = playbackManager.currentMediaSource(player) || {};
        const streams = source.MediaStreams || [];
        const video = streams.find(s => s.Type === 'Video');
        const audioIndex = playbackManager.getAudioStreamIndex(player);
        const audio = streams.find(s => s.Type === 'Audio' && s.Index === audioIndex) || streams.find(s => s.Type === 'Audio');
        const method = state.PlayState?.PlayMethod;

        let methodLabel = t('DirectPlaying');
        let methodClass = 'direct';
        if (method === 'Transcode') {
            methodLabel = t('Transcoding');
            methodClass = 'transcode';
        } else if (method === 'DirectStream') {
            methodLabel = t('DirectStreaming');
            methodClass = 'stream';
        }

        const chips = [ resolutionLabel(video), hdrLabel(video), audio?.Profile?.includes('Atmos') ? 'Atmos' : '' ]
            .filter(Boolean)
            .map(c => `<span class="cosmicChip cosmicChip-strong">${escapeHtml(c)}</span>`)
            .join('');

        const lines = [];
        if (video) {
            const fps = video.RealFrameRate || video.AverageFrameRate;
            lines.push([ t('Video'), [ video.Width && video.Height ? `${video.Width}×${video.Height}` : '', (video.Codec || '').toUpperCase(), video.Profile, fps ? `${Math.round(fps * 100) / 100} fps` : '', formatBitrate(video.BitRate) ].filter(Boolean).join(' · ') ]);
        }
        if (audio) lines.push([ t('Audio'), audio.DisplayTitle || [ audio.Language, audio.Codec ].filter(Boolean).join(' ') ]);
        const subs = subtitleState(player);
        lines.push([ t('Subtitles'), subs.current ? subs.current.DisplayTitle : t('VpSubtitlesOff') ]);
        if (source.Container) lines.push([ t('VpContainer'), source.Container.toUpperCase() ]);
        if (source.Bitrate) lines.push([ t('VpBitrate'), formatBitrate(source.Bitrate) ]);
        if (source.Size) lines.push([ t('VpSize'), formatSize(source.Size) ]);
        if (source.Name && (currentItem?.MediaSourceCount > 1 || (currentItem?.MediaSources?.length ?? 0) > 1)) lines.push([ t('VpVersion'), source.Name ]);

        return `
            <section class="cosmicVideoInfo">
                <div class="cosmicVideoInfoTop">
                    <span class="cosmicMethod cosmicMethod-${methodClass}">${icon(methodClass === 'transcode' ? 'sync' : 'bolt')}${escapeHtml(methodLabel)}</span>
                    ${chips}
                </div>
                <dl>${lines.map(([ k, v ]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v || '')}</dd></div>`).join('')}</dl>
            </section>`;
    }

    async function renderSettings() {
        const player = getPlayer();
        if (!player) return;

        const inner = settingsPanel.querySelector('.cosmicOsdPanel-inner');
        const commands = playbackManager.getSupportedCommands(player);
        let html = '';

        switch (settingsView) {
            case 'audio': {
                const current = playbackManager.getAudioStreamIndex(player);
                const tracks = playbackManager.audioTracks(player);
                html = panelHeader(t('Audio'), 'audiotrack', true)
                    + '<div class="cosmicPanelBody">'
                    + (tracks.length ? tracks.map(s => option('audio', s.Index, s.DisplayTitle, s.Title && s.Title !== s.DisplayTitle ? s.Title : '', s.Index === current)).join('') : `<p class="cosmicPanelEmpty">${escapeHtml(t('VpNoOptions'))}</p>`)
                    + '</div>';
                break;
            }
            case 'subtitles': {
                const subs = subtitleState(player);
                html = panelHeader(t('Subtitles'), 'closed_caption', true)
                    + '<div class="cosmicPanelBody">'
                    + subtitleNoticeHtml(subs.index)
                    + option('subtitles', -1, t('VpSubtitlesOff'), '', subs.index === -1)
                    + subs.streams.map(s => option('subtitles', s.Index, s.DisplayTitle, s.IsExternal ? t('VpExternal') : '', s.Index === subs.index)).join('')
                    + '</div>';
                break;
            }
            case 'secondary': {
                const current = playbackManager.getSecondarySubtitleStreamIndex(player) ?? -1;
                html = panelHeader(t('SecondarySubtitles'), 'subtitles', true)
                    + '<div class="cosmicPanelBody">'
                    + option('secondary', -1, t('VpSubtitlesOff'), '', current === -1)
                    + playbackManager.secondarySubtitleTracks(player).map(s => option('secondary', s.Index, s.DisplayTitle, '', s.Index === current)).join('')
                    + '</div>';
                break;
            }
            case 'quality':
                html = panelHeader(t('Quality'), 'high_quality', true)
                    + '<div class="cosmicPanelBody">'
                    + qualityOptions(player).map(o => option('quality', o.bitrate ?? 0, o.name, o.secondaryText, o.selected)).join('')
                    + '</div>';
                break;
            case 'speed': {
                const current = playbackManager.getPlaybackRate(player);
                html = panelHeader(t('PlaybackRate'), 'speed', true)
                    + '<div class="cosmicPanelBody">'
                    + playbackManager.getSupportedPlaybackRates(player).map(r => option('speed', r.id, r.name, '', r.id === current)).join('')
                    + '</div>';
                break;
            }
            case 'aspect': {
                const current = playbackManager.getAspectRatio(player);
                html = panelHeader(t('AspectRatio'), 'aspect_ratio', true)
                    + '<div class="cosmicPanelBody">'
                    + playbackManager.getSupportedAspectRatios(player).map(r => option('aspect', r.id, r.name, '', r.id === current)).join('')
                    + '</div>';
                break;
            }
            case 'repeat': {
                const current = playbackManager.getRepeatMode(player);
                html = panelHeader(t('RepeatMode'), 'repeat', true)
                    + '<div class="cosmicPanelBody">'
                    + [ [ 'RepeatNone', t('None') ], [ 'RepeatAll', t('RepeatAll') ], [ 'RepeatOne', t('RepeatOne') ] ]
                        .map(([ id, name ]) => option('repeat', id, name, '', id === current)).join('')
                    + '</div>';
                break;
            }
            default: {
                const audioIndex = playbackManager.getAudioStreamIndex(player);
                const audioTracks = playbackManager.audioTracks(player);
                const audio = audioTracks.find(s => s.Index === audioIndex);
                const subs = subtitleState(player);
                const parts = [ panelHeader(t('VpPlaybackMenu'), 'tune'), '<div class="cosmicPanelBody">', videoInfoHtml(player) ];

                parts.push(`<div class="cosmicPanelGroupTitle">${escapeHtml(t('VpAudioAndSubtitles'))}</div>`);
                parts.push(row('audio', 'audiotrack', t('Audio'), audio?.DisplayTitle || (audioTracks.length ? '' : t('VpNoOptions'))));
                parts.push(row('subtitles', 'closed_caption', t('Subtitles'), subtitleRowValue(subs)));
                parts.push(subtitleNoticeHtml(subs.index));
                if (subs.canSecondary) {
                    const secIndex = playbackManager.getSecondarySubtitleStreamIndex(player) ?? -1;
                    const sec = subs.secondary.find(s => s.Index === secIndex);
                    parts.push(row('secondary', 'subtitles', t('SecondarySubtitles'), sec ? sec.DisplayTitle : t('VpSubtitlesOff')));
                }
                if (playbackManager.supportSubtitleOffset(player) && playbackManager.canHandleOffsetOnCurrentSubtitle(player)) {
                    parts.push(row('', 'av_timer', t('VpSubtitleSync'), '', 'suboffset'));
                }

                parts.push(`<div class="cosmicPanelGroupTitle">${escapeHtml(t('VpPictureAndPlayback'))}</div>`);
                const state = playbackManager.getPlayerState(player);
                if (state.MediaSource?.SupportsTranscoding && commands.includes('SetMaxStreamingBitrate')) {
                    const apiClient = getApiClient();
                    const user = apiClient ? await apiClient.getCurrentUser().catch(() => null) : null;
                    if (user?.Policy?.EnableVideoPlaybackTranscoding) {
                        const selected = qualityOptions(player).find(o => o.selected);
                        parts.push(row('quality', 'high_quality', t('Quality'), selected?.name));
                    }
                }
                if (commands.includes('PlaybackRate')) {
                    const current = playbackManager.getPlaybackRate(player);
                    parts.push(row('speed', 'speed', t('PlaybackRate'), playbackManager.getSupportedPlaybackRates(player).find(r => r.id === current)?.name));
                }
                if (commands.includes('SetAspectRatio')) {
                    const current = playbackManager.getAspectRatio(player);
                    parts.push(row('aspect', 'aspect_ratio', t('AspectRatio'), playbackManager.getSupportedAspectRatios(player).find(r => r.id === current)?.name));
                }
                if (commands.includes('SetRepeatMode') && playbackManager.currentMediaSource(player)?.RunTimeTicks) {
                    const mode = playbackManager.getRepeatMode(player);
                    parts.push(row('repeat', 'repeat', t('RepeatMode'), mode === 'RepeatNone' ? t('None') : t(mode)));
                }
                parts.push(row('', 'analytics', t('VpDetailedStats'), '', 'stats'));
                parts.push('</div>');
                html = parts.join('');
            }
        }

        // The menu may have been closed or moved to another view while the user was loading
        inner.innerHTML = html;
    }

    function onSelect(kind, value) {
        const player = getPlayer();
        if (!player) return;

        switch (kind) {
            case 'audio': {
                const index = parseInt(value, 10);
                if (index !== playbackManager.getAudioStreamIndex(player)) playbackManager.setAudioStreamIndex(index, player);
                break;
            }
            case 'subtitles': {
                const index = parseInt(value, 10);
                if (index !== (playbackManager.getSubtitleStreamIndex(player) ?? -1)) playbackManager.setSubtitleStreamIndex(index, player);
                hooks.toggleSubtitleSync();
                break;
            }
            case 'secondary':
                playbackManager.setSecondarySubtitleStreamIndex(parseInt(value, 10), player);
                break;
            case 'quality': {
                const bitrate = parseInt(value, 10) || 0;
                playbackManager.setMaxStreamingBitrate({ enableAutomaticBitrateDetection: !bitrate, maxBitrate: bitrate }, player);
                break;
            }
            case 'speed':
                playbackManager.setPlaybackRate(value, player);
                break;
            case 'aspect':
                playbackManager.setAspectRatio(value, player);
                break;
            case 'repeat':
                playbackManager.setRepeatMode(value, player);
                break;
        }

        settingsView = 'main';
        // Stream changes apply a moment later
        void renderSettings();
        setTimeout(() => {
            if (openPanel === 'settings' && settingsView === 'main') void renderSettings();
        }, 800);
        focusFirst(settingsPanel);
    }

    function onSettingsClick(e) {
        const target = e.target.closest('[data-view], [data-action], [data-select]');
        if (!target) return;

        if (target.dataset.action === 'close') {
            setPanel(null);
        } else if (target.dataset.action === 'stats') {
            hooks.toggleStats();
            setPanel(null);
        } else if (target.dataset.action === 'suboffset') {
            hooks.showSubtitleOffset();
            setPanel(null);
        } else if (target.dataset.action === 'subretry') {
            getSubtitleStatus().retry?.();
        } else if (target.dataset.select) {
            onSelect(target.dataset.select, target.dataset.value);
        } else if (target.dataset.view != null) {
            settingsView = target.dataset.view || 'main';
            void renderSettings();
            focusFirst(settingsPanel);
        }
    }

    // ---------- Queue ----------

    function queueImage(apiClient, item) {
        if (!apiClient) return '';
        if (item.ImageTags?.Primary) return apiClient.getScaledImageUrl(item.Id, { type: 'Primary', maxWidth: 320, tag: item.ImageTags.Primary });
        if (item.ParentThumbItemId && item.ParentThumbImageTag) return apiClient.getScaledImageUrl(item.ParentThumbItemId, { type: 'Thumb', maxWidth: 320, tag: item.ParentThumbImageTag });
        if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) return apiClient.getScaledImageUrl(item.ParentBackdropItemId, { type: 'Backdrop', maxWidth: 320, tag: item.ParentBackdropImageTags[0] });
        if (item.SeriesId && item.SeriesPrimaryImageTag) return apiClient.getScaledImageUrl(item.SeriesId, { type: 'Primary', maxWidth: 320, tag: item.SeriesPrimaryImageTag });
        return '';
    }

    async function renderQueue() {
        const player = getPlayer();
        const inner = queuePanel.querySelector('.cosmicOsdPanel-inner');
        if (!player) return;

        let playlist = [];
        try {
            playlist = await playbackManager.getPlaylist(player) || [];
        } catch (err) {
            console.error('[CosmicOsd] failed to get playlist', err);
        }

        const currentId = playbackManager.getCurrentPlaylistItemId(player);
        const currentIndex = playlist.findIndex(i => i.PlaylistItemId === currentId);
        const apiClient = getApiClient();

        const items = playlist.map((item, i) => {
            const isCurrent = item.PlaylistItemId === currentId;
            const img = queueImage(apiClient, item);
            const ep = episodeLabel(item);
            const top = item.SeriesName || item.Album || '';
            const meta = [ ep, formatRuntime(item.RunTimeTicks) ].filter(Boolean).join(' · ');
            const progress = item.UserData?.PlayedPercentage;
            return `
                <div class="cosmicQueueItem${isCurrent ? ' cosmicQueueItem-current' : ''}${i < currentIndex ? ' cosmicQueueItem-past' : ''}">
                    <button type="button" class="cosmicQueuePlay" data-play="${escapeHtml(item.PlaylistItemId)}">
                        <span class="cosmicQueueThumb"${img ? ` style="background-image:url('${img}')"` : ''}>
                            ${img ? '' : icon('movie')}
                            ${isCurrent ? `<span class="cosmicQueueNow">${icon('equalizer')}</span>` : ''}
                            ${progress && !isCurrent ? `<span class="cosmicQueueProgress"><span style="width:${Math.min(100, progress)}%"></span></span>` : ''}
                            ${item.UserData?.Played ? `<span class="cosmicQueuePlayed">${icon('check')}</span>` : ''}
                        </span>
                        <span class="cosmicQueueText">
                            ${top && top !== item.Name ? `<small>${escapeHtml(top)}</small>` : ''}
                            <strong>${escapeHtml(item.Name || '')}</strong>
                            <span>${isCurrent ? `<em>${escapeHtml(t('VpNowPlaying'))}</em>` : escapeHtml(meta)}</span>
                        </span>
                    </button>
                    ${isCurrent ? '' : `<button type="button" class="cosmicPanelIconButton cosmicQueueRemove" data-remove="${escapeHtml(item.PlaylistItemId)}" title="${escapeHtml(t('VpRemoveFromQueue'))}">${icon('close')}</button>`}
                </div>`;
        }).join('');

        const remaining = currentIndex >= 0 ? playlist.length - currentIndex - 1 : playlist.length;
        inner.innerHTML = panelHeader(t('VpQueue'), 'playlist_play')
            + `<div class="cosmicPanelSubtitle">${escapeHtml(t('VpQueueCount', playlist.length, remaining))}</div>`
            + `<div class="cosmicPanelBody cosmicQueueList">${items || emptyHtml(t('VpQueueEmpty'))}</div>`;
    }

    function onQueueClick(e) {
        const player = getPlayer();
        const close = e.target.closest('[data-action="close"]');
        if (close) {
            setPanel(null);
            return;
        }
        const remove = e.target.closest('[data-remove]');
        if (remove && player) {
            playbackManager.removeFromPlaylist([ remove.dataset.remove ], player);
            setTimeout(() => {
                renderQueue().catch(console.error);
            }, 300);
            return;
        }
        const play = e.target.closest('[data-play]');
        if (play && player && play.dataset.play !== playbackManager.getCurrentPlaylistItemId(player)) {
            playbackManager.setCurrentPlaylistItem(play.dataset.play, player);
        }
    }

    // ---------- Title block and details under the controls ----------

    function imageUrl(apiClient, id, type, tag, maxWidth) {
        return apiClient.getScaledImageUrl(id, { type, maxWidth, tag });
    }

    function logoFor(apiClient, item, series) {
        if (item.ImageTags?.Logo) return imageUrl(apiClient, item.Id, 'Logo', item.ImageTags.Logo, 600);
        if (item.ParentLogoItemId && item.ParentLogoImageTag) return imageUrl(apiClient, item.ParentLogoItemId, 'Logo', item.ParentLogoImageTag, 600);
        if (series?.ImageTags?.Logo) return imageUrl(apiClient, series.Id, 'Logo', series.ImageTags.Logo, 600);
        return '';
    }

    function renderTitle(item, full, series) {
        const apiClient = getApiClient();
        const data = full || item;
        const logo = apiClient && full ? logoFor(apiClient, full, series) : '';
        const mainName = data.SeriesName || data.Name || '';
        const ep = episodeLabel(data);
        const sub = data.Type === 'Episode' ? [ ep, data.Name ].filter(Boolean).join(' — ') : (data.Taglines?.[0] || '');

        const player = getPlayer();
        const video = player ? playbackManager.currentMediaSource(player)?.MediaStreams?.find(s => s.Type === 'Video') : null;
        const meta = [];
        if (data.ProductionYear) meta.push(`<span>${escapeHtml(String(data.ProductionYear))}</span>`);
        if (data.OfficialRating) meta.push(`<span class="cosmicChip">${escapeHtml(data.OfficialRating)}</span>`);
        if (data.RunTimeTicks) meta.push(`<span>${escapeHtml(formatRuntime(data.RunTimeTicks))}</span>`);
        const res = resolutionLabel(video);
        if (res) meta.push(`<span class="cosmicChip cosmicChip-strong">${escapeHtml(res)}</span>`);
        const hdr = hdrLabel(video);
        if (hdr) meta.push(`<span class="cosmicChip cosmicChip-strong">${escapeHtml(hdr)}</span>`);

        const nameHtml = `<div class="cosmicOsdName">${escapeHtml(mainName)}</div>`;
        const metaHtml = meta.length ? `<div class="cosmicOsdMeta">${meta.join('')}</div>` : '';
        const logoHtml = logo ? `<img class="cosmicOsdLogo" src="${logo}" alt="${escapeHtml(mainName)}" />` : nameHtml;
        titleBlock.innerHTML = `
            ${logoHtml}
            ${sub ? `<div class="cosmicOsdSubtitle">${escapeHtml(sub)}</div>` : ''}
            ${metaHtml}`;

        const img = titleBlock.querySelector('img');
        if (img) {
            img.addEventListener('error', () => {
                img.outerHTML = nameHtml;
            }, { once: true });
        }
    }

    function ratingsHtml(data) {
        const parts = [];
        if (data.CommunityRating) {
            parts.push(`<span class="cosmicRating cosmicRating-star">${icon('star')}${escapeHtml(data.CommunityRating.toFixed(1))}</span>`);
        }
        if (data.CriticRating != null) {
            parts.push(`<span class="cosmicRating"><span class="mediaInfoCriticRating ${data.CriticRating >= 60 ? 'mediaInfoCriticRatingFresh' : 'mediaInfoCriticRatingRotten'}">${escapeHtml(String(data.CriticRating))}%</span></span>`);
        }
        if (data.OfficialRating) parts.push(`<span class="cosmicChip">${escapeHtml(data.OfficialRating)}</span>`);
        if (data.PremiereDate) {
            try {
                parts.push(`<span>${escapeHtml(datetime.toLocaleDateString(datetime.parseISO8601Date(data.PremiereDate), { year: 'numeric', month: 'long', day: 'numeric' }))}</span>`);
            } catch {
                // Ignore bad dates
            }
        } else if (data.ProductionYear) {
            parts.push(`<span>${escapeHtml(String(data.ProductionYear))}</span>`);
        }
        return parts.join('');
    }

    function personCard(apiClient, person) {
        const img = person.PrimaryImageTag ? imageUrl(apiClient, person.Id, 'Primary', person.PrimaryImageTag, 180) : '';
        const initials = (person.Name || '?').split(' ').map(w => w[0]).slice(0, 2).join('');
        return `
            <div class="cosmicCastCard">
                <span class="cosmicCastPhoto"${img ? ` style="background-image:url('${img}')"` : ''}>${img ? '' : escapeHtml(initials)}</span>
                <strong>${escapeHtml(person.Name || '')}</strong>
                ${person.Role ? `<small>${escapeHtml(person.Role)}</small>` : ''}
            </div>`;
    }

    function renderDetails(full, series) {
        const apiClient = getApiClient();
        if (!apiClient || !full) {
            details.classList.add('hide');
            return;
        }

        const overview = full.Overview || series?.Overview || '';
        const ratingSource = full.CommunityRating || full.CriticRating != null ? full : (series || full);
        const genres = (full.Genres?.length ? full.Genres : series?.Genres) || [];
        const people = [ ...(full.People || []), ...(series?.People || []) ];
        const seen = new Set();
        const cast = people.filter(p => (p.Type === 'Actor' || p.Type === 'GuestStar') && !seen.has(p.Id) && seen.add(p.Id)).slice(0, 30);
        const directors = [ ...new Set(people.filter(p => p.Type === 'Director').map(p => p.Name)) ].slice(0, 3);
        const writers = [ ...new Set(people.filter(p => p.Type === 'Writer').map(p => p.Name)) ].slice(0, 3);
        const studios = (full.Studios?.length ? full.Studios : series?.Studios || []).map(s => s.Name).slice(0, 3);

        const ratings = ratingsHtml(ratingSource);
        if (!overview && !ratings && !cast.length) {
            details.classList.add('hide');
            return;
        }
        details.classList.remove('hide');

        detailsPeek.innerHTML = `
            <span class="cosmicOsdDetailsPeekRatings">${ratings}</span>
            <span class="cosmicOsdDetailsPeekText">${escapeHtml(overview ? overview : t('VpMoreInfo'))}</span>`;

        const credits = [];
        if (directors.length) credits.push(`<div><dt>${escapeHtml(t('VpDirectedBy'))}</dt><dd>${escapeHtml(directors.join(', '))}</dd></div>`);
        if (writers.length) credits.push(`<div><dt>${escapeHtml(t('VpWrittenBy'))}</dt><dd>${escapeHtml(writers.join(', '))}</dd></div>`);
        if (studios.length) credits.push(`<div><dt>${escapeHtml(t('VpStudio'))}</dt><dd>${escapeHtml(studios.join(', '))}</dd></div>`);

        const genreChips = genres.slice(0, 5).map(g => `<span class="cosmicChip">${escapeHtml(g)}</span>`).join('');
        const castHtml = cast.length ? `
                <div class="cosmicOsdCastTitle">${escapeHtml(t('VpCast'))}</div>
                <div class="cosmicOsdCast">${cast.map(p => personCard(apiClient, p)).join('')}</div>` : '';
        detailsBody.innerHTML = `
            <div class="cosmicOsdDetailsGrid">
                <div class="cosmicOsdDetailsMain">
                    ${ratings ? `<div class="cosmicOsdRatings">${ratings}</div>` : ''}
                    ${genres.length ? `<div class="cosmicOsdGenres">${genreChips}</div>` : ''}
                    ${full.Taglines?.[0] ? `<h4 class="cosmicOsdTagline">${escapeHtml(full.Taglines[0])}</h4>` : ''}
                    ${overview ? `<p class="cosmicOsdOverview">${escapeHtml(overview)}</p>` : ''}
                </div>
                ${credits.length ? `<dl class="cosmicOsdCredits">${credits.join('')}</dl>` : ''}
            </div>
            ${castHtml}`;
    }

    async function loadDetails(item) {
        const apiClient = getApiClient();
        if (!apiClient || !item?.Id) return null;
        if (detailsCache.has(item.Id)) return detailsCache.get(item.Id);

        const userId = apiClient.getCurrentUserId();
        const promise = (async () => {
            const full = await apiClient.getItem(userId, item.Id).catch(() => null);
            const seriesId = full?.SeriesId;
            const series = seriesId ? await apiClient.getItem(userId, seriesId).catch(() => null) : null;
            return { full, series };
        })();
        detailsCache.set(item.Id, promise);
        return promise;
    }

    // ---------- Send the video to a Chromecast / screen through the browser ----------

    function bindCast() {
        const video = getVideoElement();
        if (video === castVideo) return;
        stopCastWatch?.();
        castVideo = video;
        stopCastWatch = watchRemotePlayback(video, state => {
            btnCast.classList.toggle('hide', state === 'unsupported' || state === 'unavailable');
            btnCast.classList.toggle('cosmicOsd-castActive', state === 'connected' || state === 'connecting');
        });
    }

    function onCastClick() {
        void promptRemotePlayback(castVideo).then(ok => {
            if (!ok) toast({ text: t('RpRemotePlaybackFailed') });
        });
    }

    function setItem(item) {
        currentItem = item;
        if (item) bindCast();
        if (!item) {
            titleBlock.innerHTML = '';
            details.classList.add('hide');
            detailsItemId = null;
            return;
        }

        if (detailsItemId !== item.Id) {
            detailsItemId = item.Id;
            setExpanded(false);
            renderTitle(item, null, null);
            details.classList.add('hide');
            void loadDetails(item).then(result => {
                if (detailsItemId !== item.Id || !result) return;
                renderTitle(item, result.full, result.series);
                renderDetails(result.full, result.series);
            });
        }

        refresh();
    }

    /** Re-renders the open menu (tracks or queue changed). */
    function refresh() {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            if (openPanel === 'settings') void renderSettings();
            if (openPanel === 'queue') void renderQueue();
        }, 150);
    }

    function setExpanded(expanded) {
        details.classList.toggle('cosmicOsdDetails-expanded', expanded);
        view.classList.toggle('cosmicOsd-detailsOpen', expanded);
        const toggle = details.querySelector('.cosmicOsdDetailsToggle');
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        // Open, its text takes the focus so the keys (the remote) can scroll it; closed, it leaves the focus order
        detailsBody.tabIndex = expanded ? 0 : -1;
        if (expanded) {
            if (layoutManager.tv) setTimeout(() => focusManager.focus(detailsBody), 50);
        } else {
            if (detailsBody.contains(document.activeElement)) focusManager.focus(toggle);
            detailsBody.scrollTop = 0;
        }
        hooks.onChange();
    }

    /** Up / down in the open details scroll their text (most of it cannot take the focus); at its ends, the usual keys. */
    function onDetailsKeyDown(e) {
        if (e.target !== detailsBody || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
        const step = detailsBody.clientHeight * 0.6;
        const max = detailsBody.scrollHeight - detailsBody.clientHeight;
        if (e.key === 'ArrowDown' && detailsBody.scrollTop < max - 1) {
            detailsBody.scrollBy({ top: step, behavior: scrollBehavior() });
        } else if (e.key === 'ArrowUp' && detailsBody.scrollTop > 0) {
            detailsBody.scrollBy({ top: -step, behavior: scrollBehavior() });
        } else {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
    }

    const isExpanded = () => details.classList.contains('cosmicOsdDetails-expanded');

    function onDetailsToggle() {
        setExpanded(!isExpanded());
    }

    function setQueueAvailable(available) {
        btnQueue.classList.toggle('hide', !available);
        if (!available && openPanel === 'queue') setPanel(null);
    }

    settingsPanel.addEventListener('click', onSettingsClick);
    queuePanel.addEventListener('click', onQueueClick);
    // The menu open says at once when the subtitles are ready or failed
    const stopSubtitleStatus = onSubtitleStatus(() => {
        if (openPanel === 'settings' && (settingsView === 'main' || settingsView === 'subtitles')) void renderSettings();
    });
    details.querySelector('.cosmicOsdDetailsToggle').addEventListener('click', onDetailsToggle);
    detailsBody.addEventListener('keydown', onDetailsKeyDown);
    btnQueue.addEventListener('click', toggleQueue);
    btnCast.addEventListener('click', onCastClick);

    return {
        setItem,
        refresh,
        toggleSettings,
        toggleQueue,
        setQueueAvailable,
        /** Something of ours is open, so the controls must stay visible. */
        isBusy: () => !!openPanel || isExpanded(),
        isPanelOpen: () => !!openPanel,
        /** Element belongs to a menu or to the details (keys and wheel act on them, not on the video). */
        contains: (el) => !!el && (settingsPanel.contains(el) || queuePanel.contains(el) || details.contains(el)),
        inPanel: (el) => !!el && (settingsPanel.contains(el) || queuePanel.contains(el)),
        /** Closes the top-most thing open; returns true when something was closed. */
        closeTop() {
            if (openPanel) {
                setPanel(null);
                return true;
            }
            if (isExpanded()) {
                setExpanded(false);
                return true;
            }
            return false;
        },
        closeAll() {
            if (openPanel) setPanel(null);
            if (isExpanded()) setExpanded(false);
        },
        destroy() {
            clearTimeout(refreshTimer);
            stopSubtitleStatus();
            settingsPanel.removeEventListener('click', onSettingsClick);
            queuePanel.removeEventListener('click', onQueueClick);
            details.querySelector('.cosmicOsdDetailsToggle').removeEventListener('click', onDetailsToggle);
            detailsBody.removeEventListener('keydown', onDetailsKeyDown);
            btnQueue.removeEventListener('click', toggleQueue);
            btnCast.removeEventListener('click', onCastClick);
            stopCastWatch?.();
            detailsCache.clear();
        }
    };
}
