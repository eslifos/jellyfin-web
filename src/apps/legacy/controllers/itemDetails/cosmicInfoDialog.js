/**
 * "Information" popup of the details page: plain text, no selects.
 * General data, crew, video quality, every audio track and every subtitle language
 * of the selected edition/version.
 */
import escapeHtml from 'escape-html';

import dialogHelper from 'components/dialogHelper/dialogHelper';
import globalize from 'lib/globalize';
import datetime from 'scripts/datetime';
import { getReadableSize } from 'utils/file';

import './cosmicInfoDialog.scss';

const t = (key, ...args) => globalize.translate(key, ...args);

let languageNames = null;
const languageName = (stream) => {
    const code = (stream.Language || '').trim();
    if (code && code.toLowerCase() !== 'und') {
        try {
            languageNames = languageNames || new Intl.DisplayNames([ globalize.getCurrentLocale() ], { type: 'language' });
            const name = languageNames.of(code);
            if (name && name.toLowerCase() !== code.toLowerCase()) {
                return name.charAt(0).toUpperCase() + name.slice(1);
            }
        } catch {
            // unknown code: fall back below
        }
        return code.toUpperCase();
    }
    return t('InfoUnknownLanguage');
};

const resolutionLabel = (v) => {
    const h = Math.max(v.Height || 0, Math.round((v.Width || 0) * 9 / 16));
    if (h >= 2000) return '4K';
    if (h >= 1000) return '1080p';
    if (h >= 700) return '720p';
    if (h >= 540) return '576p';
    return h ? '480p' : '';
};

const rangeLabel = (v) => {
    const r = v.VideoRangeType || '';
    if (r.startsWith('DOVI')) return 'Dolby Vision' + (r.includes('HDR10') ? ' + HDR10' : '');
    if (r === 'HDR10Plus') return 'HDR10+';
    if (r === 'HDR10') return 'HDR10';
    if (r === 'HLG') return 'HLG';
    return 'SDR';
};

const channelsLabel = (a) => {
    if (a.ChannelLayout) return a.ChannelLayout;
    if (!a.Channels) return '';
    if (a.Channels === 1) return 'Mono';
    if (a.Channels === 2) return t('InfoStereo');
    return `${a.Channels - 1}.1`;
};

const codecLabel = (codec) => {
    const names = { truehd: 'Dolby TrueHD', eac3: 'Dolby Digital+', ac3: 'Dolby Digital', dts: 'DTS', aac: 'AAC', flac: 'FLAC', opus: 'Opus', mp3: 'MP3', hevc: 'HEVC (H.265)', h264: 'H.264', av1: 'AV1', vp9: 'VP9', mpeg2video: 'MPEG-2', subrip: 'SRT', ass: 'ASS', ssa: 'SSA', pgssub: 'PGS', dvdsub: 'VobSub', dvbsub: 'DVB', mov_text: 'MOV text', webvtt: 'WebVTT' };
    const key = (codec || '').toLowerCase();
    return names[key] || (codec || '').toUpperCase();
};

const bitrateLabel = (bps) => {
    if (!bps) return '';
    return bps >= 1000000 ? `${(bps / 1000000).toFixed(1)} Mbps` : `${Math.round(bps / 1000)} kbps`;
};

const runtimeLabel = (ticks) => {
    if (!ticks) return '';
    const min = Math.round(ticks / 600000000);
    const h = Math.floor(min / 60);
    return h ? `${h} h ${min % 60} min` : `${min} min`;
};

const row = (label, value) => (value ?
    `<div class="cInfo-row"><span class="cInfo-label">${escapeHtml(label)}</span><span class="cInfo-value">${value}</span></div>` :
    '');

const section = (icon, title, body) => (body ?
    `<section class="cInfo-section"><h3><span class="material-icons" aria-hidden="true">${icon}</span>${escapeHtml(title)}</h3>${body}</section>` :
    '');

const people = (item, types) => (item.People || [])
    .filter(p => types.includes(p.Type))
    .map(p => escapeHtml(p.Name))
    .filter((n, i, all) => all.indexOf(n) === i)
    .join(', ');

const trackTags = (s) => {
    const tags = [];
    if (s.IsDefault) tags.push(t('InfoDefault'));
    if (s.IsForced) tags.push(t('InfoForced'));
    if (s.IsHearingImpaired) tags.push('SDH');
    if (s.IsExternal) tags.push(t('InfoExternal'));
    return tags.map(x => `<span class="cInfo-tag">${escapeHtml(x)}</span>`).join('');
};

function buildHtml(item, source) {
    const streams = source?.MediaStreams || [];
    const video = streams.find(s => s.Type === 'Video');
    const audios = streams.filter(s => s.Type === 'Audio');
    const subs = streams.filter(s => s.Type === 'Subtitle');

    // ---- General
    let premiere = '';
    if (item.PremiereDate) {
        try {
            premiere = escapeHtml(datetime.parseISO8601Date(item.PremiereDate).toLocaleDateString(globalize.getCurrentDateTimeLocale(), { day: 'numeric', month: 'long', year: 'numeric' }));
        } catch {
            premiere = '';
        }
    }
    const ratings = [
        item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : '',
        item.CriticRating != null ? `🍅 ${Math.round(item.CriticRating)}%` : ''
    ].filter(Boolean).join(' &nbsp; ');
    const general = [
        row(t('InfoReleaseDate'), premiere || (item.ProductionYear ? String(item.ProductionYear) : '')),
        row(t('InfoRuntime'), escapeHtml(runtimeLabel(item.RunTimeTicks))),
        row(t('InfoRating'), escapeHtml(item.OfficialRating || '')),
        row(t('InfoScores'), ratings),
        row(t('Genres'), escapeHtml((item.Genres || []).join(', '))),
        row(t('InfoStatus'), escapeHtml(item.Status === 'Continuing' ? t('InfoContinuing') : (item.Status === 'Ended' ? t('InfoEnded') : ''))),
        row(t('InfoCountries'), escapeHtml((item.ProductionLocations || []).join(', '))),
        row(t('Studios'), escapeHtml((item.Studios || []).map(s => s.Name).join(', '))),
        row(t('Tags'), escapeHtml((item.Tags || []).join(', ')))
    ].join('');

    // ---- Crew
    const actors = (item.People || []).filter(p => p.Type === 'Actor' || p.Type === 'GuestStar').slice(0, 10)
        .map(p => escapeHtml(p.Name) + (p.Role ? ` <span class="cInfo-dim">(${escapeHtml(p.Role)})</span>` : '')).join(', ');
    const crew = [
        row(t('Directors'), people(item, [ 'Director' ])),
        row(t('Writers'), people(item, [ 'Writer' ])),
        row(t('InfoProducers'), people(item, [ 'Producer' ])),
        row(t('InfoMusic'), people(item, [ 'Composer' ])),
        row(t('InfoMainCast'), actors)
    ].join('');

    // ---- Video
    let videoHtml = '';
    if (video) {
        const res = resolutionLabel(video);
        videoHtml = [
            row(t('InfoQuality'), `<b>${escapeHtml(res)}</b> <span class="cInfo-dim">${video.Width || '?'}×${video.Height || '?'}</span>`),
            row(t('InfoDynamicRange'), escapeHtml(rangeLabel(video))),
            row(t('InfoVideoCodec'), escapeHtml(codecLabel(video.Codec) + (video.Profile ? ` · ${video.Profile}` : '') + (video.BitDepth ? ` · ${video.BitDepth} bit` : ''))),
            row(t('InfoFrameRate'), video.RealFrameRate ? `${Math.round(video.RealFrameRate * 1000) / 1000} fps` : ''),
            row(t('InfoVideoBitrate'), escapeHtml(bitrateLabel(video.BitRate))),
            row(t('InfoContainer'), escapeHtml((source.Container || '').toUpperCase())),
            row(t('InfoSize'), source.Size ? escapeHtml(getReadableSize(source.Size)) : ''),
            row(t('InfoTotalBitrate'), escapeHtml(bitrateLabel(source.Bitrate))),
            row(t('InfoVersion'), escapeHtml(source.Name || ''))
        ].join('');
    }

    // ---- Audio
    const audioLangs = [ ...new Set(audios.map(languageName)) ];
    let audioHtml = '';
    if (audios.length) {
        audioHtml = `<p class="cInfo-summary">${escapeHtml(audioLangs.join(' · '))}</p><ul class="cInfo-list">${audios.map(a => `<li>
            <b>${escapeHtml(languageName(a))}</b>
            <span>${escapeHtml([ codecLabel(a.Codec) + (/atmos/i.test(`${a.Profile || ''} ${a.Title || ''}`) ? ' Atmos' : ''), channelsLabel(a), bitrateLabel(a.BitRate) ].filter(Boolean).join(' · '))}</span>
            ${a.Title ? `<span class="cInfo-dim">${escapeHtml(a.Title)}</span>` : ''}
            ${trackTags(a)}
        </li>`).join('')}</ul>`;
    }

    // ---- Subtitles
    const subLangs = [ ...new Set(subs.map(languageName)) ];
    let subsHtml = '';
    if (subs.length) {
        subsHtml = `<p class="cInfo-summary">${escapeHtml(subLangs.join(' · '))}</p><ul class="cInfo-list">${subs.map(s => `<li>
            <b>${escapeHtml(languageName(s))}</b>
            <span>${escapeHtml(codecLabel(s.Codec))}</span>
            ${s.Title ? `<span class="cInfo-dim">${escapeHtml(s.Title)}</span>` : ''}
            ${trackTags(s)}
        </li>`).join('')}</ul>`;
    }

    const title = escapeHtml(item.Name || '') + (item.ProductionYear ? ` <span class="cInfo-dim">(${item.ProductionYear})</span>` : '');

    return `<div class="cInfo-header">
            <div>
                <div class="cInfo-kicker">${escapeHtml(t('DetInfo'))}</div>
                <h2 class="cInfo-title">${title}</h2>
            </div>
            <button type="button" class="cInfo-close" aria-label="${escapeHtml(t('ButtonClose'))}"><span class="material-icons" aria-hidden="true">close</span></button>
        </div>
        <div class="cInfo-body">
            ${section('info', t('InfoGeneral'), general)}
            ${section('groups', t('InfoCrew'), crew)}
            ${section('hd', t('InfoVideo'), videoHtml)}
            ${section('graphic_eq', t('InfoAudioTracks', audios.length), audioHtml)}
            ${section('subtitles', t('InfoSubtitleTracks', subs.length), subsHtml)}
        </div>`;
}

/** Opens the popup for the item and the version currently chosen on the page. */
export function showCosmicInfo(item, mediaSourceId) {
    const source = (item.MediaSources || []).find(s => s.Id === mediaSourceId) || (item.MediaSources || [])[0];
    const dlg = dialogHelper.createDialog({ size: 'medium', removeOnClose: true, scrollY: false });
    dlg.classList.add('cosmicInfoDialog');
    dlg.innerHTML = buildHtml(item, source);
    dlg.querySelector('.cInfo-close').addEventListener('click', () => dialogHelper.close(dlg));
    return dialogHelper.open(dlg);
}
