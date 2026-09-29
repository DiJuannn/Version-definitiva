# Integración con Adobe Premiere Pro

Estado: **estudio y decisión propuesta. Nada implementado ni probado en Premiere.**
Corte funciona completo sin Premiere y sin cuenta de Frame.io.

Fuentes y límites de la investigación: ver `docs/FRAMEIO_RESEARCH.md` (no se pudo
abrir la documentación directamente; se trabajó con resúmenes de páginas oficiales).

## El problema

El editor trabaja en Premiere y hoy copia a mano las correcciones del cliente. Queremos
que las correcciones lleguen a la línea de tiempo como marcadores y que publicar una
versión desde Premiere sea directo, sin crear dos historiales que se contradigan.

## Alternativa 1 · Conectar Frame.io y usar su panel oficial

Cómo sería: la agencia contrata Frame.io (o usa el plan incluido con Creative Cloud),
el editor usa el panel Frame.io V4 de Premiere (25.6+) y Corte sincroniza con Frame.io
por su API V4 (OAuth de Adobe + webhooks).

| Aspecto | Valoración |
|---|---|
| Experiencia del editor | Muy buena dentro de Premiere: comentarios ligados a marcadores de la secuencia, detección de cambios y subida de versión desde el panel. |
| Compatibilidad | Premiere 25.2+ (panel de comentarios); 25.6+ para el panel reconstruido. |
| Costes | Suscripción Frame.io por miembro (Pro/Team) o plan incluido en CC con límites (≈100 GB, 5 proyectos, según FAQ de Adobe). A confirmar en frame.io/pricing. |
| Dependencias | Cuenta Frame.io, Adobe Developer Console (OAuth), API V4 y webhooks; la API V4 **no** permite leer/escribir campos de metadatos personalizados (limitación conocida). |
| Publicación de versiones | Desde el panel, a Frame.io. Corte tendría que importar la versión (descargar/transcodificar o enlazar). |
| Comentarios y marcadores | Nativos del panel. **Pero** el panel no admite anotaciones, comentarios anclados, adjuntos ni descargas: los dibujos del cliente no llegan a Premiere. |
| Sincronización | Bidireccional Corte ↔ Frame.io: comentarios, respuestas, estados. Cada lado tiene su modelo (completado vs. correcciones con 5 estados, internos vs. públicos, aprobaciones). |
| Conflictos | Alto riesgo: dos sistemas de comentarios y dos estados de aprobación. Reportes de la comunidad sobre marcadores sobrescritos por el panel V4. |
| Mantenimiento | Medio-alto: dependemos de cambios de la API de Frame.io (ya rompió v2→V4). |

**Fuente principal de cada dato si se eligiera**: Corte = proyectos, piezas, correcciones,
aprobaciones, enlaces al cliente. Frame.io = solo transporte de comentarios al panel del
editor. Aun así habría que definir reglas de conflicto para ediciones en ambos lados.

## Alternativa 2 · Panel propio de Corte para Premiere (UXP)

Cómo sería: un plugin UXP de Premiere («Panel Corte») que el editor instala con Creative
Cloud. Se autentica contra Corte, muestra las correcciones abiertas de la pieza y crea
marcadores en la secuencia con la API oficial `Markers`; al terminar, exporta y sube la
versión a Corte por la misma API de subida reanudable.

| Aspecto | Valoración |
|---|---|
| Experiencia del editor | Buena y a medida: lista de correcciones con estado, «ir al marcador», marcar «en curso/resuelta», subir versión con resumen y correcciones atendidas. Los dibujos pueden abrirse en la sala de Corte (enlace directo al comentario). |
| Compatibilidad | UXP es oficial en Premiere desde **25.6**; CEP deja de aceptar envíos en dic-2027 y se desactiva por defecto en dic-2028, así que UXP es la vía con futuro. |
| Costes | Sin licencias adicionales. Coste de desarrollo y firma/distribución del plugin. |
| Dependencias | Solo Premiere 25.6+ y la API de Corte. |
| Publicación de versiones | Exportación desde Premiere (preset de revisión) + subida directa a Corte; queda como versión interna para coordinación. |
| Comentarios y marcadores | `Markers` permite crear/mover/borrar marcadores en secuencias. Cada marcador guarda el id de la corrección de Corte. |
| Sincronización | Unidireccional por defecto: Corte → Premiere (marcadores) y Premiere → Corte (estado de la corrección y nueva versión). Sin segundo historial. |
| Conflictos | Bajos: Corte es la única fuente de verdad; el marcador es una vista. Si el editor mueve el marcador, no se reescribe el tiempo del comentario (pertenece a la versión revisada). |
| Mantenimiento | Medio: API UXP de Premiere todavía evoluciona; requiere probar en cada versión mayor. |

## Recomendación

**Alternativa 2 (panel propio UXP)**, por tres motivos: Corte ya es la fuente de verdad
de correcciones, internos y aprobaciones; evita pagar y sincronizar un segundo sistema de
comentarios; y UXP es la plataforma oficial con recorrido. La Alternativa 1 puede
reconsiderarse si la agencia contrata Frame.io por otros motivos (p. ej., Camera to Cloud).

Mientras tanto, **no** se ofrece un CSV como «integración con Premiere». Las exportaciones
CSV/TXT/JSON son solo para leer o archivar.

## Plan propuesto (cuando se desbloquee)

1. API para plugins: tokens personales por usuario (revocables, con alcance «edición»),
   endpoints de correcciones abiertas por pieza y de subida (ya existe la subida reanudable).
2. Prototipo UXP: iniciar sesión, elegir pieza, crear marcadores desde correcciones con
   `Markers.createAddMarkerAction`, abrir el comentario en la sala.
3. Estados: marcar «en curso/resuelta» desde el panel.
4. Subida de versión: exportar con preset, subir y asociar correcciones atendidas.
5. Validación en la versión real de Premiere de la agencia, con proyecto de prueba.

## Lo que necesito de vosotros

1. **Versión exacta de Premiere Pro** que usan los editores (Ayuda › Acerca de Premiere Pro)
   y sistema operativo (macOS/Windows y versión). Motivo: UXP requiere 25.6 o superior.
2. **Confirmar si queréis contratar Frame.io** (y qué plan). Si la respuesta es no, sigo con la
   Alternativa 2. Si es sí, necesitaré una cuenta de prueba y acceso a Adobe Developer Console
   para crear las credenciales OAuth (lo hacéis vosotros; me pasáis Client ID y el secreto por
   un canal seguro, nunca por chat ni en el repositorio).
3. Para probar el panel propio: un equipo con Premiere donde se pueda instalar un plugin en
   modo desarrollador (UXP Developer Tool) y una secuencia de prueba. Yo no puedo ejecutar
   Premiere en este entorno, así que la validación final la haríamos juntos.
