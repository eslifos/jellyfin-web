/**
 * Manage profiles > Kids: makes a profile a kids profile, which sees only the libraries chosen here (the server keeps
 * it to them), or a normal one again. The libraries offered are the ones of the account.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useUserViews } from 'hooks/api/useUserViews';
import globalize from 'lib/globalize';
import { type Profile, setKidsProfile } from 'utils/profiles';

/** Libraries of something to watch or hear (not live TV or playlists, which are not of one library). */
const NOT_LIBRARIES = new Set([ 'livetv', 'playlists', 'boxsets' ]);

interface KidsProfileDialogProps {
    profile: Profile | null;
    onClose: () => void;
    onSaved: () => void;
}

const KidsProfileDialog: FC<KidsProfileDialogProps> = ({ profile, onClose, onSaved }) => {
    const { data: views, isPending } = useUserViews();
    const libraries = useMemo(
        () => (views?.Items ?? []).filter(view => view.Id && !NOT_LIBRARIES.has(view.CollectionType ?? '')),
        [ views ]
    );
    const [ isKids, setIsKids ] = useState(false);
    const [ chosen, setChosen ] = useState<Set<string>>(new Set());
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState('');

    useEffect(() => {
        if (!profile) return;
        setIsKids(Boolean(profile.IsKids));
        setChosen(new Set(profile.KidsLibraryIds ?? []));
        setError('');
    }, [ profile ]);

    const toggle = useCallback((id: string) => {
        setChosen(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const canSave = !saving && (!isKids || chosen.size > 0);

    const onSave = useCallback(async () => {
        if (!profile) return;
        setSaving(true);
        setError('');
        try {
            await setKidsProfile(profile.Id, isKids, [ ...chosen ]);
            onSaved();
            onClose();
        } catch (err) {
            console.error('[KidsProfileDialog] save failed', err);
            setError(globalize.translate('ProfileKidsSaveError'));
        } finally {
            setSaving(false);
        }
    }, [ profile, isKids, chosen, onSaved, onClose ]);

    return (
        <Dialog
            open={Boolean(profile)}
            onClose={onClose}
            maxWidth='xs'
            fullWidth
            PaperProps={{
                sx: {
                    p: { xs: 2.5, sm: 3.5 }, borderRadius: '24px', color: '#fff',
                    background: 'rgba(10,12,24,0.96)', border: '1px solid rgba(0,164,220,0.25)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.7)'
                }
            }}
        >
            <Typography component='h2' sx={{ fontSize: '22px', fontWeight: 800 }}>
                {globalize.translate('ProfileKidsTitle', profile?.Name ?? '')}
            </Typography>
            <Typography sx={{ mt: 1, fontSize: '15px', color: 'rgba(255,255,255,0.7)' }}>
                {globalize.translate('ProfileKidsHelp')}
            </Typography>

            <FormControlLabel
                sx={{ mt: 2 }}
                control={<Switch checked={isKids} onChange={e => setIsKids(e.target.checked)} />}
                label={globalize.translate('ProfileKidsSwitch')}
            />

            {isKids && (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column' }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#00a4dc', mb: 0.5 }}>
                        {globalize.translate('ProfileKidsLibraries')}
                    </Typography>
                    {isPending && <CircularProgress size={24} sx={{ color: '#00a4dc', my: 1 }} />}
                    {libraries.map(view => (
                        <FormControlLabel
                            key={view.Id}
                            control={<Checkbox checked={chosen.has(view.Id!)} onChange={() => toggle(view.Id!)} />}
                            label={view.Name}
                        />
                    ))}
                    {chosen.size === 0 && (
                        <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                            {globalize.translate('ProfileKidsChooseOne')}
                        </Typography>
                    )}
                </Box>
            )}

            {error && <Typography sx={{ mt: 1.5, color: '#ef5350', fontSize: '14px' }}>{error}</Typography>}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
                <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>{globalize.translate('ButtonCancel')}</Button>
                <Button variant='contained' onClick={() => void onSave()} disabled={!canSave}>
                    {saving ? <CircularProgress size={20} /> : globalize.translate('Save')}
                </Button>
            </Box>
        </Dialog>
    );
};

export default KidsProfileDialog;
