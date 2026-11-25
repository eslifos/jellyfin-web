/**
 * Writes into serviceworker.js the list of files that make up the app shell, so the service worker can keep them
 * on install and the app opens without connection (to watch downloads):
 *  - index.html and everything it loads (runtime, main.jellyfin, the initial node_modules.* bundles, the main CSS),
 *    with the exact URLs of the page (their ?hash included);
 *  - the themes, the Latin fonts and the icon font, with the chunks of the CSS that declares them;
 *  - the chunks of the downloads page, so it opens even if it was never visited online;
 *  - the translations, by language: the service worker keeps English and the languages of the device.
 * It also fails the build when serviceworker.js is not self-contained (a webpack chunk without its runtime never
 * registers its events).
 */
const { Compilation, sources, WebpackError } = require('webpack');

const PLUGIN = 'ShellManifestPlugin';
/** The string in src/serviceworker.js that becomes the list. */
const PLACEHOLDER = /(["'`])__JF_SHELL_MANIFEST__\1/;
const SW_FILE = 'serviceworker.js';
/** Noto Sans for Latin scripts, both weights the app uses; other scripts are loaded when a page needs them. */
const SHELL_FONTS = /(^|\/)(noto-sans-latin(-ext)?-(400|700)-normal|MaterialIcons-Regular)\.[0-9a-f]+\.woff2$/;
/** Modules of the downloads page and its player. */
const DOWNLOADS_MODULES = /[\\/]apps[\\/]modern[\\/](routes[\\/]downloads|features[\\/]downloads)[\\/.]/;
/** Translation chunks: "es-mx-json.<hash>.chunk.js". */
const TRANSLATION = /^(.+)-json\.[0-9a-f]+\.chunk\.js$/;

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]+)"`))?.[1];

/** The scripts and styles index.html loads, as written in the page. */
const pageFiles = html => [ ...html.matchAll(/<(script|link)\b[^>]*>/g) ]
    .map(([ tag, kind ]) => (kind === 'script' ? attr(tag, 'src') : attr(tag, 'rel') === 'stylesheet' && attr(tag, 'href')))
    .filter(url => url && !/^(https?:)?\/\//.test(url));

/**
 * All the files of the chunk groups that hold a chunk passing the test (siblings load together). Only the groups
 * loaded later: the initial ones are already in index.html, with its URLs.
 */
const groupFiles = (compilation, test, withChildren = false) => {
    const files = new Set();
    const seen = new Set();
    const add = group => {
        if (seen.has(group)) return;
        seen.add(group);
        for (const chunk of group.chunks) {
            if (chunk.canBeInitial()) continue;
            for (const file of chunk.files) files.add(file);
        }
        // What those chunks load later on their own
        if (withChildren) for (const child of group.childrenIterable) add(child);
    };
    for (const group of compilation.chunkGroups) {
        if (!group.isInitial() && group.chunks.some(test)) add(group);
    }
    return files;
};

const moduleResource = module => module.resource ?? module.rootModule?.resource ?? '';

/** A chunk with a CSS file that declares one of the fonts. */
const declaresFont = (assets, fonts) => chunk => [ ...chunk.files ]
    .filter(file => file.endsWith('.css'))
    .some(file => {
        const css = assets[file]?.source().toString() ?? '';
        return fonts.some(font => css.includes(font));
    });

/** A chunk with code of the downloads page. */
const holdsDownloads = chunkGraph => chunk => [ ...chunkGraph.getChunkModulesIterable(chunk) ]
    .some(module => DOWNLOADS_MODULES.test(moduleResource(module)));

/** Translation chunk of each language, by normalized code ("es_419" → "es-419"). */
const translationsOf = assets => {
    const translations = {};
    for (const name of Object.keys(assets)) {
        const lang = TRANSLATION.exec(name)?.[1];
        if (lang) translations[lang.toLowerCase().replace(/_/g, '-')] = name;
    }
    return translations;
};

const buildManifest = (compilation, assets) => {
    const html = assets['index.html']?.source().toString() ?? '';
    const page = pageFiles(html);
    const shell = new Set(page);
    for (const name of Object.keys(assets)) {
        if (/^themes\/[^/]+\/theme\.css$/.test(name) || SHELL_FONTS.test(name)) shell.add(name);
    }
    // The CSS chunks that declare those fonts, with their JS part
    const fonts = [ ...shell ].filter(name => SHELL_FONTS.test(name)).map(name => name.split('/').pop());
    for (const file of groupFiles(compilation, declaresFont(assets, fonts))) shell.add(file);
    // The downloads page, with what it loads later
    for (const file of groupFiles(compilation, holdsDownloads(compilation.chunkGraph), true)) shell.add(file);

    return {
        // Kept with the page URL (?hash): a new build asks for new URLs
        shell: [ ...shell ].filter(name => !name.endsWith('.map') && name !== SW_FILE).sort((a, b) => a.localeCompare(b)),
        translations: translationsOf(assets),
        // index.html appends this to every file it loads
        buildQuery: page.map(file => file.split('?')[1]).find(Boolean) ?? ''
    };
};

const fillWorker = (compilation, assets) => {
    const worker = assets[SW_FILE];
    if (!worker) return;
    const code = worker.source().toString();

    if (code.includes('webpackChunk')) {
        compilation.errors.push(new WebpackError(`${PLUGIN}: ${SW_FILE} is a webpack chunk, not a self-contained script: its events would never be registered`));
        return;
    }
    if (!PLACEHOLDER.test(code)) {
        compilation.errors.push(new WebpackError(`${PLUGIN}: ${SW_FILE} has no __JF_SHELL_MANIFEST__ to fill`));
        return;
    }
    const manifest = buildManifest(compilation, assets);
    compilation.updateAsset(SW_FILE, new sources.RawSource(code.replace(PLACEHOLDER, JSON.stringify(JSON.stringify(manifest)))));
};

class ShellManifestPlugin {
    apply(compiler) {
        compiler.hooks.thisCompilation.tap(PLUGIN, compilation => {
            compilation.hooks.processAssets.tap({
                name: PLUGIN,
                // After the real content hashes are written into index.html
                stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER
            }, assets => fillWorker(compilation, assets));
        });
    }
}

module.exports = ShellManifestPlugin;
