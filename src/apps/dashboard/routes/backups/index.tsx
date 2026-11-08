import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { BackupManifestDto } from '@jellyfin/sdk/lib/generated-client/models/backup-manifest-dto';
import type { BackupOptionsDto } from '@jellyfin/sdk/lib/generated-client/models/backup-options-dto';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import BackupIcon from '@mui/icons-material/Backup';
import ClosedCaptionIcon from '@mui/icons-material/ClosedCaption';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FolderIcon from '@mui/icons-material/Folder';
import HistoryIcon from '@mui/icons-material/History';
import ImageIcon from '@mui/icons-material/Image';
import InfoIcon from '@mui/icons-material/Info';
import RestoreIcon from '@mui/icons-material/Restore';
import StorageIcon from '@mui/icons-material/Storage';
import UpdateIcon from '@mui/icons-material/Update';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

import { useBackups } from 'apps/dashboard/features/backups/api/useBackups';
import { useCreateBackup } from 'apps/dashboard/features/backups/api/useCreateBackup';
import { useRestoreBackup } from 'apps/dashboard/features/backups/api/useRestoreBackup';
import BackupProgressDialog from 'apps/dashboard/features/backups/components/BackupProgressDialog';
import RestoreConfirmationDialog from 'apps/dashboard/features/backups/components/RestoreConfirmationDialog';
import RestoreProgressDialog from 'apps/dashboard/features/backups/components/RestoreProgressDialog';
import { Badge, StatTile } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import useLiveTasks from 'apps/dashboard/features/tasks/hooks/useLiveTasks';
import ConfirmDialog from 'components/ConfirmDialog';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import SimpleAlert from 'components/SimpleAlert';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

const DAY = 24 * 3600 * 1000;
const STALE_DAYS = 30;

type ContentKey = 'Database' | 'Metadata' | 'Subtitles' | 'Trickplay';
const CONTENTS: { key: ContentKey; labelKey: string; helpKey: string; color: string; icon: React.ReactNode }[] = [
    { key: 'Database', labelKey: 'LabelDatabase', helpKey: 'BakDatabaseHelp', color: '#00a4dc', icon: <StorageIcon /> },
    { key: 'Metadata', labelKey: 'LabelMetadata', helpKey: 'BakMetadataHelp', color: '#aa5cc3', icon: <ImageIcon /> },
    { key: 'Subtitles', labelKey: 'Subtitles', helpKey: 'BakSubtitlesHelp', color: '#26c6da', icon: <ClosedCaptionIcon /> },
    { key: 'Trickplay', labelKey: 'Trickplay', helpKey: 'BakTrickplayHelp', color: '#ff9800', icon: <ViewCarouselIcon /> }
];

const relative = (d?: string | null) => (d ? formatDistanceToNow(new Date(d), getLocaleWithSuffix()) : '');
const fullDate = (d?: string | null) => (d ? new Date(d).toLocaleString(globalize.getCurrentDateTimeLocale(), { dateStyle: 'full', timeStyle: 'short' }) : '');
const fileName = (p?: string | null) => (p || '').split(/[\\/]/).pop() || '';
const folderOf = (p?: string | null) => (p || '').replace(/[\\/][^\\/]*$/, '');

const CreateDialog: FC<{ open: boolean; onClose: () => void; onCreate: (o: BackupOptionsDto) => void }> = ({ open, onClose, onCreate }) => {
    const [ opts, setOpts ] = useState<BackupOptionsDto>({ Database: true, Metadata: false, Subtitles: false, Trickplay: false });
    const create = useCallback(() => onCreate(opts), [ onCreate, opts ]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><BackupIcon sx={{ color: '#00a4dc' }} />{globalize.translate('ButtonCreateBackup')}</DialogTitle>
            <DialogContent>
                <Typography sx={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.6)', mb: 2 }}>{globalize.translate('MessageBackupDisclaimer')}</Typography>
                <Stack spacing={1.25}>
                    {CONTENTS.map(c => (
                        <ToggleRow
                            key={c.key}
                            label={globalize.translate(c.labelKey)}
                            description={globalize.translate(c.helpKey)}
                            checked={c.key === 'Database' ? true : !!opts[c.key]}
                            onChange={c.key === 'Database' ? undefined : v => setOpts(o => ({ ...o, [c.key]: v }))}
                            color={c.color}
                        />
                    ))}
                </Stack>
                <Alert severity='info' sx={{ mt: 2, fontSize: '0.8rem' }}>{globalize.translate('BakSizeHint')}</Alert>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant='text'>{globalize.translate('ButtonCancel')}</Button>
                <Button onClick={create} variant='contained' startIcon={<BackupIcon />}>{globalize.translate('Create')}</Button>
            </DialogActions>
        </Dialog>
    );
};

const BackupCard: FC<{ backup: BackupManifestDto; latest: boolean; currentVersion?: string | null; onRestore: (b: BackupManifestDto) => void }> = ({ backup, latest, currentVersion, onRestore }) => {
    const [ copied, setCopied ] = useState(false);
    const accent = latest ? '#4caf50' : '#00a4dc';
    const otherVersion = currentVersion && backup.ServerVersion && backup.ServerVersion !== currentVersion;

    const copy = useCallback(() => {
        void navigator.clipboard?.writeText(backup.Path || '').then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [ backup.Path ]);
    const restore = useCallback(() => onRestore(backup), [ backup, onRestore ]);

    return (
        <Paper elevation={0} sx={{
            position: 'relative', overflow: 'hidden', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderRadius: '16px',
            border: `1px solid ${accent}${latest ? '66' : '33'}`, boxShadow: latest ? `0 0 22px ${accent}26` : '0 8px 28px rgba(0,0,0,0.3)',
            transition: 'border-color 0.2s', '&:hover': { borderColor: `${accent}88` }
        }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1.25rem', right: '1.25rem', height: '2px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                    width: 44, height: 44, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${accent}1f`, border: `1px solid ${accent}44`, '& svg': { color: accent }
                }}>
                    <BackupIcon />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem', '&::first-letter': { textTransform: 'uppercase' } }}>{fullDate(backup.DateCreated)}</Typography>
                    <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>{relative(backup.DateCreated)}</Typography>
                </Box>
                {latest && <Badge label={globalize.translate('BakLatest')} color='#4caf50' dot />}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {CONTENTS.map(c => {
                    const on = c.key === 'Database' || !!backup.Options?.[c.key];
                    return <Badge key={c.key} label={globalize.translate(c.labelKey)} color={on ? c.color : 'rgba(255,255,255,0.25)'} dot={on} />;
                })}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 1, pl: 1.25, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Tooltip title={backup.Path || ''}>
                    <Typography sx={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fileName(backup.Path)}
                    </Typography>
                </Tooltip>
                <Tooltip title={globalize.translate(copied ? 'LtvCopied' : 'BakCopyPath')}>
                    <IconButton size='small' onClick={copy}><ContentCopyIcon sx={{ fontSize: '0.95rem' }} /></IconButton>
                </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>
                    Jellyfin <Box component='span' sx={{ fontFamily: 'monospace', color: otherVersion ? '#ffca28' : 'rgba(255,255,255,0.8)' }}>{backup.ServerVersion}</Box>
                </Typography>
                {otherVersion && (
                    <Tooltip title={globalize.translate('BakOtherVersionHelp', currentVersion || '')}>
                        <WarningAmberIcon sx={{ fontSize: '1rem', color: '#ffca28' }} />
                    </Tooltip>
                )}
                <Box sx={{ flex: 1 }} />
                <Button size='small' variant='outlined' color='warning' startIcon={<RestoreIcon />} onClick={restore}>{globalize.translate('LabelRestore')}</Button>
            </Box>
        </Paper>
    );
};

export const Component = () => {
    const { api } = useApi();
    const { data: backups, isPending, isError } = useBackups();
    const { data: tasks, isPending: isTasksPending } = useLiveTasks({ isHidden: false });
    const createBackup = useCreateBackup();
    const restoreBackup = useRestoreBackup();
    const [ isCreateOpen, setIsCreateOpen ] = useState(false);
    const [ backupInProgress, setBackupInProgress ] = useState(false);
    const [ restoreInProgress, setRestoreInProgress ] = useState(false);
    const [ isRestoreSuccess, setIsRestoreSuccess ] = useState(false);
    const [ isErrorOccurred, setIsErrorOccurred ] = useState(false);
    const [ backupToRestore, setBackupToRestore ] = useState<BackupManifestDto | null>(null);
    const [ pendingOptions, setPendingOptions ] = useState<BackupOptionsDto | null>(null);
    const [ serverVersion, setServerVersion ] = useState<string | null>(null);

    useEffect(() => {
        if (!api) return;
        void getSystemApi(api).getPublicSystemInfo().then(r => setServerVersion(r.data.Version || null)).catch(() => undefined);
    }, [ api ]);

    const runningTasks = useMemo(() => (tasks || []).filter(t => t.State !== TaskState.Idle), [ tasks ]);

    const startBackup = useCallback((options: BackupOptionsDto) => {
        setBackupInProgress(true);
        setIsCreateOpen(false);
        createBackup.mutate(options, {
            onError: () => setIsErrorOccurred(true),
            onSettled: () => setBackupInProgress(false)
        });
    }, [ createBackup ]);

    const onCreate = useCallback((options: BackupOptionsDto) => {
        if (runningTasks.length) {
            setPendingOptions(options);
            setIsCreateOpen(false);
        } else {
            startBackup(options);
        }
    }, [ runningTasks.length, startBackup ]);

    const confirmPending = useCallback(() => {
        const o = pendingOptions;
        setPendingOptions(null);
        if (o) startBackup(o);
    }, [ pendingOptions, startBackup ]);

    const onRestoreConfirm = useCallback(() => {
        if (!backupToRestore?.Path) return;
        restoreBackup.mutate(backupToRestore.Path, {
            onSuccess: () => setRestoreInProgress(true),
            onError: () => setIsErrorOccurred(true),
            onSettled: () => setBackupToRestore(null)
        });
    }, [ backupToRestore, restoreBackup ]);

    useEffect(() => {
        if (!restoreInProgress) return;
        const interval = setInterval(() => {
            void getSystemApi(api!).getPublicSystemInfo().then(() => {
                setRestoreInProgress(false);
                setIsRestoreSuccess(true);
                clearInterval(interval);
            }).catch(() => undefined);
        }, 15000);
        return () => clearInterval(interval);
    }, [ api, restoreInProgress ]);

    const openCreate = useCallback(() => setIsCreateOpen(true), []);
    const closeCreate = useCallback(() => setIsCreateOpen(false), []);
    const cancelPending = useCallback(() => setPendingOptions(null), []);
    const closeRestore = useCallback(() => setBackupToRestore(null), []);
    const closeError = useCallback(() => setIsErrorOccurred(false), []);
    const closeSuccess = useCallback(() => setIsRestoreSuccess(false), []);

    if (isPending || isTasksPending) return <Loading />;

    const list = backups || [];
    const newest = list[0];
    const newestAge = newest?.DateCreated ? Date.now() - Date.parse(newest.DateCreated) : undefined;
    const stale = newestAge !== undefined && newestAge > STALE_DAYS * DAY;
    const full = list.filter(b => b.Options?.Metadata && b.Options?.Subtitles && b.Options?.Trickplay).length;
    const folder = folderOf(newest?.Path);

    return (
        <Page id='backupsPage' title={globalize.translate('HeaderBackups')} className='mainAnimatedPage type-interior fullWidthContent'>
            <BackupProgressDialog open={backupInProgress} />
            <RestoreProgressDialog open={restoreInProgress} />
            <ConfirmDialog
                open={!!pendingOptions}
                title={globalize.translate('HeaderBackupWarning')}
                text={globalize.translate('LabelBackupWarning') + '\n\n' + runningTasks.map(t => '- ' + t.Name).join('\n')}
                confirmButtonText={globalize.translate('Create')}
                confirmButtonColor='warning'
                onConfirm={confirmPending}
                onCancel={cancelPending}
            />
            <CreateDialog open={isCreateOpen} onClose={closeCreate} onCreate={onCreate} />
            <SimpleAlert open={isErrorOccurred} text={globalize.translate('UnknownError')} onClose={closeError} />
            <SimpleAlert open={isRestoreSuccess} title={globalize.translate('Success')} text={globalize.translate('MessageRestoreSuccess')} onClose={closeSuccess} />
            <RestoreConfirmationDialog open={!!backupToRestore} onClose={closeRestore} onConfirm={onRestoreConfirm} />

            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('HeaderBackups')}
                    subtitle={globalize.translate('HeaderBackupsHelp')}
                    actions={(
                        <Button variant='contained' size='small' startIcon={<AddIcon />} onClick={openCreate}>{globalize.translate('ButtonCreateBackup')}</Button>
                    )}
                />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('BackupsPageLoadError')}</Alert>
                ) : (
                    <>
                        {list.length === 0 && (
                            <Alert severity='warning' sx={{ mb: 2, alignItems: 'center' }} action={<Button color='inherit' size='small' onClick={openCreate}>{globalize.translate('BakCreateFirst')}</Button>}>
                                {globalize.translate('BakNoneWarning')}
                            </Alert>
                        )}
                        {stale && (
                            <Alert severity='warning' sx={{ mb: 2, alignItems: 'center' }} action={<Button color='inherit' size='small' onClick={openCreate}>{globalize.translate('ButtonCreateBackup')}</Button>}>
                                {globalize.translate('BakStaleWarning', relative(newest?.DateCreated))}
                            </Alert>
                        )}
                        {runningTasks.length > 0 && (
                            <Alert severity='info' sx={{ mb: 2 }}>{globalize.translate('BakTasksRunning', runningTasks.map(t => t.Name).join(', '))}</Alert>
                        )}

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1.5, mb: 2.5 }}>
                            <StatTile icon={<HistoryIcon />} label={globalize.translate('BakTotal')} value={list.length} color='#00a4dc' />
                            <StatTile icon={<UpdateIcon />} label={globalize.translate('BakLast')} value={newest ? relative(newest.DateCreated) : '—'} color={stale || !newest ? '#ff9800' : '#4caf50'} />
                            <StatTile icon={<ImageIcon />} label={globalize.translate('BakFull')} value={full} color='#aa5cc3' />
                            <StatTile icon={<StorageIcon />} label={globalize.translate('BakServerVersion')} value={serverVersion || '—'} color='#26c6da' />
                        </Box>

                        {list.length > 0 && (
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 2, mb: 2.5 }}>
                                {list.map((b, i) => <BackupCard key={b.Path} backup={b} latest={i === 0} currentVersion={serverVersion} onRestore={setBackupToRestore} />)}
                            </Box>
                        )}

                        <SectionCard title={globalize.translate('BakAbout')} icon={<InfoIcon />} accentColor='#26c6da'>
                            <Stack spacing={1.5}>
                                {folder && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <FolderIcon sx={{ color: '#26c6da', fontSize: '1.1rem' }} />
                                        <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>{globalize.translate('BakFolder')}</Typography>
                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', wordBreak: 'break-all' }}>{folder}</Typography>
                                    </Box>
                                )}
                                <Stack component='ul' spacing={1} sx={{ m: 0, pl: 2.5 }}>
                                    {[ 'BakTip1', 'BakTip2', 'BakTip3', 'BakTip4' ].map(k => (
                                        <Typography key={k} component='li' sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{globalize.translate(k)}</Typography>
                                    ))}
                                </Stack>
                            </Stack>
                        </SectionCard>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'BackupsPage';
