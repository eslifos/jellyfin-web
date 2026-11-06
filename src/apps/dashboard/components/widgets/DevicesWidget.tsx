import React from 'react';
import globalize from 'lib/globalize';
import Widget from './Widget';
import DeviceCard from 'apps/dashboard/features/devices/components/DeviceCard';
import Stack from '@mui/material/Stack';
import DevicesIcon from '@mui/icons-material/Devices';
import useLiveSessions from 'apps/dashboard/features/sessions/hooks/useLiveSessions';

const DevicesWidget = () => {
    const { data: devices } = useLiveSessions();

    return (
        <Widget
            title={globalize.translate('HeaderDevices')}
            href='/dashboard/devices'
            icon={<DevicesIcon />}
            accentColor='#4caf50'
            bare
        >
            <Stack direction='row' flexWrap='wrap' gap={2}>
                {devices?.map(device => (
                    <DeviceCard
                        key={device.Id}
                        device={device}
                    />
                ))}
            </Stack>
        </Widget>
    );
};

export default DevicesWidget;
