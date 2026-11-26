import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { login, BASE, OUT } = require('./comun.cjs');
import path from 'node:path';
const lighthouse = (await import('lighthouse')).default // npm i --no-save lighthouse;
import fs from 'node:fs';
const s = await login('lh');
fs.rmSync(path.join(OUT, 'perfil-lh'),{recursive:true,force:true});
const port = 9333;
const b = await chromium.launchPersistentContext(path.join(OUT, 'perfil-lh'), { args: [`--remote-debugging-port=${port}`] });
const p = b.pages()[0] || await b.newPage();
const cdp = await b.newCDPSession(p);
const cred = JSON.stringify({ Servers: [{ Id: s.serverId, AccessToken: s.token, UserId: s.userId, ManualAddress: BASE, LastConnectionMode: 2, DateLastAccessed: Date.now() }] });
await p.goto(BASE + '/web/index.html'); await p.evaluate(c => localStorage.setItem('jellyfin_credentials', c), cred);
const rutas = process.argv.slice(2);
const res = {};
for (const r of rutas) {
  for (const ff of ['mobile', 'desktop']) {
    const cfg = ff === 'desktop' ? (await import('lighthouse/core/config/desktop-config.js')).default : undefined;
    await cdp.send('Network.clearBrowserCache');
    const out = await lighthouse(BASE + '/web/#/' + r, { port, output: 'json', logLevel: 'error', disableStorageReset: true, onlyCategories: ['performance', 'accessibility', 'best-practices'] }, cfg);
    const l = out.lhr;
    const a = l.audits;
    res[`${r}:${ff}`] = {
      perf: Math.round(l.categories.performance.score * 100), a11y: Math.round(l.categories.accessibility.score * 100), bp: Math.round(l.categories['best-practices'].score * 100),
      FCP: a['first-contentful-paint'].displayValue, LCP: a['largest-contentful-paint'].displayValue, TBT: a['total-blocking-time'].displayValue, CLS: a['cumulative-layout-shift'].displayValue, SI: a['speed-index'].displayValue,
      peso: a['total-byte-weight'].displayValue, jsSinUsar: a['unused-javascript']?.displayValue, imgs: a['uses-responsive-images']?.displayValue, mainThread: a['mainthread-work-breakdown']?.displayValue, bootup: a['bootup-time']?.displayValue,
      pantallaFinal: (l.audits['final-screenshot']?.details?.data || '').length,
      urlFinal: l.finalDisplayedUrl,
      fallos: Object.values(a).filter(x => x.score !== null && x.score < 0.5 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'notApplicable').map(x => x.id + (x.displayValue ? ' (' + x.displayValue + ')' : '')).slice(0, 25)
    };
    const shot = l.audits['final-screenshot']?.details?.data; if (shot) fs.writeFileSync(`${OUT}/lh-${r.replace(/\W/g,'_')}-${ff}.jpg`, Buffer.from(shot.split(',')[1], 'base64'));
    fs.writeFileSync(`${OUT}/lh-${r.replace(/\W/g,'_')}-${ff}.json`, JSON.stringify(l.audits['network-requests']?.details?.items?.map(i=>({u:i.url.slice(0,120),kb:Math.round(i.transferSize/1024),t:i.resourceType})).sort((x,y)=>y.kb-x.kb).slice(0,25), null, 1));
    console.error('hecho', r, ff);
  }
}
console.log(JSON.stringify(res, null, 1));
await b.close();
