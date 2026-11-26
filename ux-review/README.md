# Revisión de experiencia de usuario

Herramientas para revisar Jellyfin Cosmic como lo ve un usuario final y convertir lo que se encuentra en prompts para Claude Code.

| Pieza | Para qué |
|---|---|
| `.claude/agents/revisor-ux.md` | Agente que mira capturas y código, y escribe el informe con prompts |
| `.claude/skills/revision-ux/SKILL.md` | Comando `/revision-ux` que prepara todo y llama al agente |
| `ux-review/scripts/recorrido.mjs` | Entra con un usuario y saca capturas de cada pantalla en móvil, tablet, escritorio y TV, con avisos automáticos |
| `ux-review/informes/` | Informes de cada revisión (se guardan en git) |
| `ux-review/salida/` | Capturas de cada recorrido (no se guardan en git) |

## Cómo usarlo

1. Enciende un servidor con algo de contenido (por ejemplo con `docker compose` del repositorio `jellyfin-cosmic`) y crea un usuario de prueba.
2. Define los datos de acceso:
   ```bash
   export COSMIC_URL=http://localhost:8096 COSMIC_USER=prueba COSMIC_PASS=prueba
   ```
3. En Claude Code, dentro de este repositorio:
   ```
   /revision-ux
   ```
   o solo algunas pantallas: `/revision-ux home, reproductor, inicio de sesión`.
4. Abre el informe en `ux-review/informes/` y copia los prompts, uno por sesión, empezando por los de gravedad "Bloquea".

Para hacer solo el recorrido de capturas, sin el agente:
```bash
node ux-review/scripts/recorrido.mjs --solo movil,tv --rutas home,movies
```

Si tu red sale por un proxy, agrega `NODE_USE_ENV_PROXY=1`. Para ir más rápido, corre un proceso por dispositivo en paralelo, cada uno con su carpeta `COSMIC_SALIDA`.

Conviene revisar dos veces: con un usuario administrador (ve el panel) y con uno normal (ve lo que ve la familia).
