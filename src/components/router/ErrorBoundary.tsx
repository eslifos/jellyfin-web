/**
 * Error screen of a section of the app (the errorElement of its routes): "We couldn't load this section", why
 * in plain words, "Retry" and "Go to Downloads". A piece of the app that did not download was already tried twice
 * (retryImport); the screen then offers to reload the page. It retries by itself when the connection is back.
 */
import classNames from 'classnames';
import React, { type FC, useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useRouteError } from 'react-router-dom';

import LoadErrorState from 'components/common/LoadErrorState';
import layoutManager from 'components/layoutManager';
import loading from 'components/loading/loading';
import Page from 'components/Page';

interface ErrorBoundaryParams {
    pageClasses?: string[]
}

const ErrorBoundary: FC<ErrorBoundaryParams> = ({
    pageClasses = [ 'libraryPage' ]
}) => {
    const error = useRouteError();
    const navigate = useNavigate();
    const { pathname, search } = useLocation();

    useEffect(() => {
        loading.hide();
        console.error('[ErrorBoundary] section failed to load', error);
    }, [ error ]);

    // Going to the same place again loads the section again (a failed route is loaded anew)
    const retry = useCallback(() => {
        navigate({ pathname, search }, { replace: true });
    }, [ navigate, pathname, search ]);
    const goToDownloads = useCallback(() => navigate('/downloads'), [ navigate ]);

    return (
        <Page
            id='errorBoundary'
            className={classNames('mainAnimatedPage', pageClasses)}
        >
            <LoadErrorState
                variant='page'
                error={error}
                onRetry={retry}
                onDownloads={layoutManager.modern && pathname !== '/downloads' ? goToDownloads : undefined}
            />
        </Page>
    );
};

export default ErrorBoundary;
