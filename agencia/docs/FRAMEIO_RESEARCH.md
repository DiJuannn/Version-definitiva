# Investigación: Frame.io como referencia de revisión

Fecha: 29-09-2026. Objetivo: entender el visor, los comentarios, las anotaciones,
las versiones, la comparación, los enlaces y la relación con Premiere de la
versión **actual (V4)** de Frame.io, para decidir qué reproducir en Corte.

## Cómo se ha investigado y límites

- El entorno de trabajo **no puede abrir** `help.frame.io` ni `developer.adobe.com`
  directamente (la política de red devuelve 403). Se ha usado el buscador web, que
  devuelve resúmenes de las páginas oficiales indexadas. Por tanto:
  - Lo que sigue procede de **resúmenes de páginas oficiales** (Knowledge Center V4,
    blog oficial de Frame.io, documentación de Adobe) y, en pocos casos, de terceros
    que se indican como tales.
  - **No se ha usado el producto** (no hay cuenta de Frame.io). Ningún comportamiento
    se ha comprobado de primera mano.
  - Donde la fuente no da detalle, se indica «sin detalle» y no se supone el funcionamiento.
- Frame.io mantiene dos generaciones de documentación: **V4 (actual)** y **Legacy
  (V3)**. Solo se consideran actuales las páginas V4; las Legacy se citan para
  contraste.

## Hallazgos (V4, actual)

### Visor y reproducción
- Atajos tipo NLE: **J / K / L** para rebobinar, pausa/reproducir y avanzar a 2×, 4×, 8×,
  con indicador visual de velocidad. **← / →** avanzan un fotograma; **Mayús + ← / →**,
  10 fotogramas. **F** pantalla completa. [KB V4: Keyboard shortcuts]
- Búsqueda precisa por fotograma al pasar por la línea de tiempo («frame-accurate
  seeking» en el anuncio de la beta V4). [Blog: V4 Player and Commenting]
- Pantalla completa con comentarios, reproducción y zoom anclados abajo. [Blog V4]
- **Guías de encuadre** (relaciones de aspecto) con opción de máscara, desde el
  engranaje del visor. [KB V4: Player page features]
- Bucle («Loop») para clips cortos y reproducción del tramo de un comentario. [KB V4]

### Comentarios
- Comentarios con instante y **por tramo** (se arrastran los corchetes de inicio/fin
  antes de enviar). [KB V4: Commenting on your media]
- **Comentarios anclados** a un punto de la imagen, **adjuntos** (hasta 6 por
  comentario, cualquier tipo, con vista previa) y **reacciones con emoji**. [KB V4; Blog V4]
- **Comentarios internos**: los miembros del espacio de trabajo pueden escribir
  comentarios privados que nunca ven los revisores externos; se elige «Public» o
  «Internal» junto al botón de enviar y se muestra un candado. [KB V4: Comments Panel]
- Panel de comentarios: búsqueda por texto, filtros (hashtags, autor, completados,
  con anotación, con adjunto, con reacción…), marcar como completado con un círculo,
  ocultar o mostrar solo completados. Las respuestas no entran en filtros ni búsqueda. [KB V4: Comments Panel Overview]
- Exportación de comentarios a **CSV, XML, texto plano y FIOJSON**; impresión o
  guardado como PDF respetando el orden elegido. [KB V4: Comment Printing and Exporting]

### Anotaciones
- Herramienta de anotación sobre el fotograma: **flecha, línea, rectángulo y dibujo
  libre**. Un icono indica que el comentario tiene dibujo y, al pulsarlo, se muestra
  en su posición. [KB V4: Getting started with comments]

### Versiones y comparación
- **Pilas de versiones** (version stacking) y **visor de comparación** lado a lado
  para vídeo, imagen, audio y PDF; desde julio de 2026 compara dos activos cualesquiera
  y, en estáticos, ofrece superposición y **diferencia de píxeles**. Disponible en
  todos los planes. [KB V4: Comparison Viewer; Blog 29-07-2026]

### Estado y metadatos
- Campos de metadatos personalizables; se documenta un campo «Review Status» con
  valores como *Needs Review, Needs Revision, Approved*. Los campos personalizados no
  se pueden leer ni escribir por la API V4 (limitación conocida en el foro de
  desarrolladores). [Blog V4 Metadata; foro]

### Compartir
- «Shares» para enviar a clientes: permisos de **comentar** y **descargar**,
  **frase de acceso** y **fecha de caducidad**; seguimiento de apertura, visualización,
  comentarios y descargas. Administración puede fijar caducidad y descarga por defecto. [KB V4: Shares; Content Security]
- Los revisores que solo comentan en enlaces son gratuitos e ilimitados (dato de
  terceros sobre precios; sin confirmar en página oficial).

### Premiere Pro
- Panel **Frame.io V4** dentro de Premiere (Window › Frame.io). Desde Premiere 25.6
  se reconstruyó: los comentarios quedan **ligados a marcadores de la secuencia** (no a
  un tiempo fijo) para no perder su sitio al editar; el panel detecta cambios y propone
  subir versión. [KB V4: Premiere Frame.io V4 Panel Overview (25.6+); anuncio en Adobe Community]
- **No compatibles** con el panel de Premiere, según la documentación: anotaciones,
  comentarios anclados, adjuntos y descargas. [KB V4: Comments Panel Overview (Premiere)]
- Hay reportes en la comunidad de Adobe de marcadores sobrescritos por el panel V4
  (incidencia de usuarios, no documentación oficial).

### Planes y cuentas (terceros, a confirmar en frame.io/pricing)
- Free (2 miembros, 2 GB), Pro, Team y Enterprise. Las suscripciones de Creative Cloud
  con Premiere incluyen un plan ampliado (≈100 GB, hasta 5 proyectos) según la FAQ de Adobe.

### API
- API V4 con OAuth 2.0 vía Adobe Developer Console; la API Legacy (v2) no funciona con
  cuentas V4. Webhooks para eventos (p. ej., comentario nuevo). [developer.adobe.com/frameio; foro]

## Qué conviene reproducir en Corte

1. Visor centrado en la imagen con panel lateral, oscuro y con atajos de NLE.
2. Comentarios de instante, tramo y generales; respuestas; internos frente a públicos.
3. Anotaciones con herramientas básicas y posición exacta sobre la imagen.
4. Comentario como tarea: en Frame.io es un «completado»; en Corte se amplía a un
   flujo de corrección con estados, categoría y responsable (requisito propio).
5. Versiones apiladas, comparación lado a lado con reproducción enlazada.
6. Enlaces con permisos, caducidad, contraseña y seguimiento.
7. Exportación e impresión de comentarios.
8. Aprobación explícita por versión (Frame.io lo resuelve con un campo de estado; Corte
   lo hace con un registro de aprobación inalterable y política configurable).

## Fuentes

- Commenting on your media (V4): https://help.frame.io/en/articles/9105251-commenting-on-your-media
- Comments Panel Overview (V4): https://help.frame.io/en/articles/9105278-comments-panel-overview
- Comment Printing and Comment Exporting (V4): https://help.frame.io/en/articles/9105309-comment-printing-and-comment-exporting
- Keyboard shortcuts (V4): https://help.frame.io/en/articles/9105337-keyboard-shortcuts
- Player page features (V4): https://help.frame.io/en/articles/9105311-player-page-features
- Comparison Viewer (V4): https://help.frame.io/en/articles/9952618-comparison-viewer
- Versioning in Frame.io (V4): https://help.frame.io/en/articles/9101068-versioning-in-frame-io
- Shares in Frame.io (V4): https://help.frame.io/en/articles/9105232-shares-in-frame-io
- Content Security (V4): https://help.frame.io/en/articles/9859752-content-security
- Adding attachments to your comments (V4): https://help.frame.io/en/articles/9105287-adding-attachments-to-your-comments
- Premiere Frame.io V4 Panel Overview (25.6+): https://help.frame.io/en/articles/12833113-adobe-premiere-frame-io-v4-panel-overview-25-6-and-later
- Premiere Frame.io V4 Comments Panel: https://help.frame.io/en/articles/9859849-adobe-premiere-frame-io-v4-comments-panel-overview
- Import Frame.io comments as markers in Premiere (Adobe): https://helpx.adobe.com/premiere/desktop/collaborate-with-others/share-for-review-using-frame-io/import-comments-as-markers.html
- Blog: V4 Player and Commenting: https://blog.frame.io/2024/05/28/frame-io-v4-features-player-and-commenting/
- Blog: Full-Screen Search, Comparison Viewer (29-07-2026): https://blog.frame.io/2026/07/29/new-in-frameio-full-screen-search-comparison-viewer/
- Blog: V4 Metadata & Collections: https://blog.frame.io/2024/04/23/frame-io-v4-beta-metadata-collections/
- Frame.io API (Adobe): https://developer.adobe.com/frameio
- Frame.io for Creative Cloud FAQ (Adobe): https://helpx.adobe.com/x-productkb/multi/frameio-creative-cloud-faq.html
- Premiere UXP API: https://developer.adobe.com/premiere-pro/uxp/ppro-reference/
- Premiere UXP Markers: https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/markers
- Calendario CEP→UXP (Adobe): https://blog.developer.adobe.com/en/publish/2026/09/investing-in-the-future-of-creative-cloud-extensibility-uxp-comes-to-our-flagship-applications
- Incidencia comunidad (no oficial): https://community.adobe.com/t5/premiere-pro-bugs/frame-io-v4-keeps-overwriting-comments-markers-in-premiere-pro-pro/idi-p/15565768
- Precios (terceros): https://krock.io/frame-io-pricing/ , https://www.capterra.com/p/148214/Frame-io/pricing/
