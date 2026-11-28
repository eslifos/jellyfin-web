# Avance de las mejoras

Lo actualiza `/aplicar-mejoras` después de cada mejora. Estados: **Pendiente**, **Hecho**, **Parcial**, **Pendiente en <repositorio>** y **Revisar** (parece hecho por el historial, pero hay que confirmarlo en el código).

## Informe TV (`informes/2026-11-26-tv.md`)

| Mejora | Repositorio | Estado | Commit |
|---|---|---|---|
| P1 · Foco y barra | jellyfin-web | Hecho | 499691942d, f6fac0d34e |
| P2 · Menú único a la izquierda | jellyfin-web | Hecho | 7ba01884f8 |
| P3 · Tamaños para 10 pies y sin desenfoques | jellyfin-web | Hecho | 2455bccfc2 |
| P4 · Reproductor con el control remoto (el de la web, con el nativo de respaldo) | jellyfin-web + jellyfin-cosmic-tv | Hecho | 2c7cb26f13 (web), ac9cfea6 (TV) |
| P5 · Detalle para TV | jellyfin-web | Hecho | 179541a491 |
| P6 · La portada sigue al foco y tráiler automático | jellyfin-web (+ jellyfin) | Parcial: la web hecha; los tráileres no se descargan en el servidor (yt-dlp "Requested format is not available"), pendiente en jellyfin | be5942c5d1 |
| P7 · Tarjetas horizontales con logo en TV | jellyfin-web | Hecho (mejora opcional en jellyfin: BackdropTag/LogoTag en las filas) | 053b6074a3 |
| P8 · Búsqueda única para TV con voz | jellyfin-web + jellyfin-cosmic-tv | Hecho | 1bb1586a1d (web), 75bb17b9 (TV) |
| P9 · "¿Quién está viendo?" e iniciar sesión con el celular | jellyfin-web | Hecho (sin PIN: los perfiles no lo tienen) | 4cb32c56fa |
| P10 · Seguir viendo y canal en Google TV | jellyfin-cosmic-tv + jellyfin-web | Hecho | e7fd35ab (TV), 5bab34343d (web) |
| P11 · Frecuencia de pantalla, audio por HDMI y HDR | jellyfin-cosmic-tv + jellyfin-web | Hecho | 16b427e6 (TV), de9b9d37cf (web) |
| P12 · Pantallas nativas de arranque, conexión y ajustes | jellyfin-cosmic-tv + jellyfin-web | Hecho | 6567cd20 (TV), bfa12e2f81 (web) |
| P13 · Salvapantallas Cosmic | jellyfin-cosmic-tv | Hecho | 0c0b6b76 (TV) |
| P14 · Perfil infantil | jellyfin-web + jellyfin | Hecho (el servidor necesita reconstruir la imagen) | 2d0827f683 (web), 55cb827713 (servidor) |
| P15 · Guía de TV en vivo para el control | jellyfin-web | Pendiente | |
| P16 · Música a pantalla completa | jellyfin-web | Pendiente | |
| P17 · Voz con el Asistente | jellyfin-cosmic-tv | Pendiente en jellyfin-cosmic-tv | |
| P18 · Celular como control y teclado | jellyfin-web + jellyfin-cosmic-tv | Pendiente | |

## Auditoría completa (`informes/2026-11-25-auditoria.md`)

| Mejora | Repositorio | Estado | Commit |
|---|---|---|---|
| C1 · Service worker sin código | jellyfin-web | Revisar | 1e7dd0e8f5 |
| C2 · Pantalla en blanco sin conexión | jellyfin-web | Revisar | 1e7dd0e8f5 |
| C3 · 5.6 MB de prueba de velocidad al abrir | jellyfin-web | Pendiente | |
| C4 · Rendimiento en celular | jellyfin-web | Pendiente | |
| A1 · Control remoto errático en TV | jellyfin-web | Revisar | c56f54d90a |
| A2 · Calendario de Próximamente en celular | jellyfin-web | Pendiente | |
| A3 · Géneros duplicados por idioma | jellyfin | Revisar (editor de géneros en e993c507ad) | |
| A4 · Subtítulos con error 504 | jellyfin + jellyfin-web | Revisar (e993c507ad) | |
| A5 · Panel en celular | jellyfin-web | Revisar | 48428ed6ae |
| A6 · Pantallas lentas del servidor | jellyfin + jellyfin-web | Revisar (Salud de bibliotecas en 48428ed6ae) | |
| M1 · Zoom en el celular | jellyfin-web | Pendiente | |
| M2 · Accesibilidad (axe) | jellyfin-web | Pendiente | |
| M3 · Menú "Más" del detalle | jellyfin-web | Pendiente | |
| M4 · Barra flotante en el panel de escritorio | jellyfin-web | Pendiente | |
| M5 · Escape en el reproductor y ayuda de atajos | jellyfin-web | Revisar (atajos en 8d237779fa) | |
| M6 · Descargas en computadoras | jellyfin-web | Pendiente | |
| M7 · Administración (GPU, respaldos, dispositivos) | jellyfin + jellyfin-web | Pendiente | |
