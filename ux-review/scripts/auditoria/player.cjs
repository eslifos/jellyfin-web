const { BASE, login, abrir, foto, api } = require('./comun.cjs');
(async () => {
  const s = await login('player');
  const disp = process.argv[2] || 'escritorio';
  const it = (await api(s, `/Users/${s.userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=1&SortBy=CommunityRating&SortOrder=Descending&HasSubtitles=true&Fields=MediaStreams`)).Items[0];
  console.log('película:', it.Name);
  const { b, page, log } = await abrir(s, disp);
  const reqs = []; page.on('request', r => { const u = r.url(); if (/PlaybackInfo|master\.m3u8|stream|Videos\//.test(u)) reqs.push(u.replace(BASE, '').slice(0, 150)); });
  await page.goto(BASE + `/web/#/details?id=${it.Id}`); await page.waitForTimeout(8000);
  const t0 = Date.now();
  await page.locator('button:has-text("Reproducir"), .btnPlay, [title="Reproducir"], [aria-label="Reproducir"]').first().click();
  let arranco = 0;
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); const t = await page.evaluate(() => { const v = document.querySelector('video'); return v ? v.currentTime : -1; }); if (t > 0.3) { arranco = Date.now() - t0; break; } }
  console.log('arranque (s):', arranco ? (arranco / 1000).toFixed(1) : 'NO ARRANCÓ en 30 s');
  await foto(page, `${disp}-player-1`);
  console.log('texto en pantalla:', await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)));
  await page.mouse.move(700, 500); await page.waitForTimeout(800); await foto(page, `${disp}-player-osd`);
  const botones = await page.evaluate(() => [...document.querySelectorAll('button')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.getAttribute('aria-label') || e.title || e.innerText.trim() || '?').slice(0, 40));
  console.log('botones OSD:', botones.join(' | '));
  for (const [sel, n] of [['[aria-label*="ubt" i], [title*="ubt" i]', 'subtitulos'], ['[aria-label*="udio" i], [title*="udio" i]', 'audio'], ['[aria-label*="onfig" i], [title*="onfig" i], [aria-label*="alidad" i]', 'ajustes']]) {
    const l = page.locator(sel).first(); if (await l.count()) { await l.click().catch(()=>{}); await page.waitForTimeout(1200); await foto(page, `${disp}-player-${n}`); console.log(n + ':', await page.evaluate(() => { const m = document.querySelector('[role=menu], .actionSheet, .MuiPopover-paper, [role=dialog]'); return m ? m.innerText.replace(/\s+/g, ' ').slice(0, 200) : '(nada)'; })); await page.keyboard.press('Escape'); await page.waitForTimeout(600); } else console.log(n + ': botón no encontrado');
  }
  // Atajos
  const tAntes = await page.evaluate(() => document.querySelector('video')?.currentTime);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500);
  console.log('→ avanza:', tAntes, '→', await page.evaluate(() => document.querySelector('video')?.currentTime));
  await page.keyboard.press('Space'); await page.waitForTimeout(800); console.log('espacio pausa:', await page.evaluate(() => document.querySelector('video')?.paused));
  await page.keyboard.press('?'); await page.waitForTimeout(800); await foto(page, `${disp}-player-ayuda`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(1500); console.log('Escape → url:', page.url().replace(BASE, ''));
  await page.goBack().catch(()=>{}); await page.waitForTimeout(2000); console.log('Atrás → url:', page.url().replace(BASE, ''));
  console.log('peticiones:', reqs.slice(0, 5).join('\n  '));
  console.log('LOG', [...new Set(log)].filter(l => !/TUNNEL|dictionary is empty/.test(l)).slice(0, 8).join('\n'));
  await b.close();
})();
