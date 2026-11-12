/**
 * Changes the type of a library (for example "Mixed movies and shows" to "Shows") without creating it again.
 * The server keeps the library, its options and images; movies and series that keep their type keep their
 * metadata, so only the items that the new type sees differently are identified again.
 */
import type { VirtualFolderInfo } from '@jellyfin/sdk/lib/generated-client/models/virtual-folder-info';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Icon from '@mui/material/Icon';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import React, { type FC, useCallback, useEffect, useState } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { getLibraryIcon } from 'utils/image';

import { invalidateVirtualFolders } from '../api/invalidateVirtualFolders';
import getCollectionTypeOptions from '../utils/collectionTypeOptions';
import { getLibraryAccent } from '../utils/libraryUi';

interface ChangeLibraryTypeDialogProps {
    open: boolean;
    virtualFolder: VirtualFolderInfo;
    onClose: () => void;
}

const useChangeLibraryType = () => {
    const { api, user } = useApi();
    return useMutation({
        mutationFn: async ({ name, collectionType, itemId, scan }: { name: string; collectionType: string; itemId?: string | null; scan: boolean }) => {
            const headers = { Authorization: api!.authorizationHeader };
            await api!.axiosInstance.post(`${api!.basePath}/Library/VirtualFolders/CollectionType`, null, {
                headers,
                params: { name, collectionType }
            });

            if (scan && itemId) {
                // Same as "Scan library": new and changed files only, existing metadata is kept
                await api!.axiosInstance.post(`${api!.basePath}/Items/${itemId}/Refresh`, null, {
                    headers,
                    params: {
                        Recursive: true,
                        MetadataRefreshMode: 'Default',
                        ImageRefreshMode: 'Default',
                        ReplaceAllMetadata: false,
                        ReplaceAllImages: false
                    }
                });
            }
        },
        onSuccess: () => invalidateVirtualFolders(user)
    });
};

const ChangeLibraryTypeDialog: FC<ChangeLibraryTypeDialogProps> = ({ open, virtualFolder, onClose }) => {
    const current = virtualFolder.CollectionType || 'mixed';
    const [ selected, setSelected ] = useState<string>(current);
    const [ scan, setScan ] = useState(true);
    const changeType = useChangeLibraryType();

    useEffect(() => {
        if (open) {
            setSelected(current);
            setScan(true);
            changeType.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ open, current ]);

    const types = getCollectionTypeOptions().filter(t => t.value);

    const confirm = useCallback(() => {
        if (!virtualFolder.Name || selected === current) return;
        changeType.mutate(
            { name: virtualFolder.Name, collectionType: selected, itemId: virtualFolder.ItemId, scan },
            { onSuccess: onClose }
        );
    }, [ changeType, current, onClose, scan, selected, virtualFolder ]);

    return (
        <Dialog
            open={open}
            onClose={changeType.isPending ? undefined : onClose}
            maxWidth='sm'
            fullWidth
            PaperProps={{ sx: { borderRadius: '18px', border: '1px solid rgba(0,164,220,0.25)', background: 'rgba(12,14,26,0.98)' } }}
        >
            <DialogTitle sx={{ fontWeight: 800 }}>
                {globalize.translate('LibChangeTypeTitle', virtualFolder.Name || '')}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mb: 2 }}>
                    {types.map(type => {
                        const accent = getLibraryAccent(type.value);
                        const active = selected === type.value;
                        return (
                            <Box
                                key={type.value}
                                component='button'
                                type='button'
                                disabled={changeType.isPending}
                                // eslint-disable-next-line react/jsx-no-bind
                                onClick={() => setSelected(type.value)}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1.25, p: 1.5, borderRadius: '12px', cursor: 'pointer',
                                    textAlign: 'left', color: '#fff', font: 'inherit',
                                    background: active ? `${accent}26` : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${active ? accent : 'rgba(255,255,255,0.1)'}`,
                                    boxShadow: active ? `0 0 16px ${accent}33` : 'none',
                                    transition: 'all 0.15s',
                                    '&:hover': { borderColor: accent }
                                }}
                            >
                                <Icon sx={{ color: accent }}>{getLibraryIcon(type.value)}</Icon>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700 }}>{type.name}</Typography>
                                    {type.value === current && (
                                        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                                            {globalize.translate('LibChangeTypeCurrent')}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>

                <Alert severity='info' sx={{ mb: 1.5, borderRadius: '12px' }}>
                    {globalize.translate('LibChangeTypeHelp')}
                </Alert>

                <FormControlLabel
                    control={
                        <Checkbox
                            checked={scan}
                            disabled={changeType.isPending}
                            // eslint-disable-next-line react/jsx-no-bind
                            onChange={e => setScan(e.target.checked)}
                        />
                    }
                    label={globalize.translate('LibChangeTypeScan')}
                />

                {changeType.isError && (
                    <Alert severity='error' sx={{ mt: 1, borderRadius: '12px' }}>
                        {globalize.translate('LibChangeTypeError')}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={changeType.isPending}>
                    {globalize.translate('ButtonCancel')}
                </Button>
                <Button
                    variant='contained'
                    onClick={confirm}
                    disabled={selected === current || changeType.isPending}
                    startIcon={changeType.isPending ? <CircularProgress size={16} /> : undefined}
                >
                    {globalize.translate('LibChangeTypeConfirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChangeLibraryTypeDialog;
