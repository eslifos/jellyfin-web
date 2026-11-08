import Analytics from '@mui/icons-material/Analytics';
import BarChart from '@mui/icons-material/BarChart';
import Devices from '@mui/icons-material/Devices';
import History from '@mui/icons-material/History';
import PeopleAlt from '@mui/icons-material/PeopleAlt';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import React from 'react';

import ListItemLink from 'components/ListItemLink';
import globalize from 'lib/globalize';

const DevicesDrawerSection = () => {
    return (
        <List
            aria-labelledby='devices-subheader'
            subheader={
                <ListSubheader component='div' id='devices-subheader'>
                    {globalize.translate('HeaderDevices')}
                </ListSubheader>
            }
        >
            <ListItem disablePadding>
                <ListItemLink to='/dashboard/devices'>
                    <ListItemIcon>
                        <Devices />
                    </ListItemIcon>
                    <ListItemText primary={globalize.translate('HeaderDevices')} />
                </ListItemLink>
            </ListItem>
            <ListItem disablePadding>
                <ListItemLink to='/dashboard/activity'>
                    <ListItemIcon>
                        <Analytics />
                    </ListItemIcon>
                    <ListItemText primary={globalize.translate('HeaderActivity')} />
                </ListItemLink>
            </ListItem>
            <ListItem disablePadding>
                <ListItemLink to='/dashboard/stats'>
                    <ListItemIcon>
                        <BarChart />
                    </ListItemIcon>
                    <ListItemText primary={globalize.translate('StsTitle')} />
                </ListItemLink>
            </ListItem>
            <ListItem disablePadding>
                <ListItemLink to='/dashboard/stats/users'>
                    <ListItemIcon>
                        <PeopleAlt />
                    </ListItemIcon>
                    <ListItemText primary={globalize.translate('PvuTitle')} />
                </ListItemLink>
            </ListItem>
            <ListItem disablePadding>
                <ListItemLink to='/dashboard/history'>
                    <ListItemIcon>
                        <History />
                    </ListItemIcon>
                    <ListItemText primary={globalize.translate('HisTitle')} />
                </ListItemLink>
            </ListItem>
        </List>
    );
};

export default DevicesDrawerSection;
