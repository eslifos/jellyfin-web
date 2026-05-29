import React, { lazy, Suspense } from 'react';
import { Navigate, RouteObject } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

import ConnectionRequired from 'components/ConnectionRequired';
import ErrorBoundary from 'components/router/ErrorBoundary';

const WizardStartPage = lazy(() => import('../pages/WizardStartPage'));
const WizardUserPage = lazy(() => import('../pages/WizardUserPage'));
const WizardLibraryPage = lazy(() => import('../pages/WizardLibraryPage'));
const WizardSettingsPage = lazy(() => import('../pages/WizardSettingsPage'));
const WizardRemotePage = lazy(() => import('../pages/WizardRemotePage'));
const WizardFinishPage = lazy(() => import('../pages/WizardFinishPage'));

const WizardFallback = () => (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080810' }}>
        <CircularProgress sx={{ color: '#00a4dc' }} />
    </Box>
);

const withSuspense = (Component: React.ComponentType) => (
    <Suspense fallback={<WizardFallback />}>
        <Component />
    </Suspense>
);

export const WIZARD_APP_ROUTES: RouteObject[] = [
    {
        element: <ConnectionRequired level='wizard' />,
        children: [
            {
                path: 'wizard',
                ErrorBoundary,
                children: [
                    { index: true, element: <Navigate replace to='start' /> },
                    { path: 'start',        element: withSuspense(WizardStartPage) },
                    { path: 'user',         element: withSuspense(WizardUserPage) },
                    { path: 'library',      element: withSuspense(WizardLibraryPage) },
                    { path: 'settings',     element: withSuspense(WizardSettingsPage) },
                    { path: 'remoteaccess', element: withSuspense(WizardRemotePage) },
                    { path: 'finish',       element: withSuspense(WizardFinishPage) }
                ]
            }
        ]
    }
];