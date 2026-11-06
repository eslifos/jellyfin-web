import ListItem from '@mui/material/ListItem';
import List from '@mui/material/List';
import React, { FC } from 'react';

import DrawerHeaderLink from 'apps/modern/components/drawers/DrawerHeaderLink';
import ResponsiveDrawer, { ResponsiveDrawerProps } from 'components/ResponsiveDrawer';

import DrawerSections from './DrawerSections';

const AppDrawer: FC<ResponsiveDrawerProps> = ({
    open = false,
    onClose,
    onOpen
}) => (
    <ResponsiveDrawer
        open={open}
        onClose={onClose}
        onOpen={onOpen}
    >
        <List disablePadding>
            <ListItem disablePadding>
                <DrawerHeaderLink />
            </ListItem>
        </List>
        <DrawerSections />
    </ResponsiveDrawer>
);

export default AppDrawer;
