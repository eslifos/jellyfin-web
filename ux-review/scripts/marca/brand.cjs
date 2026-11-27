// Jellyfin Cosmic: renders every image of the brand from one design (the mark: the triangle with an orbit and stars)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const OUT = process.argv[2];

const TRI = 'm512 284.789466c-57.344 0-241.850182 334.568734-213.736727 391.074914 28.113454 56.50618 399.639277 55.85454 427.473457 0 27.83418-55.85455-156.39273-391.074914-213.73673-391.074914zm140.10182 342.109094c-18.24582 36.58473-261.67855 37.05018-280.11055 0-18.431997-37.05018 102.49309-256.27928 140.00873-256.27928s158.34764 219.60146 140.10182 256.27928zm-140.10182-176.128c-18.99055 0-80.24436 111.05745-70.93527 129.76873 9.30909 18.71127 132.65454 18.52509 141.87054 0s-51.85163-129.76873-70.93527-129.76873z';
const star = (x, y, r) => {
    const k = r * 0.12;
    return `M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}`
        + `C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z`;
};
const ORBIT = { cx: 512, cy: 540, rx: 360, ry: 92, rot: -16 };
const STARS = [ [ 800, 270, 62 ], [ 236, 330, 30 ], [ 860, 470, 20 ] ];

/** The mark in a 1024 box; `mono` paints everything in one color (splash, notification). */
const mark = (mono) => {
    const triFill = mono ?? 'url(#cg)';
    const orbit = mono ?? 'url(#co)';
    const starFill = mono ?? '#ffffff';
    const { cx, cy, rx, ry, rot } = ORBIT;
    return `<g transform="rotate(${rot} ${cx} ${cy})"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${orbit}" stroke-width="20" opacity="${mono ? 1 : 0.55}"/></g>`
        + `<path d="${TRI}" fill="${triFill}"/>`
        + `<g transform="rotate(${rot} ${cx} ${cy})"><path d="M${cx - rx} ${cy}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}" fill="none" stroke="${orbit}" stroke-width="20" stroke-linecap="round"/></g>`
        + STARS.map(([ x, y, r ]) => `<path d="${star(x, y, r)}" fill="${starFill}"/>`).join('');
};

const DEFS = '<defs>'
    + '<linearGradient id="cg" x1="298" y1="285" x2="752" y2="720" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#AA5CC3"/><stop offset="1" stop-color="#00A4DC"/></linearGradient>'
    + '<linearGradient id="co" x1="150" y1="0" x2="880" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7FD8FF"/><stop offset="0.5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#C48CF0"/></linearGradient>'
    + '<radialGradient id="bg" cx="0.32" cy="0.25" r="0.95"><stop offset="0" stop-color="#2B1C63"/><stop offset="0.55" stop-color="#0C1236"/><stop offset="1" stop-color="#050816"/></radialGradient>'
    + '</defs>';
const DUST = [ [ 150, 160, 5 ], [ 880, 150, 4 ], [ 120, 760, 4 ], [ 900, 820, 5 ], [ 330, 880, 3 ], [ 700, 120, 3 ] ]
    .map(([ x, y, r ]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.7"/>`).join('');

/** The mark alone, transparent. */
const markSvg = (mono) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${DEFS}${mark(mono)}</svg>`;

/** The app icon: the mark on deep space; `shape` rounded, circle or square. */
const iconSvg = (shape = 'rounded') => {
    let clip = '<rect width="1024" height="1024" rx="224"/>';
    if (shape === 'circle') clip = '<circle cx="512" cy="512" r="512"/>';
    if (shape === 'square') clip = '<rect width="1024" height="1024"/>';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${DEFS}<clipPath id="clip">${clip}</clipPath>`
        + `<g clip-path="url(#clip)"><rect width="1024" height="1024" fill="url(#bg)"/>${DUST}`
        + `<g transform="translate(512 512) scale(0.84) translate(-512 -520)">${mark()}</g></g></svg>`;
};

/** The word mark: the mark, then "Jellyfin" small over "Cosmic" big. */
const word = (w, h, light) => {
    const small = light ? 'rgba(255,255,255,0.82)' : '#3a4257';
    const big = light ? 'linear-gradient(100deg,#ffffff 0%,#7fd8ff 45%,#c48cf0 100%)' : 'linear-gradient(100deg,#0b7fc0 0%,#7b3fa0 100%)';
    return `<div id="b" style="width:${w}px;height:${h}px;display:flex;align-items:center;gap:${h * 0.06}px;font-family:'Segoe UI','Noto Sans',sans-serif">`
        // The mark cut to its drawing (orbit and stars), so it is as big as the words
        + `<div style="width:${h * 1.25}px;height:${h * 0.9}px;flex:0 0 auto">${markSvg().replace('viewBox="0 0 1024 1024"', 'viewBox="130 200 770 560"').replace('<svg ', '<svg width="100%" height="100%" ')}</div>`
        + '<div style="display:flex;flex-direction:column;line-height:1">'
        + `<span style="font-size:${h * 0.2}px;font-weight:600;color:${small};margin-left:${h * 0.02}px">Jellyfin</span>`
        + `<span style="font-size:${h * 0.46}px;font-weight:800;letter-spacing:-0.01em;background:${big};-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:${h * 0.04}px">Cosmic</span>`
        + '</div></div>';
};
const page = (body) => `<html><body style="margin:0;background:transparent">${body}</body></html>`;

/** The TV banner: deep space, the word mark centered. */
const tvBanner = (w, h) => {
    const dots = [ [ 30, 20 ], [ 290, 30 ], [ 270, 150 ], [ 60, 160 ], [ 180, 15 ], [ 150, 170 ] ]
        .map(([ x, y ]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="#fff" opacity="0.7"/>`).join('');
    return `<div id="b" style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:radial-gradient(ellipse at 20% 30%,#1d3a63 0%,#0c1236 45%,#2a1648 100%)">`
        + `<svg viewBox="0 0 320 180" style="position:absolute;inset:0;width:100%;height:100%">${dots}</svg>`
        + `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${word(w * 0.97, h * 0.58, true).replace('id="b"', '')}</div></div>`;
};

const svgBox = (svg, size) => `<div id="b" style="width:${size}px;height:${size}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>`;

/** PNG files into one ICO (PNG entries; Windows Vista and newer). */
const ico = (pngs) => {
    const head = Buffer.alloc(6 + 16 * pngs.length);
    head.writeUInt16LE(0, 0);
    head.writeUInt16LE(1, 2);
    head.writeUInt16LE(pngs.length, 4);
    let offset = head.length;
    pngs.forEach(({ size, data }, i) => {
        const e = 6 + 16 * i;
        head.writeUInt8(size >= 256 ? 0 : size, e);
        head.writeUInt8(size >= 256 ? 0 : size, e + 1);
        head.writeUInt16LE(1, e + 4);
        head.writeUInt16LE(32, e + 6);
        head.writeUInt32LE(data.length, e + 8);
        head.writeUInt32LE(offset, e + 12);
        offset += data.length;
    });
    return Buffer.concat([ head, ...pngs.map(p => p.data) ]);
};

(async () => {
    const browser = await chromium.launch();
    const tab = await browser.newPage({ deviceScaleFactor: 1 });
    const shot = async (body, w, h) => {
        // A viewport larger than the tiny icons (the browser does not go under ~200 px), cut to the box
        await tab.setViewportSize({ width: Math.max(400, Math.ceil(w)), height: Math.max(400, Math.ceil(h)) });
        await tab.setContent(page(body));
        await tab.waitForTimeout(100);
        return tab.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: Math.ceil(w), height: Math.ceil(h) } });
    };
    const save = (rel, data) => {
        const f = path.join(OUT, rel);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, data);
    };
    const icon = async (svg, size) => shot(svgBox(svg, size), size, size);
    const icoOf = async (shape) => {
        const pngs = [];
        for (const s of [ 16, 24, 32, 48, 64, 128, 256 ]) pngs.push({ size: s, data: await icon(iconSvg(shape), s) });
        return ico(pngs);
    };

    // Sources
    save('svg/cosmic-mark.svg', markSvg());
    save('svg/cosmic-icon.svg', iconSvg());
    // Web
    save('web/icon-transparent.png', await icon(markSvg(), 536));
    save('web/banner-light.png', await shot(word(1302, 378, true), 1302, 378));
    save('web/banner-dark.png', await shot(word(1302, 378, false), 1302, 378));
    for (const s of [ 72, 114, 144, 180, 512 ]) save(`web/favicons/touchicon${s === 180 ? '' : s}.png`, await icon(iconSvg(), s));
    save('web/favicons/favicon.png', await icon(iconSvg(), 256));
    save('web/favicons/favicon.ico', await icoOf('rounded'));
    // Server
    save('server/Jellyfin.Server.ico', await icoOf('rounded'));
    save('server/jellyfin.svg', markSvg());
    // Android
    const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
    for (const [ d, k ] of Object.entries(dens)) {
        save(`android/mipmap-${d}/ic_launcher.png`, await icon(iconSvg('rounded'), 48 * k));
        save(`android/mipmap-${d}/ic_launcher_round.png`, await icon(iconSvg('circle'), 48 * k));
    }
    for (const [ d, s ] of Object.entries({ ldpi: 48, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
        save(`android/drawable-${d}/ic_notification.png`, await icon(markSvg('#ffffff'), s));
    }
    save('android/drawable-xhdpi/banner_tv.png', await shot(tvBanner(320, 180), 320, 180));
    save('android/drawable-xxxhdpi/banner_tv.png', await shot(tvBanner(640, 360), 640, 360));
    save('android/drawable-xxhdpi/app_logo.png', await shot(word(756, 216, true), 756, 216));
    await browser.close();
})();
