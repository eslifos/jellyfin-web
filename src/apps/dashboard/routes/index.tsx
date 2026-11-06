import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import ConfirmDialog from 'components/ConfirmDialog';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import ServerPathWidget from '../components/widgets/ServerPathWidget';
import ResourceMonitorWidget from '../components/widgets/ResourceMonitorWidget';
import ServerInfoWidget from '../components/widgets/ServerInfoWidget';
import AlertsLogWidget from '../components/widgets/AlertsLogWidget';
import useShutdownServer from '../features/system/api/useShutdownServer';
import useRestartServer from '../features/system/api/useRestartServer';
import useLiveTasks from '../features/tasks/hooks/useLiveTasks';
import RunningTasksWidget from '../components/widgets/RunningTasksWidget';
import { useStartTask } from '../features/tasks/api/useStartTask';
import ItemCountsWidget from '../components/widgets/ItemCountsWidget';

export const Component = () => {
    const { api } = useApi();
    const [ isRestartConfirmDialogOpen, setIsRestartConfirmDialogOpen ] = useState(false);
    const [ isShutdownConfirmDialogOpen, setIsShutdownConfirmDialogOpen ] = useState(false);
    const startTask = useStartTask();
    const restartServer = useRestartServer();
    const shutdownServer = useShutdownServer();
    const queryClient = useQueryClient();

    const { data: tasks } = useLiveTasks({ isHidden: false });

    const librariesTask = useMemo(() => (
        tasks?.find((value) => value.Key === 'RefreshLibrary')
    ), [ tasks ]);

    const promptRestart = useCallback(() => {
        setIsRestartConfirmDialogOpen(true);
    }, []);

    const closeRestartDialog = useCallback(() => {
        setIsRestartConfirmDialogOpen(false);
    }, []);

    const promptShutdown = useCallback(() => {
        setIsShutdownConfirmDialogOpen(true);
    }, []);

    const closeShutdownDialog = useCallback(() => {
        setIsShutdownConfirmDialogOpen(false);
    }, []);

    const onScanLibraries = useCallback(() => {
        const scanLibrariesTask = tasks?.find((value) => value.Key === 'RefreshLibrary');

        if (scanLibrariesTask?.Id) {
            startTask.mutate({
                taskId: scanLibrariesTask.Id
            });
        }
    }, [ startTask, tasks ]);

    const onRestartConfirm = useCallback(() => {
        restartServer.mutate();
        setIsRestartConfirmDialogOpen(false);
    }, [ restartServer ]);

    const onShutdownConfirm = useCallback(() => {
        shutdownServer.mutate();
        setIsShutdownConfirmDialogOpen(false);
    }, [shutdownServer]);

    // Clear the query client when the server restarts or shuts down
    useEffect(() => {
        return api?.subscribe([OutboundWebSocketMessageType.ServerRestarting, OutboundWebSocketMessageType.ServerShuttingDown], () => {
            queryClient.clear();
        });
    }, [ api, queryClient ]);

    return (
        <Page
            id='dashboardPage'
            title={globalize.translate('TabDashboard')}
            className='mainAnimatedPage type-interior'
        >
            <ConfirmDialog
                open={isRestartConfirmDialogOpen}
                title={globalize.translate('Restart')}
                text={globalize.translate('MessageConfirmRestart')}
                onConfirm={onRestartConfirm}
                onCancel={closeRestartDialog}
                confirmButtonText={globalize.translate('Restart')}
                confirmButtonColor='error'
            />
            <ConfirmDialog
                open={isShutdownConfirmDialogOpen}
                title={globalize.translate('ButtonShutdown')}
                text={globalize.translate('MessageConfirmShutdown')}
                onConfirm={onShutdownConfirm}
                onCancel={closeShutdownDialog}
                confirmButtonText={globalize.translate('ButtonShutdown')}
                confirmButtonColor='error'
            />
            <Box className='content-primary'>
                <Box sx={{ mb: 3, mt: 1 }}>
                    <Typography component='h1' sx={{
                        fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.5px',
                        background: 'linear-gradient(135deg, #fff 20%, #00a4dc 60%, #aa5cc3 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                    }}>
                        {globalize.translate('TabDashboard')}
                    </Typography>
                    <Box sx={{ mt: 1, width: 72, height: 3, borderRadius: 3, background: 'linear-gradient(90deg, #00a4dc, #aa5cc3)' }} />
                </Box>
                <Grid container spacing={3}>
                    <Grid item xs={12} lg={7} xl={8}>
                        <Stack spacing={3}>
                            <ServerInfoWidget
                                onScanLibrariesClick={onScanLibraries}
                                onRestartClick={promptRestart}
                                onShutdownClick={promptShutdown}
                                isScanning={librariesTask?.State !== TaskState.Idle}
                            />
                            <ResourceMonitorWidget />
                            <ItemCountsWidget />
                            <RunningTasksWidget tasks={tasks} />
                        </Stack>
                    </Grid>
                    <Grid item xs={12} lg={5} xl={4}>
                        <Stack spacing={3}>
                            <AlertsLogWidget />
                            <ServerPathWidget />
                        </Stack>
                    </Grid>
                </Grid>
            </Box>
        </Page>
    );
};

Component.displayName = 'DashboardPage';
