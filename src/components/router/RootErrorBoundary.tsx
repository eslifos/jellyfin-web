import React, { type FC, useMemo } from 'react';
import { useRouteError } from 'react-router-dom';

import { reloadOnChunkError } from './chunkReload';

/**
 * Errors no page caught. A piece of the app that failed to download reloads the page by itself;
 * anything else is shown with a button to reload.
 */
const reloadPage = () => window.location.reload();

const RootErrorBoundary: FC = () => {
    const error = useRouteError() as Error | undefined;
    const reloading = useMemo(() => reloadOnChunkError(error), [ error ]);
    if (reloading) return null;

    return (
        <div style={{ padding: '2rem', color: '#fff', background: '#101018', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <h2 style={{ marginTop: 0 }}>{error?.name ?? 'Error'}</h2>
            <p>{error?.message}</p>
            <button type='button' onClick={reloadPage} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
                ↻
            </button>
            {error?.stack && <pre style={{ marginTop: '1rem', opacity: 0.6, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>{error.stack}</pre>}
        </div>
    );
};

export default RootErrorBoundary;
