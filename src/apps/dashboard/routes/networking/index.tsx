import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { NetworkConfiguration } from '@jellyfin/sdk/lib/generated-client/models/network-configuration';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloudIcon from '@mui/icons-material/Cloud';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DnsIcon from '@mui/icons-material/Dns';
import HomeIcon from '@mui/icons-material/Home';
import HttpsIcon from '@mui/icons-material/Https';
import LanIcon from '@mui/icons-material/Lan';
import LinkIcon from '@mui/icons-material/Link';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PublicIcon from '@mui/icons-material/Public';
import PublicOffIcon from '@mui/icons-material/PublicOff';
import RadarIcon from '@mui/icons-material/Radar';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RouterIcon from '@mui/icons-material/Router';
import ShieldIcon from '@mui/icons-material/Shield';

import { encodePublishedServerUris, getPublishedServerUris, type PublishedServerUris } from 'apps/dashboard/features/networking/utils';
import { BrowseField, CategoryInput } from 'apps/dashboard/features/livetv/components/LiveTvForms';
import { Column, InfoTile, SaveBar, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import { toggleSx } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import useRestartServer from 'apps/dashboard/features/system/api/useRestartServer';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import ConfirmDialog from 'components/ConfirmDialog';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY as CONFIG_QUERY_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import { useSystemInfo } from 'hooks/useSystemInfo';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

const CONFIG_KEY = 'network';
/** Settings that only apply after a restart. */
const RESTART_FIELDS: (keyof NetworkConfiguration)[] = [ 'InternalHttpPort', 'InternalHttpsPort', 'EnableHttps', 'BaseUrl', 'CertificatePath', 'LocalNetworkAddresses', 'EnableIPv4', 'EnableIPv6' ];

const fieldSlot = { inputLabel: { shrink: true } };

const CopyLine: FC<{ label: string; value: string; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => {
    const [ copied, setCopied ] = useState(false);
    const copy = useCallback(() => {
        void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [ value ]);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1, pl: 1.25, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Box sx={{ color, display: 'flex', '& svg': { fontSize: '1.2rem' } }}>{icon}</Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</Typography>
                <Typography noWrap sx={{ fontFamily: 'monospace', fontSize: '0.84rem', color: 'rgba(255,255,255,0.9)' }}>{value}</Typography>
            </Box>
            <Tooltip title={globalize.translate(copied ? 'LtvCopied' : 'NetCopy')}>
                <IconButton size='small' onClick={copy}><ContentCopyIcon sx={{ fontSize: '1rem' }} /></IconButton>
            </Tooltip>
        </Box>
    );
};

const toInt = (v: string) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? undefined : n;
};

export const Component = () => {
    const { api } = useApi();
    const { data: initial, isPending, isError } = useNamedConfiguration<NetworkConfiguration>(CONFIG_KEY);
    const { data: systemInfo } = useSystemInfo();
    const restartServer = useRestartServer();
    const [ config, setConfig ] = useState<NetworkConfiguration | null>(null);
    const [ saved, setSaved ] = useState<NetworkConfiguration | null>(null);
    const [ sameUri, setSameUri ] = useState(true);
    const [ uris, setUris ] = useState<PublishedServerUris>({});
    const [ showSaved, setShowSaved ] = useState(false);
    const [ restartOpen, setRestartOpen ] = useState(false);
    const [ needsRestart, setNeedsRestart ] = useState(false);

    useEffect(() => {
        if (initial && !config) {
            setConfig(initial);
            setSaved(initial);
            const parsed = getPublishedServerUris(initial.PublishedServerUriBySubnet || []);
            setUris(parsed);
            setSameUri(!(parsed.internal || parsed.external));
        }
    }, [ initial, config ]);

    const update = useCallback((patch: Partial<NetworkConfiguration>) => setConfig(c => ({ ...c, ...patch })), []);

    const save = useMutation({
        mutationFn: async (body: NetworkConfiguration) => {
            await getSystemApi(api!).updateNamedConfiguration({ key: CONFIG_KEY, body });
            return body;
        },
        onSuccess: body => {
            void queryClient.invalidateQueries({ queryKey: [ CONFIG_QUERY_KEY, CONFIG_KEY ] });
            if (saved && RESTART_FIELDS.some(f => JSON.stringify(saved[f]) !== JSON.stringify(body[f]))) setNeedsRestart(true);
            setSaved(body);
            setShowSaved(true);
        }
    });

    const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!config) return;
        const published: PublishedServerUris = sameUri ? { all: uris.all?.trim() || undefined } : { internal: uris.internal?.trim() || undefined, external: uris.external?.trim() || undefined };
        save.mutate({ ...config, PublishedServerUriBySubnet: encodePublishedServerUris(published) });
    }, [ config, sameUri, save, uris ]);

    const openRestart = useCallback(() => setRestartOpen(true), []);
    const closeRestart = useCallback(() => setRestartOpen(false), []);
    const doRestart = useCallback(() => {
        setRestartOpen(false);
        restartServer.mutate();
    }, [ restartServer ]);
    const closeSaved = useCallback(() => setShowSaved(false), []);

    const addresses = useMemo(() => {
        if (!config) return [];
        const base = (config.BaseUrl || '').replace(/\/+$/, '');
        const list: { label: string; value: string; color: string; icon: React.ReactNode }[] = [];
        let host = window.location.hostname;
        try {
            if (systemInfo?.LocalAddress) host = new URL(systemInfo.LocalAddress).hostname;
        } catch {
            // keep the browser host
        }
        list.push({ label: globalize.translate('NetLocalHttp'), value: `http://${host}:${config.InternalHttpPort || 8096}${base}`, color: '#00a4dc', icon: <HomeIcon /> });
        if (config.EnableHttps) list.push({ label: globalize.translate('NetLocalHttps'), value: `https://${host}:${config.InternalHttpsPort || 8920}${base}`, color: '#4caf50', icon: <LockIcon /> });
        const pub = sameUri ? uris.all : uris.external;
        if (pub) list.push({ label: globalize.translate('NetPublished'), value: pub, color: '#aa5cc3', icon: <PublicIcon /> });
        return list;
    }, [ config, sameUri, systemInfo, uris ]);

    if (isPending || !config) return <Loading />;

    const remote = !!config.EnableRemoteAccess;
    const filterCount = config.RemoteIPFilter?.length || 0;

    return (
        <Page id='networkingPage' title={globalize.translate('TabNetworking')} className='type-interior mainAnimatedPage fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={globalize.translate('TabNetworking')} subtitle={globalize.translate('NetSubtitle')} />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('NetworkingPageLoadError')}</Alert>
                ) : (
                    <form onSubmit={onSubmit} style={{ maxWidth: 'none' }}>
                        {save.isError && <Alert severity='error' sx={{ mb: 2 }}>{globalize.translate('NetSaveError')}</Alert>}
                        {needsRestart && (
                            <Alert severity='warning' sx={{ mb: 2, alignItems: 'center' }} action={(
                                <Button color='inherit' size='small' startIcon={<RestartAltIcon />} onClick={openRestart} disabled={restartServer.isPending || restartServer.isSuccess}>
                                    {globalize.translate(restartServer.isSuccess ? 'PlgRestarting' : 'PlgRestartNow')}
                                </Button>
                            )}>
                                {globalize.translate('NetRestartNeeded')}
                            </Alert>
                        )}

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, mb: 2.5 }}>
                            <InfoTile icon={<RouterIcon />} label={globalize.translate('NetHttpPort')} value={config.InternalHttpPort ?? '—'} color='#00a4dc' secondary={config.BaseUrl ? `${globalize.translate('NetBase')}: ${config.BaseUrl}` : undefined} />
                            <InfoTile icon={config.EnableHttps ? <LockIcon /> : <LockOpenIcon />} label='HTTPS' value={globalize.translate(config.EnableHttps ? 'NetOn' : 'NetOff')} color={config.EnableHttps ? '#4caf50' : '#90a4ae'}
                                secondary={config.EnableHttps ? `${globalize.translate('NetPort')} ${config.InternalHttpsPort}${config.RequireHttps ? ` · ${globalize.translate('NetRequired')}` : ''}` : undefined} />
                            <InfoTile icon={remote ? <PublicIcon /> : <PublicOffIcon />} label={globalize.translate('NetRemote')} value={globalize.translate(remote ? 'NetAllowed' : 'NetBlocked')} color={remote ? '#aa5cc3' : '#ef5350'}
                                secondary={remote && filterCount ? globalize.translate(config.IsRemoteIPFilterBlacklist ? 'NetBlockedCount' : 'NetAllowedCount', filterCount) : undefined} />
                            <InfoTile icon={<LanIcon />} label={globalize.translate('NetLanNetworks')} value={config.LocalNetworkSubnets?.length || globalize.translate('Auto')} color='#26c6da' />
                            <InfoTile icon={<RadarIcon />} label={globalize.translate('NetDiscovery')} value={globalize.translate(config.AutoDiscovery ? 'NetOn' : 'NetOff')} color={config.AutoDiscovery ? '#ffca28' : '#90a4ae'} />
                        </Box>

                        <SectionCard title={globalize.translate('NetAddresses')} icon={<LinkIcon />} accentColor='#00a4dc' description={globalize.translate('NetAddressesHelp')}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 1.25 }}>
                                {addresses.map(a => <CopyLine key={a.label} {...a} />)}
                            </Box>
                        </SectionCard>

                        <TwoColumns>
                            <Column>
                                <SectionCard title={globalize.translate('HeaderServerAddressSettings')} icon={<DnsIcon />} accentColor='#00a4dc'>
                                    <Stack spacing={2.5}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                            <TextField type='number' label={globalize.translate('LabelLocalHttpServerPortNumber')} helperText={globalize.translate('NetHttpPortHelp')}
                                                value={config.InternalHttpPort ?? ''} onChange={e => update({ InternalHttpPort: toInt(e.target.value) })} slotProps={{ htmlInput: { min: 1, max: 65535 }, ...fieldSlot }} />
                                            <TextField type='number' label={globalize.translate('LabelHttpsPort')} helperText={globalize.translate('NetHttpsPortHelp')}
                                                value={config.InternalHttpsPort ?? ''} onChange={e => update({ InternalHttpsPort: toInt(e.target.value) })} slotProps={{ htmlInput: { min: 1, max: 65535 }, ...fieldSlot }} />
                                        </Box>
                                        <TextField label={globalize.translate('LabelBaseUrl')} helperText={globalize.translate('LabelBaseUrlHelp')} placeholder='/jellyfin'
                                            value={config.BaseUrl || ''} onChange={e => update({ BaseUrl: e.target.value })} fullWidth slotProps={{ input: { sx: { fontFamily: 'monospace' } }, ...fieldSlot }} />
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('HeaderHttpsSettings')} icon={<HttpsIcon />} accentColor='#4caf50' description={globalize.translate('NetHttpsHelp')}>
                                    <Stack spacing={1.25}>
                                        <ToggleRow label={globalize.translate('LabelEnableHttps')} description={globalize.translate('LabelEnableHttpsHelp')} checked={!!config.EnableHttps} onChange={v => update({ EnableHttps: v })} color='#4caf50' />
                                        <ToggleRow label={globalize.translate('LabelRequireHttps')} description={globalize.translate('LabelRequireHttpsHelp')} checked={!!config.RequireHttps} onChange={v => update({ RequireHttps: v })} color='#4caf50' />
                                    </Stack>
                                    <Stack spacing={2.5} sx={{ mt: 2.5 }}>
                                        <BrowseField label={globalize.translate('LabelCustomCertificatePath')} helperText={globalize.translate('LabelCustomCertificatePathHelp')}
                                            value={config.CertificatePath || ''} onChange={v => update({ CertificatePath: v })} placeholder='/config/cert.pfx' />
                                        <TextField type='password' label={globalize.translate('LabelCertificatePassword')} helperText={globalize.translate('LabelCertificatePasswordHelp')}
                                            value={config.CertificatePassword || ''} onChange={e => update({ CertificatePassword: e.target.value })} autoComplete='new-password' fullWidth slotProps={fieldSlot} />
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('NetPublishedTitle')} icon={<CloudIcon />} accentColor='#aa5cc3' description={globalize.translate('NetPublishedHelp')}>
                                    <Stack spacing={2.5}>
                                        <ToggleRow label={globalize.translate('LabelUseSamePublishedServerUri')} checked={sameUri} onChange={setSameUri} color='#aa5cc3' />
                                        {sameUri ? (
                                            <TextField label={globalize.translate('LabelPublishedServerUri')} helperText={globalize.translate('LabelPublishedServerUriHelp')} placeholder='https://jellyfin.midominio.com'
                                                value={uris.all || ''} onChange={e => setUris(u => ({ ...u, all: e.target.value }))} fullWidth slotProps={{ input: { sx: { fontFamily: 'monospace' } }, ...fieldSlot }} />
                                        ) : (
                                            <>
                                                <TextField label={globalize.translate('LabelInternalServerUri')} helperText={globalize.translate('LabelInternalServerUriHelp')}
                                                    value={uris.internal || ''} onChange={e => setUris(u => ({ ...u, internal: e.target.value }))} fullWidth slotProps={{ input: { sx: { fontFamily: 'monospace' } }, ...fieldSlot }} />
                                                <TextField label={globalize.translate('LabelExternalServerUri')} helperText={globalize.translate('LabelExternalServerUriHelp')}
                                                    value={uris.external || ''} onChange={e => setUris(u => ({ ...u, external: e.target.value }))} fullWidth slotProps={{ input: { sx: { fontFamily: 'monospace' } }, ...fieldSlot }} />
                                            </>
                                        )}
                                    </Stack>
                                </SectionCard>
                            </Column>

                            <Column>
                                <SectionCard title={globalize.translate('HeaderRemoteAccessSettings')} icon={<PublicIcon />} accentColor='#aa5cc3'>
                                    <Stack spacing={2.5}>
                                        <ToggleRow label={globalize.translate('AllowRemoteAccess')} description={globalize.translate('AllowRemoteAccessHelp')} checked={remote} onChange={v => update({ EnableRemoteAccess: v })} color='#aa5cc3' />
                                        {remote && (
                                            <>
                                                <Box>
                                                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', mb: 1 }}>{globalize.translate('LabelAllowedRemoteAddressesMode')}</Typography>
                                                    <ToggleButtonGroup size='small' exclusive value={config.IsRemoteIPFilterBlacklist ? 'blacklist' : 'whitelist'}
                                                        onChange={(_, v: string | null) => v && update({ IsRemoteIPFilterBlacklist: v === 'blacklist' })} sx={toggleSx}>
                                                        <ToggleButton value='whitelist'>{globalize.translate('Whitelist')}</ToggleButton>
                                                        <ToggleButton value='blacklist'>{globalize.translate('Blacklist')}</ToggleButton>
                                                    </ToggleButtonGroup>
                                                    <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.45)', mt: 1 }}>
                                                        {globalize.translate(config.IsRemoteIPFilterBlacklist ? 'NetBlacklistHelp' : 'NetWhitelistHelp')}
                                                    </Typography>
                                                </Box>
                                                <CategoryInput label={globalize.translate('LabelAllowedRemoteAddresses')} helperText={globalize.translate('AllowedRemoteAddressesHelp')}
                                                    value={config.RemoteIPFilter || []} onChange={v => update({ RemoteIPFilter: v })} color={config.IsRemoteIPFilterBlacklist ? '#ef5350' : '#4caf50'} />
                                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                                    <TextField type='number' label={globalize.translate('LabelPublicHttpPort')} helperText={globalize.translate('LabelPublicHttpPortHelp')}
                                                        value={config.PublicHttpPort ?? ''} onChange={e => update({ PublicHttpPort: toInt(e.target.value) })} slotProps={{ htmlInput: { min: 1, max: 65535 }, ...fieldSlot }} />
                                                    <TextField type='number' label={globalize.translate('LabelPublicHttpsPort')} helperText={globalize.translate('LabelPublicHttpsPortHelp')}
                                                        value={config.PublicHttpsPort ?? ''} onChange={e => update({ PublicHttpsPort: toInt(e.target.value) })} slotProps={{ htmlInput: { min: 1, max: 65535 }, ...fieldSlot }} />
                                                </Box>
                                            </>
                                        )}
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('NetLocalTitle')} icon={<LanIcon />} accentColor='#26c6da'>
                                    <Stack spacing={2.5}>
                                        <CategoryInput label={globalize.translate('LabelLanNetworks')} helperText={globalize.translate('LanNetworksHelp')}
                                            value={config.LocalNetworkSubnets || []} onChange={v => update({ LocalNetworkSubnets: v })} color='#26c6da' />
                                        <CategoryInput label={globalize.translate('LabelBindToLocalNetworkAddress')} helperText={globalize.translate('LabelBindToLocalNetworkAddressHelp')}
                                            value={config.LocalNetworkAddresses || []} onChange={v => update({ LocalNetworkAddresses: v })} color='#00a4dc' />
                                        <CategoryInput label={globalize.translate('LabelKnownProxies')} helperText={globalize.translate('KnownProxiesHelp')}
                                            value={config.KnownProxies || []} onChange={v => update({ KnownProxies: v })} color='#ff9800' />
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('HeaderNetworking')} icon={<ShieldIcon />} accentColor='#ffca28'>
                                    <Stack spacing={1.25}>
                                        <ToggleRow label={globalize.translate('LabelEnableIP4')} description={globalize.translate('LabelEnableIP4Help')} checked={!!config.EnableIPv4} onChange={v => update({ EnableIPv4: v })} color='#ffca28' />
                                        <ToggleRow label={globalize.translate('LabelEnableIP6')} description={globalize.translate('LabelEnableIP6Help')} checked={!!config.EnableIPv6} onChange={v => update({ EnableIPv6: v })} color='#ffca28' />
                                        <ToggleRow label={globalize.translate('LabelAutomaticDiscovery')} description={globalize.translate('LabelAutomaticDiscoveryHelp')} checked={!!config.AutoDiscovery} onChange={v => update({ AutoDiscovery: v })} color='#ffca28' />
                                        <ToggleRow label={globalize.translate('NetIgnoreVirtual')} description={globalize.translate('NetIgnoreVirtualHelp')} checked={!!config.IgnoreVirtualInterfaces} onChange={v => update({ IgnoreVirtualInterfaces: v })} color='#ffca28' />
                                    </Stack>
                                    {config.IgnoreVirtualInterfaces && (
                                        <Box sx={{ mt: 2.5 }}>
                                            <CategoryInput label={globalize.translate('NetVirtualNames')} helperText={globalize.translate('NetVirtualNamesHelp')}
                                                value={config.VirtualInterfaceNames || []} onChange={v => update({ VirtualInterfaceNames: v })} color='#ffca28' />
                                        </Box>
                                    )}
                                </SectionCard>
                            </Column>
                        </TwoColumns>

                        <SaveBar isSubmitting={save.isPending} />
                    </form>
                )}
            </Box>

            <SavedSnackbar open={showSaved} onClose={closeSaved} />
            <ConfirmDialog
                open={restartOpen}
                title={globalize.translate('Restart')}
                text={globalize.translate('MessageConfirmRestart')}
                onCancel={closeRestart}
                onConfirm={doRestart}
                confirmButtonColor='warning'
                confirmButtonText={globalize.translate('Restart')}
            />
        </Page>
    );
};

Component.displayName = 'NetworkingPage';
