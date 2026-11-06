import { getDisplayVersion } from '@jellyfin/sdk/lib/utils/versioning';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import DnsIcon from '@mui/icons-material/Dns';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import React from 'react';

import { useSystemInfo } from 'hooks/useSystemInfo';
import globalize from 'lib/globalize';

import Widget from './Widget';

type ServerInfoWidgetProps = {
    onScanLibrariesClick?: () => void;
    onRestartClick?: () => void;
    onShutdownClick?: () => void;
    isScanning?: boolean;
};

const InfoTile = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <Box sx={{
        p: 1.5, borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,164,220,0.12)', minWidth: 0
    }}>
        <Typography sx={{ fontSize: '0.68rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', mb: 0.25 }}>
            {label}
        </Typography>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value ?? <Skeleton width='70%' />}
        </Typography>
    </Box>
);

const outlinedSx = (color: string) => ({
    fontWeight: 600,
    color,
    borderColor: `${color}55`,
    background: `${color}10`,
    '&:hover': { borderColor: color, background: `${color}22` }
});

const ServerInfoWidget = ({
    onScanLibrariesClick,
    onRestartClick,
    onShutdownClick,
    isScanning
}: ServerInfoWidgetProps) => {
    const { data: systemInfo, isPending } = useSystemInfo();

    const displayServerVersion = getDisplayVersion(systemInfo?.Version);
    const displayWebVersion = getDisplayVersion(__PACKAGE_JSON_VERSION__);

    return (
        <Widget
            title={globalize.translate('TabServer')}
            href='/dashboard/settings'
            icon={<DnsIcon />}
            accentColor='#00a4dc'
        >
            <Box sx={{ px: 1 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2 }}>
                    <InfoTile label={globalize.translate('LabelServerName')} value={isPending ? undefined : systemInfo?.ServerName} />
                    <InfoTile label={globalize.translate('LabelServerVersion')} value={isPending ? undefined : displayServerVersion} />
                    <InfoTile label={globalize.translate('LabelWebVersion')} value={displayWebVersion} />
                    <InfoTile label={globalize.translate('LabelBuildVersion')} value={__JF_BUILD_VERSION__} />
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    <Button
                        variant='contained'
                        onClick={onScanLibrariesClick}
                        startIcon={<RefreshIcon />}
                        sx={{ fontWeight: 600, flex: { sm: 1 } }}
                        loading={isScanning}
                        loadingPosition='start'
                    >
                        {globalize.translate('ButtonScanAllLibraries')}
                    </Button>

                    <Button variant='outlined' onClick={onRestartClick} startIcon={<RestartAltIcon />} sx={outlinedSx('#ff9800')}>
                        {globalize.translate('Restart')}
                    </Button>

                    <Button variant='outlined' onClick={onShutdownClick} startIcon={<PowerSettingsNewIcon />} sx={outlinedSx('#ef5350')}>
                        {globalize.translate('ButtonShutdown')}
                    </Button>
                </Stack>
            </Box>
        </Widget>
    );
};

export default ServerInfoWidget;
