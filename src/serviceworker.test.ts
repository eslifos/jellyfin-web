/**
 * The service worker of the production build (npm run build:production) must be a self-contained script: as a
 * webpack chunk it waits for a runtime that never loads in a service worker, so install, activate and fetch are
 * never registered and the app shell is never kept. Skipped when there is no build.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = resolve(__dirname, '../dist');
const WORKER = resolve(DIST, 'serviceworker.js');
const built = existsSync(WORKER);

interface ShellManifest {
    shell: string[];
    translations: Record<string, string>;
    buildQuery: string;
}

const manifestOf = (code: string): ShellManifest => {
    // The list is written as JSON.parse("<json>"); the minifier may pick either quote
    const literal = /JSON\.parse\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/.exec(code)?.[1];
    if (!literal) throw new Error('No manifest in serviceworker.js');
    const text = literal.startsWith('"') ? JSON.parse(literal) as string : JSON.parse(`"${literal.slice(1, -1).replace(/"/g, '\\"')}"`) as string;
    return JSON.parse(text) as ShellManifest;
};

describe.skipIf(!built)('dist/serviceworker.js', () => {
    const code = built ? readFileSync(WORKER, 'utf8') : '';

    it('is not a webpack chunk', () => {
        expect(code).not.toContain('webpackChunk');
    });

    it('registers its events', () => {
        for (const event of [ 'install', 'activate', 'fetch' ]) {
            expect(code).toMatch(new RegExp(`addEventListener\\(["'\`]${event}["'\`]`));
        }
    });

    it('carries the app shell, and every file of it exists', () => {
        expect(code).not.toContain('__JF_SHELL_MANIFEST__');
        const manifest = manifestOf(code);
        expect(manifest.shell.some(f => /^runtime\.[0-9a-f]{16,}\.bundle\.js/.test(f))).toBe(true);
        expect(manifest.shell.some(f => /^main\.jellyfin\.[0-9a-f]{16,}\.bundle\.js/.test(f))).toBe(true);
        expect(manifest.shell.some(f => /^main\.jellyfin\..*\.css/.test(f))).toBe(true);
        expect(manifest.shell.some(f => f.endsWith('.woff2'))).toBe(true);
        expect(manifest.translations['en-us']).toBeTruthy();
        // The page writes "@" as %40; each file only once
        const files = manifest.shell.map(f => decodeURIComponent(f.split('?')[0]));
        expect(new Set(files).size).toBe(files.length);
        for (const file of files) expect(existsSync(resolve(DIST, file)), file).toBe(true);
    });

    it('names the bundles of the page by their content (no cache can serve an old one)', () => {
        const html = readFileSync(resolve(DIST, 'index.html'), 'utf8');
        const scripts = [ ...html.matchAll(/<script[^>]+src="([^"?]+)/g) ].map(m => m[1]);
        expect(scripts.length).toBeGreaterThan(0);
        for (const src of scripts) expect(src).toMatch(/\.[0-9a-f]{16,}\.bundle\.js$/);
    });

    it('is not loaded by the page', () => {
        expect(readFileSync(resolve(DIST, 'index.html'), 'utf8')).not.toContain('serviceworker');
    });
});
