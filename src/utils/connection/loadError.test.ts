import { describe, expect, it, vi } from 'vitest';

import { classifyLoadError, isChunkLoadError, retryImport } from './loadError';

const chunkError = () => Object.assign(new Error('Loading chunk 123 failed.'), { name: 'ChunkLoadError' });

describe('classifyLoadError', () => {
    it('says offline first, whatever failed', () => {
        expect(classifyLoadError(chunkError(), false)).toBe('offline');
        expect(classifyLoadError(new Error('x'), false)).toBe('offline');
    });

    it('tells a piece of the app that did not download', () => {
        expect(isChunkLoadError(new Error('Loading CSS chunk 9 failed.'))).toBe(true);
        expect(classifyLoadError(chunkError(), true)).toBe('update');
    });

    it('tells a server that does not answer', () => {
        expect(classifyLoadError({ response: { status: 502 } }, true)).toBe('server');
        expect(classifyLoadError({ status: 504 }, true)).toBe('server');
        expect(classifyLoadError({ code: 'ERR_NETWORK', message: 'Network Error' }, true)).toBe('server');
        expect(classifyLoadError(new TypeError('Failed to fetch'), true)).toBe('server');
    });

    it('leaves anything else as other', () => {
        expect(classifyLoadError({ response: { status: 404 } }, true)).toBe('other');
        expect(classifyLoadError(new TypeError('x is undefined'), true)).toBe('other');
        expect(classifyLoadError(undefined, true)).toBe('other');
    });
});

describe('retryImport', () => {
    it('tries once more when a piece fails to download', async () => {
        const load = vi.fn()
            .mockRejectedValueOnce(chunkError())
            .mockResolvedValueOnce('page');
        await expect(retryImport(load, 0)).resolves.toBe('page');
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('gives up after the second failure', async () => {
        const load = vi.fn().mockRejectedValue(chunkError());
        await expect(retryImport(load, 0)).rejects.toThrow('Loading chunk');
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('does not retry other errors', async () => {
        const load = vi.fn().mockRejectedValue(new Error('bug'));
        await expect(retryImport(load, 0)).rejects.toThrow('bug');
        expect(load).toHaveBeenCalledTimes(1);
    });
});
