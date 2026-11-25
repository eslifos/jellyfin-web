const { merge } = require('webpack-merge');

const common = require('./webpack.common');
const ShellManifestPlugin = require('./scripts/shellManifestPlugin');

module.exports = merge(common, {
    mode: 'production',
    entry: {
        ...common.entry,
        'serviceworker': './serviceworker.js'
    },
    plugins: [
        // The files the service worker keeps so the app opens without connection
        new ShellManifestPlugin()
    ]
});
