import React, { useMemo } from 'react';
import globalize from 'lib/globalize';
import Widget from './Widget';
import type { TaskInfo } from '@jellyfin/sdk/lib/generated-client/models/task-info';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import Typography from '@mui/material/Typography';
import TaskProgress from 'apps/dashboard/features/tasks/components/TaskProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

type RunningTasksWidgetProps = {
    tasks?: TaskInfo[];
};

const RunningTasksWidget = ({ tasks }: RunningTasksWidgetProps) => {
    const runningTasks = useMemo(() => {
        return tasks?.filter(v => v.State == TaskState.Running) || [];
    }, [ tasks ]);

    if (runningTasks.length == 0) return null;

    return (
        <Widget
            title={globalize.translate('HeaderRunningTasks')}
            href='/dashboard/tasks'
            icon={<PendingActionsIcon />}
            accentColor='#ff9800'
        >
            <Box sx={{ px: 1, pb: 0.5 }}>
                <Stack spacing={2} >
                    {runningTasks.map((task => (
                        <Box key={task.Id}>
                            <Typography>{task.Name}</Typography>
                            <TaskProgress task={task} />
                        </Box>
                    )))}
                </Stack>
            </Box>
        </Widget>
    );
};

export default RunningTasksWidget;
