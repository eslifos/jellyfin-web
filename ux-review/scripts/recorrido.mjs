#!/usr/bin/env node
/**
 * Recorrido de Jellyfin Cosmic como usuario final.
 *
 * Entra con un usuario real, visita cada pantalla en móvil, tablet, escritorio y TV,
 * guarda capturas y anota problemas que se pueden medir (errores, imágenes rotas,
 * botones sin nombre, botones muy pequeños, scroll horizontal, pantallas lentas).
 *
 * Uso:
 *   COSMIC_URL=http://localhost:8096 COSMIC_USER=admin COSMIC_PASS=secreto \
 *     node ux-review/scripts/recorrido.mjs [--solo movil,escritorio] [--rutas home,movies]
 *
 * Salida: ux-review/salida/<fecha-hora>/ con capturas/ y hallazgos.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Playwright puede estar instalado en el proyecto o de forma global (npm i -g playwright).
const require = createRequire(import.meta.url);
let chromium;
try {
    ({ chromium } = require('playwright'));
} catch {
    console.error('Falta Playwright. Instálalo con: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
}

const BASE = (process.env.COSMIC_URL || 'http://localhost:8096').replace(/\/$/, '');
const USER = process.env.COSMIC_USER || '';
const PASS = process.env.COSMIC_PASS || '';
const args = process.argv.slice(2);
const opt = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1]?.split(',') : null;
};

const DISPOSITIVOS = {
    movil: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    tablet: { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
    escritorio: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    tv: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, layout: 'tv' }
};

// Pantallas que ve un usuario normal y las de administración.
const RUTAS_USUARIO = [
    'home', 'search', 'movies', 'tv', 'music', 'books', 'musicvideos', 'homevideos', 'boxsets', 'playlists',
    'livetv', 'upcoming', 'universes', 'downloads', 'mypreferencesmenu', 'mypreferencesdisplay',
    'mypreferenceshome', 'mypreferencesplayback', 'mypreferencessubtitles', 'mypreferencescontrols',
    'mypreferencesdownloads', 'userprofile', 'profiles'
];
const RUTAS_ADMIN = [
    'dashboard', 'dashboard/settings', 'dashboard/branding', 'dashboard/users', 'dashboard/libraries',
    'dashboard/libraries/display', 'dashboard/libraries/metadata', 'dashboard/libraries/nfo',
    'dashboard/libraries/health', 'dashboard/libraries/top10', 'dashboard/libraries/episodeorder',
    'dashboard/playback/transcoding', 'dashboard/playback/resume', 'dashboard/playback/streaming',
    'dashboard/playback/trickplay', 'dashboard/devices', 'dashboard/activity', 'dashboard/networking',
    'dashboard/plugins', 'dashboard/plugins/catalog', 'dashboard/tasks', 'dashboard/logs', 'dashboard/backups',
    'dashboard/keys', 'dashboard/stats', 'dashboard/livetv'
];

const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SALIDA = process.env.COSMIC_SALIDA || path.join('ux-review', 'salida', sello);
fs.mkdirSync(path.join(SALIDA, 'capturas'), { recursive: true });

// Cada recorrido usa su propio dispositivo: si dos recorridos comparten DeviceId,
// el servidor cierra la sesión del primero al entrar el segundo.
const DEVICE_ID = `revision-ux-${(opt('solo') || ['todo']).join('-')}-${process.pid}`;
const AUTH = `MediaBrowser Client="Revision UX", Device="Playwright", DeviceId="${DEVICE_ID}", Version="1.0.0"`;

async function api(p, init = {}, token) {
    const headers = { 'Content-Type': 'application/json', Authorization: AUTH + (token ? `, Token="${token}"` : '') };
    const r = await fetch(BASE + p, { ...init, headers: { ...headers, ...init.headers } });
    if (!r.ok) throw new Error(`${p} → ${r.status}`);
    return r.status === 204 ? null : r.json();
}

async function iniciarSesion() {
    if (!USER) throw new Error('Falta COSMIC_USER (y COSMIC_PASS si tiene contraseña).');
    const info = await api('/System/Info/Public');
    const auth = await api('/Users/AuthenticateByName', { method: 'POST', body: JSON.stringify({ Username: USER, Pw: PASS }) });
    return { serverId: info.Id, token: auth.AccessToken, userId: auth.User.Id, esAdmin: !!auth.User.Policy?.IsAdministrator };
}

// Busca elementos reales para abrir páginas de detalle (película, serie, álbum, persona).
async function rutasDeDetalle({ token, userId }) {
    const rutas = [];
    const tipos = [['Movie', 'pelicula'], ['Series', 'serie'], ['Episode', 'episodio'], ['MusicAlbum', 'album'], ['Book', 'libro'], ['BoxSet', 'coleccion']];
    for (const [tipo, nombre] of tipos) {
        try {
            const r = await api(`/Users/${userId}/Items?IncludeItemTypes=${tipo}&Recursive=true&Limit=1&SortBy=Random`, {}, token);
            const it = r.Items?.[0];
            if (it) rutas.push({ ruta: `details?id=${it.Id}&serverId=${it.ServerId}`, nombre: `detalle-${nombre}` });
        } catch { /* tipo sin contenido */ }
    }
    return rutas;
}

// Comprobaciones que se ejecutan dentro de la página.
function revisarPagina(esMovil) {
    const out = [];
    const nombre = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.getAttribute('alt') || '').trim();
    const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const desc = (el) => {
        const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        return `${el.tagName.toLowerCase()}${cls}`;
    };

    const doc = document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 2) {
        out.push({ tipo: 'scroll-horizontal', detalle: `La página mide ${doc.scrollWidth}px de ancho en una pantalla de ${window.innerWidth}px` });
    }
    document.querySelectorAll('img').forEach((img) => {
        if (!visible(img)) return;
        if (img.complete && img.naturalWidth === 0 && img.src) out.push({ tipo: 'imagen-rota', detalle: img.src.slice(0, 160) });
        if (!img.hasAttribute('alt')) out.push({ tipo: 'imagen-sin-alt', detalle: desc(img) });
    });
    const clicables = document.querySelectorAll('button, a[href], [role=button], [onclick], .MuiIconButton-root, .paper-icon-button-light');
    clicables.forEach((el) => {
        if (!visible(el)) return;
        if (!nombre(el)) out.push({ tipo: 'boton-sin-nombre', detalle: desc(el) });
        const r = el.getBoundingClientRect();
        if (esMovil && (r.width < 40 || r.height < 40) && r.width > 0) {
            out.push({ tipo: 'boton-pequeno', detalle: `${desc(el)} "${nombre(el).slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}px` });
        }
    });
    // Elementos que responden al clic pero no al teclado ni al control remoto.
    document.querySelectorAll('div, span, li, img').forEach((el) => {
        if (!visible(el)) return;
        if (getComputedStyle(el).cursor === 'pointer' && el.tabIndex < 0 && !el.closest('button, a, [role=button], [tabindex]')) {
            out.push({ tipo: 'clic-sin-teclado', detalle: `${desc(el)} "${nombre(el).slice(0, 30)}"` });
        }
    });
    // Textos en inglés o claves sin traducir que se ven en pantalla.
    const texto = document.body.innerText;
    const claves = texto.match(/\b(Label|Header|Button|Option|Message|Nav|Section)[A-Z][A-Za-z]+\b/g);
    if (claves) out.push({ tipo: 'clave-sin-traducir', detalle: [...new Set(claves)].slice(0, 10).join(', ') });
    if (/\bundefined\b|\bNaN\b|\[object Object\]|\{\{/.test(texto)) {
        out.push({ tipo: 'texto-roto', detalle: (texto.match(/.{0,40}(undefined|NaN|\[object Object\]|\{\{).{0,40}/) || [''])[0] });
    }
    // Quitar duplicados.
    const vistos = new Set();
    return out.filter((h) => {
        const k = h.tipo + h.detalle;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
    });
}

async function main() {
    const sesion = await iniciarSesion();
    const detalles = await rutasDeDetalle(sesion);
    const soloRutas = opt('rutas');
    let rutas = [...RUTAS_USUARIO.map((r) => ({ ruta: r, nombre: r })), ...detalles];
    if (sesion.esAdmin) rutas.push(...RUTAS_ADMIN.map((r) => ({ ruta: r, nombre: r.replace(/\//g, '_') })));
    if (soloRutas) rutas = rutas.filter((r) => soloRutas.some((s) => r.nombre.startsWith(s)));
    const dispositivos = Object.entries(DISPOSITIVOS).filter(([k]) => !opt('solo') || opt('solo').includes(k));

    const credenciales = JSON.stringify({
        Servers: [{ Id: sesion.serverId, AccessToken: sesion.token, UserId: sesion.userId, ManualAddress: BASE, LocalAddress: BASE, LastConnectionMode: 2, DateLastAccessed: Date.now() }]
    });

    const browser = await chromium.launch();
    const resultado = { url: BASE, fecha: new Date().toISOString(), usuario: USER, esAdmin: sesion.esAdmin, pantallas: [] };

    for (const [disp, conf] of dispositivos) {
        const { layout, ...ctxOpts } = conf;
        const ctx = await browser.newContext({ ...ctxOpts, locale: 'es-MX', colorScheme: 'dark' });
        await ctx.addInitScript(([cred, lay]) => {
            try {
                localStorage.setItem('jellyfin_credentials', cred);
                if (lay) localStorage.setItem('layout', lay);
            } catch { /* sin storage */ }
        }, [credenciales, layout]);

        for (const { ruta, nombre } of rutas) {
            const page = await ctx.newPage();
            const errores = [];
            const fallos = [];
            page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
            page.on('pageerror', (e) => errores.push('Excepción: ' + e.message.slice(0, 300)));
            page.on('response', (r) => { if (r.status() >= 400) fallos.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 160)}`); });

            const t0 = Date.now();
            let cargo = true;
            try {
                await page.goto(`${BASE}/web/#/${ruta}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                await page.waitForTimeout(800); // animaciones de entrada
            } catch (e) {
                cargo = false;
                errores.push('No cargó: ' + e.message.slice(0, 200));
            }
            const ms = Date.now() - t0;
            const archivo = `${disp}__${nombre.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60)}.png`;
            // Primera pantalla (lo que ve el usuario al entrar) y página completa.
            await page.screenshot({ path: path.join(SALIDA, 'capturas', archivo.replace('.png', '__vista.png')) }).catch(() => {});
            await page.screenshot({ path: path.join(SALIDA, 'capturas', archivo), fullPage: true }).catch(() => {});
            const hallazgos = cargo ? await page.evaluate(revisarPagina, !!conf.isMobile).catch((e) => [{ tipo: 'error-revision', detalle: e.message }]) : [];
            if (ms > 6000) hallazgos.push({ tipo: 'pantalla-lenta', detalle: `Tardó ${(ms / 1000).toFixed(1)} s en quedar lista` });
            const enLogin = page.url().includes('login') || await page.locator('input[type=password]:visible').count().catch(() => 0) > 0;
            if (enLogin && !/login|password|userprofile/.test(ruta)) hallazgos.push({ tipo: 'sesion-perdida', detalle: 'Mandó al inicio de sesión' });

            resultado.pantallas.push({ dispositivo: disp, ruta, captura: `capturas/${archivo}`, ms, errores: [...new Set(errores)], fallosRed: [...new Set(fallos)], hallazgos });
            process.stdout.write(`${disp.padEnd(10)} ${nombre.padEnd(40)} ${hallazgos.length} hallazgos, ${errores.length} errores\n`);
            await page.close();
        }
        await ctx.close();
    }
    await browser.close();

    fs.writeFileSync(path.join(SALIDA, 'hallazgos.json'), JSON.stringify(resultado, null, 2));
    const total = resultado.pantallas.reduce((n, p) => n + p.hallazgos.length + p.errores.length, 0);
    console.log(`\nListo: ${resultado.pantallas.length} capturas, ${total} avisos → ${SALIDA}`);
}

main().catch((e) => {
    console.error('El recorrido falló:', e.message);
    process.exit(1);
});
