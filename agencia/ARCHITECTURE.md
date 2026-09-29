# Arquitectura de Corte

## Decisiones principales

| Decisión | Motivo |
|---|---|
| App nueva en `agencia/` dentro del repositorio existente | El repositorio ya contenía otro producto (Taller). No se toca: la raíz excluye `agencia/` de su `tsconfig` y `eslint`, y `agencia/next.config.ts` fija `turbopack.root`. |
| Next.js 16.3 (App Router, Turbopack), React 19, TypeScript estricto, Tailwind 4 | Preferencia del brief; versiones actuales. Documentación de la versión en `node_modules/next/dist/docs/`. |
| PostgreSQL + Prisma **6.19** | Prisma 7 cambia configuración y drivers; 6.19 es estable y conocido. Migrar a 7 es una tarea aislada. |
| Autenticación propia (sesiones en BD, cookie httpOnly, scrypt) | Sesiones revocables al instante, sin dependencias de terceros ni proveedores externos. Sigue las prácticas de Lucia/Copenhagen Book (token aleatorio de 256 bits, solo el SHA-256 en BD, renovación deslizante). |
| Autorización centralizada en servidor por **alcance** | Todas las consultas pasan por `lib/authz/scope.ts`. Fuera de alcance = 404 (no se revela existencia). |
| Route handlers JSON para la sala de revisión; Server Actions para formularios | La sala es muy interactiva y la usan también invitados de enlace; la misma API sirve para un futuro plugin de Premiere. |
| Almacenamiento con interfaz `StorageProvider` | Hoy disco local; S3/R2 con subida multiparte firmada es el siguiente paso (necesita credenciales). |

## Capas

```
app/                 UI (páginas, layouts), Server Actions (app/actions) y API (app/api)
components/          UI reutilizable: ui/ (primitivas), work/ (listas), review/ (sala), shell/
lib/domain/          Reglas puras: máquinas de estados, timecode, geometría de anotación,
                     dinero, brief, estilo, etiquetas. Sin BD. 100 % testeable.
lib/authz/           Actor (usuario o invitado), filtros de alcance, guards
lib/auth/            Criptografía, sesiones, invitados, límites de intentos
lib/services/        Casos de uso: proyectos, piezas, versiones, comentarios, correcciones,
                     aprobaciones, enlaces, media, finanzas, clientes, usuarios, auditoría
lib/storage/         StorageProvider, disco local, URLs firmadas
lib/notifications/   Avisos en la app, bandeja de email idempotente
lib/http/            Errores tipados, envoltorio de API (CSRF, errores), acciones, páginas
prisma/              Esquema, migraciones y datos de demostración
tests/               Vitest: unit (dominio, seguridad) e integration (servicios contra corte_test)
e2e/                 Recorrido completo en Chromium real
```

Regla: la UI nunca decide permisos; los servicios reciben un `Actor` y aplican alcance.
La UI solo oculta botones para no confundir.

## Modelo de datos (resumen)

- **Organization** → todo cuelga de ella (`organizationId`) para el aislamiento multi-organización.
- **User** con rol `ADMIN | COORDINATOR | EDITOR | CLIENT`; los clientes pertenecen a un **Client**.
  `canViewFinance` (coordinadores) y `canViewOwnPay` (editores) son permisos explícitos.
- **Session** (hash del token, caducidad, revocación). **RateLimit** (ventana fija en BD).
- **Team** (coordinador + editores), **EditorProfile** (especialidades, software, disponibilidad,
  capacidad, tarifa privada, notas).
- **Client** → **StyleProfile** versionado (cada guardado = nueva fila) y **StyleSuggestion**.
- **Project** (estado propio, apunta a la versión del perfil de estilo vigente al crearlo) →
  **Brief** (JSON validado) → **Piece** (estado operativo) → **Version**.
- **Piece** guarda tres punteros explícitos: `currentVersionId`, `clientVersionId`, `approvedVersionId`.
- **Version** (número, estado, `publishedAt`, `lockedAt`, fps declarado y `fpsVerified`, media).
- **Comment** (instante `timeMs`, tramo `timeMs..endMs`, general sin tiempo; `visibility`
  INTERNAL/CLIENT; anotación normalizada) → **CommentRevision** (historial), **CommentMention**.
- **Correction** (1:1 con un comentario raíz) → **CorrectionEvent** (historial de estados).
- **Approval** (append-only; solo `revokedAt` con motivo y actor).
- **MediaAsset** (SOURCE, PROXY, PREVIEW, DELIVERABLE, REFERENCE, ATTACHMENT; LOCAL/S3/EXTERNAL_LINK;
  estado, tamaño, SHA-256, visibilidad, retención) → **Delivery**, **DownloadLog**.
- **ShareLink** (hash del token, alcance, permisos, contraseña, dominio, caducidad, revocación)
  → **ReviewGuest** (sesión propia por enlace) → **ShareLinkEvent**.
- **Notification** (agrupación por `groupKey`), **NotificationPreference**, **EmailOutbox** (idempotencia).
- **ServicePackage**, **FinanceLine** (céntimos + moneda ISO), **AuditLog** (append-only).

## Estados

**Proyecto**: DRAFT, REQUESTED, ACTIVE, ON_HOLD, COMPLETED, CANCELLED.

**Pieza** (`lib/domain/piece-status.ts`): BORRADOR → PENDIENTE DE ASIGNACIÓN → ASIGNADO →
EN EDICIÓN → REVISIÓN INTERNA → EN REVISIÓN DEL CLIENTE → CAMBIOS SOLICITADOS → EN CORRECCIÓN →
(REVISIÓN INTERNA…) → APROBADO → ENTREGA FINAL → COMPLETADO; CANCELADO desde casi cualquier estado.
Transiciones automáticas (asignar, subir versión, publicar, decidir, entregar) y manuales
(empezar a editar, empezar correcciones, cancelar, completar). Cada cambio usa una
actualización condicional (`WHERE status = anterior`) para no pisar cambios concurrentes y
deja un **PieceEvent**. Los bloqueos (falta material/decisión/otro, motivo y responsable) son
entidades aparte: no cambian el estado.

**Versión** (`version-status.ts`): INTERNAL_REVIEW → (INTERNAL_CHANGES) → CLIENT_REVIEW →
CHANGES_REQUESTED | APPROVED; SUPERSEDED cuando otra la sustituye sin decisión. APPROVED solo
vuelve a CLIENT_REVIEW por revocación de administración.

**Corrección** (`correction-status.ts`): PENDIENTE → EN CURSO → RESUELTA POR EL EQUIPO →
VERIFICADA; DESCARTADA; reapertura a PENDIENTE. El equipo resuelve; quien revisa verifica.

## Flujo de versiones

1. El editor sube el archivo de revisión (PREVIEW) por trozos → servidor verifica SHA-256.
2. Crea la versión: siempre **interna**; puede declarar qué correcciones atiende (quedan
   RESUELTAS con `addressedInVersionId`). Las versiones internas previas pasan a SUSTITUIDA.
3. Coordinación revisa (comentarios siempre internos en versiones no publicadas) y **publica**
   o pide cambios internos.
4. Publicar: `publishedAt`, la media pasa a visible para el cliente, la versión que veía el
   cliente sin decisión pasa a SUSTITUIDA, `clientVersionId` apunta a la nueva y se avisa al cliente.
5. El cliente decide sobre **esa versión**. Aprobar bloquea la versión (`lockedAt`) y fija
   `approvedVersionId`, que se conserva aunque se publiquen versiones posteriores.
6. Los comentarios **no se copian** entre versiones; la sala muestra los pendientes de versiones
   anteriores con enlace a su versión.

## Permisos (resumen)

| Acción | ADMIN | COORDINATOR | EDITOR | CLIENT | Invitado |
|---|---|---|---|---|---|
| Ver proyecto | todos | los suyos (coordinador o equipo) | con piezas asignadas | los de su cliente (no borradores) | el del enlace |
| Ver versión | todas | su ámbito | sus piezas | publicadas | publicadas dentro del alcance |
| Comentarios internos | sí | sí | sí | nunca | nunca |
| Crear proyecto/pieza, asignar | sí | en su ámbito | no | solicitar (si está activado) | no |
| Subir versión | sí | sí | pieza asignada | no | no |
| Publicar / cambios internos | sí | sí | no | no | no |
| Aprobar / pedir cambios | en nombre del cliente (nota obligatoria) | ídem | no | su cliente | si el enlace lo permite |
| Revocar aprobación | sí (con motivo) | no | no | no | no |
| Finanzas | sí | con `canViewFinance` | solo sus pagos | no | no |
| Usuarios, organización, auditoría | sí | no | no | no | no |

## Media

- Tipos: SOURCE (originales), PROXY, PREVIEW (revisión), DELIVERABLE (entrega), REFERENCE, ATTACHMENT.
- **Originales pesados**: hoy se registran como **enlace externo** (Drive, Dropbox…). Se etiqueta el
  servicio, pero se deja claro que **no es una integración con su API**.
- **Subida**: `POST /api/uploads` → `PUT /api/uploads/:id?offset=N` (trozos ≤ 16 MB con SHA-256 por
  trozo; 409 con el offset correcto para reanudar) → `POST /complete` (tamaño + SHA-256 del archivo).
  El cliente guarda la subida en curso y la reanuda si se vuelve a elegir el mismo archivo.
  **Limitación**: con el disco local los bytes pasan por el servidor de la app. Límite 8 GB por archivo
  de revisión/entrega. En Vercel no hay disco persistente: en producción hay que usar S3/R2 con
  subida multiparte firmada directa desde el navegador (pendiente, requiere credenciales).
- **Reproducción privada**: `/api/media/:token` con token HMAC (asset, sujeto, caducidad 2 h; descarga
  10 min). Soporta `Range`. En **cada petición** se comprueba que la sesión o el enlace siguen vigentes,
  así que revocar corta el acceso aunque la URL no haya caducado.
- **Metadatos**: duración y dimensiones leídas por el navegador; fps declarado por el editor. No hay
  ffprobe/ffmpeg en servidor todavía → `fpsVerified=false` y paso por fotograma marcado como «≈».
- **Retención**: campo `retainUntil` preparado; falta el proceso de purga.

## Notificaciones

`notify()` se llama dentro de la transacción de la acción: crea o agrupa avisos en la app (mismo
`groupKey` sin leer → incrementa contador), respeta preferencias por tipo y canal, y encola emails con
`idempotencyKey = evento:usuario` (único en BD). Contenido interno (`internal: true`) nunca se entrega a
usuarios CLIENT. La bandeja se procesa con `/api/cron/outbox` (secreto) o `npm run outbox`; cada email se
«reclama» con un UPDATE condicional (sin envíos dobles) y se reintenta con espera exponencial (5 intentos).
Sin proveedor configurado se marca como OMITIDO y se ve en Ajustes.

## IA

- `lib/ai/provider.ts`: interfaz `AIProvider` (`suggestCategory`, `summarize`) con implementación Anthropic
  (SDK oficial, modelo configurable con `AI_MODEL`, por defecto `claude-opus-5-5`, esfuerzo bajo, salida
  estructurada validada con zod). Sin implementación simulada.
- Solo se usa si **ambos**: el servidor tiene `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` **y** la
  organización activó «Permitir enviar textos de clientes a un proveedor de IA». Si no, la API responde 503
  con un mensaje claro y la interfaz lo indica; el flujo manual no cambia.
- Funciones: sugerir categoría de una corrección (solo equipo) y resumir la conversación de una versión
  (solo agencia). Nunca modifican datos: la persona pulsa «Aplicar». Cada uso queda en auditoría.
- Solo se envía texto de comentarios; nunca media ni archivos.
- La «detección de patrones de estilo» del cliente es por reglas, no IA, y se presenta como tal.
- **No probado contra la API real** (no hay credenciales en este entorno).

## Seguridad

- CSRF: Server Actions con comprobación de origen integrada en Next; route handlers mutantes
  comprueban `Origin` = `Host` (`lib/http/api.ts`). Cookies `SameSite=Lax`, `httpOnly`, `Secure` en producción.
- Validación con zod en todos los servicios. Errores tipados → 400/401/403/404/409/422/429.
- Límites: login (30/IP y 8/email por 15 min), identificación en enlaces (20 por 15 min), comentarios (60/min).
- Cabeceras: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Exportación CSV protegida contra inyección de fórmulas. Enlaces en comentarios con `rel="noopener noreferrer nofollow"`.
- Tokens de sesión y de enlaces: solo su hash en BD. Contraseñas: scrypt (N=2^17).
- Auditoría append-only de las acciones relevantes (incluye proyecto y si es visible para el cliente).

## Evolución a SaaS

Ya preparado: `organizationId` en todas las entidades, alcance por organización en cada consulta,
moneda/impuestos/política por organización. Pendiente cuando haga falta: registro de organizaciones,
subdominios, facturación, límites por plan.
