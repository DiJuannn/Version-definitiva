# Corte

Plataforma interna de la agencia de edición y postproducción: clientes, equipos,
proyectos y piezas, brief guiado, asignación, **sala de revisión** (inspirada en
Frame.io), versiones, aprobaciones, enlaces para clientes, entregas, avisos y finanzas.

> Vive en `agencia/` dentro de este repositorio y es independiente del proyecto de
> la raíz (Taller). Todos los comandos se ejecutan dentro de `agencia/`.

## Requisitos

- Node.js 20.9+ (probado con 22)
- PostgreSQL 14+ (probado con 16)
- Para los vídeos de prueba y el recorrido E2E: Chromium y un `ffmpeg` con `libvpx`
  (en este entorno: `/opt/pw-browsers`; configurable con `CHROME_PATH` y `FFMPEG_PATH`).

## Puesta en marcha

```bash
cd agencia
npm install
cp .env.example .env          # rellena DATABASE_URL y APP_SECRET
createdb corte_dev             # o crea la base con tu herramienta
npm run db:migrate             # aplica migraciones
npm run db:seed                # datos de DEMOSTRACIÓN (no borra nada)
npm run dev                    # http://localhost:3100
```

Usuarios de demostración (contraseña `demo-corte-2026`):

| Email | Rol |
|---|---|
| admin@demo.test | Administración |
| coord@demo.test | Coordinación (sin finanzas) · coord2@demo.test con finanzas |
| lucia@demo.test, marco@demo.test, sara@demo.test | Edición |
| marta@cafenorte.test | Cliente «Café Norte» |
| jon@brisa.test | Cliente «Pilates Brisa» |
| admin@otra.test, cliente@otra.test | Otra organización (para probar aislamiento) |

## Comprobación

```bash
npm run typecheck      # TypeScript estricto
npm run lint           # ESLint (reglas de Next y React Compiler)
npm test               # Vitest: unit + integración contra la base corte_test
npm run media:test     # genera vídeos de prueba (16:9, 9:16, 1:1; V1 y V2) en test-media/
npm run e2e            # recorrido completo en Chromium contra el servidor en marcha
npm run build          # compilación de producción
```

- `npm test` necesita una base **`corte_test`** (se vacía en cada ejecución; se niega a
  actuar si el nombre no termina en `_test`). Configurable con `TEST_DATABASE_URL`.
- `npm run e2e` crea sus propios usuarios y proyectos con un sufijo único y solo
  reinicia los contadores de intentos de login. Capturas en `e2e/artifacts/`.

## Documentación

- `PROJECT_STATUS.md` — qué está hecho, qué falta, bloqueos y siguiente prioridad.
- `ARCHITECTURE.md` — decisiones, capas, modelo de datos, estados, permisos, media.
- `docs/REVIEW_FEATURE_MATRIX.md` — funciones de revisión frente a Frame.io, con estado y prueba.
- `docs/FRAMEIO_RESEARCH.md` — investigación con fuentes y límites.
- `docs/PREMIERE_INTEGRATION.md` — alternativas, recomendación y qué necesitamos de vosotros.
- `docs/DESIGN.md` — dirección visual.
- `AGENTS.md` / `CLAUDE.md` — instrucciones para agentes (Claude Code, Codex).

## Despliegue

Compatible con cualquier host Node (y con Vercel para la app), pero **el almacenamiento local
no sirve en Vercel**. Antes de producción: proveedor de objetos (S3/R2), `APP_SECRET` propio,
`APP_URL`, proveedor de email y `CRON_SECRET` con un cron que llame a `/api/cron/outbox`.
Ver «Antes de producción» en `PROJECT_STATUS.md`.
