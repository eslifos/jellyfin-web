/**
 * Cosmic Dark — custom Jellyfin color scheme.
 *
 * Primary:    #00a4dc  (cyan-blue)
 * Secondary:  #aa5cc3  (violet)
 * Background: #080810  (deep dark navy)
 *
 * Registered in src/themes/index.ts and src/config.json.
 * Visual styles are defined in theme.scss alongside this file.
 */
import { buildCustomColorScheme } from 'themes/utils';

/** The "Cosmic Dark" color scheme. */
const theme = buildCustomColorScheme({
    palette: {
        background: {
            default: '#080810',
            paper: '#0d0e1e'
        },
        primary: {
            main: '#00a4dc',
            dark: '#0077b6',
            light: '#33b6e3'
        },
        secondary: {
            main: '#aa5cc3',
            dark: '#7b3f92',
            light: '#c47fd9'
        },
        AppBar: {
            defaultBg: '#0d0e1e'
        }
    }
});

export default theme;