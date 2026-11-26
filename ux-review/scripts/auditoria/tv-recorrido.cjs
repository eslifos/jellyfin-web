// Recorrido completo en modo TV usando solo el control remoto (flechas, Enter, Atrás).
// Guarda una captura por paso y un registro del foco: qué elemento, dónde está y si se ve.
// Uso: COSMIC_URL=... COSMIC_USER=... COSMIC_PASS=... node ux-review/scripts/auditoria/tv-recorrido.cjs
const fs = require('fs');
const path = require('path');
const { BASE, OUT, login, abrir, api } = require('./comun.cjs');

const DIR = path.join(OUT, 'tv');
fs.mkdirSync(DIR, { recursive: true });

(async () => {
    const s = await login('tvrec');
    const serie = (await api(s, `/Users/${s.userId}/Items?IncludeItemTypes=Series&Recursive=true&Limit=1&SortBy=DateCreated&SortOrder=Descending`)).Items[0];
    const { b, page, log } = await abrir(s, 'tv');
    const registro = [];
    let n = 0;

    const foco = () => page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body || e === document.documentElement) return { sinFoco: true };
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        const marca = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || cs.transform !== 'none'
            || /focus|selected|active/i.test(e.className);
        return {
            el: `${e.tagName.toLowerCase()}.${String(e.className).split(' ').filter(Boolean).slice(0, 2).join('.')}`,
            texto: (e.getAttribute('aria-label') || e.getAttribute('title') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40),
            x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
            fuera: r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth,
            sinMarca: !marca
        };
    });

    const tecla = async (k, etiqueta) => {
        await page.keyboard.press(k);
        await page.waitForTimeout(450);
        const f = await foco();
        n++;
        const nombre = `${String(n).padStart(3, '0')}-${etiqueta}-${k}`;
        await page.screenshot({ path: path.join(DIR, nombre + '.png') }).catch(() => {});
        registro.push({ n, pantalla: etiqueta, tecla: k, url: page.url().replace(BASE, ''), ...f });
    };
    const ir = async (ruta, etiqueta, espera = 9000) => {
        await page.goto(BASE + '/web/#/' + ruta);
        await page.waitForTimeout(espera);
        n++;
        await page.screenshot({ path: path.join(DIR, `${String(n).padStart(3, '0')}-${etiqueta}-inicio.png`) });
        registro.push({ n, pantalla: etiqueta, tecla: '(llega)', url: page.url().replace(BASE, ''), ...(await foco()) });
    };

    // 1. Inicio: bajar por todas las filas, moverse dentro de una, abrir el riel lateral y volver.
    await ir('home', 'inicio', 11000);
    for (let i = 0; i < 8; i++) await tecla('ArrowDown', 'inicio');
    for (let i = 0; i < 9; i++) await tecla('ArrowRight', 'inicio');
    for (let i = 0; i < 4; i++) await tecla('ArrowLeft', 'inicio');
    for (let i = 0; i < 10; i++) await tecla('ArrowUp', 'inicio');
    for (let i = 0; i < 3; i++) await tecla('ArrowLeft', 'inicio-riel');
    for (let i = 0; i < 4; i++) await tecla('ArrowDown', 'inicio-riel');
    await tecla('ArrowRight', 'inicio-riel');
    await tecla('Escape', 'inicio-atras');

    // 2. Biblioteca de películas: rejilla, letras, filtros.
    await ir('movies', 'peliculas');
    for (let i = 0; i < 5; i++) await tecla('ArrowDown', 'peliculas');
    for (let i = 0; i < 12; i++) await tecla('ArrowRight', 'peliculas');
    for (let i = 0; i < 7; i++) await tecla('ArrowUp', 'peliculas');
    await tecla('Enter', 'peliculas-abrir');
    await page.waitForTimeout(5000);

    // 3. Detalle de una película (lo que abrió Enter) y de una serie.
    for (let i = 0; i < 4; i++) await tecla('ArrowDown', 'detalle-pelicula');
    for (let i = 0; i < 3; i++) await tecla('ArrowRight', 'detalle-pelicula');
    await tecla('Escape', 'detalle-pelicula-atras');
    await ir(`details?id=${serie.Id}`, 'detalle-serie');
    for (let i = 0; i < 6; i++) await tecla('ArrowDown', 'detalle-serie');
    for (let i = 0; i < 4; i++) await tecla('ArrowRight', 'detalle-serie');
    for (let i = 0; i < 6; i++) await tecla('ArrowUp', 'detalle-serie');

    // 4. Búsqueda: llegar al campo y escribir.
    await ir('search', 'buscar', 7000);
    await tecla('ArrowDown', 'buscar');
    await page.keyboard.type('bat', { delay: 200 });
    await page.waitForTimeout(3000);
    for (let i = 0; i < 3; i++) await tecla('ArrowDown', 'buscar-resultados');
    for (let i = 0; i < 3; i++) await tecla('ArrowRight', 'buscar-resultados');

    // 5. Preferencias y Universos.
    await ir('mypreferencesmenu', 'preferencias', 6000);
    for (let i = 0; i < 6; i++) await tecla('ArrowDown', 'preferencias');
    await ir('universes', 'universos', 7000);
    for (let i = 0; i < 3; i++) await tecla('ArrowDown', 'universos');
    for (let i = 0; i < 3; i++) await tecla('ArrowRight', 'universos');
    await ir('livetv', 'tv-en-vivo', 7000);
    for (let i = 0; i < 3; i++) await tecla('ArrowDown', 'tv-en-vivo');

    fs.writeFileSync(path.join(DIR, 'foco.json'), JSON.stringify(registro, null, 1));
    // Resumen
    const por = {};
    for (const r of registro) {
        const p = por[r.pantalla.split('-')[0]] ||= { pasos: 0, sinFoco: 0, fuera: 0, sinMarca: 0, quieto: 0 };
        p.pasos++;
        if (r.sinFoco) p.sinFoco++;
        if (r.fuera) p.fuera++;
        if (r.sinMarca && !r.sinFoco) p.sinMarca++;
    }
    for (let i = 1; i < registro.length; i++) {
        const a = registro[i - 1], c = registro[i];
        if (c.tecla.startsWith('Arrow') && a.x === c.x && a.y === c.y && a.texto === c.texto && !c.sinFoco) por[c.pantalla.split('-')[0]].quieto++;
    }
    console.log('pantalla      pasos sinFoco fueraDePantalla sinMarcaVisible noSeMovio');
    for (const [k, v] of Object.entries(por)) console.log(k.padEnd(14), String(v.pasos).padStart(4), String(v.sinFoco).padStart(7), String(v.fuera).padStart(15), String(v.sinMarca).padStart(15), String(v.quieto).padStart(9));
    console.log('\nLOG', [...new Set(log)].filter(l => !/TUNNEL|dictionary is empty/.test(l)).slice(0, 10).join('\n'));
    await b.close();
})().catch(e => { console.error('FALLO', e); process.exit(1); });
