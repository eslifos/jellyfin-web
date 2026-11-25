import Box from '@mui/material/Box';
import DOMPurify from 'dompurify';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { appHost } from 'components/apphost';
import { serverLabel } from 'components/connection/bootCheck';
import ServerUnreachable from 'components/connection/ServerUnreachable';
import Page from 'components/Page';
import toast from 'components/toast/toast';
import { AppFeature } from 'constants/appFeature';
import LinkButton from 'elements/emby-button/LinkButton';
import globalize from 'lib/globalize';
import { ConnectionState, ServerConnections } from 'lib/jellyfin-apiclient';

const reloadPage = () => window.location.reload();
const RECONNECT_EVERY_MS = 5000;

interface ConnectionErrorPageProps {
    state: ConnectionState
}

const ConnectionErrorPage: FC<ConnectionErrorPageProps> = ({
    state
}) => {
    const [ title, setTitle ] = useState<string>();
    const [ htmlMessage, setHtmlMessage ] = useState<string>();
    const [ message, setMessage ] = useState<string>();
    const [ isConnectDisabled, setIsConnectDisabled ] = useState(false);

    const onForceConnect = useCallback(async () => {
        setIsConnectDisabled(true);

        try {
            const server = ServerConnections.getLastUsedServer();
            await ServerConnections.updateSavedServerId(server);
            window.location.reload();
        } catch (err) {
            console.error('[ConnectionErrorPage] Failed to force connect to server', err);
            toast(globalize.translate('HeaderConnectionFailure'));
            setIsConnectDisabled(false);
        }
    }, []);

    // Server out of reach: the whole connection (with the session) is tried again every few seconds and the app
    // opens again by itself as soon as it works
    const [ checking, setChecking ] = useState(false);
    const unavailable = state === ConnectionState.Unavailable;
    const serverName = serverLabel(ServerConnections.currentApiClient()?.serverAddress(), ServerConnections.getLastUsedServer()?.Name);
    const tryAgain = useCallback(async () => {
        setChecking(true);
        try {
            const result = await ServerConnections.connect();
            if (result?.State !== ConnectionState.Unavailable) {
                reloadPage();
                return;
            }
        } catch {
            // Still out of reach
        }
        setChecking(false);
    }, []);
    const onRetry = useCallback(() => {
        void tryAgain();
    }, [ tryAgain ]);
    useEffect(() => {
        if (!unavailable) return;
        const timer = setInterval(onRetry, RECONNECT_EVERY_MS);
        window.addEventListener('online', onRetry);
        return () => {
            clearInterval(timer);
            window.removeEventListener('online', onRetry);
        };
    }, [ unavailable, onRetry ]);
    const navigate = useNavigate();
    const onChangeServer = useCallback(() => navigate('/selectserver'), [ navigate ]);

    useEffect(() => {
        switch (state) {
            case ConnectionState.ServerMismatch:
                setTitle(globalize.translate('HeaderServerMismatch'));
                setHtmlMessage(undefined);
                setMessage(globalize.translate('MessageServerMismatch'));
                return;
            case ConnectionState.ServerUpdateNeeded:
                setTitle(globalize.translate('HeaderUpdateRequired'));
                setHtmlMessage(globalize.translate(
                    'ServerUpdateNeeded',
                    '<a href="https://jellyfin.org/downloads/server/">jellyfin.org/downloads/server</a>'
                ));
                setMessage(undefined);
        }
    }, [ state ]);

    if (unavailable) {
        return (
            <Page
                id='connectionErrorPage'
                className='mainAnimatedPage standalonePage'
                isBackButtonEnabled={false}
                shouldAutoFocus
            >
                <Box sx={{ minHeight: '55vh', display: 'flex' }}>
                    <ServerUnreachable
                        serverName={serverName}
                        checking={checking}
                        onRetry={onRetry}
                        onChangeServer={onChangeServer}
                    />
                </Box>
            </Page>
        );
    }

    if (!title) return;

    return (
        <Page
            id='connectionErrorPage'
            className='mainAnimatedPage standalonePage'
            isBackButtonEnabled={false}
            shouldAutoFocus
        >
            <div className='padded-left padded-right'>
                <h1>{title}</h1>
                {htmlMessage && (
                    <p
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlMessage) }}
                        style={{ maxWidth: '80ch' }}
                    />
                )}
                {message && (
                    <p style={{ maxWidth: '80ch' }}>
                        {message}
                    </p>
                )}

                {appHost.supports(AppFeature.MultiServer) && (
                    <LinkButton
                        className='raised'
                        href='/selectserver'
                    >
                        {globalize.translate('ButtonChangeServer')}
                    </LinkButton>
                )}

                {state === ConnectionState.ServerMismatch && (
                    <LinkButton
                        onClick={onForceConnect}
                        style={ isConnectDisabled ? { pointerEvents: 'none' } : undefined }
                    >
                        {globalize.translate('ConnectAnyway')}
                    </LinkButton>
                )}
            </div>
        </Page>
    );
};

export default ConnectionErrorPage;
