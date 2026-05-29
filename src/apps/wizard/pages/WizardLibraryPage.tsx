import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import TvIcon from '@mui/icons-material/Tv';
import BookIcon from '@mui/icons-material/Book';
import PhotoIcon from '@mui/icons-material/Photo';
import FolderIcon from '@mui/icons-material/Folder';
import { useNavigate } from 'react-router-dom';

import { useVirtualFolders, useAddVirtualFolder, useDeleteVirtualFolder } from '../api/useVirtualFolders';
import WizardLayout from '../components/WizardLayout';

const COLLECTION_TYPES = [
    { value: 'movies', label: 'Películas', icon: <MovieIcon /> },
    { value: 'tvshows', label: 'Series', icon: <TvIcon /> },
    { value: 'music', label: 'Música', icon: <MusicNoteIcon /> },
    { value: 'books', label: 'Libros', icon: <BookIcon /> },
    { value: 'homevideos', label: 'Fotos y videos personales', icon: <PhotoIcon /> },
    { value: 'mixed', label: 'Contenido mixto', icon: <FolderIcon /> }
];

const getIcon = (type?: string) => {
    const found = COLLECTION_TYPES.find(t => t.value === type);
    return found?.icon ?? <FolderIcon />;
};

const WizardLibraryPage = () => {
    const navigate = useNavigate();
    const { data: folders = [], isPending } = useVirtualFolders();
    const { mutateAsync: addFolder, isPending: adding } = useAddVirtualFolder();
    const { mutateAsync: deleteFolder } = useDeleteVirtualFolder();

    const [ open, setOpen ] = useState(false);
    const [ name, setName ] = useState('');
    const [ type, setType ] = useState('movies');
    const [ path, setPath ] = useState('');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        await addFolder({ name, collectionType: type, paths: path ? [ path ] : [] });
        setOpen(false);
        setName('');
        setType('movies');
        setPath('');
    };

    return (
        <WizardLayout maxWidth={860}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography
                    variant='h5'
                    sx={{
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}
                >
                    Configure sus bibliotecas multimedia
                </Typography>
                <Button
                    href='https://jellyfin.org/docs/general/server/libraries'
                    target='_blank'
                    rel='noopener noreferrer'
                    size='small'
                    sx={{
                        color: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.13)',
                        borderRadius: 2,
                        fontSize: '0.78rem',
                        '&:hover': { borderColor: 'rgba(0,164,220,0.4)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' }
                    }}
                >
                    Ayuda
                </Button>
            </Box>

            {/* Grid de tarjetas */}
            {isPending ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: '#00a4dc' }} />
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
                    {/* Tarjetas de bibliotecas existentes */}
                    {folders.map(folder => (
                        <Card
                            key={folder.ItemId}
                            sx={{
                                width: 180,
                                background: 'rgba(10,14,28,0.75)',
                                border: '1px solid rgba(0,164,220,0.25)',
                                borderRadius: 3,
                                backdropFilter: 'blur(12px)',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,164,220,0.5)' }
                            }}
                        >
                            <Box sx={{
                                height: 100,
                                background: 'linear-gradient(135deg, rgba(0,60,90,0.9), rgba(80,0,110,0.7))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2.5rem',
                                color: 'rgba(255,255,255,0.9)',
                                filter: 'drop-shadow(0 2px 8px rgba(0,164,220,0.4))'
                            }}>
                                {getIcon(folder.CollectionType)}
                            </Box>
                            <CardContent sx={{ p: 1.5, textAlign: 'center', background: 'rgba(8,10,22,0.85)', borderTop: '1px solid rgba(0,164,220,0.12)', '&:last-child': { pb: 1.5 } }}>
                                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', mb: 0.25 }} noWrap>
                                    {folder.Name}
                                </Typography>
                                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }} noWrap>
                                    {folder.Locations?.[0] ?? ''}
                                </Typography>
                                <IconButton
                                    size='small'
                                    onClick={() => void deleteFolder(folder.Name ?? '')}
                                    sx={{ color: 'rgba(255,255,255,0.3)', mt: 0.5, '&:hover': { color: '#ef5350' } }}
                                >
                                    <DeleteIcon fontSize='small' />
                                </IconButton>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Botón Añadir */}
                    <Card
                        sx={{
                            width: 180,
                            background: 'transparent',
                            border: '1.5px dashed rgba(0,164,220,0.45)',
                            borderRadius: 3,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': { background: 'rgba(0,164,220,0.08)', borderColor: '#00a4dc', borderStyle: 'solid', boxShadow: '0 0 20px rgba(0,164,220,0.2)' }
                        }}
                    >
                        <CardActionArea
                            onClick={() => setOpen(true)}
                            sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, py: 3 }}
                        >
                            <AddCircleOutlineIcon sx={{ color: '#00a4dc', fontSize: '2rem' }} />
                            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: 500, textAlign: 'center', px: 1 }}>
                                Añadir biblioteca de medios
                            </Typography>
                        </CardActionArea>
                    </Card>
                </Box>
            )}

            {/* Navegación */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    onClick={() => navigate('/wizard/user')}
                    startIcon={<ArrowBackIcon />}
                    sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, '&:hover': { borderColor: 'rgba(0,164,220,0.35)', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' } }}
                >
                    Anterior
                </Button>
                <Button
                    onClick={() => navigate('/wizard/settings')}
                    variant='contained'
                    endIcon={<ArrowForwardIcon />}
                    sx={{ background: 'linear-gradient(135deg, #00a4dc, #0077b6)', borderRadius: 2, px: 3, fontWeight: 600, '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' } }}
                >
                    Siguiente
                </Button>
            </Box>

            {/* Dialog para añadir biblioteca */}
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                maxWidth='sm'
                fullWidth
                PaperProps={{
                    sx: {
                        background: 'rgba(8,8,18,0.9)',
                        backdropFilter: 'blur(28px)',
                        border: '1px solid rgba(0,164,220,0.2)',
                        borderRadius: 3,
                        '&::before': { content: '""', position: 'absolute', top: 0, left: '2rem', right: '2rem', height: '2px', background: 'linear-gradient(90deg, transparent, #00a4dc 40%, #aa5cc3 60%, transparent)' }
                    }
                }}
            >
                <DialogTitle sx={{ bgcolor: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(0,164,220,0.12)', fontWeight: 700, background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    Añadir biblioteca de medios
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Box component='form' id='add-library-form' onSubmit={handleAdd}>
                        <TextField
                            select
                            label='Tipo de contenido'
                            value={type}
                            onChange={e => setType(e.target.value)}
                            fullWidth
                            variant='filled'
                            sx={{ mb: 2 }}
                        >
                            {COLLECTION_TYPES.map(t => (
                                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label='Nombre para mostrar'
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            fullWidth
                            variant='filled'
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label='Ruta de la carpeta'
                            value={path}
                            onChange={e => setPath(e.target.value)}
                            fullWidth
                            variant='filled'
                            helperText='Ej: /mnt/nas/peliculas'
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(0,164,220,0.1)', p: 2 }}>
                    <Button onClick={() => setOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>Cancelar</Button>
                    <Button
                        type='submit'
                        form='add-library-form'
                        variant='contained'
                        disabled={adding}
                        endIcon={adding ? <CircularProgress size={14} color='inherit' /> : null}
                        sx={{ background: 'linear-gradient(135deg, #00a4dc, #0077b6)', borderRadius: 2, px: 3, fontWeight: 600 }}
                    >
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </WizardLayout>
    );
};

export default WizardLibraryPage;