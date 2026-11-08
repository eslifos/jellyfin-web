/**
 * Cosmic building blocks for the plugin pages: stat tiles, status badges,
 * plugin cards and version helpers.
 */
import React, { type FC, useCallback, useState } from 'react';
import { PluginStatus } from '@jellyfin/sdk/lib/generated-client/models/plugin-status';
import type { VersionInfo } from '@jellyfin/sdk/lib/generated-client/models/version-info';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ExtensionIcon from '@mui/icons-material/Extension';
import SettingsIcon from '@mui/icons-material/Settings';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import { Link, useNavigate } from 'react-router-dom';

import globalize from 'lib/globalize';
import { getPluginUrl } from 'utils/dashboard';

import { useDisablePlugin } from '../api/useDisablePlugin';
import { useEnablePlugin } from '../api/useEnablePlugin';
import { useInstallPackage } from '../api/useInstallPackage';
import { CATEGORY_LABELS } from '../constants/categoryLabels';
import { PluginCategory } from '../constants/pluginCategory';
import type { PluginDetails } from '../types/PluginDetails';

export const TRUSTED_REPO_URL = 'https://repo.jellyfin.org/';

/* ---------- helpers ---------- */

/** Compares dotted version strings ("10.9.1.0"). */
export const compareVersions = (a?: string | null, b?: string | null) => {
    const pa = (a || '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = (b || '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff) return diff;
    }
    return 0;
};

/** Newest repository version that targets this server version or older. */
export const latestCompatible = (versions: VersionInfo[], serverVersion?: string | null) => (
    versions
        .filter(v => !serverVersion || !v.targetAbi || compareVersions(v.targetAbi, serverVersion) <= 0)
        .sort((x, y) => compareVersions(y.version, x.version))[0]
);

/** The update to install for an installed plugin, if a newer version exists. */
export const getUpdate = (plugin: PluginDetails, serverVersion?: string | null) => {
    if (!plugin.status || !plugin.canUninstall) return undefined;
    const latest = latestCompatible(plugin.versions, serverVersion);
    return latest && compareVersions(latest.version, plugin.version?.version) > 0 ? latest : undefined;
};

export const categoryLabel = (category?: string) => {
    if (!category) return globalize.translate('Other');
    const key = Object.values(PluginCategory).find(c => c.toLowerCase() === category.toLowerCase());
    return key ? globalize.translate(CATEGORY_LABELS[key]) : category;
};

export const STATUS_INFO: Record<string, { color: string; labelKey: string }> = {
    [PluginStatus.Active]: { color: '#4caf50', labelKey: 'PlgStatusActive' },
    [PluginStatus.Restart]: { color: '#ff9800', labelKey: 'PlgStatusRestart' },
    [PluginStatus.Disabled]: { color: '#90a4ae', labelKey: 'PlgStatusDisabled' },
    [PluginStatus.NotSupported]: { color: '#ef5350', labelKey: 'PlgStatusNotSupported' },
    [PluginStatus.Malfunctioned]: { color: '#ef5350', labelKey: 'PlgStatusMalfunctioned' },
    [PluginStatus.Superceded]: { color: '#78909c', labelKey: 'PlgStatusSuperceded' },
    [PluginStatus.Deleted]: { color: '#78909c', labelKey: 'PlgStatusDeleted' }
};

export const pluginUrl = (plugin: Pick<PluginDetails, 'id' | 'name'>) => `/dashboard/plugins/${plugin.id}?name=${encodeURIComponent(plugin.name || '')}`;

/* ---------- small UI ---------- */

export const StatTile: FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; color: string; active?: boolean; onClick?: () => void }> = ({ icon, label, value, color, active, onClick }) => (
    <Paper elevation={0} onClick={onClick} sx={{
        position: 'relative', overflow: 'hidden', p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5,
        cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        borderColor: active ? `${color}99 !important` : undefined,
        boxShadow: active ? `0 0 22px ${color}33` : 'none',
        '&:hover': onClick ? { transform: 'translateY(-2px)', borderColor: `${color}66 !important` } : {}
    }}>
        <Box sx={{ position: 'absolute', top: 0, left: '1rem', right: '1rem', height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <Box sx={{
            width: 42, height: 42, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: `${color}1f`, border: `1px solid ${color}44`, '& svg': { color, fontSize: '1.35rem' }
        }}>
            {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '1.45rem', fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{value}</Typography>
            <Typography noWrap sx={{ fontSize: '0.7rem', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>{label}</Typography>
        </Box>
    </Paper>
);

export const toggleSx = {
    '& .MuiToggleButton-root': {
        border: '1px solid rgba(0,164,220,0.2)', color: 'rgba(255,255,255,0.55)', px: 1.5, gap: 0.75, textTransform: 'none', fontSize: '0.82rem',
        '&.Mui-selected': { color: '#00a4dc', background: 'rgba(0,164,220,0.16)', borderColor: 'rgba(0,164,220,0.45)' },
        '&:hover': { background: 'rgba(0,164,220,0.1)' }
    },
    '& .MuiToggleButtonGroup-grouped:first-of-type': { borderRadius: '12px 0 0 12px' },
    '& .MuiToggleButtonGroup-grouped:last-of-type': { borderRadius: '0 12px 12px 0' }
};

export const Badge: FC<{ label: string; color: string; dot?: boolean; icon?: React.ReactNode }> = ({ label, color, dot, icon }) => (
    <Box component='span' sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.25, borderRadius: '8px', fontSize: '0.66rem', fontWeight: 700,
        color, background: `${color}17`, border: `1px solid ${color}40`, whiteSpace: 'nowrap', letterSpacing: '0.3px',
        '& svg': { fontSize: '0.9rem', color }
    }}>
        {icon ? <Box component='span' sx={{ display: 'inline-flex' }}>{icon}</Box> : dot && <Box component='span' sx={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />}
        {label}
    </Box>
);

export const StatusBadge: FC<{ status?: PluginStatus | null }> = ({ status }) => {
    if (!status) return <Badge label={globalize.translate('LabelNotInstalled')} color='#00a4dc' />;
    const info = STATUS_INFO[status] || { color: '#90a4ae', labelKey: status };
    return <Badge label={globalize.translate(info.labelKey)} color={info.color} dot />;
};

export const PluginImage: FC<{ url?: string; name?: string; height?: number | string; rounded?: string }> = ({ url, name, height = 120, rounded = '0' }) => {
    const [ failed, setFailed ] = useState(false);
    const onError = useCallback(() => setFailed(true), []);
    return (
        <Box sx={{
            height, borderRadius: rounded, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(0,164,220,0.12), rgba(170,92,195,0.12))'
        }}>
            {url && !failed ? (
                <Box component='img' src={url} alt={name} loading='lazy' onError={onError} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <ExtensionIcon sx={{ fontSize: 54, color: 'rgba(255,255,255,0.25)' }} />
            )}
        </Box>
    );
};

/* ---------- plugin card ---------- */

export const PluginTile: FC<{ plugin: PluginDetails; update?: VersionInfo }> = ({ plugin, update }) => {
    const navigate = useNavigate();
    const enable = useEnablePlugin();
    const disable = useDisablePlugin();
    const install = useInstallPackage();
    const status = plugin.status;
    const accent = status ? (STATUS_INFO[status]?.color || '#00a4dc') : '#00a4dc';
    const busy = enable.isPending || disable.isPending;

    const open = useCallback(() => navigate(pluginUrl(plugin)), [ navigate, plugin ]);
    const stop = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

    const toggle = useCallback((_: unknown, checked: boolean) => {
        const version = plugin.version?.version;
        if (!version) return;
        (checked ? enable : disable).mutate({ pluginId: plugin.id, version });
    }, [ disable, enable, plugin ]);

    const runUpdate = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!update || !plugin.name) return;
        install.mutate({ name: plugin.name, assemblyGuid: plugin.id, version: update.version, repositoryUrl: update.repositoryUrl });
    }, [ install, plugin, update ]);

    const settingsUrl = plugin.configurationPage?.Name ? `/${getPluginUrl(plugin.configurationPage.Name)}` : undefined;

    return (
        <Paper elevation={0} onClick={open} sx={{
            position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', borderRadius: '16px',
            border: `1px solid ${accent}33`, boxShadow: `0 8px 28px rgba(0,0,0,0.3), 0 0 18px ${accent}10`,
            transition: 'transform 0.2s, border-color 0.2s', '&:hover': { transform: 'translateY(-3px)', borderColor: `${accent}88` }
        }}>
            <Box sx={{ position: 'relative' }}>
                <PluginImage url={plugin.imageUrl} name={plugin.name} />
                <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    <Box sx={{ backdropFilter: 'blur(6px)', borderRadius: '8px', background: 'rgba(0,0,0,0.45)' }}><StatusBadge status={status} /></Box>
                    {update && !install.isSuccess && <Box sx={{ backdropFilter: 'blur(6px)', borderRadius: '8px', background: 'rgba(0,0,0,0.45)' }}><Badge label={globalize.translate('PlgUpdateBadge', update.version || '')} color='#ffca28' /></Box>}
                </Box>
            </Box>

            <Box sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.98rem', color: '#fff', flex: 1, minWidth: 0 }}>{plugin.name}</Typography>
                    {plugin.version?.version && <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', flexShrink: 0 }}>v{plugin.version.version}</Typography>}
                </Box>
                <Typography noWrap sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                    {categoryLabel(plugin.category)}{plugin.owner ? ` · ${plugin.owner}` : ''}
                </Typography>
                <Typography sx={{
                    fontSize: '0.78rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.45, minHeight: '2.3em',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>
                    {plugin.description || '—'}
                </Typography>

                <Box onClick={stop} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'default' }}>
                    {status && plugin.canUninstall && (
                        <Tooltip title={globalize.translate(plugin.isEnabled ? 'PlgDisable' : 'PlgEnable')}>
                            <span>
                                <Switch size='small' checked={plugin.isEnabled} onChange={toggle} disabled={busy || status === PluginStatus.Restart} />
                            </span>
                        </Tooltip>
                    )}
                    {settingsUrl && (
                        <Tooltip title={globalize.translate('Settings')}>
                            <IconButton size='small' component={Link} to={settingsUrl}><SettingsIcon fontSize='small' /></IconButton>
                        </Tooltip>
                    )}
                    <Box sx={{ flex: 1 }} />
                    {update && (install.isSuccess ? (
                        <Badge label={globalize.translate('PlgStatusRestart')} color='#ff9800' />
                    ) : (
                        <Button size='small' variant='contained' color='warning' onClick={runUpdate} disabled={install.isPending}
                            startIcon={install.isPending ? <CircularProgress size={14} color='inherit' /> : <SystemUpdateAltIcon />}>
                            {globalize.translate('PlgUpdate')}
                        </Button>
                    ))}
                    {!status && (
                        <Button size='small' variant='outlined' onClick={open}>{globalize.translate('HeaderInstall')}</Button>
                    )}
                </Box>
                {install.isError && <Typography sx={{ fontSize: '0.7rem', color: '#ef5350' }}>{globalize.translate('MessagePluginInstallError')}</Typography>}
            </Box>
        </Paper>
    );
};
