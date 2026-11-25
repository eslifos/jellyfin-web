const fs = require('fs');
const { BASE, login, abrir, api } = require('./comun.cjs');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8') // npm i --no-save axe-core;
(async () => {
  const s = await login('axe');
  const it = (await api(s, `/Users/${s.userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=1&SortBy=DateCreated&SortOrder=Descending`)).Items[0];
  const se = (await api(s, `/Users/${s.userId}/Items?IncludeItemTypes=Series&Recursive=true&Limit=1&SortBy=DateCreated&SortOrder=Descending`)).Items[0];
  const rutas = ['home', 'movies', `details?id=${it.Id}`, `details?id=${se.Id}`, 'search', 'mypreferencesmenu', 'dashboard', 'dashboard/users', 'dashboard/libraries', 'upcoming', 'universes'];
  const total = {};
  for (const disp of ['movil', 'escritorio']) {
    const { b, page } = await abrir(s, disp);
    for (const r of rutas) {
      await page.goto(BASE + '/web/#/' + r); await page.waitForTimeout(7000);
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ej: v.nodes.slice(0, 2).map(n => n.target.join(' ').slice(0, 80) + ' :: ' + (n.failureSummary || '').split('\n')[1]?.slice(0, 110)) })));
      for (const v of res) { const k = v.id; total[k] = total[k] || { impact: v.impact, n: 0, rutas: new Set(), ej: v.ej }; total[k].n += v.n; total[k].rutas.add(disp[0] + ':' + r.slice(0, 18)); }
    }
    await b.close();
  }
  // Pantalla de inicio de sesión sin credenciales
  const { chromium } = require('playwright'); const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto(BASE + '/web/#/login'); await p.waitForTimeout(6000); await p.addScriptTag({ content: AXE });
  const lr = await p.evaluate(async () => (await axe.run()).violations.map(v => v.id + ' x' + v.nodes.length + ' ' + v.nodes[0].target.join(' ').slice(0, 60)));
   await b.close();
  for (const [k, v] of Object.entries(total).sort((a, b) => b[1].n - a[1].n)) console.log(`${v.impact.padEnd(9)} ${k.padEnd(28)} ${String(v.n).padStart(5)} nodos  ${[...v.rutas].slice(0, 6).join(', ')}\n          ej: ${v.ej.join(' || ')}`);
  console.log('\nLOGIN:', lr.join(' | '));
})();
