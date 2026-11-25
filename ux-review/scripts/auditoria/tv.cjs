// Navegación con control remoto (flechas + Enter + Atrás) en modo TV.
const { BASE, login, abrir, foto } = require('./comun.cjs');
(async () => {
  const s = await login('tv');
  const { b, page } = await abrir(s, 'tv');
  const foco = () => page.evaluate(() => {
    const e = document.activeElement; if (!e || e === document.body) return 'BODY (sin foco)';
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    const visible = cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' || cs.boxShadow !== 'none' || cs.transform !== 'none' || e.classList.contains('focused') || e.matches(':focus-visible');
    return `${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0,2).join('.')} "${(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,30)}" @${Math.round(r.x)},${Math.round(r.y)} ${r.width?'':'(INVISIBLE)'} ${r.y>1080||r.y<0?'(FUERA DE PANTALLA)':''}`;
  });
  await page.goto(BASE + '/web/#/home'); await page.waitForTimeout(10000);
  console.log('inicio:', await foco());
  const pasos = [['ArrowDown',4],['ArrowRight',5],['ArrowUp',8],['ArrowLeft',3]];
  let i=0;
  for (const [k,n] of pasos) for (let j=0;j<n;j++) { await page.keyboard.press(k); await page.waitForTimeout(400); const f=await foco(); console.log(`${k}:`, f); if (++i%6==0) await foto(page,'tv-paso-'+i); }
  await page.keyboard.press('Enter'); await page.waitForTimeout(5000); await foto(page,'tv-enter'); console.log('tras Enter URL:', page.url().replace(BASE,''), '|', await foco());
  await page.keyboard.press('Backspace'); await page.waitForTimeout(4000); console.log('tras Atrás URL:', page.url().replace(BASE,''), '|', await foco());
  await page.keyboard.press('Escape'); await page.waitForTimeout(2000); console.log('tras Escape URL:', page.url().replace(BASE,''));
  // Biblioteca en TV
  await page.goto(BASE + '/web/#/movies'); await page.waitForTimeout(9000);
  console.log('peliculas inicio:', await foco());
  for (let j=0;j<6;j++){ await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400);} console.log('peliculas 6xAbajo:', await foco()); await foto(page,'tv-peliculas-abajo');
  await b.close();
})();
