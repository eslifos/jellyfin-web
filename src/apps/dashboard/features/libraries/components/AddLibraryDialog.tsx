/**
 * Simplified "Add library": choose what the library is for (movies, series, anime, kids, music…), a name and its
 * folders. Metadata language and country come from the server settings and everything else uses the defaults;
 * they can be changed later in "Manage". Anime and Kids are mixed movies and shows libraries with a theme.
 */
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
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { type FC, useCallback, useEffect, useState } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { getLibraryIcon } from 'utils/image';

import { invalidateVirtualFolders } from '../api/invalidateVirtualFolders';
import { type LibraryKind, type LibraryKindOption, getLibraryKinds } from '../utils/libraryKinds';
import { getLibraryAccent } from '../utils/libraryUi';
import { type FolderType, FolderTypeToggle, guessFolderType, setFolderContentTypes } from './FolderContentType';

/** Provider of the server for audiobooks (Audible, Apple Books, Google Books and Open Library, Spanish first). */
const AUDIOBOOK_PROVIDER = 'Audiolibros en línea';

/** Books in parts are albums and single-file books are audiobooks: both use only the audiobook catalogs. */
const AUDIOBOOK_TYPE_OPTIONS = [ 'MusicAlbum', 'AudioBook' ].map(Type => ({
    Type,
    MetadataFetchers: [ AUDIOBOOK_PROVIDER ],
    MetadataFetcherOrder: [ AUDIOBOOK_PROVIDER ],
    ImageFetchers: [ AUDIOBOOK_PROVIDER ],
    ImageFetcherOrder: [ AUDIOBOOK_PROVIDER ],
    ImageOptions: []
}));

interface AddLibraryDialogProps {
    open: boolean;
    onClose: () => void;
}

interface ServerConfig {
    PreferredMetadataLanguage?: string;
    MetadataCountryCode?: string;
}

interface DirectoryBrowserInstance {
    show: (options: { callback: (path?: string) => void }) => void;
    close: () => void;
}

const KindButton: FC<{ kind: LibraryKindOption, active: boolean, disabled: boolean, onSelect: (kind: LibraryKind) => void }> = ({ kind, active, disabled, onSelect }) => {
    const accent = getLibraryAccent(kind.value);
    const onClick = useCallback(() => onSelect(kind.value), [ onSelect, kind.value ]);
    return (
        <Box
            component='button'
            type='button'
            disabled={disabled}
            onClick={onClick}
            sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1.25, p: 1.5, borderRadius: '14px', cursor: 'pointer',
                textAlign: 'left', color: '#fff', font: 'inherit',
                background: active ? `${accent}26` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? accent : 'rgba(255,255,255,0.1)'}`,
                boxShadow: active ? `0 0 18px ${accent}33` : 'none',
                transition: 'all 0.15s', '&:hover': { borderColor: accent }
            }}
        >
            <Icon sx={{ color: accent, mt: 0.25 }}>{getLibraryIcon(kind.value)}</Icon>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.92rem', fontWeight: 800 }}>{kind.label}</Typography>
                <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.35 }}>{kind.description}</Typography>
            </Box>
        </Box>
    );
};

const FolderRow: FC<{ path: string, disabled: boolean, onRemove: (path: string) => void, type?: FolderType, onType?: (path: string, type: FolderType) => void }> = ({ path, disabled, onRemove, type, onType }) => {
    const remove = useCallback(() => onRemove(path), [ onRemove, path ]);
    const changeType = useCallback((value: FolderType) => onType?.(path, value), [ onType, path ]);
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 1.25, py: 0.75, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <FolderRoundedIcon sx={{ color: '#00a4dc', fontSize: '1.1rem' }} />
            <Typography dir='ltr' noWrap sx={{ flex: 1, minWidth: 160, fontSize: '0.85rem', fontFamily: 'monospace' }}>{path}</Typography>
            {onType && <FolderTypeToggle value={type ?? ''} disabled={disabled} onChange={changeType} />}
            <IconButton size='small' onClick={remove} disabled={disabled} title={globalize.translate('ButtonRemove')}>
                <RemoveCircleOutlineRoundedIcon fontSize='small' />
            </IconButton>
        </Box>
    );
};

const AddLibraryDialog: FC<AddLibraryDialogProps> = ({ open, onClose }) => {
    const { api, user } = useApi();
    const kinds = getLibraryKinds();
    const [ kind, setKind ] = useState<LibraryKind | null>(null);
    const [ name, setName ] = useState('');
    const [ nameEdited, setNameEdited ] = useState(false);
    const [ paths, setPaths ] = useState<string[]>([]);
    const [ folderTypes, setFolderTypes ] = useState<Record<string, FolderType>>({});
    const [ scan, setScan ] = useState(true);

    useEffect(() => {
        if (open) {
            setKind(null);
            setName('');
            setNameEdited(false);
            setPaths([]);
            setFolderTypes({});
            setScan(true);
        }
    }, [ open ]);

    const { data: config } = useQuery({
        queryKey: [ 'ServerConfigurationBasic' ],
        queryFn: async ({ signal }) => (await api!.axiosInstance.get<ServerConfig>(`${api!.basePath}/System/Configuration`, {
            headers: { Authorization: api!.authorizationHeader }, signal
        })).data,
        enabled: !!api && open
    });

    const create = useMutation({
        mutationFn: async () => {
            const option = kinds.find(k => k.value === kind);
            if (!option) throw new Error('No type');
            const mixed = option.collectionType === 'mixed';
            await api!.axiosInstance.post(`${api!.basePath}/Library/VirtualFolders`, {
                LibraryOptions: {
                    PathInfos: paths.map(Path => ({ Path })),
                    PreferredMetadataLanguage: config?.PreferredMetadataLanguage || undefined,
                    MetadataCountryCode: config?.MetadataCountryCode || undefined,
                    ContentTheme: option.theme ?? null,
                    EnableRealtimeMonitor: true,
                    // Audiobooks: only the audiobook catalogs, so a book in parts is never matched as a music album
                    TypeOptions: option.theme === 'audiobooks' ? AUDIOBOOK_TYPE_OPTIONS : undefined
                }
            }, {
                headers: { Authorization: api!.authorizationHeader },
                // Mixed libraries scan after their folder types are saved
                params: { name: name.trim(), collectionType: option.collectionType, refreshLibrary: scan && !mixed }
            });

            if (mixed) {
                // What each folder holds, so movies and series are read right from the first scan
                // The server registers and reads every folder once its type is saved
                await setFolderContentTypes(api!, name.trim(), paths.map(Path => ({ Path, ContentType: folderTypes[Path] || null })), scan);
            }
        },
        onSuccess: () => {
            invalidateVirtualFolders(user);
            onClose();
        }
    });

    const onSelectKind = useCallback((value: LibraryKind) => {
        setKind(value);
        if (!nameEdited) setName(kinds.find(k => k.value === value)?.defaultName ?? '');
    }, [ kinds, nameEdited ]);

    const onName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
        setNameEdited(true);
    }, []);

    const onAddFolder = useCallback(() => {
        void import('components/directorybrowser/directorybrowser').then(({ default: DirectoryBrowser }) => {
            const picker = new DirectoryBrowser() as DirectoryBrowserInstance;
            picker.show({
                callback: (path?: string) => {
                    if (path) {
                        setPaths(prev => (prev.includes(path) ? prev : [ ...prev, path ]));
                        setFolderTypes(prev => ({ ...prev, [path]: prev[path] ?? guessFolderType(path) }));
                    }
                    picker.close();
                }
            });
        });
    }, []);

    const onRemoveFolder = useCallback((path: string) => setPaths(prev => prev.filter(p => p !== path)), []);
    const onFolderType = useCallback((path: string, type: FolderType) => setFolderTypes(prev => ({ ...prev, [path]: type })), []);
    const isMixed = kinds.find(k => k.value === kind)?.collectionType === 'mixed';
    const onScan = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setScan(e.target.checked), []);
    const onCreate = useCallback(() => create.mutate(), [ create ]);

    const busy = create.isPending;
    const ready = !!kind && !!name.trim() && paths.length > 0 && !busy;

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            maxWidth='md'
            fullWidth
            PaperProps={{ sx: { borderRadius: '18px', border: '1px solid rgba(0,164,220,0.25)', background: 'rgba(12,14,26,0.98)' } }}
        >
            <DialogTitle sx={{ fontWeight: 800 }}>{globalize.translate('ButtonAddMediaLibrary')}</DialogTitle>
            <DialogContent>
                <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', mb: 1 }}>
                    {globalize.translate('LkStepType')}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1, mb: 2.5 }}>
                    {kinds.map(k => <KindButton key={k.value} kind={k} active={kind === k.value} disabled={busy} onSelect={onSelectKind} />)}
                </Box>

                {kind && (
                    <>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', mb: 1 }}>
                            {globalize.translate('LkStepDetails')}
                        </Typography>
                        <TextField fullWidth size='small' label={globalize.translate('LabelName')} value={name} onChange={onName} disabled={busy} sx={{ mb: 1.5 }} />

                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography sx={{ flex: 1, fontSize: '0.9rem', fontWeight: 700 }}>{globalize.translate('Folders')}</Typography>
                            <Button size='small' variant='outlined' startIcon={<CreateNewFolderRoundedIcon />} onClick={onAddFolder} disabled={busy}>
                                {globalize.translate('LkAddFolder')}
                            </Button>
                        </Box>
                        <Box sx={{ display: 'grid', gap: 0.75, mb: 1.5 }}>
                            {paths.length === 0 && (
                                <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', px: 0.5 }}>{globalize.translate('LkNoFolders')}</Typography>
                            )}
                            {isMixed && paths.length > 0 && (
                                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', px: 0.5 }}>{globalize.translate('FctHelp')}</Typography>
                            )}
                            {paths.map(p => (
                                <FolderRow key={p} path={p} disabled={busy} onRemove={onRemoveFolder} type={folderTypes[p]} onType={isMixed ? onFolderType : undefined} />
                            ))}
                        </Box>

                        <Alert severity='info' sx={{ borderRadius: '12px', mb: 1 }}>
                            {globalize.translate('LkDefaultsHelp', [ config?.PreferredMetadataLanguage, config?.MetadataCountryCode ].filter(Boolean).join(' / ') || '—')}
                        </Alert>
                        <FormControlLabel control={<Checkbox checked={scan} onChange={onScan} disabled={busy} />} label={globalize.translate('LkScanNow')} />
                    </>
                )}

                {create.isError && <Alert severity='error' sx={{ mt: 1, borderRadius: '12px' }}>{globalize.translate('LkCreateError')}</Alert>}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={busy}>{globalize.translate('ButtonCancel')}</Button>
                <Button variant='contained' onClick={onCreate} disabled={!ready} startIcon={busy ? <CircularProgress size={16} /> : undefined}>
                    {globalize.translate('LkCreate')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddLibraryDialog;
