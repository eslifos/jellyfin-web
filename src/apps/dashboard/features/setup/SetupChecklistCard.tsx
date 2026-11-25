/**
 * "Your server in 5 steps" at the top of the dashboard: only for administrators, only while a step is pending.
 * Each step is read from the server (setupSteps.ts), links to its screen and is ticked by itself once done.
 * It can be hidden; that choice follows the user to every device.
 */
import type { TaskInfo } from '@jellyfin/sdk/lib/generated-client/models/task-info';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import React, { type FC, useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import Widget from 'apps/dashboard/components/widgets/Widget';
import { useVirtualFolders } from 'apps/dashboard/features/libraries/api/useVirtualFolders';
import { useItemCounts } from 'apps/dashboard/features/metrics/api/useItemCounts';
import { useNetworkConfig } from 'apps/dashboard/features/users/api/useNetworkConfig';
import { useApi } from 'hooks/useApi';
import { useNamedConfiguration } from 'hooks/useNamedConfiguration';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';
import { TEXT_SECONDARY, TEXT_TERTIARY } from 'themes/cosmic/textColors';
import { readPref, writePref } from 'utils/syncedPrefs';

import { getSetupSteps } from './setupSteps';

const HIDDEN_PREF = 'dashboardSetupGuideHidden';
const ACCENT = '#00a4dc';
const DONE = '#4caf50';

interface SetupChecklistCardProps {
    /** The scheduled tasks of the dashboard (live): the library scan says whether the first scan finished. */
    tasks?: TaskInfo[];
}

const SetupChecklistCard: FC<SetupChecklistCardProps> = ({ tasks }) => {
    const { user } = useApi();
    const isAdmin = !!user?.Policy?.IsAdministrator;
    const [ hidden, setHidden ] = useState(() => readPref(HIDDEN_PREF) === '1');

    const { data: libraries } = useVirtualFolders(false, isAdmin);
    const { data: itemCounts } = useItemCounts();
    const { data: users } = useUsers();
    const { data: network } = useNetworkConfig();
    const { data: encoding } = useNamedConfiguration<{ HardwareAccelerationType?: string | null }>('encoding');

    const steps = useMemo(() => getSetupSteps({
        libraries,
        scanTask: tasks?.find(t => t.Key === 'RefreshLibrary'),
        itemCounts,
        users,
        network,
        encoding,
        hostname: typeof window === 'undefined' ? undefined : window.location.hostname
    }), [ encoding, itemCounts, libraries, network, tasks, users ]);

    const hide = useCallback(() => {
        writePref(HIDDEN_PREF, '1');
        setHidden(true);
    }, []);

    if (!isAdmin || hidden || !steps) return null;
    const doneCount = steps.filter(s => s.done).length;
    if (doneCount === steps.length) return null;

    const progress = globalize.translate('SetupProgress', doneCount, steps.length);

    return (
        <Box sx={{ mb: 3 }}>
            <Widget
                title={globalize.translate('SetupTitle')}
                icon={<RocketLaunchRoundedIcon />}
                accentColor={ACCENT}
                headerExtra={
                    <>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: TEXT_SECONDARY, whiteSpace: 'nowrap' }}>{progress}</Typography>
                        <Tooltip title={globalize.translate('SetupHideHelp')}>
                            <IconButton size='small' onClick={hide} aria-label={globalize.translate('SetupHideHelp')} sx={{ color: TEXT_TERTIARY, '&:hover': { color: '#fff' } }}>
                                <CloseRoundedIcon fontSize='small' />
                            </IconButton>
                        </Tooltip>
                    </>
                }
            >
                <LinearProgress
                    variant='determinate'
                    value={(doneCount / steps.length) * 100}
                    aria-label={progress}
                    sx={{ mx: 1, mb: 1.5, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { borderRadius: 3, background: `linear-gradient(90deg, ${ACCENT}, #aa5cc3)` } }}
                />
                <Box component='ol' aria-label={globalize.translate('SetupTitle')} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
                    {steps.map((step, index) => (
                        <li key={step.id}>
                            <Box
                                component={RouterLink}
                                to={step.to}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 1.1, minHeight: 44, borderRadius: '12px',
                                    color: 'inherit', textDecoration: 'none', transition: 'background 0.15s',
                                    '&:hover, &:focus-visible': { background: 'rgba(0,164,220,0.1)', outline: 'none' },
                                    '&:focus-visible': { boxShadow: `0 0 0 2px ${ACCENT}` }
                                }}
                            >
                                {step.done ?
                                    <CheckCircleRoundedIcon sx={{ color: DONE, flexShrink: 0 }} /> :
                                    <RadioButtonUncheckedRoundedIcon sx={{ color: TEXT_TERTIARY, flexShrink: 0 }} />}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{
                                        fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.3,
                                        color: step.done ? TEXT_TERTIARY : '#fff', textDecoration: step.done ? 'line-through' : 'none'
                                    }}>
                                        {`${index + 1}. ${globalize.translate(step.titleKey)}`}
                                        <Box component='span' sx={visuallyHidden}>{` · ${globalize.translate(step.done ? 'SetupStepDone' : 'SetupStepPending')}`}</Box>
                                    </Typography>
                                    {!step.done && (
                                        <Typography sx={{ fontSize: '0.78rem', color: TEXT_TERTIARY, lineHeight: 1.4, mt: 0.25 }}>
                                            {globalize.translate(step.helpKey)}
                                        </Typography>
                                    )}
                                </Box>
                                {!step.done && <ChevronRightRoundedIcon aria-hidden='true' sx={{ color: TEXT_TERTIARY, flexShrink: 0 }} />}
                            </Box>
                        </li>
                    ))}
                </Box>
            </Widget>
        </Box>
    );
};

export default SetupChecklistCard;
