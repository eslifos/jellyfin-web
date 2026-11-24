---
name: revision-ux
description: Revisión completa de Jellyfin Cosmic como usuario final. Recorre la app en móvil, tablet, escritorio y TV, encuentra lo que se ve mal o se puede mejorar y deja un informe con prompts listos para corregir. Úsalo con /revision-ux, opcionalmente seguido de las pantallas a revisar (por ejemplo "/revision-ux home, reproductor").
---

Haz una revisión de experiencia de usuario de Jellyfin Cosmic.

Pantallas o temas que pidió el usuario (si está vacío, revisa todo): $ARGUMENTS

1. Comprueba si hay un servidor respondiendo en `${COSMIC_URL:-http://localhost:8096}` (`curl -s $URL/System/Info/Public`).
   - Si no responde y existe la carpeta `dist/`, avisa que se puede levantar con Docker (`docker compose -f ../jellyfin-cosmic/docker/docker-compose.yml up -d`) o con el servidor local, y pregunta si se revisa solo el código.
   - Si faltan `COSMIC_USER`/`COSMIC_PASS`, pídelos (sugiere crear un usuario de prueba no administrador y otro administrador para ver ambas experiencias).
2. Si Playwright no está disponible (`node -e "require('playwright')"`), instálalo con `npm i --no-save playwright && npx playwright install chromium`.
3. Delega la revisión al agente `revisor-ux`, pasándole la URL, si hay servidor o no, y las pantallas pedidas.
4. Cuando termine, muestra al usuario:
   - el resumen de 3 a 5 líneas,
   - la ruta del informe (`ux-review/informes/...md`),
   - los tres prompts que conviene correr primero, cada uno en su propio bloque para copiarlo.
