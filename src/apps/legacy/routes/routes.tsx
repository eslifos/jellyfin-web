import { Navigate, RouteObject } from 'react-router-dom';
import React, { lazy, Suspense } from 'react';

import ConnectionRequired from 'components/ConnectionRequired';
import { toAsyncPageRoute } from 'components/router/AsyncRoute';
import { toViewManagerPageRoute } from 'components/router/LegacyRoute';
import ErrorBoundary from 'components/router/ErrorBoundary';
import FallbackRoute from 'components/router/FallbackRoute';

import AppLayout from '../AppLayout';

import { ASYNC_PUBLIC_ROUTES, ASYNC_USER_ROUTES } from './asyncRoutes';
import { LEGACY_PUBLIC_ROUTES, LEGACY_USER_ROUTES } from './legacyRoutes';

const LoginPage          = lazy(() => import('./session/login'));
const AddServerPage      = lazy(() => import('./session/addServer'));
const SelectServerPage   = lazy(() => import('./session/selectServer'));
const ForgotPinPage      = lazy(() => import('./session/forgotPasswordPin'));

const withSuspense = (Component: React.ComponentType) => (
    <Suspense fallback={null}><Component /></Suspense>
);

const MIGRATED_PUBLIC = [ 'login', 'addserver', 'selectserver', 'forgotpasswordpin' ];

export const APP_ROUTES: RouteObject[] = [
    {
        path: '/*',
        Component: AppLayout,
        children: [
            { index: true, element: <Navigate replace to='/home' /> },

            {
                /* User routes */
                Component: ConnectionRequired,
                children: [
                    ...ASYNC_USER_ROUTES.map(toAsyncPageRoute),
                    ...LEGACY_USER_ROUTES.map(toViewManagerPageRoute)
                ],
                ErrorBoundary
            },

            {
                /* Public routes */
                element: <ConnectionRequired level='public' />,
                children: [
                    { path: 'login',            element: withSuspense(LoginPage) },
                    { path: 'addserver',         element: withSuspense(AddServerPage) },
                    { path: 'selectserver',      element: withSuspense(SelectServerPage) },
                    { path: 'forgotpasswordpin', element: withSuspense(ForgotPinPage) },
                    ...ASYNC_PUBLIC_ROUTES.map(toAsyncPageRoute),
                    ...LEGACY_PUBLIC_ROUTES.filter(r => !MIGRATED_PUBLIC.includes(r.path)).map(toViewManagerPageRoute),
                    { path: '*', Component: FallbackRoute }
                ]
            }
        ]
    }
];