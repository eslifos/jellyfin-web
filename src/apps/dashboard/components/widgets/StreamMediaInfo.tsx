import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';
import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import Box from '@mui/material/Box';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import SubtitlesRoundedIcon from '@mui/icons-material/SubtitlesRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import React, { type FC } from 'react';

import globalize from 'lib/globalize';

const VIDEO_COLOR = '#00a4dc';
const AUDIO_COLOR = '#aa5cc3';
const SUB_COLOR = '#ffca28';

/** ISO 639-2 codes (what Jellyfin stores) to ISO 639-1, so the browser can name the language. */
const ISO2: Record<string, string> = {
    spa: 'es', eng: 'en', jpn: 'ja', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', ita: 'it', por: 'pt',
    kor: 'ko', chi: 'zh', zho: 'zh', rus: 'ru', ara: 'ar', hin: 'hi', dut: 'nl', nld: 'nl', pol: 'pl',
    tur: 'tr', swe: 'sv', nor: 'no', dan: 'da', fin: 'fi', gre: 'el', ell: 'el', heb: 'he', tha: 'th',
    vie: 'vi', ind: 'id', cze: 'cs', ces: 'cs', hun: 'hu', rum: 'ro', ron: 'ro', ukr: 'uk', cat: 'ca'
};

const languageName = (code?: string | null) => {
    if (!code || code === 'und') return null;
    const short = ISO2[code.toLowerCase()] ?? code;
    try {
        const name = new Intl.DisplayNames([ globalize.getCurrentLocale() || 'es' ], { type: 'language' }).of(short);
        if (name) return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
        // unknown code: show it as is
    }
    return code.toUpperCase();
};

/** 4K / 1440p / 1080p / 720p / SD from the frame size (wide movies are less tall, so the width counts too). */
export const resolutionLabel = (width?: number | null, height?: number | null) => {
    const w = width ?? 0;
    const h = height ?? 0;
    if (!w && !h) return null;
    if (w >= 3800 || h >= 2000) return '4K';
    if (w >= 2500 || h >= 1400) return '1440p';
    if (w >= 1900 || h >= 1000) return '1080p';
    if (w >= 1260 || h >= 700) return '720p';
    if (h >= 560) return '576p';
    return h >= 470 ? '480p' : `${h}p`;
};

const channelsLabel = (s: MediaStream) => {
    const c = s.Channels ?? 0;
    if (c === 1) return 'Mono';
    if (c === 2) return globalize.translate('StreamStereo');
    if (c === 6) return '5.1';
    if (c === 8) return '7.1';
    return c > 0 ? `${c} ch` : null;
};

const hdrLabel = (s: MediaStream) => {
    const range = String(s.VideoRangeType ?? s.VideoRange ?? '');
    if (!range || range === 'SDR' || range === 'Unknown') return null;
    if (range.startsWith('DOVI')) return 'Dolby Vision';
    if (range === 'HDR10Plus') return 'HDR10+';
    return range;
};

const codec = (value?: string | null) => (value ? value.toUpperCase().replace(/^H264$/, 'H.264').replace(/^H265$/, 'HEVC') : null);

const Badge: FC<{ icon: React.ReactNode; color: string; label: string; main: string; parts: (string | null | undefined)[]; changed?: string | null }> = ({ icon, color, label, main, parts, changed }) => (
    <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: '1 1 180px',
        px: 1, py: 0.6, borderRadius: '10px', background: `${color}12`, border: `1px solid ${color}38`
    }}>
        <Box sx={{ color, display: 'flex', '& svg': { fontSize: '1.05rem' } }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontSize: '0.6rem', letterSpacing: '0.8px', textTransform: 'uppercase', fontWeight: 700, color: `${color}dd` }}>{label}</Box>
            <Box sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={[ main, ...parts ].filter(Boolean).join(' · ')}>
                {main}
                {parts.filter(Boolean).length > 0 && (
                    <Box component='span' sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}> · {parts.filter(Boolean).join(' · ')}</Box>
                )}
            </Box>
            {changed && (
                <Box sx={{ fontSize: '0.66rem', color: '#ff9800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>→ {changed}</Box>
            )}
        </Box>
    </Box>
);

const pickTracks = (session: SessionInfoDto) => {
    const streams = session.NowPlayingItem?.MediaStreams ?? [];
    const play = session.PlayState;
    const audios = streams.filter(s => s.Type === 'Audio');
    const subIndex = play?.SubtitleStreamIndex ?? -1;
    return {
        streams,
        video: streams.find(s => s.Type === 'Video'),
        audio: audios.find(s => s.Index === play?.AudioStreamIndex) ?? audios.find(s => s.IsDefault) ?? audios[0],
        subtitle: subIndex >= 0 ? streams.find(s => s.Type === 'Subtitle' && s.Index === subIndex) : undefined,
        subCount: streams.filter(s => s.Type === 'Subtitle').length
    };
};

/** What the server converts to, when it is transcoding (null when that part plays as it is). */
const conversions = (session: SessionInfoDto) => {
    const info = session.TranscodingInfo;
    if (!info || session.PlayState?.PlayMethod !== 'Transcode') return { video: null, audio: null, subtitle: null };
    const reasons = (info.TranscodeReasons as string[] | undefined) ?? [];
    return {
        video: info.IsVideoDirect ? null : [ resolutionLabel(info.Width, info.Height), codec(info.VideoCodec) ].filter(Boolean).join(' · '),
        audio: info.IsAudioDirect ? null : [ codec(info.AudioCodec), info.AudioChannels === 2 ? globalize.translate('StreamStereo') : null ].filter(Boolean).join(' · '),
        subtitle: reasons.includes('SubtitleCodecNotSupported') ? globalize.translate('StreamBurnedIn') : null
    };
};

const subtitleParts = (subtitle: MediaStream | undefined, subCount: number) => {
    if (!subtitle) return [ subCount ? globalize.translate('StreamSubtitlesAvailable', subCount) : null ];
    return [
        codec(subtitle.Codec)?.replace('SUBRIP', 'SRT').replace('PGSSUB', 'PGS') ?? null,
        subtitle.IsForced ? globalize.translate('StreamForced') : null,
        subtitle.IsExternal ? globalize.translate('StreamExternal') : null
    ];
};

/** What is playing: video quality, audio track and subtitles, with the conversion when it is transcoded. */
const StreamMediaInfo: FC<{ session: SessionInfoDto }> = ({ session }) => {
    const { streams, video, audio, subtitle, subCount } = pickTracks(session);
    if (!streams.length) return null;
    const changed = conversions(session);
    const unknown = globalize.translate('StreamUnknownLanguage');

    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {video && (
                <Badge icon={<VideocamRoundedIcon />} color={VIDEO_COLOR} label={globalize.translate('StreamVideo')}
                    main={resolutionLabel(video.Width, video.Height) ?? codec(video.Codec) ?? '—'}
                    parts={[ hdrLabel(video), codec(video.Codec), video.BitRate ? `${(video.BitRate / 1e6).toFixed(1)} Mbps` : null ]}
                    changed={changed.video} />
            )}
            {audio && (
                <Badge icon={<GraphicEqRoundedIcon />} color={AUDIO_COLOR} label={globalize.translate('StreamAudio')}
                    main={languageName(audio.Language) ?? unknown}
                    parts={[ codec(audio.Profile?.includes('Atmos') ? 'Atmos' : audio.Codec), channelsLabel(audio) ]}
                    changed={changed.audio} />
            )}
            <Badge icon={<SubtitlesRoundedIcon />} color={SUB_COLOR} label={globalize.translate('StreamSubtitles')}
                main={subtitle ? (languageName(subtitle.Language) ?? unknown) : globalize.translate('StreamNoSubtitles')}
                parts={subtitleParts(subtitle, subCount)}
                changed={subtitle ? changed.subtitle : null} />
        </Box>
    );
};

export default StreamMediaInfo;
