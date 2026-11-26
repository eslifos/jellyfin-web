import { Navigate, RouteObject } from 'react-router-dom';
import React, { lazy, Suspense } from 'react';

import ConnectionRequired from 'components/ConnectionRequired';
import { toAsyncPageRoute } from 'components/router/AsyncRoute';
import { toViewManagerPageRoute } from 'components/router/LegacyRoute';
import ErrorBoundary from 'components/router/ErrorBoundary';
import { retryImport } from 'utils/connection/loadError';
import FallbackRoute from 'components/router/FallbackRoute';

import { ASYNC_USER_ROUTES as MODERN_ASYNC_USER_ROUTES } from 'apps/modern/routes/asyncRoutes';
import layoutManager from 'components/layoutManager';

import AppLayout from '../AppLayout';

import { ASYNC_PUBLIC_ROUTES, ASYNC_USER_ROUTES } from './asyncRoutes';
import { LEGACY_PUBLIC_ROUTES, LEGACY_USER_ROUTES } from './legacyRoutes';
import TvLibraryLayout, { TV_LIBRARY_PATHS } from './TvLibraryLayout';

const LoginPage = lazy(() => retryImport(() => import('./session/login')));
const AddServerPage = lazy(() => retryImport(() => import('./session/addServer')));
const SelectServerPage = lazy(() => retryImport(() => import('./session/selectServer')));
const ForgotPinPage = lazy(() => retryImport(() => import('./session/forgotPasswordPin')));

const withSuspense = (Component: React.ComponentType) => (
    <Suspense fallback={null}><Component /></Suspense>
);

const MIGRATED_PUBLIC = [ 'login', 'addserver', 'selectserver', 'forgotpasswordpin' ];

/** TV: the libraries are the Cosmic pages of the desktop (continuous scrolling), not the legacy paged ones. */
const tvLibraries = layoutManager.tv;
const TV_LIBRARY_ROUTES: RouteObject[] = tvLibraries ? [ {
    Component: TvLibraryLayout,
    children: MODERN_ASYNC_USER_ROUTES.filter(r => TV_LIBRARY_PATHS.includes(r.path)).map(toAsyncPageRoute)
} ] : [];
const userLegacyRoutes = tvLibraries ? LEGACY_USER_ROUTES.filter(r => !TV_LIBRARY_PATHS.includes(r.path)) : LEGACY_USER_ROUTES;

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
                    ...TV_LIBRARY_ROUTES,
                    ...ASYNC_USER_ROUTES.map(toAsyncPageRoute),
                    ...userLegacyRoutes.map(toViewManagerPageRoute)
                ],
                ErrorBoundary
            },

            {
                /* Public routes */
                element: <ConnectionRequired level='public' />,
                children: [
                    { path: 'login', element: withSuspense(LoginPage) },
                    { path: 'addserver', element: withSuspense(AddServerPage) },
                    { path: 'selectserver', element: withSuspense(SelectServerPage) },
                    { path: 'forgotpasswordpin', element: withSuspense(ForgotPinPage) },
                    ...ASYNC_PUBLIC_ROUTES.map(toAsyncPageRoute),
                    ...LEGACY_PUBLIC_ROUTES.filter(r => !MIGRATED_PUBLIC.includes(r.path)).map(toViewManagerPageRoute),
                    { path: '*', Component: FallbackRoute }
                ]
            }
        ]
    }
];
