import Dashboard from '@mui/icons-material/Dashboard';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LibraryAdd from '@mui/icons-material/LibraryAdd';
import Palette from '@mui/icons-material/Palette';
import People from '@mui/icons-material/People';
import PlayCircle from '@mui/icons-material/PlayCircle';
import Settings from '@mui/icons-material/Settings';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import React, { type FC, type MouseEvent, useCallback, useContext, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import ListItemLink from 'components/ListItemLink';
import globalize from 'lib/globalize';

import { NavCollapsedContext } from '../navContext';

interface GroupLink { to: string; labelKey: string }

const LIBRARY_LINKS: GroupLink[] = [
    { to: '/dashboard/libraries', labelKey: 'HeaderLibraries' },
    { to: '/dashboard/libraries/display', labelKey: 'Display' },
    { to: '/dashboard/libraries/metadata', labelKey: 'LabelMetadata' },
    { to: '/dashboard/libraries/nfo', labelKey: 'TabNfoSettings' },
    { to: '/dashboard/libraries/health', labelKey: 'HlthTitle' },
    { to: '/dashboard/libraries/episodeorder', labelKey: 'EpoTitle' }
];

const PLAYBACK_LINKS: GroupLink[] = [
    { to: '/dashboard/playback/transcoding', labelKey: 'Transcoding' },
    { to: '/dashboard/playback/resume', labelKey: 'ButtonResume' },
    { to: '/dashboard/playback/streaming', labelKey: 'TabStreaming' },
    { to: '/dashboard/playback/trickplay', labelKey: 'Trickplay' }
];

/**
 * A menu entry with sub pages. In the expanded menu it opens inline;
 * in the collapsed (icons only) menu it opens a flyout to the right.
 */
const NavGroup: FC<{ icon: React.ReactNode; labelKey: string; links: GroupLink[] }> = ({ icon, labelKey, links }) => {
    const location = useLocation();
    const collapsed = useContext(NavCollapsedContext);
    const isActive = links.some(l => l.to === location.pathname);
    const [ isOpen, setIsOpen ] = useState(isActive);
    const [ anchor, setAnchor ] = useState<HTMLElement | null>(null);

    const onClick = useCallback((e: MouseEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (collapsed) setAnchor(e.currentTarget);
        else setIsOpen(open => !open);
    }, [ collapsed ]);

    const closeFlyout = useCallback(() => setAnchor(null), []);

    return (
        <>
            <ListItem disablePadding>
                <ListItemButton onClick={onClick} selected={collapsed && isActive}>
                    <ListItemIcon>{icon}</ListItemIcon>
                    <ListItemText primary={globalize.translate(labelKey)} />
                    {isOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
            </ListItem>
            <Collapse in={isOpen && !collapsed} timeout='auto' unmountOnExit>
                <List component='div' disablePadding>
                    {links.map(l => (
                        <ListItemLink key={l.to} to={l.to} sx={{ pl: 4 }}>
                            <ListItemText inset primary={globalize.translate(l.labelKey)} />
                        </ListItemLink>
                    ))}
                </List>
            </Collapse>

            <Menu
                open={!!anchor}
                anchorEl={anchor}
                onClose={closeFlyout}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        sx: {
                            ml: 1.5, minWidth: 210, borderRadius: '16px', overflow: 'hidden',
                            background: 'rgba(8, 10, 22, 0.96)', backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(0,164,220,0.3)',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 22px rgba(0,164,220,0.18)'
                        }
                    },
                    list: { sx: { py: 0.75 } }
                }}
            >
                <Typography sx={{ px: 2, pt: 0.5, pb: 1, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#00a4dc' }}>
                    {globalize.translate(labelKey)}
                </Typography>
                {links.map(l => {
                    const selected = l.to === location.pathname;
                    return (
                        <MenuItem
                            key={l.to}
                            component={Link}
                            to={l.to}
                            selected={selected}
                            onClick={closeFlyout}
                            sx={{
                                mx: 0.75, borderRadius: '10px', fontSize: '0.88rem', color: selected ? '#fff' : 'rgba(255,255,255,0.78)',
                                '&:hover': { background: 'rgba(0,164,220,0.14)', color: '#fff' },
                                '&.Mui-selected': {
                                    background: 'linear-gradient(90deg, rgba(0,164,220,0.26), rgba(170,92,195,0.14))', fontWeight: 600,
                                    '&:hover': { background: 'linear-gradient(90deg, rgba(0,164,220,0.32), rgba(170,92,195,0.18))' }
                                }
                            }}
                        >
                            {globalize.translate(l.labelKey)}
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
};

const ServerDrawerSection = () => (
    <List
        aria-labelledby='server-subheader'
        subheader={
            <ListSubheader component='div' id='server-subheader'>
                {globalize.translate('TabServer')}
            </ListSubheader>
        }
    >
        <ListItem disablePadding>
            <ListItemLink to='/dashboard'>
                <ListItemIcon>
                    <Dashboard />
                </ListItemIcon>
                <ListItemText primary={globalize.translate('TabDashboard')} />
            </ListItemLink>
        </ListItem>
        <ListItem disablePadding>
            <ListItemLink to='/dashboard/settings'>
                <ListItemIcon>
                    <Settings />
                </ListItemIcon>
                <ListItemText primary={globalize.translate('General')} />
            </ListItemLink>
        </ListItem>
        <ListItemLink to='/dashboard/branding'>
            <ListItemIcon>
                <Palette />
            </ListItemIcon>
            <ListItemText primary={globalize.translate('HeaderBranding')} />
        </ListItemLink>
        <ListItem disablePadding>
            <ListItemLink to='/dashboard/users'>
                <ListItemIcon>
                    <People />
                </ListItemIcon>
                <ListItemText primary={globalize.translate('HeaderUsers')} />
            </ListItemLink>
        </ListItem>
        <NavGroup icon={<LibraryAdd />} labelKey='HeaderLibraries' links={LIBRARY_LINKS} />
        <NavGroup icon={<PlayCircle />} labelKey='TitlePlayback' links={PLAYBACK_LINKS} />
    </List>
);

export default ServerDrawerSection;
