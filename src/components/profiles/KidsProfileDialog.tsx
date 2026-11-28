/**
 * Manage profiles > Kids: makes a profile a kids profile, which sees only the libraries chosen here (the server keeps
 * it to them), or a normal one again. The libraries offered are the ones of the account.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useUserViews } from 'hooks/api/useUserViews';
import globalize from 'lib/globalize';
import { type Profile, setKidsProfile } from 'utils/profiles';

/** Libraries of something to watch or hear (not live TV or playlists, which are not of one library). */
const NOT_LIBRARIES = new Set([ 'livetv', 'playlists', 'boxsets' ]);

/**
 * A switch or a check box as one row that is a button: OK on the remote (Enter) toggles it, as a click does (the
 * switches and check boxes of Material UI only take the space bar), and the focus shows on the whole row.
 */
const ToggleRow: FC<{ kind: 'switch' | 'checkbox'; checked: boolean; label: string; onToggle: () => void }> = ({ kind, checked, label, onToggle }) => (
    <ButtonBase
        className='cosmic-toggle-row'
        role={kind}
        aria-checked={checked}
        onClick={onToggle}
        sx={{
            width: '100%', justifyContent: 'flex-start', gap: 1.5, px: 1.5, py: 1, borderRadius: '12px',
            color: '#fff', fontSize: '16px', textAlign: 'left',
            '&:hover': { background: 'rgba(255,255,255,0.06)' },
            '&:focus, &.Mui-focusVisible': { outline: 'none', background: 'rgba(0,164,220,0.22)', boxShadow: 'inset 0 0 0 2px #00a4dc' }
        }}
    >
        {kind === 'checkbox' && (checked ?
            <CheckBoxIcon sx={{ color: '#00a4dc' }} /> :
            <CheckBoxOutlineBlankIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />)}
        <Box component='span' sx={{ flexGrow: 1 }}>{label}</Box>
        {kind === 'switch' && (
            <Box aria-hidden='true' sx={{ position: 'relative', width: 44, height: 24, borderRadius: '12px', flexShrink: 0, background: checked ? '#00a4dc' : 'rgba(255,255,255,0.25)', transition: 'background 0.15s' }}>
                <Box sx={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
            </Box>
        )}
    </ButtonBase>
);

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

            <Box sx={{ mt: 2 }}>
                <ToggleRow kind='switch' checked={isKids} label={globalize.translate('ProfileKidsSwitch')} onToggle={() => setIsKids(value => !value)} />
            </Box>

            {isKids && (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column' }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#00a4dc', mb: 0.5 }}>
                        {globalize.translate('ProfileKidsLibraries')}
                    </Typography>
                    {isPending && <CircularProgress size={24} sx={{ color: '#00a4dc', my: 1 }} />}
                    {libraries.map(view => (
                        <ToggleRow
                            key={view.Id}
                            kind='checkbox'
                            checked={chosen.has(view.Id!)}
                            label={view.Name ?? ''}
                            onToggle={() => toggle(view.Id!)}
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
                <Button variant='text' onClick={onClose} sx={{ color: 'rgba(255,255,255,0.75)' }}>{globalize.translate('ButtonCancel')}</Button>
                <Button variant='contained' onClick={() => void onSave()} disabled={!canSave}>
                    {saving ? <CircularProgress size={20} /> : globalize.translate('Save')}
                </Button>
            </Box>
        </Dialog>
    );
};

export default KidsProfileDialog;
