/**
 * TV: sign in with the phone, the main way on the TV (no typing with the remote). Quick Connect starts by itself:
 * its code in large and a QR code that opens <server>/web/#/quickconnect?code=… on the phone, where one tap approves
 * it. The code renews itself when it expires; the TV signs in as soon as it is approved.
 */
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import type { ApiClient } from 'jellyfin-apiclient';
import React, { type FC, useEffect, useMemo, useState } from 'react';

import globalize from 'lib/globalize';
import { encodeQr, qrPath } from 'utils/qrCode';

/** How often the TV asks whether the code was approved. */
const POLL_MS = 3000;
const QUIET_ZONE = 4;

interface QuickConnectClient extends ApiClient {
    ajax: (options: Record<string, unknown>, raw?: boolean) => Promise<Response>;
    quickConnect: (secret: string) => Promise<{ User?: { Id?: string }, AccessToken?: string }>;
}

interface TvPhoneSignInProps {
    getApiClient: () => ApiClient | undefined;
    /** Approved: the session of the user who approved it. */
    onSignedIn: (userId: string | undefined, accessToken: string | undefined, apiClient: ApiClient) => void;
}

/** The address the phone opens: the server as the TV reaches it, on the Quick Connect page with the code. */
const approveUrl = (apiClient: ApiClient, code: string) => {
    let base = apiClient.serverAddress();
    while (base.endsWith('/')) base = base.slice(0, -1);
    return `${base}/web/#/quickconnect?code=${encodeURIComponent(code)}`;
};

const TvPhoneSignIn: FC<TvPhoneSignInProps> = ({ getApiClient, onSignedIn }) => {
    const [ code, setCode ] = useState<string | null>(null);
    const [ url, setUrl ] = useState('');
    const [ failed, setFailed ] = useState(false);

    useEffect(() => {
        const apiClient = getApiClient() as QuickConnectClient | undefined;
        if (!apiClient) return;
        let timer: number | undefined;
        let stopped = false;

        const start = async () => {
            try {
                const res = await apiClient.ajax({ type: 'POST', url: apiClient.getUrl('/QuickConnect/Initiate') }, true);
                const json = await res.json() as { Secret?: string, Code?: string };
                if (stopped || !json.Secret || !json.Code) return;
                setFailed(false);
                setCode(json.Code);
                setUrl(approveUrl(apiClient, json.Code));
                const poll = async () => {
                    try {
                        const state = await apiClient.getJSON(apiClient.getUrl(`/QuickConnect/Connect?Secret=${json.Secret}`)) as { Authenticated?: boolean };
                        if (stopped) return;
                        if (state.Authenticated) {
                            const result = await apiClient.quickConnect(json.Secret ?? '');
                            onSignedIn(result.User?.Id, result.AccessToken, apiClient);
                            return;
                        }
                        timer = window.setTimeout(() => {
                            void poll();
                        }, POLL_MS);
                    } catch {
                        // The code expired (or the server restarted): a new one
                        if (!stopped) void start();
                    }
                };
                timer = window.setTimeout(() => {
                    void poll();
                }, POLL_MS);
            } catch (err) {
                console.error('[TvPhoneSignIn] Quick Connect could not start', err);
                if (!stopped) setFailed(true);
            }
        };
        void start();
        return () => {
            stopped = true;
            window.clearTimeout(timer);
        };
    }, [ getApiClient, onSignedIn ]);

    const qr = useMemo(() => {
        if (!url) return null;
        try {
            return encodeQr(url);
        } catch {
            return null;
        }
    }, [ url ]);

    if (failed) return null;
    const side = qr ? qr.length + QUIET_ZONE * 2 : 0;

    return (
        <Box
            role='region'
            aria-label={globalize.translate('TvPhoneSignIn')}
            sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, p: 4, width: 520, boxSizing: 'border-box',
                borderRadius: 3, background: 'rgba(10,12,22,0.85)', border: '1px solid rgba(0,164,220,0.35)',
                boxShadow: '0 0 40px rgba(0,164,220,0.15)'
            }}
        >
            <Typography component='h2' sx={{ fontSize: 34, fontWeight: 800, textAlign: 'center', color: '#fff' }}>
                {globalize.translate('TvPhoneSignIn')}
            </Typography>
            <Box sx={{ width: 280, height: 280, borderRadius: 2, background: '#fff', display: 'grid', placeItems: 'center' }}>
                {qr ? (
                    <svg viewBox={`0 0 ${side} ${side}`} width='280' height='280' role='img' aria-label={globalize.translate('TvPhoneSignInQr')} shapeRendering='crispEdges'>
                        <path d={qrPath(qr, QUIET_ZONE)} fill='#000' />
                    </svg>
                ) : <CircularProgress sx={{ color: '#00a4dc' }} />}
            </Box>
            <Typography sx={{ fontSize: 24, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 1.35 }}>
                {globalize.translate('TvPhoneSignInHelp')}
            </Typography>
            <Typography sx={{ fontSize: 64, fontWeight: 800, letterSpacing: '0.18em', color: '#00a4dc', fontFamily: 'monospace', lineHeight: 1 }}>
                {code ?? '······'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress size={22} sx={{ color: '#00a4dc' }} />
                <Typography sx={{ fontSize: 22, color: 'rgba(255,255,255,0.65)' }}>{globalize.translate('LoginWaitingAuthorization')}</Typography>
            </Box>
        </Box>
    );
};

export default TvPhoneSignIn;
