/**
 * "Watch together" (SyncPlay): create a named group, see who is in each group and what it is doing, join with one
 * click and invite people with a link that joins them automatically.
 */
import type { GroupInfoDto } from '@jellyfin/sdk/lib/generated-client/models/group-info-dto';
import { SyncPlayUserAccessType } from '@jellyfin/sdk/lib/generated-client/models/sync-play-user-access-type';
import AddRounded from '@mui/icons-material/AddRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import PlayCircleRounded from '@mui/icons-material/PlayCircleRounded';
import StopCircleRounded from '@mui/icons-material/StopCircleRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Popover, { type PopoverProps } from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback, useEffect, useState } from 'react';

import { useCreateSyncPlayGroup } from 'apps/modern/features/syncPlay/hooks/api/useCreateSyncPlayGroup';
import { useJoinSyncPlayGroup } from 'apps/modern/features/syncPlay/hooks/api/useJoinSyncPlayGroup';
import { useLeaveSyncPlayGroup } from 'apps/modern/features/syncPlay/hooks/api/useLeaveSyncPlayGroup';
import { useSyncPlayGroups } from 'apps/modern/features/syncPlay/hooks/api/useSyncPlayGroups';
import { useSyncPlay } from 'apps/modern/features/syncPlay/hooks/useSyncPlay';
import { getSyncPlayInviteLink } from 'apps/modern/features/syncPlay/utils/invite';
import UserAvatar from 'components/UserAvatar';
import toast from 'components/toast/toast';
import { useApi } from 'hooks/useApi';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';

import { glassPaperSx, popoverPlacement } from './menuStyles';

export const ID = 'app-sync-play-menu';

interface SyncPlayMenuProps extends Omit<PopoverProps, 'open' | 'anchorEl'> {
    open: boolean
    anchorEl: HTMLElement | null
    onMenuClose: () => void
}

const STATE_INFO: Record<string, { label: string, color: string }> = {
    Idle: { label: 'SpStateIdle', color: 'rgba(255,255,255,0.5)' },
    Waiting: { label: 'SpStateWaiting', color: '#ffc266' },
    Paused: { label: 'SpStatePaused', color: '#7fd6f5' },
    Playing: { label: 'SpStatePlaying', color: '#6ee7a0' }
};

const StateChip: FC<{ state?: string | null }> = ({ state }) => {
    const info = STATE_INFO[state ?? 'Idle'] ?? STATE_INFO.Idle;
    return (
        <Chip
            size='small'
            label={globalize.translate(info.label)}
            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, color: info.color, background: 'rgba(255,255,255,0.07)', '& .MuiChip-label': { px: 1 } }}
            icon={<Box component='span' sx={{ width: 7, height: 7, borderRadius: '50%', background: info.color, ml: '8px !important' }} />}
        />
    );
};

const Participants: FC<{ names: string[], max?: number }> = ({ names, max = 5 }) => {
    const { data: users } = useUsers();
    return (
        <AvatarGroup max={max} sx={{ justifyContent: 'flex-end', '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem', borderColor: 'rgba(8,10,22,0.94)' } }}>
            {names.map(name => {
                const user = users?.find(u => u.Name === name);
                return user ? <UserAvatar key={name} user={user} size={28} /> : <Avatar key={name}>{name.slice(0, 1).toUpperCase()}</Avatar>;
            })}
        </AvatarGroup>
    );
};

const GroupCard: FC<{ group: GroupInfoDto, onJoin: (id: string) => void, busy: boolean }> = ({ group, onJoin, busy }) => {
    const onClick = useCallback(() => group.GroupId && onJoin(group.GroupId), [ group.GroupId, onJoin ]);
    const names = group.Participants ?? [];
    return (
        <Box sx={{ mx: 1.5, mb: 1, p: 1.5, borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Stack direction='row' alignItems='center' spacing={1}>
                <Typography sx={{ flex: 1, fontWeight: 700, fontSize: '0.92rem', minWidth: 0 }} noWrap>{group.GroupName}</Typography>
                <StateChip state={group.State} />
            </Stack>
            <Stack direction='row' alignItems='center' spacing={1} sx={{ mt: 1 }}>
                <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', minWidth: 0 }} noWrap>
                    {names.join(', ')}
                </Typography>
                <Participants names={names} max={4} />
                <Button size='small' variant='contained' disabled={busy} onClick={onClick} sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, minWidth: 0, px: 1.5 }}>
                    {globalize.translate('SpJoin')}
                </Button>
            </Stack>
        </Box>
    );
};

const copyText = async (text: string) => {
    try {
        // eslint-disable-next-line compat/compat
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // http pages have no clipboard API: fall back to a hidden field
        const field = document.createElement('textarea');
        field.value = text;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const ok = document.execCommand('copy');
        field.remove();
        return ok;
    }
};

const sectionTitleSx = { px: 2, pt: 1.5, pb: 0.75, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' };
const actionSx = { justifyContent: 'flex-start', textTransform: 'none', fontWeight: 600, borderRadius: '10px', color: '#fff', px: 1.5 };

const SyncPlayMenu: FC<SyncPlayMenuProps> = ({ anchorEl, open, onMenuClose }) => {
    const { __legacyApiClient__, user } = useApi();
    const { isActive, currentGroup, syncPlay } = useSyncPlay();
    const { data: groups } = useSyncPlayGroups();
    const createGroup = useCreateSyncPlayGroup();
    const joinGroup = useJoinSyncPlayGroup();
    const leaveGroup = useLeaveSyncPlayGroup();

    const canCreate = user?.Policy?.SyncPlayAccess === SyncPlayUserAccessType.CreateAndJoinGroups;
    const defaultName = globalize.translate('SyncPlayGroupDefaultTitle', user?.Name ?? '');
    const [ groupName, setGroupName ] = useState(defaultName);

    useEffect(() => {
        if (open) setGroupName(defaultName);
    }, [ open, defaultName ]);

    const onNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setGroupName(e.target.value), []);

    const onCreate = useCallback(() => {
        createGroup.mutate({ newGroupRequestDto: { GroupName: groupName.trim() || defaultName } }, {
            onSuccess: () => toast({ text: globalize.translate('SpCreated') }),
            onError: () => toast({ text: globalize.translate('MessageSyncPlayErrorAccessingGroups') })
        });
    }, [ createGroup, defaultName, groupName ]);

    const onNameKeyDown = useCallback((e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') onCreate();
    }, [ onCreate ]);

    const onJoin = useCallback((GroupId: string) => {
        joinGroup.mutate({ joinGroupRequestDto: { GroupId } }, {
            onError: () => toast({ text: globalize.translate('MessageSyncPlayErrorAccessingGroups') })
        });
    }, [ joinGroup ]);

    const onLeave = useCallback(() => {
        leaveGroup.mutate(undefined, { onSettled: onMenuClose });
    }, [ leaveGroup, onMenuClose ]);

    const onInvite = useCallback(() => {
        if (!currentGroup?.GroupId) return;
        void copyText(getSyncPlayInviteLink(currentGroup.GroupId)).then(ok => {
            toast({ text: globalize.translate(ok ? 'SpInviteCopied' : 'SpInviteCopyFailed') });
        });
    }, [ currentGroup ]);

    const onSettings = useCallback(async () => {
        if (!syncPlay) return;
        const SyncPlaySettingsEditor = (await import('../../../../../plugins/syncPlay/ui/settings/SettingsEditor')).default;
        new SyncPlaySettingsEditor(__legacyApiClient__, syncPlay.Manager.getTimeSyncCore(), { groupInfo: currentGroup })
            .embed()
            .catch(err => {
                if (err) console.error('[SyncPlayMenu] Error creating SyncPlay settings editor', err);
            });
        onMenuClose();
    }, [ __legacyApiClient__, currentGroup, onMenuClose, syncPlay ]);

    const onResume = useCallback(() => {
        if (__legacyApiClient__) syncPlay?.Manager.resumeGroupPlayback(__legacyApiClient__);
        onMenuClose();
    }, [ __legacyApiClient__, onMenuClose, syncPlay ]);

    const onHalt = useCallback(() => {
        if (__legacyApiClient__) syncPlay?.Manager.haltGroupPlayback(__legacyApiClient__);
        onMenuClose();
    }, [ __legacyApiClient__, onMenuClose, syncPlay ]);

    const others = (groups ?? []).filter(g => g.GroupId !== currentGroup?.GroupId);
    const playbackActive = syncPlay?.Manager.isPlaybackActive();
    const canResume = isActive && !syncPlay?.Manager.isPlaylistEmpty() && !playbackActive;
    const inviteLink = currentGroup?.GroupId ? getSyncPlayInviteLink(currentGroup.GroupId) : '';

    return (
        <Popover
            id={ID}
            anchorEl={anchorEl}
            open={open}
            onClose={onMenuClose}
            {...popoverPlacement(anchorEl)}
            slotProps={{ paper: { sx: { ...glassPaperSx, width: 380, maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(680px, 82vh)', pb: 1.5 } } }}
        >
            <Box sx={{ display: 'flex', gap: 1.25, px: 2, pt: 1.75, pb: 0.5 }}>
                <GroupsRounded sx={{ color: '#00a4dc', mt: '2px' }} />
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{globalize.translate('SpTitle')}</Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>{globalize.translate('SpSubtitle')}</Typography>
                </Box>
            </Box>

            {isActive && currentGroup ? (
                <>
                    <Box sx={{ mx: 1.5, mt: 1.25, p: 1.75, borderRadius: '14px', background: 'linear-gradient(135deg, rgba(0,164,220,0.16), rgba(138,92,255,0.14))', border: '1px solid rgba(0,164,220,0.25)' }}>
                        <Stack direction='row' alignItems='center' spacing={1}>
                            <Typography sx={{ flex: 1, fontWeight: 800, minWidth: 0 }} noWrap>{currentGroup.GroupName}</Typography>
                            <StateChip state={currentGroup.State} />
                        </Stack>
                        <Typography sx={{ mt: 1, mb: 0.75, fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                            {globalize.translate('SpMembers', currentGroup.Participants?.length ?? 0)}
                        </Typography>
                        <Stack spacing={0.75}>
                            {(currentGroup.Participants ?? []).map(name => (
                                <Stack key={name} direction='row' alignItems='center' spacing={1}>
                                    <Participants names={[ name ]} />
                                    <Typography sx={{ fontSize: '0.88rem', fontWeight: name === user?.Name ? 700 : 500 }}>
                                        {name}{name === user?.Name ? ` (${globalize.translate('SpYou')})` : ''}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mx: 2, mt: 1.25, color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                        <InfoOutlined sx={{ fontSize: 16, mt: '2px' }} />
                        <span>{globalize.translate('SpPlayHint')}</span>
                    </Box>

                    <Typography sx={sectionTitleSx}>{globalize.translate('SpInvite')}</Typography>
                    <Stack direction='row' spacing={1} sx={{ mx: 2 }}>
                        <TextField
                            size='small'
                            value={inviteLink}
                            fullWidth
                            slotProps={{ htmlInput: { readOnly: true, onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(), style: { fontSize: '0.75rem' } } }}
                        />
                        <Button variant='contained' onClick={onInvite} startIcon={<ContentCopyRounded />} sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, flexShrink: 0 }}>
                            {globalize.translate('SpCopy')}
                        </Button>
                    </Stack>

                    <Stack sx={{ mx: 1, mt: 1.5 }} spacing={0.25}>
                        {canResume && (
                            <Button onClick={onResume} startIcon={<PlayCircleRounded />} sx={actionSx}>{globalize.translate('LabelSyncPlayResumePlayback')}</Button>
                        )}
                        {playbackActive && (
                            <Button onClick={onHalt} startIcon={<StopCircleRounded />} sx={actionSx}>{globalize.translate('LabelSyncPlayHaltPlayback')}</Button>
                        )}
                        <Button onClick={onSettings} startIcon={<TuneRounded />} sx={actionSx}>{globalize.translate('SpSyncSettings')}</Button>
                        <Button onClick={onLeave} startIcon={<LogoutRounded />} sx={{ ...actionSx, color: '#ff8a80' }}>{globalize.translate('LabelSyncPlayLeaveGroup')}</Button>
                    </Stack>
                </>
            ) : (
                <>
                    {canCreate && (
                        <>
                            <Typography sx={sectionTitleSx}>{globalize.translate('SpNewGroup')}</Typography>
                            <Stack direction='row' spacing={1} sx={{ mx: 2 }}>
                                <TextField
                                    size='small'
                                    fullWidth
                                    value={groupName}
                                    onChange={onNameChange}
                                    onKeyDown={onNameKeyDown}
                                    placeholder={defaultName}
                                    slotProps={{ htmlInput: { maxLength: 60, 'aria-label': globalize.translate('SpGroupName') } }}
                                />
                                <Button variant='contained' disabled={createGroup.isPending} onClick={onCreate} startIcon={<AddRounded />} sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, flexShrink: 0 }}>
                                    {globalize.translate('SpCreate')}
                                </Button>
                            </Stack>
                        </>
                    )}

                    <Typography sx={sectionTitleSx}>{globalize.translate('SpActiveGroups')}</Typography>
                    {others.map(group => (
                        <GroupCard key={group.GroupId} group={group} onJoin={onJoin} busy={joinGroup.isPending} />
                    ))}
                    {!others.length && (
                        <Typography sx={{ mx: 2, fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>
                            {globalize.translate(canCreate ? 'SpNoGroupsCreate' : 'LabelSyncPlayNoGroups')}
                        </Typography>
                    )}
                </>
            )}
        </Popover>
    );
};

export default SyncPlayMenu;
