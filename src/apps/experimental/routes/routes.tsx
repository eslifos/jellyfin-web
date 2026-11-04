import React, { lazy, Suspense } from 'react';
import { Navigate, RouteObject } from 'react-router-dom';

import ConnectionRequired from 'components/ConnectionRequired';
import { toAsyncPageRoute } from 'components/router/AsyncRoute';
import { toViewManagerPageRoute } from 'components/router/LegacyRoute';
import ErrorBoundary from 'components/router/ErrorBoundary';
import FallbackRoute from 'components/router/FallbackRoute';

import { ASYNC_USER_ROUTES } from './asyncRoutes';
import { LEGACY_PUBLIC_ROUTES, LEGACY_USER_ROUTES } from './legacyRoutes';
import VideoPage from './video';

const LoginPage           = lazy(() => import('apps/stable/routes/session/login'));
const AddServerPage       = lazy(() => import('apps/stable/routes/session/addServer'));
const SelectServerPage    = lazy(() => import('apps/stable/routes/session/selectServer'));
const ForgotPinPage       = lazy(() => import('apps/stable/routes/session/forgotPasswordPin'));
const ForgotPasswordPage  = lazy(() => import('apps/stable/routes/session/forgotPassword'));

const withSuspense = (Component: React.ComponentType) => (
    <Suspense fallback={null}><Component /></Suspense>
);

const MIGRATED_PUBLIC = [ 'login', 'addserver', 'selectserver', 'forgotpasswordpin', 'forgotpassword' ];

export const EXPERIMENTAL_APP_ROUTES: RouteObject[] = [
    {
        path: '/*',
        lazy: () => import('../AppLayout'),
        children: [
            { index: true, element: <Navigate replace to='/home' /> },

            {
                /* User routes */
                Component: ConnectionRequired,
                children: [
                    ...ASYNC_USER_ROUTES.map(toAsyncPageRoute),
                    ...LEGACY_USER_ROUTES.map(toViewManagerPageRoute),
                    { path: 'video', Component: VideoPage }
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
                    { path: 'forgotpassword',    element: withSuspense(ForgotPasswordPage) },
                    ...LEGACY_PUBLIC_ROUTES.filter(r => !MIGRATED_PUBLIC.includes(r.path)).map(toViewManagerPageRoute),
                    { path: '*', Component: FallbackRoute }
                ]
            }
        ]
    }
];