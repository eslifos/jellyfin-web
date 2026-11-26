// Qué ve el usuario cuando falla la red o el servidor.
const { BASE, login, abrir, foto } = require('./comun.cjs');
const esApi = (u) => u.startsWith(BASE) && !u.includes('/web/');
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const texto = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)).catch(() => '');

(async () => {
    const s = await login('red');
    const disp = process.argv[2] || 'movil';
    const res = {};

    // 1. Se cae el wifi a mitad de uso.
    {
        const { b, ctx, page, log } = await abrir(s, disp);
        await page.goto(BASE + '/web/#/home'); await page.waitForTimeout(9000);
        await ctx.setOffline(true);
        await page.evaluate(() => { location.hash = '#/movies'; }); await page.waitForTimeout(4000);
        await foto(page, `${disp}-offline-navegar-4s`);
        res.offlineNavegar = await texto(page);
        await page.waitForTimeout(12000);
        await foto(page, `${disp}-offline-navegar-16s`);
        // intentar abrir algo
        await page.locator('.card, a[href*="details"]').first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(3000);
        await foto(page, `${disp}-offline-clic`);
        res.offlineClic = await texto(page);
        await ctx.setOffline(false); await page.waitForTimeout(10000);
        await foto(page, `${disp}-offline-recupera`);
        res.recupera = await texto(page);
        res.logOffline = [...new Set(log)].slice(0, 15);
        await b.close();
    }
    // 2. Abrir la app sin conexión (app ya instalada / service worker).
    {
        const { b, ctx, page } = await abrir(s, disp);
        await page.goto(BASE + '/web/#/home'); await page.waitForTimeout(8000);
        await ctx.setOffline(true);
        await page.reload().catch(e => { res.recargaOffline = 'falló: ' + e.message.slice(0, 80); });
        await page.waitForTimeout(6000);
        await foto(page, `${disp}-offline-recarga`);
        res.recargaOfflineTexto = await texto(page);
        await b.close();
    }
    // 3. El servidor responde con error 500 / 502.
    {
        const { b, ctx, page, log } = await abrir(s, disp);
        await ctx.route(u => esApi(u.toString()) && !u.toString().includes('/System/Info/Public'), r => r.fulfill({ status: 502, body: 'Bad Gateway' }));
        await page.goto(BASE + '/web/#/home'); await page.waitForTimeout(12000);
        await foto(page, `${disp}-servidor-502`);
        res.servidor502 = await texto(page);
        res.log502 = [...new Set(log)].slice(0, 8);
        await b.close();
    }
    // 4. El servidor está apagado por completo (no responde).
    {
        const { b, ctx, page } = await abrir(s, disp);
        await page.goto(BASE + '/web/#/home'); await page.waitForTimeout(6000);
        await ctx.route(u => esApi(u.toString()), r => r.abort('connectionrefused'));
        await page.evaluate(() => { location.hash = '#/tv'; }); await page.waitForTimeout(10000);
        await foto(page, `${disp}-servidor-apagado`);
        res.servidorApagado = await texto(page);
        await b.close();
    }
    // 5. Sesión vencida o revocada (401).
    {
        const { b, ctx, page } = await abrir(s, disp);
        await page.goto(BASE + '/web/#/home'); await page.waitForTimeout(7000);
        await ctx.route(u => esApi(u.toString()) && !u.toString().includes('/System/Info/Public'), r => r.fulfill({ status: 401, body: '' }));
        await page.evaluate(() => { location.hash = '#/movies'; }); await page.waitForTimeout(8000);
        await foto(page, `${disp}-sesion-401`);
        res.sesion401 = { url: page.url(), texto: await texto(page) };
        await b.close();
    }
    // 6. Red lenta (3G) desde cero.
    {
        const { b, ctx, page } = await abrir(s, disp);
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
        let bytes = 0, reqs = 0;
        page.on('response', async r => { reqs++; const l = Number(r.headers()['content-length'] || 0); bytes += l; });
        const t0 = Date.now();
        await page.goto(BASE + '/web/#/home', { timeout: 120000 }).catch(() => {});
        for (const t of [3, 8, 15, 30]) {
            await espera(Math.max(0, t * 1000 - (Date.now() - t0)));
            await foto(page, `${disp}-3g-${t}s`);
        }
        res.lenta = { reqs, mb: (bytes / 1048576).toFixed(1), textoA30s: await texto(page) };
        await b.close();
    }
    console.log(JSON.stringify(res, null, 1));
})().catch(e => { console.error('FALLO', e); process.exit(1); });
