import React, { useCallback, useMemo, useState } from 'react';
import globalize from 'lib/globalize';
import Widget from './Widget';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useQueryClient } from '@tanstack/react-query';
import ActivityListItem from 'apps/dashboard/features/activity/components/ActivityListItem';
import subSeconds from 'date-fns/subSeconds';
import { useLogEntries } from 'apps/dashboard/features/activity/api/useLogEntries';
import { useApi } from 'hooks/useApi';

const ACCENT = '#ef5350';

const AlertsLogWidget = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ deletingId, setDeletingId ] = useState<number | null>(null);

    const weekBefore = useMemo(() => (
        subSeconds(new Date(), 7 * 24 * 60 * 60).toISOString()
    ), []);

    const { data: alerts, isPending } = useLogEntries({
        startIndex: 0,
        limit: 4,
        minDate: weekBefore,
        hasUserId: false
    });

    /** Deletes the alert on the server (custom endpoint) and reloads the list. */
    const onDismiss = useCallback(async (id?: number) => {
        if (!api || id == null) return;
        setDeletingId(id);
        try {
            await api.axiosInstance.delete(`${api.basePath}/System/ActivityLog/Entries/${id}`, {
                headers: { Authorization: api.authorizationHeader }
            });
            await queryClient.invalidateQueries({ queryKey: [ 'ActivityLogEntries' ] });
        } catch (err) {
            console.error('[AlertsLogWidget] failed to delete alert', err);
        } finally {
            setDeletingId(null);
        }
    }, [ api, queryClient ]);

    if (isPending || alerts?.Items?.length === 0) return null;

    const count = alerts?.TotalRecordCount ?? alerts?.Items?.length ?? 0;

    return (
        <Widget
            title={globalize.translate('Alerts')}
            href='/dashboard/activity?useractivity=false'
            icon={<NotificationsActiveIcon />}
            accentColor={ACCENT}
            collapsible
            defaultOpen={false}
            headerExtra={(
                <Box sx={{
                    minWidth: 22, height: 22, px: 0.75, borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: ACCENT, boxShadow: `0 0 10px ${ACCENT}88`
                }}>
                    {count}
                </Box>
            )}
        >
            <List disablePadding>
                {alerts?.Items?.map(entry => (
                    <Box key={entry.Id} sx={{
                        display: 'flex', alignItems: 'center', borderRadius: '12px',
                        '&:hover .alert-dismiss': { opacity: 1 }
                    }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <ActivityListItem
                                item={entry}
                                displayShortOverview={false}
                                to='/dashboard/activity?useractivity=false'
                            />
                        </Box>
                        <Tooltip title={globalize.translate('Delete')}>
                            <span>
                                <IconButton
                                    className='alert-dismiss'
                                    size='small'
                                    disabled={deletingId != null}
                                    onClick={() => void onDismiss(entry.Id)}
                                    aria-label={globalize.translate('Delete')}
                                    sx={{
                                        mr: 0.5, opacity: 0.55, transition: 'opacity 0.2s, color 0.2s, background 0.2s',
                                        color: 'rgba(255,255,255,0.6)', '&:hover': { color: ACCENT, background: `${ACCENT}1f` }
                                    }}
                                >
                                    {deletingId === entry.Id ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : <CloseIcon fontSize='small' />}
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                ))}
            </List>
        </Widget>
    );
};

export default AlertsLogWidget;
