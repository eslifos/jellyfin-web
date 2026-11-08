import React from 'react';
import { LogLevel } from '@jellyfin/sdk/lib/generated-client/models/log-level';
import DownloadIcon from '@mui/icons-material/Download';
import ExtensionIcon from '@mui/icons-material/Extension';
import ExtensionOffIcon from '@mui/icons-material/ExtensionOff';
import GppBadIcon from '@mui/icons-material/GppBad';
import KeyIcon from '@mui/icons-material/Key';
import LockIcon from '@mui/icons-material/Lock';
import LoginIcon from '@mui/icons-material/Login';
import LyricsIcon from '@mui/icons-material/Lyrics';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import SubtitlesOffIcon from '@mui/icons-material/SubtitlesOff';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdateAlt';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';

import globalize from 'lib/globalize';

interface TypeInfo {
    labelKey: string;
    color: string;
    icon: React.ReactNode;
}

/** Known activity log types written by the server, with their look. */
const TYPES: Record<string, TypeInfo> = {
    AuthenticationSucceeded: { labelKey: 'ActTypeLogin', color: '#4caf50', icon: <LoginIcon /> },
    AuthenticationFailed: { labelKey: 'ActTypeLoginFailed', color: '#ef5350', icon: <GppBadIcon /> },
    UserLockedOut: { labelKey: 'ActTypeLockedOut', color: '#ef5350', icon: <LockIcon /> },
    UserPasswordChanged: { labelKey: 'ActTypePasswordChanged', color: '#ff9800', icon: <KeyIcon /> },
    SessionStarted: { labelKey: 'ActTypeSessionStarted', color: '#26c6da', icon: <WifiIcon /> },
    SessionEnded: { labelKey: 'ActTypeSessionEnded', color: '#78909c', icon: <WifiOffIcon /> },
    VideoPlayback: { labelKey: 'ActTypeVideoPlayback', color: '#00a4dc', icon: <PlayCircleIcon /> },
    VideoPlaybackStopped: { labelKey: 'ActTypeVideoStopped', color: '#4f7f99', icon: <StopCircleIcon /> },
    AudioPlayback: { labelKey: 'ActTypeAudioPlayback', color: '#aa5cc3', icon: <MusicNoteIcon /> },
    AudioPlaybackStopped: { labelKey: 'ActTypeAudioStopped', color: '#7d5a8a', icon: <StopCircleIcon /> },
    UserDownloadingContent: { labelKey: 'ActTypeDownload', color: '#26a69a', icon: <DownloadIcon /> },
    UserCreated: { labelKey: 'ActTypeUserCreated', color: '#66bb6a', icon: <PersonAddIcon /> },
    UserDeleted: { labelKey: 'ActTypeUserDeleted', color: '#ef5350', icon: <PersonRemoveIcon /> },
    PluginInstalled: { labelKey: 'ActTypePluginInstalled', color: '#aa5cc3', icon: <ExtensionIcon /> },
    PluginUpdateInstalled: { labelKey: 'ActTypePluginUpdated', color: '#aa5cc3', icon: <SystemUpdateIcon /> },
    PluginUninstalled: { labelKey: 'ActTypePluginUninstalled', color: '#ff9800', icon: <ExtensionOffIcon /> },
    InstallationFailed: { labelKey: 'ActTypeInstallFailed', color: '#ef5350', icon: <ExtensionOffIcon /> },
    TaskFailed: { labelKey: 'ActTypeTaskFailed', color: '#ef5350', icon: <ScheduleIcon /> },
    SubtitleDownloadFailure: { labelKey: 'ActTypeSubtitleFailed', color: '#ff9800', icon: <SubtitlesOffIcon /> },
    LyricDownloadFailure: { labelKey: 'ActTypeLyricFailed', color: '#ff9800', icon: <LyricsIcon /> }
};

const FALLBACK: TypeInfo = { labelKey: '', color: '#90a4ae', icon: <NotificationsIcon /> };

export const getTypeInfo = (type?: string | null) => (type && TYPES[type]) || FALLBACK;

export const getTypeLabel = (type?: string | null) => {
    const info = getTypeInfo(type);
    return info.labelKey ? globalize.translate(info.labelKey) : (type || '—');
};

/**
 * Options for the type filter. The server matches with LIKE %value%,
 * so "Playback" covers every playback entry and "VideoPlayback" also
 * includes the "stopped" ones.
 */
export const TYPE_FILTERS: { value: string; labelKey: string }[] = [
    { value: 'Playback', labelKey: 'ActFilterAllPlayback' },
    { value: 'VideoPlayback', labelKey: 'ActTypeVideoPlayback' },
    { value: 'AudioPlayback', labelKey: 'ActTypeAudioPlayback' },
    { value: 'AuthenticationSucceeded', labelKey: 'ActTypeLogin' },
    { value: 'AuthenticationFailed', labelKey: 'ActTypeLoginFailed' },
    { value: 'SessionStarted', labelKey: 'ActTypeSessionStarted' },
    { value: 'SessionEnded', labelKey: 'ActTypeSessionEnded' },
    { value: 'UserDownloadingContent', labelKey: 'ActTypeDownload' },
    { value: 'UserCreated', labelKey: 'ActTypeUserCreated' },
    { value: 'UserDeleted', labelKey: 'ActTypeUserDeleted' },
    { value: 'UserLockedOut', labelKey: 'ActTypeLockedOut' },
    { value: 'UserPasswordChanged', labelKey: 'ActTypePasswordChanged' },
    { value: 'Plugin', labelKey: 'ActFilterPlugins' },
    { value: 'TaskFailed', labelKey: 'ActTypeTaskFailed' },
    { value: 'DownloadFailure', labelKey: 'ActFilterDownloadFailures' }
];

export const SEVERITY_COLORS: Partial<Record<LogLevel, string>> = {
    [LogLevel.Information]: '#00a4dc',
    [LogLevel.Warning]: '#ff9800',
    [LogLevel.Error]: '#ef5350',
    [LogLevel.Critical]: '#d50000'
};

export const severityColor = (level?: LogLevel | null) => (level && SEVERITY_COLORS[level]) || '#90a4ae';
