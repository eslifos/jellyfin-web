import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getConnectionSnapshot, onConnectionRestored, reportNetworkFailure, reportServerStatus, resetConnectionMonitor,
    startConnectionMonitor
} from './monitor';

describe('connection monitor', () => {
    beforeEach(() => {
        resetConnectionMonitor();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        resetConnectionMonitor();
    });

    it('needs repeated failures to say the server is down', () => {
        reportServerStatus(502);
        expect(getConnectionSnapshot().serverDown).toBe(false);
        reportNetworkFailure();
        expect(getConnectionSnapshot().serverDown).toBe(true);
    });

    it('a normal answer in between resets the count', () => {
        reportServerStatus(503);
        reportServerStatus(200);
        reportServerStatus(504);
        expect(getConnectionSnapshot().serverDown).toBe(false);
    });

    it('client errors are not the server being down', () => {
        reportServerStatus(404);
        reportServerStatus(401);
        reportServerStatus(500);
        expect(getConnectionSnapshot().serverDown).toBe(false);
    });

    it('asks the server until it is back, then tells once', async () => {
        const restored = vi.fn();
        const onRestored = vi.fn();
        onConnectionRestored(restored);
        // The monitor keeps the fetch of the browser it finds when it starts
        const fetchMock = vi.spyOn(window, 'fetch')
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValue(new Response('{}', { status: 200 }));
        startConnectionMonitor({ serverAddress: () => 'http://server.test', onRestored });

        reportServerStatus(502);
        reportServerStatus(502);
        expect(getConnectionSnapshot().serverDown).toBe(true);

        await vi.advanceTimersByTimeAsync(5000);
        expect(getConnectionSnapshot().serverDown).toBe(true);
        await vi.advanceTimersByTimeAsync(5000);
        expect(getConnectionSnapshot().serverDown).toBe(false);
        expect(fetchMock).toHaveBeenCalledWith('http://server.test/System/Info/Public', expect.anything());
        expect(restored).toHaveBeenCalledTimes(1);
        expect(onRestored).toHaveBeenCalledTimes(1);
    });
});
