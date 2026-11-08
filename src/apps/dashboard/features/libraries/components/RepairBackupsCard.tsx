import React, { type FC, useCallback, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InventoryIcon from '@mui/icons-material/Inventory2';

import { SectionCard } from 'apps/dashboard/components/cosmic';
import { BACKUPS_KEY, type RepairBackup, deleteRepairBackups, useRepairBackups } from 'apps/dashboard/features/libraries/api/vobSubRepair';
import { formatSize } from 'apps/dashboard/features/logs/utils/logTypes';
import { relativeTime } from 'apps/dashboard/features/tasks/components/TaskCosmic';
import ConfirmDialog from 'components/ConfirmDialog';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

/** Lists the .bak copies left by repairs and lets the admin delete them. */
const RepairBackupsCard: FC<{ enabled: boolean }> = ({ enabled }) => {
    const { api } = useApi();
    const { data: backups, isFetching } = useRepairBackups(enabled);
    const [ open, setOpen ] = useState(false);
    const [ confirm, setConfirm ] = useState<{ ids: string[]; label: string } | null>(null);
    const [ freed, setFreed ] = useState<number | null>(null);

    const total = useMemo(() => (backups || []).reduce((s, b) => s + (b.Size || 0), 0), [ backups ]);

    const remove = useMutation({
        mutationFn: (ids: string[]) => deleteRepairBackups(api!, ids),
        onSuccess: (deleted: RepairBackup[]) => {
            setFreed(deleted.reduce((s, b) => s + (b.Size || 0), 0));
            void queryClient.invalidateQueries({ queryKey: [ BACKUPS_KEY ] });
        }
    });

    const toggle = useCallback(() => setOpen(v => !v), []);
    const askAll = useCallback(() => setConfirm({ ids: [], label: globalize.translate('BakDelAllConfirm', backups?.length ?? 0, formatSize(total)) }), [ backups, total ]);
    const cancel = useCallback(() => setConfirm(null), []);
    const doDelete = useCallback(() => {
        if (confirm) remove.mutate(confirm.ids);
        setConfirm(null);
    }, [ confirm, remove ]);

    if (!enabled || (!backups?.length && freed === null)) return null;

    return (
        <SectionCard title={globalize.translate('BakFilesTitle')} icon={<InventoryIcon />} accentColor='#aa5cc3' description={globalize.translate('BakFilesHelp')}>
            <Stack spacing={1.5}>
                {freed !== null && (
                    <Alert severity='success' onClose={() => setFreed(null)}>{globalize.translate('BakFreed', formatSize(freed))}</Alert>
                )}
                {remove.isError && <Alert severity='error'>{globalize.translate('BakDelError')}</Alert>}

                {!!backups?.length && (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontSize: '0.9rem' }}>
                                {globalize.translate('BakSummary', backups.length, formatSize(total))}
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            <Button size='small' onClick={toggle} endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}>
                                {globalize.translate(open ? 'BakHideList' : 'BakShowList')}
                            </Button>
                            <Button variant='contained' color='error' onClick={askAll} disabled={remove.isPending}
                                startIcon={remove.isPending ? <CircularProgress size={14} color='inherit' /> : <DeleteSweepIcon />}>
                                {globalize.translate('BakDelAll', backups.length)}
                            </Button>
                        </Box>
                        <Collapse in={open}>
                            <Stack spacing={0.75}>
                                {backups.map(b => (
                                    <Box key={b.ItemId} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, pl: 1.25, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography noWrap sx={{ fontSize: '0.84rem', fontWeight: 600 }}>{b.Name}</Typography>
                                            <Tooltip title={b.Path || ''}>
                                                <Typography noWrap sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', direction: 'rtl', textAlign: 'left' }}>{b.Path}</Typography>
                                            </Tooltip>
                                        </Box>
                                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                            <Typography sx={{ fontSize: '0.78rem' }}>{formatSize(b.Size)}</Typography>
                                            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)' }}>{relativeTime(b.DateModified)}</Typography>
                                        </Box>
                                        <Tooltip title={globalize.translate('Delete')}>
                                            <span>
                                                <IconButton size='small' sx={{ color: '#ef5350' }} disabled={remove.isPending}
                                                    onClick={() => setConfirm({ ids: [ b.ItemId ], label: globalize.translate('BakDelOneConfirm', b.Name || '', formatSize(b.Size)) })}>
                                                    <DeleteIcon fontSize='small' />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Box>
                                ))}
                            </Stack>
                        </Collapse>
                    </>
                )}
                {isFetching && !backups && <CircularProgress size={20} />}
            </Stack>

            <ConfirmDialog
                open={!!confirm}
                title={globalize.translate('BakDelTitle')}
                text={confirm?.label || ''}
                onCancel={cancel}
                onConfirm={doDelete}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('Delete')}
            />
        </SectionCard>
    );
};

export default RepairBackupsCard;
