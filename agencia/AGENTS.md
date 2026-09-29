<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Corte — reglas para agentes

Instrucciones comunes para Claude Code y Codex. Léelas junto con `PROJECT_STATUS.md`
(estado y siguiente prioridad) y `ARCHITECTURE.md` (decisiones y límites).

## Ámbito

- Todo el trabajo de esta plataforma va en `agencia/`. **No modifiques el proyecto de la
  raíz** (Taller) salvo para mantenerlo aislado (`tsconfig`/`eslint` raíz excluyen `agencia/`).
- Idioma de la interfaz, mensajes, comentarios de código y documentación: **español**.

## Comandos (desde `agencia/`)

| Tarea | Comando |
|---|---|
| Desarrollo | `npm run dev` (puerto 3100) |
| Tipos / lint | `npm run typecheck` · `npm run lint` |
| Tests | `npm test` (usa la base `corte_test`) |
| E2E | `npm run media:test` una vez, luego `npm run e2e` con el servidor en marcha |
| Migraciones | `npm run db:migrate` (dev) · `npm run db:deploy` (producción) |
| Datos demo | `npm run db:seed` (no borra nada) |

Next 16: `params`/`searchParams`/`cookies()` son asíncronos; usa `PageProps<"/ruta">` y
`RouteContext<"/ruta">` (genera tipos con `npx next typegen` al crear rutas). El antiguo
`middleware` se llama `proxy`.

## Convenciones

- **Permisos en servidor, siempre.** Los servicios de `lib/services/*` reciben un `Actor` y usan
  `lib/authz/scope.ts` / `guards.ts`. Nunca consultes datos de negocio sin filtro de alcance.
  Fuera de alcance → 404 (en páginas, envuelve con `orNotFound`).
- Reglas puras en `lib/domain/*` (sin BD) con tests unitarios.
- Mutaciones: Server Actions en `app/actions/*` con `runAction` + `ActionForm`; la sala de
  revisión usa route handlers JSON envueltos en `api()` (CSRF + errores tipados).
- Cambios de estado: siempre con la función de transición del dominio y actualización condicional.
- Todo lo relevante deja `audit()` en la misma transacción; avisos con `notify()` (indica `internal`).
- Dinero en céntimos (`Int`) con moneda ISO explícita. Tiempos de vídeo en milisegundos.
- Anotaciones: coordenadas normalizadas al área real de imagen (`lib/domain/annotation.ts`).
- Formularios: `ActionForm`/`useKeepValuesAction` (no vacían los campos si hay error).
- Diseño: tokens de `app/globals.css` y `docs/DESIGN.md`. Nada de tarjetas de estadísticas
  inventadas; estados vacío/carga/error redactados como indicaciones.

## Honestidad del producto

- No presentes como terminado lo que no se ha probado. Actualiza `docs/REVIEW_FEATURE_MATRIX.md`
  con el estado real (✅ solo con prueba automática).
- No simules integraciones (Frame.io, Premiere, Drive, IA). Un enlace no es una integración.
- No anuncies precisión por fotograma sin `fpsVerified`.
- Sin credenciales, los flujos manuales deben seguir funcionando.

## Antes de terminar un bloque

1. `npm run typecheck && npm run lint && npm test`
2. Si tocas la UI o flujos: `npm run e2e` y revisa capturas en `e2e/artifacts/`.
3. Actualiza `PROJECT_STATUS.md` (y la matriz si afecta a la revisión).
