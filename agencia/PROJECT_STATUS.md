# Estado del proyecto

Actualizado: 29-09-2026.

## Implementado y comprobado

Comprobación: `npm test` (39 pruebas unitarias e integración) · `npm run e2e` (59 comprobaciones en
Chromium, escritorio y móvil) · `npm run typecheck` · `npm run lint` · `npm run build`.

- **Base**: Next.js 16 + Prisma + PostgreSQL en `agencia/`, aislada del proyecto raíz.
- **Autenticación**: sesiones en BD revocables, scrypt, límites de intentos, cambio de contraseña (cierra
  otras sesiones), lista y cierre de sesiones, restablecimiento por administración.
- **Autorización en servidor** por alcance y organización (admin, coordinación, edición, cliente,
  invitado de enlace). 404 fuera de alcance. Probado: otro cliente y otra organización no acceden por
  URL ni por API.
- **Clientes** con perfil de estilo versionado (los proyectos conservan su versión; aplicar la nueva es una
  acción explícita) y **sugerencias por reglas** a partir de correcciones repetidas, con decisión humana.
- **Equipo**: editores con especialidades, software, disponibilidad, capacidad, tarifa privada y notas
  (solo admin); equipos por coordinador; carga frente a capacidad.
- **Proyectos y piezas**: estados separados, prioridad, fechas, notas internas, paquete de servicio,
  material y referencias (enlaces externos etiquetados o subida), bloqueos con motivo y responsable,
  historial de estados, actividad.
- **Brief guiado** por secciones con borrador local y en servidor, campos pendientes y vista limpia para el editor.
- **Solicitudes de proyecto** desde el portal del cliente (activable).
- **Sala de revisión** (ver `docs/REVIEW_FEATURE_MATRIX.md`: 67 funciones ✅).
- **Versiones internas / publicación / aprobación** con política configurable, bloqueo, revocación y concurrencia.
- **Enlaces de revisión** con alcance, permisos, caducidad, contraseña, dominio, revocación inmediata.
- **Media**: subida por trozos reanudable con SHA-256, reproducción privada con URLs firmadas revocables,
  entregas ligadas a la versión aprobada, descargas registradas.
- **Avisos** en la app (agrupados, preferencias) y bandeja de email idempotente con reintentos; visible en Ajustes.
- **Paneles por rol** con datos reales: próximas acciones, en riesgo, con el cliente, entregas, equipo, actividad;
  «Ahora» y correcciones del editor; «Listo para revisar» del cliente con estados propios para clientes.
- **Calendario** mensual de entregas (lista en móvil).
- **Finanzas**: líneas por proyecto (ingreso, descuento, coste de edición, otros), margen estimado y final,
  impuestos aparte, cobros y pagos pendientes, paquetes configurables, «Mis pagos» del editor.
- **Auditoría** consultable por administración.

## Implementado sin prueba contra el servicio real

- **Email** vía Resend (sin `RESEND_API_KEY` quedan como «omitidos»; la lógica de bandeja sí está probada).
- **IA** (sugerir categoría, resumir conversación) con Anthropic: solo el camino «desactivada» está probado.

## Pendiente

1. **Almacenamiento de objetos (S3/R2)** con subida multiparte firmada directa desde el navegador:
   imprescindible para desplegar en Vercel y para originales de decenas/cientos de GB.
2. **Pipeline de media** (ffprobe/ffmpeg en un worker): verificar fps (`fpsVerified`), proxies de revisión,
   miniaturas/sprites, forma de onda, marcas de agua.
3. Revisión: adjuntos en comentarios, reacciones, guías de encuadre, tiempo real (SSE), línea recta, orden y
   volumen con prueba automática.
4. **Avisos programados**: entregas próximas y retrasos (cron diario).
5. Recuperación de contraseña por email (hoy la restablece administración).
6. Panel de Premiere (UXP) — ver `docs/PREMIERE_INTEGRATION.md`.
7. Política de retención y purga de archivos (`retainUntil` ya existe en el modelo).
8. Endurecimiento para producción (abajo).

## Bloqueos / necesito de vosotros

- **Premiere**: versión exacta de Premiere Pro y sistema operativo de los editores; decisión sobre contratar
  Frame.io (ver `docs/PREMIERE_INTEGRATION.md`, «Lo que necesito de vosotros»).
- **Almacenamiento**: elegir proveedor (recomendado Cloudflare R2 o AWS S3) y crear un bucket privado con
  claves de acceso limitadas a ese bucket. Me hacen falta: endpoint, región, nombre del bucket, Access Key ID
  y Secret (en variables de entorno del hosting, no por chat).
- **Email**: cuenta de Resend con dominio verificado → `RESEND_API_KEY` y `EMAIL_FROM`.
- **IA** (opcional): decisión de negocio sobre enviar textos de clientes a un proveedor externo, y clave
  `ANTHROPIC_API_KEY` en el servidor. Sin esto, todo funciona en manual.

## Antes de producción

- Proveedor de almacenamiento (arriba) y `APP_SECRET` único; `APP_URL` real.
- Base de datos gestionada con copias de seguridad; `npm run db:deploy` en el despliegue.
- Cron para `/api/cron/outbox` con `CRON_SECRET`.
- Revisar límites de intentos detrás del proxy real (`x-forwarded-for`).
- Content-Security-Policy y HSTS en el hosting.
- Crear la organización y el primer administrador reales (el seed es solo demo; no usarlo en producción).

## Siguiente prioridad

1. S3/R2 con subida multiparte directa (desbloquea el despliegue).
2. Avisos programados de entregas y retrasos.
3. Worker de media (fps verificado, proxies, miniaturas).
4. Panel Premiere UXP en cuanto tengamos la versión de Premiere.
