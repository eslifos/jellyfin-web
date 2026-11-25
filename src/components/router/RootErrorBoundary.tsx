/**
 * Errors no section caught (the layout of the app itself failed): the same screen as a section, over the whole
 * page, so it is never left blank. Retrying loads the page again.
 */
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import React, { type FC, useCallback, useEffect } from 'react';
import { useRouteError } from 'react-router-dom';

import LoadErrorState from 'components/common/LoadErrorState';
import layoutManager from 'components/layoutManager';
import loading from 'components/loading/loading';
import appTheme from 'themes';
import { ThemeStorageManager } from 'themes/themeStorageManager';

const reloadPage = () => window.location.reload();

const RootErrorBoundary: FC = () => {
    const error = useRouteError();

    useEffect(() => {
        loading.hide();
        console.error('[RootErrorBoundary] the app failed to load', error);
    }, [ error ]);

    const goToDownloads = useCallback(() => {
        window.location.hash = '#/downloads';
        reloadPage();
    }, []);

    return (
        <ThemeProvider theme={appTheme} defaultMode='dark' storageManager={ThemeStorageManager}>
            <Box sx={{ minHeight: '100vh', background: '#0b0d16', color: '#fff' }}>
                <LoadErrorState
                    variant='page'
                    error={error}
                    onRetry={reloadPage}
                    onDownloads={layoutManager.modern ? goToDownloads : undefined}
                />
            </Box>
        </ThemeProvider>
    );
};

export default RootErrorBoundary;
