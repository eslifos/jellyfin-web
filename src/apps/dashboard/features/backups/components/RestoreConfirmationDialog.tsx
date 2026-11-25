import type { BackupManifestDto } from '@jellyfin/sdk/lib/generated-client/models/backup-manifest-dto';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import globalize from 'lib/globalize';
import React, { FunctionComponent } from 'react';

type IProps = {
    open: boolean;
    /** The copy to restore: its date says how much is lost. */
    backup?: BackupManifestDto | null;
    onClose: () => void;
    onConfirm: () => void;
};

const backupDate = (backup?: BackupManifestDto | null) => (backup?.DateCreated ?
    new Date(backup.DateCreated).toLocaleString(globalize.getCurrentDateTimeLocale(), { dateStyle: 'long', timeStyle: 'short' }) :
    null);

const RestoreConfirmationDialog: FunctionComponent<IProps> = ({ open, backup, onClose, onConfirm }: IProps) => {
    const date = backupDate(backup);
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={'xs'}
            fullWidth
        >
            <DialogTitle>
                {globalize.translate('LabelRestore')}
            </DialogTitle>

            <DialogContent>
                {/* What is lost and how much: everything since the date of the copy */}
                <DialogContentText sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5 }}>
                    {date ? globalize.translate('DangerRestore', date) : globalize.translate('DangerRestoreNoDate')}
                </DialogContentText>
                <DialogContentText sx={{ whiteSpace: 'pre-line' }}>
                    {backup?.ServerVersion ?
                        globalize.translate('DangerRestoreVersion', backup.ServerVersion) :
                        globalize.translate('MessageRestoreDisclaimer')}
                </DialogContentText>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} variant='text'>
                    {globalize.translate('ButtonCancel')}
                </Button>
                <Button onClick={onConfirm} variant='contained' color='error'>
                    {globalize.translate('DangerRestoreButton')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default RestoreConfirmationDialog;
