// Jellyfin Cosmic: the mark as Android vector drawables (adaptive icon, splash, logo of the connect screen)
const fs = require('fs');
const path = require('path');
const RES = process.argv[2];

const TRI = 'm512 284.789466c-57.344 0-241.850182 334.568734-213.736727 391.074914 28.113454 56.50618 399.639277 55.85454 427.473457 0 27.83418-55.85455-156.39273-391.074914-213.73673-391.074914zm140.10182 342.109094c-18.24582 36.58473-261.67855 37.05018-280.11055 0-18.431997-37.05018 102.49309-256.27928 140.00873-256.27928s158.34764 219.60146 140.10182 256.27928zm-140.10182-176.128c-18.99055 0-80.24436 111.05745-70.93527 129.76873 9.30909 18.71127 132.65454 18.52509 141.87054 0s-51.85163-129.76873-70.93527-129.76873z';
const ORBIT = { cx: 512, cy: 540, rx: 360, ry: 92, rot: -16 };
const STARS = [ [ 800, 270, 62 ], [ 236, 330, 30 ], [ 860, 470, 20 ] ];
const star = (x, y, r) => {
    const k = r * 0.12;
    return `M${x},${y - r}C${x + k},${y - k} ${x + k},${y - k} ${x + r},${y}C${x + k},${y + k} ${x + k},${y + k} ${x},${y + r}`
        + `C${x - k},${y + k} ${x - k},${y + k} ${x - r},${y}C${x - k},${y - k} ${x - k},${y - k} ${x},${y - r}Z`;
};
const { cx, cy, rx, ry, rot } = ORBIT;
const backArc = `M${cx - rx},${cy}A${rx},${ry} 0,0 1 ${cx + rx},${cy}`;
const frontArc = `M${cx - rx},${cy}A${rx},${ry} 0,0 0 ${cx + rx},${cy}`;

const gradient = (x1, y1, x2, y2, stops) => `
        <aapt:attr name="android:fillColor">
            <gradient android:type="linear" android:startX="${x1}" android:startY="${y1}" android:endX="${x2}" android:endY="${y2}">
${stops.map(([ o, c ]) => `                <item android:offset="${o}" android:color="${c}" />`).join('\n')}
            </gradient>
        </aapt:attr>`;
const strokeGradient = gradient(150, 0, 880, 0, [ [ 0, '#FF7FD8FF' ], [ 0.5, '#FFFFFFFF' ], [ 1, '#FFC48CF0' ] ]).replace('android:fillColor', 'android:strokeColor');

/** The mark; `mono` a color for everything (splash), else its gradients. `scale` around the center (safe zone). */
const vector = (size, viewport, mono, scale = 1) => {
    const orbit = (d, alpha) => mono
        ? `<path android:pathData="${d}" android:strokeColor="${mono}" android:strokeWidth="20" android:strokeLineCap="round" android:strokeAlpha="${alpha}" />`
        : `<path android:pathData="${d}" android:strokeWidth="20" android:strokeLineCap="round" android:strokeAlpha="${alpha}">${strokeGradient}
            </path>`;
    const tri = mono
        ? `<path android:pathData="${TRI}" android:fillColor="${mono}" />`
        : `<path android:pathData="${TRI}">${gradient(298, 285, 752, 720, [ [ 0, '#FFAA5CC3' ], [ 1, '#FF00A4DC' ] ])}
        </path>`;
    const stars = STARS.map(([ x, y, r ]) => `<path android:pathData="${star(x, y, r)}" android:fillColor="${mono ?? '#FFFFFF'}" />`).join('\n        ');
    return `<?xml version="1.0" encoding="utf-8"?>
<!-- Jellyfin Cosmic: the mark (the triangle with an orbit and stars) -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="${size[0]}dp"
    android:height="${size[1]}dp"
    android:viewportWidth="${viewport}"
    android:viewportHeight="${viewport}">
    <group android:pivotX="512" android:pivotY="512" android:scaleX="${scale}" android:scaleY="${scale}">
        <group android:pivotX="${cx}" android:pivotY="${cy}" android:rotation="${rot}">
            ${orbit(backArc, mono ? 1 : 0.55)}
        </group>
        ${tri}
        <group android:pivotX="${cx}" android:pivotY="${cy}" android:rotation="${rot}">
            ${orbit(frontArc, 1)}
        </group>
        ${stars}
    </group>
</vector>
`;
};

// Adaptive icon (108 dp, the safe zone is the middle 66 dp): the whole mark inside it
fs.writeFileSync(path.join(RES, 'drawable/ic_launcher_foreground.xml'), vector([ 108, 108 ], 1024, null, 0.6));
// Splash (one color, as before)
fs.writeFileSync(path.join(RES, 'drawable/ic_splash.xml'), vector([ 108, 108 ], 1024, '@color/splash_fill', 0.6));
