import { PluginStatus } from '@jellyfin/sdk/lib/generated-client/models/plugin-status';
import type { VersionInfo } from '@jellyfin/sdk/lib/generated-client/models/version-info';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Delete from '@mui/icons-material/Delete';
import Download from '@mui/icons-material/Download';
import DownloadDone from '@mui/icons-material/DownloadDone';
import ExpandMore from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import InfoIcon from '@mui/icons-material/Info';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Settings from '@mui/icons-material/Settings';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import React, { type FC, useState, useCallback, useMemo } from 'react';
import { useSearchParams, Link as RouterLink, useParams } from 'react-router-dom';

import { SectionCard } from 'apps/dashboard/components/cosmic';
import { findBestConfigurationPage } from 'apps/dashboard/features/plugins/api/configurationPage';
import { findBestPluginInfo } from 'apps/dashboard/features/plugins/api/pluginInfo';
import { useConfigurationPages } from 'apps/dashboard/features/plugins/api/useConfigurationPages';
import { useDisablePlugin } from 'apps/dashboard/features/plugins/api/useDisablePlugin';
import { useEnablePlugin } from 'apps/dashboard/features/plugins/api/useEnablePlugin';
import { useInstallPackage } from 'apps/dashboard/features/plugins/api/useInstallPackage';
import { usePackageInfo } from 'apps/dashboard/features/plugins/api/usePackageInfo';
import { usePlugins } from 'apps/dashboard/features/plugins/api/usePlugins';
import { useUninstallPlugin } from 'apps/dashboard/features/plugins/api/useUninstallPlugin';
import { Badge, PluginImage, StatusBadge, TRUSTED_REPO_URL, categoryLabel, compareVersions, getUpdate, latestCompatible } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import type { PluginDetails } from 'apps/dashboard/features/plugins/types/PluginDetails';
import { Column, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import ConfirmDialog from 'components/ConfirmDialog';
import MarkdownBox from 'components/MarkdownBox';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { useSystemInfo } from 'hooks/useSystemInfo';
import globalize from 'lib/globalize';
import { getDisplayDateTime } from 'scripts/datetime';
import { getPluginUrl } from 'utils/dashboard';

interface AlertMessage {
    severity?: 'success' | 'info' | 'warning' | 'error'
    messageKey: string
}

const InfoRow: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.05)', '&:last-child': { borderBottom: 0 } }}>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{label}</Typography>
        <Box sx={{ ml: 'auto', minWidth: 0, fontSize: '0.84rem', color: 'rgba(255,255,255,0.88)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {children}
        </Box>
    </Box>
);

const RevisionItem: FC<{ version: VersionInfo; installed: boolean; compatible: boolean; latest: boolean; defaultOpen: boolean; onInstall: () => void; disabled: boolean }> = ({ version, installed, compatible, latest, defaultOpen, onInstall, disabled }) => {
    const [ open, setOpen ] = useState(defaultOpen);
    const toggle = useCallback(() => setOpen(o => !o), []);
    const color = installed ? '#4caf50' : '#00a4dc';

    return (
        <Box sx={{ position: 'relative', pl: 3, pb: 1.5, '&:last-child': { pb: 0 } }}>
            <Box sx={{ position: 'absolute', left: 7, top: 6, bottom: 0, width: '2px', background: 'rgba(255,255,255,0.07)' }} />
            <Box sx={{ position: 'absolute', left: 2, top: 6, width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }} />
            <Box sx={{ borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${installed ? '#4caf5055' : 'rgba(255,255,255,0.06)'}` }}>
                <Box onClick={toggle} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', p: 1.25, cursor: 'pointer' }}>
                    <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem' }}>{version.version}</Typography>
                    {latest && <Badge label={globalize.translate('PlgLatest')} color='#00a4dc' />}
                    {installed && <Badge label={globalize.translate('LabelInstalled')} color='#4caf50' dot />}
                    {!compatible && <Badge label={globalize.translate('PlgIncompatible')} color='#ef5350' />}
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                        {version.timestamp ? getDisplayDateTime(version.timestamp) : ''}
                        {version.targetAbi ? ` · ABI ${version.targetAbi}` : ''}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <ExpandMore sx={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', color: 'rgba(255,255,255,0.5)' }} />
                </Box>
                <Collapse in={open} unmountOnExit>
                    <Box sx={{ px: 1.5, pb: 1.5, fontSize: '0.84rem' }}>
                        <MarkdownBox fallback={globalize.translate('LabelNoChangelog')} markdown={version.changelog} />
                        <Box sx={{ mt: 1.5 }}>
                            {installed ? (
                                <Button size='small' disabled startIcon={<DownloadDone />} variant='outlined'>{globalize.translate('LabelInstalled')}</Button>
                            ) : (
                                <Button size='small' startIcon={<Download />} variant='outlined' onClick={onInstall} disabled={disabled || !compatible}>
                                    {globalize.translate('PlgInstallVersion', version.version || '')}
                                </Button>
                            )}
                        </Box>
                    </Box>
                </Collapse>
            </Box>
        </Box>
    );
};

const PluginPage: FC = () => {
    const { api } = useApi();
    const { pluginId } = useParams();
    const [ searchParams ] = useSearchParams();
    const { data: systemInfo } = useSystemInfo();
    const disablePlugin = useDisablePlugin();
    const enablePlugin = useEnablePlugin();
    const installPlugin = useInstallPackage();
    const uninstallPlugin = useUninstallPlugin();

    const [ isEnabledOverride, setIsEnabledOverride ] = useState<boolean>();
    const [ isInstallConfirmOpen, setIsInstallConfirmOpen ] = useState(false);
    const [ isInstalling, setIsInstalling ] = useState(false);
    const [ isUninstallConfirmOpen, setIsUninstallConfirmOpen ] = useState(false);
    const [ pendingInstallVersion, setPendingInstallVersion ] = useState<VersionInfo>();
    const [ copied, setCopied ] = useState(false);

    const pluginName = searchParams.get('name') ?? undefined;
    const serverVersion = systemInfo?.Version;

    const { data: configurationPages, isError: isConfigurationPagesError, isPending: isConfigurationPagesLoading } = useConfigurationPages();
    const { data: packageInfo, isError: isPackageInfoError, isPending: isPackageInfoLoading } = usePackageInfo(pluginName ? { name: pluginName, assemblyGuid: pluginId } : undefined);
    const { data: plugins, isError: isPluginsError, isPending: isPluginsLoading } = usePlugins();

    const isLoading = isConfigurationPagesLoading || isPackageInfoLoading || isPluginsLoading;

    const pluginDetails = useMemo<PluginDetails | undefined>(() => {
        if (pluginId && !isPluginsLoading) {
            const pluginInfo = findBestPluginInfo(pluginId, plugins);

            let version;
            if (pluginInfo) {
                const repoVersion = packageInfo?.versions?.find(v => v.version === pluginInfo.Version);
                version = repoVersion || { version: pluginInfo.Version, VersionNumber: pluginInfo.Version };
            } else {
                version = packageInfo?.versions?.[0];
            }

            let imageUrl;
            if (pluginInfo?.HasImage) {
                imageUrl = api?.getUri(`/Plugins/${pluginInfo.Id}/${pluginInfo.Version}/Image`);
            }

            return {
                canUninstall: !!pluginInfo?.CanUninstall,
                category: packageInfo?.category,
                description: pluginInfo?.Description || packageInfo?.description || packageInfo?.overview,
                id: pluginId,
                imageUrl: imageUrl || packageInfo?.imageUrl || undefined,
                isEnabled: (isEnabledOverride && pluginInfo?.Status === PluginStatus.Restart)
                    ?? pluginInfo?.Status !== PluginStatus.Disabled,
                name: pluginName || pluginInfo?.Name || packageInfo?.name,
                owner: pluginInfo?.CanUninstall === false ? 'jellyfin' : packageInfo?.owner,
                status: pluginInfo?.Status,
                configurationPage: findBestConfigurationPage(configurationPages || [], pluginId),
                version,
                versions: packageInfo?.versions || []
            };
        }
    }, [ api, configurationPages, isEnabledOverride, isPluginsLoading, packageInfo, pluginId, pluginName, plugins ]);

    const update = pluginDetails ? getUpdate(pluginDetails, serverVersion) : undefined;
    const latest = pluginDetails ? latestCompatible(pluginDetails.versions, serverVersion) : undefined;

    const alertMessages = useMemo(() => {
        const alerts: AlertMessage[] = [];
        if (disablePlugin.isError) alerts.push({ messageKey: 'PluginDisableError' });
        if (enablePlugin.isError) alerts.push({ messageKey: 'PluginEnableError' });
        if (installPlugin.isSuccess) alerts.push({ severity: 'success', messageKey: 'MessagePluginInstalled' });
        if (installPlugin.isError) alerts.push({ messageKey: 'MessagePluginInstallError' });
        if (uninstallPlugin.isSuccess) alerts.push({ severity: 'success', messageKey: 'PlgUninstalled' });
        if (uninstallPlugin.isError) alerts.push({ messageKey: 'PluginUninstallError' });
        if (isConfigurationPagesError) alerts.push({ messageKey: 'PluginLoadConfigError' });
        if (!isPluginsLoading && pluginDetails?.canUninstall && isPackageInfoError) alerts.push({ severity: 'warning', messageKey: 'PluginLoadRepoError' });
        if (isPluginsError) alerts.push({ messageKey: 'MessageGetInstalledPluginsError' });
        if (pluginDetails?.status === PluginStatus.Restart) alerts.push({ severity: 'warning', messageKey: 'PlgRestartThisPlugin' });
        if (pluginDetails?.status === PluginStatus.NotSupported) alerts.push({ messageKey: 'PlgNotSupportedHelp' });
        if (pluginDetails?.status === PluginStatus.Malfunctioned) alerts.push({ messageKey: 'PlgMalfunctionedHelp' });
        return alerts;
    }, [ disablePlugin.isError, enablePlugin.isError, installPlugin.isError, installPlugin.isSuccess, isConfigurationPagesError, isPackageInfoError,
        isPluginsError, isPluginsLoading, pluginDetails?.canUninstall, pluginDetails?.status, uninstallPlugin.isError, uninstallPlugin.isSuccess ]);

    const resetAll = useCallback(() => {
        installPlugin.reset();
        enablePlugin.reset();
        disablePlugin.reset();
        uninstallPlugin.reset();
    }, [ disablePlugin, enablePlugin, installPlugin, uninstallPlugin ]);

    const toggleEnabled = useCallback(() => {
        if (!pluginDetails?.version?.version) return;
        const params = { pluginId: pluginDetails.id, version: pluginDetails.version.version };
        if (pluginDetails.isEnabled) {
            disablePlugin.mutate(params, { onSuccess: () => setIsEnabledOverride(false) });
        } else {
            enablePlugin.mutate(params, { onSuccess: () => setIsEnabledOverride(true) });
        }
    }, [ disablePlugin, enablePlugin, pluginDetails ]);

    /** Install a version, asking for confirmation if it comes from an untrusted repository. */
    const install = useCallback((version?: VersionInfo, isConfirmed = false) => {
        if (!pluginDetails?.name) return;
        const installVersion = version || latest || pluginDetails.version;
        if (!installVersion) return;

        if (!isConfirmed && !pluginDetails.status && !installVersion.repositoryUrl?.startsWith(TRUSTED_REPO_URL)) {
            setPendingInstallVersion(installVersion);
            setIsInstallConfirmOpen(true);
            return;
        }

        resetAll();
        setIsInstalling(true);
        installPlugin.mutate({
            name: pluginDetails.name,
            assemblyGuid: pluginDetails.id,
            version: installVersion.version,
            repositoryUrl: installVersion.repositoryUrl
        }, {
            onSettled: () => {
                setIsInstalling(false);
                setPendingInstallVersion(undefined);
            }
        });
    }, [ installPlugin, latest, pluginDetails, resetAll ]);

    const onInstallLatest = useCallback(() => install(update || latest), [ install, latest, update ]);
    const onConfirmInstall = useCallback(() => {
        setIsInstallConfirmOpen(false);
        install(pendingInstallVersion, true);
    }, [ install, pendingInstallVersion ]);
    const onCloseInstallConfirmDialog = useCallback(() => {
        setPendingInstallVersion(undefined);
        setIsInstallConfirmOpen(false);
    }, []);
    const onConfirmUninstall = useCallback(() => setIsUninstallConfirmOpen(true), []);
    const onCloseUninstallConfirmDialog = useCallback(() => setIsUninstallConfirmOpen(false), []);
    const onUninstall = useCallback(() => {
        if (!pluginDetails?.version?.version) return;
        setIsUninstallConfirmOpen(false);
        resetAll();
        uninstallPlugin.mutate({ pluginId: pluginDetails.id, version: pluginDetails.version.version });
    }, [ pluginDetails, resetAll, uninstallPlugin ]);

    const copyId = useCallback(() => {
        if (!pluginId) return;
        void navigator.clipboard?.writeText(pluginId).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [ pluginId ]);

    const name = pluginDetails?.name || pluginName;
    const status = pluginDetails?.status;
    const settingsUrl = pluginDetails?.configurationPage?.Name ? `/${getPluginUrl(pluginDetails.configurationPage.Name)}` : undefined;
    const repoUrl = pluginDetails?.version?.repositoryUrl || latest?.repositoryUrl;
    const repoName = pluginDetails?.version?.repositoryName || latest?.repositoryName;
    const sourceUrl = pluginDetails?.version?.sourceUrl || latest?.sourceUrl;
    const bundled = !!status && pluginDetails?.canUninstall === false;
    const toggleBusy = enablePlugin.isPending || disablePlugin.isPending;

    return (
        <Page id='addPluginPage' title={name} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <Button component={RouterLink} to='/dashboard/plugins' startIcon={<ArrowBackIcon />} size='small' sx={{ mb: 1.5, mt: 1 }}>
                    {globalize.translate('TabPlugins')}
                </Button>

                {/* Hero */}
                <Paper elevation={0} sx={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', p: { xs: 2, md: 2.5 }, mb: 2.5, display: 'flex', gap: 2.5, flexDirection: { xs: 'column', md: 'row' } }}>
                    <Box sx={{ position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem', height: '2px', background: 'linear-gradient(90deg, transparent, #00a4dc, #aa5cc3, transparent)' }} />
                    <Box sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0 }}>
                        {isLoading && !pluginDetails?.imageUrl ? (
                            <Skeleton variant='rounded' height={170} />
                        ) : (
                            <PluginImage url={pluginDetails?.imageUrl} name={name} height={170} rounded='14px' />
                        )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                        <Typography component='h1' sx={{
                            fontSize: { xs: '1.5rem', md: '1.9rem' }, fontWeight: 800, lineHeight: 1.2,
                            background: 'linear-gradient(135deg, #fff 20%, #00a4dc 60%, #aa5cc3 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                        }}>
                            {name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                            {!isPluginsLoading && <StatusBadge status={status} />}
                            {pluginDetails?.category && <Badge label={categoryLabel(pluginDetails.category)} color='#aa5cc3' />}
                            {bundled && <Badge label={globalize.translate('LabelBundled')} color='#26c6da' />}
                            {update && <Badge label={globalize.translate('PlgUpdateBadge', update.version || '')} color='#ffca28' />}
                            {pluginDetails?.owner && (
                                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('PlgBy', pluginDetails.owner)}</Typography>
                            )}
                        </Box>
                        <Typography sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, maxWidth: '90ch' }}>
                            {isLoading && !pluginDetails?.description ? <Skeleton /> : pluginDetails?.description}
                        </Typography>

                        {!isLoading && (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 'auto', pt: 1 }}>
                                {!status && (
                                    <Button variant='contained' startIcon={isInstalling ? <CircularProgress size={16} color='inherit' /> : <Download />} onClick={onInstallLatest} disabled={isInstalling || !latest}>
                                        {latest ? globalize.translate('PlgInstallVersion', latest.version || '') : globalize.translate('HeaderInstall')}
                                    </Button>
                                )}
                                {update && !installPlugin.isSuccess && (
                                    <Button variant='contained' color='warning' startIcon={isInstalling ? <CircularProgress size={16} color='inherit' /> : <SystemUpdateAltIcon />} onClick={onInstallLatest} disabled={isInstalling}>
                                        {globalize.translate('PlgUpdateTo', update.version || '')}
                                    </Button>
                                )}
                                {settingsUrl && (
                                    <Button variant='outlined' component={RouterLink} to={settingsUrl} startIcon={<Settings />}>{globalize.translate('Settings')}</Button>
                                )}
                                {status && pluginDetails?.canUninstall && (
                                    <Box component='label' sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 1.25, pr: 0.5, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                                        <Typography sx={{ fontSize: '0.84rem' }}>{globalize.translate('LabelEnablePlugin')}</Typography>
                                        <Switch checked={pluginDetails.isEnabled} onChange={toggleEnabled} disabled={toggleBusy || status === PluginStatus.Restart} />
                                    </Box>
                                )}
                                {status && pluginDetails?.canUninstall && (
                                    <Button color='error' variant='outlined' startIcon={<Delete />} onClick={onConfirmUninstall} disabled={uninstallPlugin.isPending || uninstallPlugin.isSuccess}>
                                        {globalize.translate('ButtonUninstall')}
                                    </Button>
                                )}
                            </Box>
                        )}
                    </Box>
                </Paper>

                {alertMessages.map(({ severity = 'error', messageKey }) => (
                    <Alert key={messageKey} severity={severity} sx={{ mb: 2 }}>{globalize.translate(messageKey)}</Alert>
                ))}
                {!isLoading && !status && (
                    <Alert severity='info' sx={{ mb: 2 }}>{globalize.translate('ServerRestartNeededAfterPluginInstall')}</Alert>
                )}

                <TwoColumns>
                    <Column>
                        <SectionCard title={globalize.translate('HeaderRevisionHistory')} icon={<HistoryIcon />} accentColor='#00a4dc'
                            description={pluginDetails?.versions.length ? globalize.translate('PlgVersionsCount', pluginDetails.versions.length) : undefined}>
                            {isPackageInfoLoading && pluginName ? (
                                <Stack spacing={1}>{[ 1, 2, 3 ].map(i => <Skeleton key={i} variant='rounded' height={48} />)}</Stack>
                            ) : pluginDetails?.versions.length ? (
                                <Box>
                                    {pluginDetails.versions.map((v, i) => (
                                        <RevisionItem
                                            key={v.checksum || v.version}
                                            version={v}
                                            installed={!!status && v.version === pluginDetails.version?.version}
                                            compatible={!serverVersion || !v.targetAbi || compareVersions(v.targetAbi, serverVersion) <= 0}
                                            latest={v.version === latest?.version}
                                            defaultOpen={i === 0}
                                            disabled={isInstalling}
                                            onInstall={() => install(v)}
                                        />
                                    ))}
                                </Box>
                            ) : (
                                <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate(bundled ? 'PlgBundledNoHistory' : 'PlgNoHistory')}</Typography>
                            )}
                        </SectionCard>
                    </Column>

                    <Column>
                        <SectionCard title={globalize.translate('PlgDetails')} icon={<InfoIcon />} accentColor='#aa5cc3'>
                            <Box>
                                <InfoRow label={globalize.translate('LabelStatus')}>{isPluginsLoading ? <Skeleton width={80} /> : <StatusBadge status={status} />}</InfoRow>
                                <InfoRow label={globalize.translate('PlgInstalledVersion')}>
                                    <Box component='span' sx={{ fontFamily: 'monospace' }}>{status ? pluginDetails?.version?.version : '—'}</Box>
                                </InfoRow>
                                <InfoRow label={globalize.translate('PlgLatestVersion')}>
                                    <Box component='span' sx={{ fontFamily: 'monospace' }}>{latest?.version || '—'}</Box>
                                </InfoRow>
                                {latest?.targetAbi && <InfoRow label={globalize.translate('PlgTargetAbi')}><Box component='span' sx={{ fontFamily: 'monospace' }}>{latest.targetAbi}</Box></InfoRow>}
                                {serverVersion && <InfoRow label={globalize.translate('PlgServerVersion')}><Box component='span' sx={{ fontFamily: 'monospace' }}>{serverVersion}</Box></InfoRow>}
                                <InfoRow label={globalize.translate('LabelDeveloper')}>{pluginDetails?.owner || globalize.translate('Unknown')}</InfoRow>
                                <InfoRow label={globalize.translate('PlgCategory')}>{categoryLabel(pluginDetails?.category)}</InfoRow>
                                <InfoRow label={globalize.translate('LabelRepository')}>
                                    {bundled ? globalize.translate('LabelBundled') : (repoUrl ? (
                                        <Link href={repoUrl} target='_blank' rel='noopener noreferrer'>{repoName || repoUrl}</Link>
                                    ) : globalize.translate('Unknown'))}
                                </InfoRow>
                                {sourceUrl && (
                                    <InfoRow label={globalize.translate('PlgDownload')}>
                                        <Link href={sourceUrl} target='_blank' rel='noopener noreferrer' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                            {globalize.translate('PlgPackage')} <OpenInNewIcon sx={{ fontSize: '0.9rem' }} />
                                        </Link>
                                    </InfoRow>
                                )}
                                <InfoRow label='ID'>
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box component='span' sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{pluginId}</Box>
                                        <Tooltip title={globalize.translate(copied ? 'LtvCopied' : 'PlgCopyId')}>
                                            <IconButton size='small' onClick={copyId}><ContentCopyIcon sx={{ fontSize: '0.9rem' }} /></IconButton>
                                        </Tooltip>
                                    </Box>
                                </InfoRow>
                            </Box>
                        </SectionCard>
                    </Column>
                </TwoColumns>
            </Box>

            <ConfirmDialog
                open={isInstallConfirmOpen}
                title={globalize.translate('HeaderConfirmPluginInstallation')}
                text={globalize.translate('MessagePluginInstallDisclaimer')}
                onCancel={onCloseInstallConfirmDialog}
                onConfirm={onConfirmInstall}
                confirmButtonText={globalize.translate('HeaderInstall')}
            />

            <ConfirmDialog
                open={isUninstallConfirmOpen}
                title={globalize.translate('HeaderUninstallPlugin')}
                text={globalize.translate('UninstallPluginConfirmation', name || '')}
                onCancel={onCloseUninstallConfirmDialog}
                onConfirm={onUninstall}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('ButtonUninstall')}
            />
        </Page>
    );
};

export default PluginPage;
