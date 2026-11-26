# Auditoría completa — 2026-11-25

**Cómo se revisó:** app en vivo en `https://jellyfin.famalvarez.com` (versión web desplegada el 24-11 a las 23:09; esos cambios **todavía no están en GitHub**, así que las rutas de archivo apuntan a la última versión publicada de `feature/cosmic-dark-v12.4` y conviene confirmarlas). Usuario administrador `prueba`.

| Prueba | Qué se hizo |
|---|---|
| Recorrido | 54 pantallas × 4 dispositivos (móvil 390 px, tablet 1024 px, escritorio 1440 px, TV 1920 px) = 216 capturas |
| Conectividad | Wifi que se cae a mitad de uso, recarga sin conexión, servidor con error 502, servidor apagado, sesión vencida (401), red 3G |
| Rendimiento | Lighthouse con caché vacía, móvil y escritorio, en Inicio, Películas y Detalle |
| Accesibilidad | axe-core en 11 pantallas, móvil y escritorio, más la pantalla de inicio de sesión |
| Interacción | Todos los menús (abrir, cerrar con Escape, clic derecho), navegación con control remoto en TV, reproductor (arranque, controles, atajos, subtítulos) |
| Celular real | Descargas sin conexión con un Android simulado (Pixel 7) |

**No se probó:** Chromecast, SyncPlay con dos personas, TV en vivo, Safari/iPhone real, la app con un usuario no administrador, ni nada que modifique el servidor (borrar, guardar ajustes).

**Ruido descartado:** `gstatic.com` (Cast) e `image.tmdb.org` están bloqueados por la red de la revisión. Los tiempos del recorrido incluyen la espera hasta que la red queda en reposo; para rendimiento valen las cifras de Lighthouse.

---

## Calificación general

| Área | Nota | Comentario |
|---|---|---|
| Diseño visual | 9/10 | Se ve como un servicio de streaming de primer nivel |
| Experiencia en escritorio | 8/10 | Muy completa; quedan detalles |
| Experiencia en celular | 6/10 | Mejoró mucho desde ayer; quedan pantallas rotas y tarda demasiado en abrir |
| Experiencia en TV | 5/10 | Ya usa el Inicio Cosmic, pero el control remoto se comporta de forma errática |
| **Conectividad y modo sin conexión** | **2/10** | Pantalla en blanco al perder la red; el modo sin conexión no existe en la práctica |
| **Rendimiento en celular** | **3/10** | 8.5 MB y 20 s hasta poder usar el Inicio en un celular promedio |
| Administración | 7/10 | Panel muy legible; el celular y algunas pantallas lentas fallan |
| Accesibilidad | 5/10 | No se puede hacer zoom, faltan nombres, contraste justo |

---

## ✅ Verificado como corregido (desde ayer)

- El error `reading 'scope'` del service worker ya no aparece. Los errores de consola bajaron de ~650 a 70, todos por la red de la revisión.
- Preferencias → Inicio ya no se sale de la pantalla en móvil.
- En móvil, las insignias de las tarjetas bajaron a calidad + IMDb.
- La barra de bibliotecas del Inicio en móvil ya muestra nombres.
- Los botones del detalle en móvil tienen etiqueta (Reproducir, Tráiler, Visto, Favorito, Info, Más).
- La barra flotante se simplificó (Inicio, Buscar, Más, avatar) y ya no se sale de la pantalla en el panel.
- El modo TV usa el Inicio Cosmic.
- "Escanear todas las bibliotecas" ya se ve activo.

---

## 🔴 Crítico: arreglar antes de cualquier otra cosa

### C1. El service worker no hace nada: no hay caché ni modo sin conexión, y las Descargas no sirven sin internet
- **Qué vive el usuario:** descarga una película en el celular para el avión. Al quedarse sin señal abre la app y ve una pantalla en blanco. Las descargas existen, pero no hay forma de llegar a ellas.
- **Evidencia:**
  - Android simulado: service worker activo, pero `caches.keys()` = `["embydata"]`; la caché `jf-shell-v1` ni existe. Recargar sin conexión da `ERR_INTERNET_DISCONNECTED`.
  - Causa: el `serviceworker.js` publicado (6 KB) empieza con `(self.webpackChunk=self.webpackChunk||[]).push([[82798],…` y termina con `n.O(0,[59928],…)`. Es un fragmento que necesita `runtime.bundle.js` y el fragmento 59928, que nunca se cargan dentro del service worker, así que **ningún listener (`install`, `activate`, `fetch`) se registra**.
  - Origen: `webpack.common.js` usa `optimization.runtimeChunk: 'single'` y `splitChunks` para todas las entradas, incluida `serviceworker`. Además lo inyecta en `index.html` (`HtmlWebpackPlugin.chunks`).
  - En el Jellyfin original esto pasaba inadvertido porque su service worker solo atendía clics en notificaciones.
- **Prompt para Claude Code:**
  > En Jellyfin Cosmic (`jellyfin-web`), el service worker publicado no ejecuta nada. `dist/serviceworker.js` sale como fragmento de webpack (`self.webpackChunk.push(...)` y `n.O(0,[59928],...)`) porque `webpack.common.js` aplica `optimization.runtimeChunk: 'single'` y `splitChunks` también a la entrada `serviceworker`; dentro del service worker no existe el runtime, así que no se registran `install`, `activate` ni `fetch`, y la caché `jf-shell-v1` nunca se crea. Corrígelo:
  > (1) Que `serviceworker` se compile autocontenido: excluirlo de `runtimeChunk` (función que devuelva `false` para esa entrada) y de `splitChunks` (`chunks: chunk => chunk.name !== 'serviceworker'`), o compilarlo con una configuración de webpack aparte con `target: 'webworker'`.
  > (2) Quitarlo de `HtmlWebpackPlugin.chunks`, porque no debe ejecutarse en la página.
  > (3) En `src/serviceworker.js`, precachear en `install` el esqueleto de la app (`index.html`, `runtime`, `main.jellyfin`, los `node_modules.*` iniciales, el CSS principal, las fuentes y las traducciones del idioma actual) usando un manifiesto generado por webpack (por ejemplo `workbox-webpack-plugin` con `InjectManifest`, o un plugin propio que escriba la lista). Usar estrategia "caché primero" para los archivos con hash y "red primero con caché de respaldo" para `index.html`. Nunca cachear respuestas de la API salvo las que Descargas necesite.
  > (4) Comprobarlo con `npm run build:production`, sirviendo `dist/` por https o localhost: en DevTools → Application el service worker queda "activated", `jf-shell-v1` tiene archivos, y con "Offline" marcado la app abre y se llega a `#/downloads`. Agrega una prueba automática que falle si `dist/serviceworker.js` contiene `webpackChunk`.

### C2. Si se pierde la conexión o el servidor falla, la pantalla queda en blanco o cargando para siempre
- **Qué vive el usuario:**
  - **El wifi se cae mientras navega:** la pantalla se pone completamente en blanco (el `body` queda vacío) y **sigue en blanco cuando vuelve la conexión**. La única salida es cerrar y volver a abrir.
  - **El servidor responde 502** (Nginx sin Jellyfin detrás, reinicio, actualización): el logo de Jellyfin se queda para siempre, sin mensaje.
  - **El servidor está apagado:** un círculo que gira infinitamente en la biblioteca, sin decir qué pasa.
- **Evidencia:** `aud/movil-offline-navegar-16s.png`, `movil-offline-recupera.png`, `movil-servidor-502.png` y `movil-servidor-apagado.png`. Al navegar sin red falla la carga de los fragmentos de la siguiente pantalla (`ChunkLoadError`) y React desmonta toda la app: no hay `ErrorBoundary` en las rutas perezosas.
- **Lo que sí funciona:** con la sesión vencida (401), la app manda al inicio de sesión y recuerda a dónde iba (`url=%2Fmovies`).
- **Prompt para Claude Code:**
  > Haz que Jellyfin Cosmic (`jellyfin-web`) nunca muestre una pantalla en blanco ni un círculo de carga infinito cuando falla la red o el servidor. Hoy, al navegar sin conexión, la carga perezosa de la siguiente ruta lanza `ChunkLoadError` y React desmonta toda la app (el `body` queda vacío), incluso cuando vuelve la red. Si el servidor responde 502 se queda el logo de inicio, y si está apagado la biblioteca muestra un círculo infinito.
  > 1. **Límite de errores por ruta:** agrega un `ErrorBoundary` (con el `errorElement` de React Router en `src/apps/*/routes`) que muestre una pantalla Cosmic con el mensaje "No pudimos cargar esta sección", el motivo en palabras simples (sin conexión o servidor sin respuesta) y los botones "Reintentar" y "Ir a Descargas". Ante `ChunkLoadError`, reintenta la importación una vez y, si vuelve a fallar, ofrece recargar.
  > 2. **Indicador de conexión global:** escucha `online`/`offline` y los fallos repetidos de la API (red caída, 502/503/504) y muestra una franja fija "Sin conexión con el servidor — reintentando…" que desaparezca sola al recuperarse, y que en ese momento refresque las consultas de TanStack Query (`queryClient.invalidateQueries`).
  > 3. **Tiempos límite:** ninguna carga inicial debe esperar más de 15 s sin mostrar un mensaje. En la pantalla de arranque (logo), si `System/Info` falla, muestra "No se puede conectar con Jelly-Local" con "Reintentar" y "Cambiar servidor".
  > 4. **Listas:** las bibliotecas y filas del Inicio con error muestran un estado de error con "Reintentar" en lugar del círculo.
  > Textos con `globalize.translate` en inglés y los cinco archivos en español. Comprueba con Playwright: `context.setOffline(true)` a mitad de navegación, rutas que devuelvan 502 y que se aborten. Ninguna captura debe quedar en blanco y todo debe recuperarse solo al volver la red.

### C3. La app gasta 5.6 MB de datos cada vez que se abre
- **Qué vive el usuario:** cada vez que abre la app en el celular, aunque no vaya a ver nada, se descargan 0.5 + 1 + 4 MB de prueba de velocidad. Con datos móviles es dinero perdido, y además compite con la carga del Inicio.
- **Evidencia:** Lighthouse (Inicio, móvil): `/Playback/BitrateTest?Size=500000`, `?Size=1000000` y `?Size=3000000` suman 5.6 de los 8.5 MB de la carga. Origen: `src/lib/jellyfin-apiclient/ServerConnections.js:138` (`setTimeout(() => detectBitrate(..., true), 6000)` en `onLocalUserSignedIn`). Viene del Jellyfin original, pero en Cosmic se nota más por el peso del Inicio.
- **Prompt para Claude Code:**
  > En Jellyfin Cosmic (`jellyfin-web`), `src/lib/jellyfin-apiclient/ServerConnections.js:138` lanza la prueba de velocidad (`detectBitrate(api, true)`, en `src/utils/bitrateTest.ts`) 6 segundos después de cada inicio de sesión o apertura de la app, y descarga hasta 5.6 MB aunque el usuario no reproduzca nada. Cámbialo así: (1) no medir al iniciar; medir solo justo antes de la primera reproducción que lo necesite (la calidad está en automático y no hay una medición de menos de 1 hora en `localStorage`); (2) si `navigator.connection?.saveData` es verdadero o `navigator.connection?.type === 'cellular'`, no hacer la prueba grande: usar solo la de 500 KB y un tope de calidad prudente; (3) guardar el resultado con fecha por servidor para no repetirlo en cada recarga. Comprueba en DevTools → Network que abrir el Inicio ya no pide `/Playback/BitrateTest`, y que reproducir algo sigue eligiendo bien la calidad. Corre `npm test` y `npm run lint`.

### C4. En el celular, el Inicio tarda 20 segundos en poder usarse
- **Evidencia (Lighthouse, móvil simulado, caché vacía):**

  | Pantalla | Rendimiento | La imagen principal aparece | Se puede usar | Bloqueo del hilo principal | Peso |
  |---|---|---|---|---|---|
  | Inicio | **35/100** | **18.6 s** | **20.7 s** | 3.0 s | 8.5 MB |
  | Películas | 42/100 | 5.0 s | 19.2 s | **4.8 s** | 8.2 MB |
  | Detalle | 47/100 | 4.8 s | 15.9 s | 1.7 s | 2.1 MB |
  | Inicio (escritorio) | 52/100 | 5.1 s | 5.1 s | 0.4 s | 4.6 MB |

  - 528–557 KB de JavaScript que no se usa en cada pantalla, y 430 KB de CSS sin usar (una sola hoja `73560.*.css` de 367 KB).
  - Películas en escritorio genera **9,083 elementos** en la página: no hay virtualización, y en móvil eso se traduce en 4.8 s de bloqueo.
  - Hay 354 KB de imágenes más grandes de lo que se muestran (portadas grandes en el Inicio de escritorio).
  - Se carga `en-us-json` (78 KB) aunque el idioma sea español (es el respaldo, pero podría cargarse solo si falta una clave).
- **Prompt para Claude Code:**
  > Mejora el rendimiento de Jellyfin Cosmic (`jellyfin-web`) en celulares, donde Lighthouse da 35/100 en el Inicio (la imagen principal tarda 18.6 s, se puede usar a los 20.7 s y bloquea el hilo principal 3 s) y 42/100 en Películas (4.8 s de bloqueo, 9,083 elementos en la página). Trabaja en este orden y mide con Lighthouse en modo móvil antes y después de cada paso:
  > 1. **Imagen principal del Inicio:** en `src/apps/modern/components/QuickHome`, la portada debe pedirse con el ancho real de la pantalla (`maxWidth` según `window.innerWidth * devicePixelRatio`, `quality` de 80 a 85) y con `fetchpriority="high"`. Las miniaturas y las filas de más abajo, con `loading="lazy"`. Agrega `<link rel="preconnect">` al propio servidor si hace falta.
  > 2. **Virtualizar las bibliotecas:** en Películas y Series (`src/apps/modern/features/libraries` o el `ItemsView` que corresponda), renderiza solo las filas visibles (`@tanstack/react-virtual` o el virtualizador que ya exista en el proyecto) para no superar unos 300 elementos en la página.
  > 3. **Dividir el CSS:** la hoja `73560.*.css` de 367 KB lleva estilos del panel, el asistente y el reproductor a todas las pantallas. Que `cosmicOsd.scss`, `player.scss`, `wizard-modern.scss`, `CosmicDashboard.scss` y `downloads.scss` se importen solo desde sus rutas perezosas.
  > 4. **JavaScript inicial:** revisa con `npx webpack-bundle-analyzer` qué entra en `main.jellyfin` y en los `node_modules.*` iniciales y mueve a carga perezosa lo que no hace falta para pintar el Inicio (por ejemplo `sortablejs`, el editor de Universos, `date-fns` completo y los íconos MUI importados por barril).
  > 5. **Menos trabajo inicial:** retrasa con `requestIdleCallback` lo que no se ve: la primera consulta de Próximamente, el indicador de escaneo y el monitor de recursos.
  > Meta: Inicio en móvil con rendimiento de 70 o más, la imagen principal en menos de 4 s y bloqueo menor a 600 ms. Comprueba con `npm run build:production`, `npm test` y `npm run lint`.

---

## 🟠 Alto: se nota mucho

### A1. El control remoto en TV salta de forma errática
- **Qué vive el usuario:** en el Inicio presiona ↓ y el foco va a un chip, luego vuelve a "Reproducir", luego a una tarjeta y otra vez a "Reproducir". Presiona ↑ y el foco alterna entre la portada y el menú de arriba. Tres veces ↑ seguidas quedan atascadas en la miniatura activa. En la fila Top 10, → deja de avanzar en la tarjeta 6. **Atrás (Backspace) no regresa** desde una biblioteca.
- **Evidencia:** registro de foco en modo TV con 20 pulsaciones; capturas `aud/tv-paso-*.png`. La portada rota sola (cambia de título mientras el usuario navega), lo que mueve los elementos bajo el foco.
- **Además:** al entrar a una biblioteca en TV aparece la página clásica (encabezado viejo, pestaña "Sugerencias", paginado "1-100 de 2,892" con flechas), distinta de la de Cosmic en escritorio. El menú de bibliotecas del Inicio en TV son iconos pequeños sin texto.
- **Prompt para Claude Code:**
  > Haz que Jellyfin Cosmic se use cómodamente con control remoto en modo TV (`layoutManager.tv`). Hoy, en el Inicio (`src/apps/modern/components/QuickHome`):
  > - ↓ desde "Reproducir" va a un chip y luego vuelve a "Reproducir";
  > - ↑ alterna entre la portada y el menú;
  > - tres ↑ seguidas se quedan en la miniatura activa;
  > - → se detiene en la tarjeta 6 del Top 10;
  > - Atrás (Backspace) no regresa desde una biblioteca.
  >
  > Implementa:
  > (1) Navegación por filas predecible: ↑/↓ mueve entre filas (portada → menú de bibliotecas → chips de Universos → cada fila) y ←/→ dentro de la fila, recordando la última tarjeta enfocada de cada fila. Usa el `focusManager` existente (`src/components/focusManager.js`) o una capa propia con `data-focus-row`.
  > (2) Que la portada **deje de rotar** mientras tenga el foco o el usuario esté navegando, y que retome a los 10 s de inactividad.
  > (3) Que las filas hagan scroll para mantener visible la tarjeta enfocada.
  > (4) Que Atrás/Backspace/Escape vuelva a la pantalla anterior en toda la app, excepto en el Inicio, donde no debe hacer nada.
  > (5) Que en TV el menú de bibliotecas muestre el nombre junto al icono, con un tamaño legible a 3 metros (mínimo 24 px).
  > (6) Que las bibliotecas en TV usen la misma vista Cosmic que en escritorio, con desplazamiento continuo en vez de paginado.
  >
  > Prueba con Playwright en 1920×1080 con `localStorage.layout='tv'`, registrando `document.activeElement` en cada pulsación: el foco debe seguir siempre la dirección de la flecha y estar siempre visible.

### A2. Próximamente en el celular muestra solo 3 días de la semana
- **Qué vive el usuario:** el calendario en móvil muestra LUN, MAR y MIÉ; el resto de la semana queda cortado fuera de la pantalla.
- **Evidencia:** `salida/v2/movil/capturas/movil__upcoming__vista.png`.
- **Prompt para Claude Code:**
  > En Jellyfin Cosmic, Próximamente (`src/apps/modern/routes/upcoming.tsx`) en vista Calendario muestra solo LUN, MAR y MIÉ en un celular de 390 px; el resto se corta. En anchos menores a 700 px, abre por defecto la vista Lista (recordando la elección del usuario), y si elige Calendario muestra una semana a la vez con columnas que entren completas (iniciales de los días, puntos de color por estreno y el detalle del día al tocarlo). Comprueba con el recorrido `--solo movil --rutas upcoming`.

### A3. Los géneros aparecen duplicados en inglés y español
- **Qué vive el usuario:** en Géneros ve "Comedia (3,978)" y también "Comedy (1,143)", "Animación" y "Animation", "Acción" y "Action", "Fantasía" y "Fantasy", "Aventura" y "Adventure", "Misterio" y "Mystery"… Filtrar por "Comedia" deja fuera más de mil películas.
- **Evidencia:** lista de géneros del Inicio en móvil (recorrido de menús).
- **Prompt para Claude Code (repositorio `jellyfin`, rama `feature/cosmic-12.4`):**
  > En el servidor de Jellyfin Cosmic, los géneros quedan duplicados por idioma ("Comedy" y "Comedia", "Animation" y "Animación", "Action" y "Acción"…) porque distintos proveedores o archivos NFO los traen en inglés. Agrega una normalización de géneros: un mapa de equivalencias inglés → idioma de la biblioteca (empieza por los géneros de TMDb y AniList), que se aplique al guardar los metadatos de un elemento, más una tarea programada "Unificar géneros" que corrija lo ya guardado. Que el administrador pueda revisar y editar el mapa desde el panel (Bibliotecas → Metadatos). Agrega pruebas unitarias del mapeo. Comprueba con `dotnet build` y `dotnet test`.

### A4. Los subtítulos fallan con un error 504 mientras el servidor los extrae
- **Qué vive el usuario:** empieza la película, los subtítulos no aparecen y no se le dice nada. En segundo plano, el servidor tarda tanto en extraerlos del archivo que el proxy corta la petición.
- **Evidencia:** reproduciendo "BTS: El regreso": `/Subtitles/3/Partial.js` → **504 Gateway Time-out**, y el reproductor repite "subtitles not ready, trying again".
- **Prompt para Claude Code:**
  > En Jellyfin Cosmic, al reproducir con subtítulos integrados, `/Videos/{id}/{id}/Subtitles/{index}/Partial.js` tarda tanto que el proxy inverso responde 504, y el usuario no ve subtítulos ni ningún aviso. (1) En el servidor (`jellyfin`, rama `feature/cosmic-12.4`): extrae los subtítulos de texto en segundo plano al terminar el escaneo (o con una tarea programada) para que ya estén listos al reproducir, y que el endpoint responda rápido con lo disponible en vez de esperar la extracción completa. (2) En la web (`src/plugins/htmlVideoPlayer` o el reproductor Cosmic): mientras los subtítulos no estén listos, mostrar en el menú de subtítulos "Preparando subtítulos…", y si fallan, avisar con un mensaje breve y la opción de reintentar. Comprueba reproduciendo una película MKV con subtítulos integrados que no se hayan extraído antes.

### A5. El panel en celular tiene encabezados rotos y textos cortados
- **Qué vive el usuario:**
  - **Dispositivos:** el título queda como "Di" y la descripción cae una palabra por línea ("Equipos / y / apps / que / han…"), porque los botones "Eliminar inactivos" y "Borrar todo" ocupan el ancho. Además, "Borrar todo" queda en rojo arriba, a un toque de distancia.
  - **Usuarios:** "ADMINISTRAD…" y "DESHABILITA…" se cortan.
  - **Registros:** "hace menos de un minuto" ocupa 4 líneas gigantes dentro de una tarjeta de cifra.
  - La barra flotante tapa contenido al final de cada pantalla del panel.
- **Evidencia:** `salida/v2/movil/capturas/movil__dashboard_devices__vista.png`, `movil__dashboard_users__vista.png`, `movil__dashboard_logs__vista.png`.
- **Prompt para Claude Code:**
  > Arregla el panel de Jellyfin Cosmic en celulares (390 px):
  > (1) En `src/apps/dashboard/routes/devices/index.tsx`, el encabezado comparte fila con "Eliminar inactivos" y "Borrar todo", así que el título queda "Di" y la descripción cae palabra por palabra. Haz que en móvil los botones bajen debajo del título y que "Borrar todo" pase a un menú "⋮" con confirmación, en vez de un botón rojo visible.
  > (2) Revisa el componente de encabezado común del panel para que ningún encabezado comparta fila con botones por debajo de 600 px.
  > (3) En las tarjetas de cifras (Usuarios: "ADMINISTRAD…", "DESHABILITA…"; Registros: "hace menos de un minuto" en 4 líneas), usa etiquetas cortas o permite dos líneas a menor tamaño, y muestra los tiempos relativos en forma corta ("hace 1 min").
  > (4) Que todas las páginas del panel reserven espacio inferior para la barra flotante.
  >
  > Comprueba con `node ux-review/scripts/recorrido.mjs --solo movil --rutas dashboard`.

### A6. Pantallas lentas del lado del servidor
- **Videos caseros:** la consulta `/Items?…recursive=false&fields=MediaSourceCount…` tarda **8.2 s**. **Videos musicales:** 3.4 s. **Actividad** y **Salud de bibliotecas** en el panel: 12–17 s con solo un círculo de carga, y en Actividad ni siquiera se ve el menú lateral mientras carga.
- **Detalle:** abrir un detalle llegó a tardar 6.9 s solo en responder el documento inicial (Lighthouse, escritorio).
- **Prompt para Claude Code (ambos repositorios):**
  > En Jellyfin Cosmic hay pantallas que esperan demasiado al servidor:
  > - Videos caseros: `/Items?...recursive=false&fields=MediaSourceCount...` tarda 8.2 s;
  > - Videos musicales: 3.4 s;
  > - Actividad y Salud de bibliotecas del panel: entre 12 y 17 s.
  >
  > (1) En el servidor (`jellyfin`, `feature/cosmic-12.4`): mide estas consultas con los registros de "respuestas lentas" que ya existen y revisa si `MediaSourceCount` y las agrupaciones por versión/edición que agregó Cosmic provocan consultas N+1 en SQLite. Agrega índices o calcula esos datos al escanear. En Salud de bibliotecas, guarda el resultado del último análisis y devuélvelo al instante, con la fecha y un botón "Analizar de nuevo".
  > (2) En la web: Actividad y Salud deben mostrar el diseño (menú lateral y esqueletos) de inmediato y cargar los datos por partes, en páginas de 50 eventos con desplazamiento continuo.
  >
  > Meta: ninguna consulta de lista por encima de 1.5 s en esta biblioteca (213 mil elementos).

---

## 🟡 Medio: pulido que se nota

### M1. No se puede hacer zoom en el celular
- `index.html` tiene `maximum-scale=1, user-scalable=no`. Quien ve poco no puede ampliar textos pequeños como las calificaciones o las insignias. axe lo marca como **crítico** en todas las pantallas. Viene del original, pero hoy ya no hace falta para evitar el zoom al tocar campos.
- **Prompt:**
  > En Jellyfin Cosmic, quita `minimum-scale=1, maximum-scale=1, user-scalable=no` del `<meta name="viewport">` de `src/index.html` y deja `width=device-width, initial-scale=1, viewport-fit=cover`. Para evitar el zoom automático de iOS al enfocar campos, asegúrate de que los `input`, `select` y `textarea` tengan al menos 16 px de letra en móvil (tema Cosmic y MUI). Prueba en Safari de iPhone, o en el emulador, que el zoom con dos dedos funciona y que el reproductor y los carruseles siguen respondiendo bien a los gestos.

### M2. Accesibilidad: nombres y roles que faltan
Resultados de axe en 11 pantallas:
- **Contraste insuficiente** (275 elementos): la insignia "En emisión" del Top 10, blanco sobre `#e53935`, da 4.22:1 (mínimo 4.5); también textos secundarios del Inicio, del detalle y de Preferencias.
- **Círculos de carga sin nombre** (34): `MuiCircularProgress` sin `aria-label`.
- **Imágenes sin `alt`** (33): pósters en Películas.
- **Botones sin nombre** (12) y `aria-label` en `span` sin rol (6): tarjetas de cifras del panel.
- **Listas mal formadas** (18): menú lateral del panel y de Preferencias, con `role=button` como hijos directos de la lista.
- **Roles no permitidos** (120): el reparto en el detalle usa `a` con `role=img`.
- Texto "Menu de usuario" sin tilde (`UserMenu` en `es-mx.json:2656`).
- La consola avisa "Translation key is missing: Cricket Green (voice)": en el detalle se pasa el papel de un actor por `globalize.translate`.
- **Prompt:**
  > Corrige las violaciones de accesibilidad que axe-core encontró en Jellyfin Cosmic:
  > (1) La insignia `.qh-badge-live` (blanco sobre `#e53935`, contraste 4.22) debe usar `#c62828` o texto más grueso; revisa también los textos secundarios con contraste menor a 4.5:1 en `src/apps/modern/components/QuickHome/quickHome.scss` y `cosmicDetails.scss`.
  > (2) Agrega `aria-label={globalize.translate('Loading')}` a cada `CircularProgress`.
  > (3) Pon `alt` con el nombre del elemento a los pósters de `src/components/cardbuilder` (o `alt=""` si el título ya está como texto).
  > (4) En las tarjetas de cifras del panel, cambia `span[aria-label]` por un elemento con rol o un texto oculto visualmente.
  > (5) En los menús laterales del panel y de Preferencias, envuelve cada `ListItemButton` en un `ListItem`, o quita el `ul`.
  > (6) En el reparto del detalle, cambia `role=img` por un `aria-label` sobre el enlace.
  > (7) Corrige `UserMenu` a "Menú de usuario" en los archivos en español.
  > (8) No traduzcas los papeles de los actores: busca dónde se llama `globalize.translate` con `Role`.
  >
  > Comprueba inyectando `axe-core` con Playwright en Inicio, Películas, Detalle, Panel y Preferencias, en móvil y escritorio, hasta llegar a 0 violaciones graves o críticas.

### M3. El menú "Más" del detalle mezcla opciones de usuario y de administrador
- En escritorio, al abrir "⋮" en una película aparecen 12 opciones seguidas y sin separadores: Agregar a colección, Agregar a lista de reproducción, Editar metadatos, Editar imágenes, Editar subtítulos, Identificar, Información multimedia, Detectar intro y créditos, Actualizar metadatos… El administrador busca entre todo; a un usuario normal le sobra la mitad.
- **Prompt:**
  > En el menú "Más" del detalle de Jellyfin Cosmic (`src/components/itemContextMenu.js` y el detalle en `src/apps/legacy/controllers/itemDetails/index.js`), agrupa las opciones con separadores y títulos pequeños: "Ver" (lista de reproducción, colección, compartir), "Información" (información multimedia) y "Administrar" (editar metadatos, imágenes y subtítulos, identificar, detectar intro y créditos, actualizar metadatos, borrar). En móvil, "Administrar" debe ser un submenú. Usa los mismos íconos y orden en el menú de las tarjetas.

### M4. La barra flotante aparece también en el panel de escritorio
- En el panel de escritorio ya hay menú lateral, y la barra flotante inferior queda encima de las tarjetas (Tareas, Registros, Redes). Sobra y tapa contenido.
- **Prompt:**
  > En Jellyfin Cosmic, oculta la barra flotante (`src/apps/modern/components/FloatingNav/index.tsx`) en el panel de administración cuando el menú lateral está visible (escritorio y tablet horizontal), y deja solo un botón "Volver a la app" en la parte superior del menú lateral. En móvil, mantén la barra pero reservando su espacio al final de cada página.

### M5. Escape no cierra el reproductor y falta la ayuda de atajos
- Dentro del reproductor, Escape no vuelve al detalle (solo el botón ← o Atrás del navegador). Con teclado o control remoto esa es la salida natural. Tampoco existe una ayuda de atajos con `?`.
- **Prompt:**
  > En el reproductor de Jellyfin Cosmic (`src/apps/modern/components/Player/index.tsx` y `src/apps/legacy/controllers/playback/video`): (1) Escape debe salir primero de pantalla completa, luego cerrar el menú abierto y, si no hay nada abierto, volver a la pantalla anterior; (2) `?` abre un panel con los atajos que maneja el `keydown` del reproductor (espacio, ←/→ de 10 o 30 s, ↑/↓ volumen, F, M, C subtítulos, N siguiente), legible en TV y que se cierre con Escape. Textos traducidos en inglés y español.

### M6. Descargas solo existe en celulares
- `src/apps/modern/features/downloads/support.ts` limita las descargas a teléfonos y tablets por el user agent. Una laptop que se lleva de viaje no puede descargar, y en escritorio se ve la página "Descargas" con un mensaje que dice que no está disponible.
- **Prompt:**
  > En Jellyfin Cosmic, `src/apps/modern/features/downloads/support.ts` solo ofrece descargas en celulares y tablets (`isMobileDevice`). Permite también descargar en computadoras cuando el navegador lo soporte (contexto seguro, `crypto.subtle`, IndexedDB y `navigator.storage.persist()`), mostrando el espacio disponible con `navigator.storage.estimate()`. Donde no esté disponible, oculta "Descargas" del menú en lugar de mostrar una página vacía con un aviso. Hazlo después de corregir el service worker (C1), porque sin él las descargas no se pueden abrir sin conexión.

### M7. Tablero de administración: lo que más ayudaría
- **Transcodificación por CPU:** el servidor tiene "Aceleración por hardware: Ninguno" y llegó a estar al 100 % de CPU. El panel debería detectar la GPU (Intel QSV/VAAPI, NVIDIA) y proponer activarla con un botón "Probar", en vez de un enlace a la documentación.
- **Sin copias de seguridad:** "Todavía no tienes ninguna copia de seguridad". Conviene ofrecer copias automáticas semanales con retención de 4, ya activadas en instalaciones nuevas.
- **48 dispositivos registrados** (muchos de pruebas): limpieza automática de los inactivos por más de 90 días, configurable.
- **Prompt (ambos repositorios):**
  > Mejora la experiencia de administración de Jellyfin Cosmic:
  > (1) En Reproducción → Transcodificación (`src/apps/dashboard/routes/playback/transcoding.tsx`), si la aceleración está en "Ninguno", muestra arriba una tarjeta que detecte el hardware disponible (agrega en el servidor un endpoint que pruebe `vainfo`, `/dev/dri`, QSV y `nvidia-smi` con ffmpeg) y ofrezca "Activar y probar" con una transcodificación corta de muestra.
  > (2) En Respaldos (`src/apps/dashboard/routes/backups/index.tsx` y el servidor), agrega copias automáticas programables (semanal por defecto, conservando 4) con aviso en el panel si la última tiene más de 14 días.
  > (3) En Dispositivos, agrega la opción "Quitar automáticamente los dispositivos inactivos por más de N días" (90 por defecto) como tarea programada.
  >
  > Comprueba con `dotnet test` en el servidor y con `npm run lint` y `npm test` en la web.

---

## 🔵 Detalles

- **Ruta `#/search`:** sigue mostrando "Sugerencias" como lista de nombres al azar (pendiente del informe anterior, problema 10).
- **Números en formato inglés:** el contador "11,614" y "1-100 de 2,892" en TV (pendiente, problema 11).
- **"✓ 0 disponibles"** en Próximamente (pendiente).
- **El anillo de escaneo** en la barra flotante sigue sin explicación visible en móvil (en escritorio ya tiene la etiqueta "Escaneando: …").
- **Detalle en móvil:** el logo de la película se superpone con la imagen de fondo y quedan 5 insignias en dos filas (Aventura, IMDb 5.9 17k, 1080P, Dolby Digital, DUAL AUDIO). Muestra 3 como máximo y el resto en "Info".
- **"¿Qué vemos hoy en Anime?" en móvil:** el título se parte en dos líneas al lado del subtítulo. Pon el subtítulo debajo.
- **Botones de icono sin nombre** confirmados en vivo: `a.qh-genre`, `a.qh-spot-poster` (Inicio), botones de las tarjetas de usuarios, bibliotecas, transcodificación, dispositivos y actividad del panel.

Para estos detalles, un solo prompt:
> En Jellyfin Cosmic, termina estos detalles:
> (1) `#/search` sin texto debe mostrar búsquedas recientes y pósters de lo más visto, en vez de la lista de nombres al azar;
> (2) todos los números con `globalize.getCurrentLocale()` (`LibraryToolbar.tsx:80` y la paginación en TV);
> (3) en `upcoming.tsx`, ocultar "0 disponibles";
> (4) tooltip y porcentaje en `LibraryScanIndicator`;
> (5) en el detalle en móvil, como máximo 3 insignias y el logo sin superponerse al fondo;
> (6) en móvil, subtítulos de sección debajo del título;
> (7) `aria-label` en `a.qh-genre`, `a.qh-spot-poster` y los `IconButton` del panel.
>
> Comprueba con el recorrido en móvil y escritorio.

---

## Orden recomendado

1. **C1 y C2** (service worker y pantallas en blanco), en la misma sesión o dos seguidas: sin ellos, cualquier corte de red rompe la app.
2. **C3** (prueba de velocidad): es corto y ahorra datos a todos de inmediato.
3. **C4** (rendimiento en móvil), en varias sesiones, un paso por sesión, midiendo con Lighthouse.
4. **A1** (TV), **A2** (calendario móvil), **A5** (panel móvil).
5. **A3, A4 y A6** (servidor: géneros, subtítulos, consultas lentas).
6. **M1–M7** y los detalles.

Después de cada grupo, vuelve a correr `/revision-ux` para confirmar que se arregló y que no se rompió nada.
