---
name: aplicar-mejoras
description: Aplica las mejoras de un informe de ux-review/informes una por una - toma la siguiente pendiente, la implementa, la comprueba, hace commit y la marca como hecha en ux-review/progreso.md. Úsalo con /aplicar-mejoras, opcionalmente seguido del informe y de qué mejoras hacer (por ejemplo "/aplicar-mejoras tv P2" o "/aplicar-mejoras tv fase 1").
---

Aplica mejoras de los informes de revisión de Jellyfin Cosmic.

Lo que pidió el usuario: $ARGUMENTS

## 1. Elegir qué hacer

1. **Informe:** si el usuario nombró uno ("tv", "auditoria", "2026-11-26"), usa el archivo de `ux-review/informes/` cuyo nombre lo contenga; si no, el más reciente.
2. **Avance:** lee `ux-review/progreso.md`. Si no existe, créalo con una tabla por informe que liste cada mejora con prompt (los títulos `P1`, `P2`… o `C1`, `A1`, `M1`… del informe), con las columnas Mejora, Repositorio, Estado y Commit.
3. **Qué ya está hecho:** antes de empezar, revisa `git log --oneline -30` por si alguna mejora ya se hizo en otra sesión, aunque no figure en el avance. Si el commit lo deja claro, márcala como "Hecho" con ese commit; si no estás seguro, compruébalo en el código.
4. **Qué mejora tomar:**
   - si el usuario nombró una ("P2") o una fase ("fase 1"), haz esas;
   - si no, toma **la primera pendiente** del informe en su orden.
5. **Repositorio:** cada prompt dice en qué repositorio va (jellyfin-web, jellyfin, jellyfin-cosmic-tv).
   - Haz solo las de este repositorio (`jellyfin-web`).
   - Si la siguiente es de otro, márcala "Pendiente en <repositorio>" y dile al usuario que la corra en una sesión de ese repositorio, con el prompt completo para copiar.
   - Si un prompt toca dos repositorios, haz la parte de este y deja anotada la otra.

## 2. Hacerla

1. **Lee el prompt del informe completo** y trátalo como la instrucción principal. Si el código cambió desde que se escribió el informe (rutas, nombres o algo ya resuelto en parte), adáptate al código actual y anota la diferencia.
2. **Mira primero el código involucrado** y respeta el estilo del proyecto: tema Cosmic, textos con `globalize.translate` en `src/strings/en-us.json` y los cinco archivos en español (`es.json`, `es-mx.json`, `es-ar.json`, `es_419.json`, `es_DO.json`), tratando de "tú".
3. **Un cambio del tamaño del prompt.** No arregles otras cosas de paso; si ves algo, anótalo al final para el usuario.

## 3. Comprobarla

Corre lo que corresponda y no la des por hecha si algo falla:
- `npm run lint` y `npm run build:check`, siempre;
- `npm test`, si tocaste lógica;
- la comprobación que pide el prompt. Por ejemplo:
  - en TV: `node ux-review/scripts/auditoria/tv-recorrido.cjs`;
  - en las pantallas: `node ux-review/scripts/recorrido.mjs --rutas <pantalla>`;
  - en accesibilidad: `node ux-review/scripts/auditoria/axe.cjs`.

Los scripts necesitan un servidor: usa `COSMIC_URL`, `COSMIC_USER` y `COSMIC_PASS` si están definidos. Si no hay servidor disponible, dilo y comprueba lo que se pueda sin él (lint, tipos, pruebas y build).

Si una comprobación falla por algo que no tocaste, dilo con la salida, en vez de ocultarlo.

## 4. Cerrar

1. **Commit** en la rama actual, con un mensaje en español que diga qué cambia para el usuario y que mencione la mejora (por ejemplo "TV: menú único a la izquierda (informe TV, P2)").
2. **Avance:** en `ux-review/progreso.md`, marca la mejora "Hecho" con el hash del commit, o "Parcial" con lo que falta. Inclúyelo en el mismo commit o en uno inmediato.
3. **Push:** sube la rama solo si el usuario lo pidió en esta sesión.
4. **Responde al usuario con:**
   - qué cambió, en 2 o 3 líneas, desde lo que ve el usuario;
   - qué comprobaste y el resultado;
   - lo que quedó pendiente o que notaste de paso;
   - cuál es la siguiente mejora, para que solo escriba `/aplicar-mejoras` de nuevo.

Haz **una mejora por vez** salvo que el usuario pida varias o una fase completa. En ese caso, haz un commit por mejora y detente si alguna no pasa sus comprobaciones.
