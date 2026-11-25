// Utilidades de la auditoría. Variables: COSMIC_URL, COSMIC_USER, COSMIC_PASS, OUT (carpeta de capturas).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.COSMIC_URL || 'http://localhost:8096').replace(/\/$/, '');
const OUT = process.env.OUT || path.join('ux-review', 'salida', 'auditoria');
fs.mkdirSync(OUT, { recursive: true });

async function login(tag) {
    const auth = `MediaBrowser Client="Revision UX", Device="Playwright", DeviceId="audit-${tag}-${process.pid}", Version="1.0.0"`;
    const r = await fetch(BASE + '/Users/AuthenticateByName', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify({ Username: process.env.COSMIC_USER, Pw: process.env.COSMIC_PASS || '' }) });
    if (!r.ok) throw new Error('login ' + r.status);
    const a = await r.json();
    const info = await (await fetch(BASE + '/System/Info/Public')).json();
    return { token: a.AccessToken, userId: a.User.Id, serverId: info.Id, auth: auth + `, Token="${a.AccessToken}"` };
}

async function api(s, p) {
    const r = await fetch(BASE + p, { headers: { Authorization: s.auth } });
    return r.json();
}

const DISP = {
    movil: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
    escritorio: { viewport: { width: 1440, height: 900 } },
    tv: { viewport: { width: 1920, height: 1080 }, layout: 'tv' },
    tablet: { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true }
};

async function abrir(s, disp = 'escritorio', extra = {}) {
    const b = await chromium.launch();
    const { layout, ...o } = DISP[disp];
    const ctx = await b.newContext({ ...o, locale: 'es-MX', ...extra });
    const cred = JSON.stringify({ Servers: [{ Id: s.serverId, AccessToken: s.token, UserId: s.userId, ManualAddress: BASE, LastConnectionMode: 2, DateLastAccessed: Date.now() }] });
    await ctx.addInitScript(([c, l]) => { try { localStorage.setItem('jellyfin_credentials', c); if (l) localStorage.setItem('layout', l); } catch {} }, [cred, layout]);
    const page = await ctx.newPage();
    const log = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(m.type() + ': ' + m.text().slice(0, 200)); });
    page.on('pageerror', e => log.push('EXC: ' + e.message.slice(0, 200)));
    return { b, ctx, page, log };
}

async function foto(page, nombre) {
    const f = path.join(OUT, nombre + '.png');
    await page.screenshot({ path: f }).catch(() => {});
    return f;
}

module.exports = { BASE, OUT, login, api, abrir, foto, DISP };
