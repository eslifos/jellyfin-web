import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DnsIcon from '@mui/icons-material/Dns';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import WifiIcon from '@mui/icons-material/Wifi';
import { useNavigate } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useCustomLogo } from 'utils/customLogo';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import Dashboard from 'utils/dashboard';
import WizardBackground from 'apps/wizard/components/WizardBackground';

interface Server {
    Id: string;
    Name: string;
    ManualAddress?: string;
    LocalAddress?: string;
    RemoteAddress?: string;
    DateLastAccessed?: number;
}

const SelectServerPage = () => {
    const { bannerUrl: bannerLight } = useCustomLogo();
    const navigate = useNavigate();
    const [ servers, setServers ] = useState<Server[]>([]);
    const [ loading, setLoading ] = useState(true);
    const [ connecting, setConnecting ] = useState<string | null>(null);
    const [ menuAnchor, setMenuAnchor ] = useState<null | HTMLElement>(null);
    const [ menuServer, setMenuServer ] = useState<Server | null>(null);

    useEffect(() => {
        ServerConnections.getAvailableServers()
            .then((result: Server[]) => setServers(result ?? []))
            .catch(() => setServers([]))
            .finally(() => setLoading(false));
    }, []);

    const connectToServer = async (server: Server) => {
        setConnecting(server.Id);
        try {
            const result = await ServerConnections.connectToServer(server);
            switch (result.State) {
                case 'SignedIn':
                    Dashboard.onServerChanged(result.User?.Id, result.AccessToken, result.ApiClient);
                    navigate('/home');
                    break;
                case 'ServerSignIn':
                    navigate(`/login?serverid=${result.ApiClient.serverId()}`);
                    break;
                default:
                    break;
            }
        } catch {
        } finally {
            setConnecting(null);
        }
    };

    const deleteServer = async (server: Server) => {
        setMenuAnchor(null);
        await ServerConnections.deleteServer(server.Id);
        setServers(prev => prev.filter(s => s.Id !== server.Id));
    };

    const serverUrl = (s: Server) => s.ManualAddress || s.LocalAddress || s.RemoteAddress || '';

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', p: 2 }}>
            <WizardBackground />

            <Box sx={{
                width: 220, height: 56, mb: 2.5, zIndex: 2, position: 'relative',
                backgroundImage: `url(${bannerLight as string})`,
                backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
                animation: 'jf-logo-glow 3s ease-in-out infinite, jf-float-logo 4s ease-in-out infinite'
            }} />

            <Box sx={{ width: '100%', maxWidth: 560, zIndex: 2, position: 'relative' }}>
                <Typography variant='h5' sx={{ fontWeight: 700, mb: 3, textAlign: 'center', background: 'linear-gradient(135deg, #fff 30%, #00a4dc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    Seleccionar servidor
                </Typography>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress sx={{ color: '#00a4dc' }} />
                    </Box>
                ) : servers.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'rgba(255,255,255,0.4)' }}>
                        <DnsIcon sx={{ fontSize: '3rem', mb: 1, opacity: 0.4 }} />
                        <Typography>No hay servidores guardados</Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                        {servers.map(server => (
                            <Card key={server.Id} sx={{
                                background: 'rgba(10,12,22,0.80)', backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(0,164,220,0.2)', borderRadius: 3,
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: 'rgba(0,164,220,0.5)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <CardActionArea
                                        onClick={() => void connectToServer(server)}
                                        disabled={connecting === server.Id}
                                        sx={{ flex: 1, p: 0 }}
                                    >
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <WifiIcon sx={{ color: '#00a4dc', flexShrink: 0 }} />
                                            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                                                <Typography sx={{ fontWeight: 600, color: '#fff' }} noWrap>
                                                    {server.Name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }} noWrap>
                                                    {serverUrl(server)}
                                                </Typography>
                                            </Box>
                                            {connecting === server.Id && <CircularProgress size={20} sx={{ color: '#00a4dc' }} />}
                                        </CardContent>
                                    </CardActionArea>
                                    <IconButton
                                        onClick={e => { setMenuAnchor(e.currentTarget); setMenuServer(server); }}
                                        sx={{ color: 'rgba(255,255,255,0.4)', mr: 1, '&:hover': { color: '#00a4dc' } }}
                                    >
                                        <MoreVertIcon />
                                    </IconButton>
                                </Box>
                            </Card>
                        ))}
                    </Box>
                )}

                <Button
                    onClick={() => navigate('/addserver')}
                    startIcon={<AddIcon />}
                    fullWidth
                    sx={{
                        mt: 1, border: '1.5px dashed rgba(0,164,220,0.4)', borderRadius: 3, py: 1.5,
                        color: 'rgba(255,255,255,0.6)',
                        '&:hover': { borderColor: '#00a4dc', borderStyle: 'solid', color: '#00a4dc', bgcolor: 'rgba(0,164,220,0.08)' }
                    }}
                >
                    Agregar servidor
                </Button>
            </Box>

            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                PaperProps={{ sx: { background: 'rgba(13,14,30,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,164,220,0.2)', borderRadius: 2 } }}
            >
                <MenuItem onClick={() => menuServer && void deleteServer(menuServer)} sx={{ color: '#ef5350', gap: 1 }}>
                    <DeleteIcon fontSize='small' /> Eliminar servidor
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default SelectServerPage;