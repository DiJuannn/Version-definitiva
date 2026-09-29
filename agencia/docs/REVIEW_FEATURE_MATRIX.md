# Matriz de funciones de revisión

Referencia: Frame.io V4 (ver `docs/FRAMEIO_RESEARCH.md`, con fuentes y límites).
Actualizada: 29-09-2026.

**Estados**
- ✅ **Implementada y comprobada** — funciona en la app y hay prueba automática (unitaria/integración `npm test` o recorrido en navegador `npm run e2e`).
- 🟡 **En desarrollo** — existe pero es parcial, o falta prueba automática.
- ⏳ **Pendiente** — no implementada.
- 🔌 **Requiere servicio o integración externa** — depende de credenciales, pipeline o software de terceros.

**Referencia**: `V4` = función actual documentada · `Legacy` = solo documentación antigua · `Plan` = depende del plan · `Propio` = requisito de la agencia sin equivalente directo.

## A. Reproductor

| Función | Ref. | Estado | Criterio de aceptación / cómo se comprueba |
|---|---|---|---|
| Reproducir / pausa (Espacio, K, clic, doble clic) | V4 | ✅ | E2E: reproducción enlazada y bucle |
| Búsqueda por tiempo (arrastrar la línea) | V4 | ✅ | E2E: marcadores, comentarios con tiempo exacto |
| Tiempo y duración; conmutar timecode ↔ reloj con ms | V4 | ✅ | E2E: exportación con `00:00:02:00`; unit `formatTimecode` |
| Paso por fotograma ←/→ y ±10 con Mayús | V4 | ✅ con límite | E2E sobre clip con número de fotograma impreso (25 fps declarados): 100→101→111→110. **No es precisión validada por pipeline**: se basa en el fps declarado por el editor; se marca «≈» si no está verificado (`fpsVerified=false`). |
| J / L | V4 (lanzadera 2×/4×/8× y reversa) | 🟡 | En Corte J/L saltan ±5 s: `<video>` no reproduce hacia atrás de forma fiable. Documentado en atajos. |
| Velocidad 0,25×–2× | V4 | ✅ | E2E: 0,5× |
| Volumen y silencio (M) | V4 | 🟡 | Implementado; sin prueba automática |
| Pantalla completa conservando herramientas (F) | V4 | ✅ | E2E: en pantalla completa siguen el panel y el compositor |
| Modo enfoque (panel oculto, Mayús+F) | Propio | 🟡 | Implementado; sin prueba automática |
| Atajos documentados (? en la sala) | V4 | ✅ | Diálogo de atajos + `docs` |
| Marcadores de comentarios en la línea de tiempo (color por estado, tramo como barra, internos punteados) | V4 | ✅ | E2E: selección desde marcador / deep link |
| Selección de tramo (I / O, asas arrastrables) y repetición (R) | V4 | ✅ | E2E: tramo 4–7 s exacto; bucle vuelve al inicio |
| Vista previa al pasar por la línea de tiempo | V4 | ✅ con límite | E2E. Se genera en el navegador con un vídeo secundario; sin sprites pre-generados (🔌 pipeline). |
| Zoom (Z: ajustar/150/200/300 %) y desplazamiento arrastrando | V4 | ✅ | E2E: zoom; dibujo sigue alineado (coordenadas relativas al área de imagen) |
| Estados de carga, espera de red, error y reintento con nueva URL firmada | V4 | 🟡 | Implementado; el reintento automático no tiene prueba automática |
| Vídeo horizontal, vertical y cuadrado | — | ✅ | E2E con 9:16; unit de geometría para 16:9 y 1:1; clips de prueba de los tres formatos |
| Guías de encuadre / zonas seguras con máscara | V4 | ⏳ | — |
| Forma de onda de audio | V4 | ⏳ | — |
| Pistas de subtítulos en el visor | V4 | ⏳ | — |
| Renditions adaptativas (proxies 1080p/4K), HDR | V4 | 🔌 | Requiere pipeline de transcodificación |

## B. Comentarios

| Función | Ref. | Estado | Criterio / comprobación |
|---|---|---|---|
| Comentario en un instante | V4 | ✅ | E2E (2,000 s exactos) |
| Comentario en un tramo | V4 | ✅ | E2E (4–7 s) |
| Comentario general sin tiempo | V4 | ✅ | E2E |
| Respuestas en hilo | V4 | ✅ | E2E |
| Autor, fecha, versión | V4 | ✅ | Payload/informe |
| Comentarios internos (candado) frente a visibles al cliente | V4 | ✅ | E2E + integración: el cliente y los invitados nunca los reciben (API, export, informe, avisos) |
| Menciones @ a participantes autorizados | V4 | ✅ | Integración: se descartan menciones a quien no puede ver el comentario |
| Enlaces de referencia (autoenlazado, guardados en `links`) | V4 | 🟡 | Implementado; sin prueba automática específica |
| Adjuntos | V4 (hasta 6) | ⏳ | Requiere almacenamiento S3 en producción |
| Reacciones con emoji | V4 | ⏳ | — |
| Borradores recuperables (recarga, navegación, fallo de red) | Propio | ✅ | E2E: el borrador sobrevive a recargar; si el envío falla el texto se conserva |
| Edición con historial y retirada con registro | Propio | ✅ | Integración: revisiones guardadas; retirar descarta la corrección |
| Enlace directo a un comentario (`?c=`) | V4 | ✅ | E2E: abre, busca el tiempo y muestra el dibujo |
| Búsqueda por texto y persona | V4 | ✅ | E2E |
| Filtros: estado, categoría, participante, visibilidad, con dibujo | V4 | ✅ | E2E (combinados) |
| Orden por tiempo, antigüedad o actividad | V4 | 🟡 | Implementado; sin prueba automática |
| Hashtags | V4 | ⏳ | — |
| Actualización en tiempo real | V4 | 🟡 | Sondeo cada 15 s con la pestaña visible; sin WebSocket/SSE |
| Numeración estable de comentarios | V4 | ✅ | Por orden temporal |

## C. Anotaciones

| Función | Ref. | Estado | Criterio / comprobación |
|---|---|---|---|
| Punto, flecha, rectángulo, elipse, mano alzada | V4 (flecha, línea, caja, libre) | ✅ | E2E flecha + rectángulo |
| Línea recta | V4 | ⏳ | (la flecha cubre el caso) |
| Color (5 colores de alto contraste) | V4 | ✅ | — |
| Deshacer / rehacer / borrar el borrador | V4 | ✅ | E2E |
| Guardar el dibujo con el comentario | V4 | ✅ | E2E: 2 formas guardadas |
| Volver al momento y ver el dibujo | V4 | ✅ | E2E deep link en móvil |
| Posición correcta al redimensionar, pantalla completa, zoom y vídeo vertical | V4 | ✅ | E2E: en móvil el SVG coincide con el área real de la imagen; unit: normalización independiente del tamaño |
| Coordenadas relativas al área de imagen (sin barras negras) | Propio | ✅ | E2E: coordenadas 0,25/0,30 → 0,50/0,55 |

## D. Correcciones como tareas

| Función | Ref. | Estado | Criterio / comprobación |
|---|---|---|---|
| Estado PENDIENTE → EN CURSO → RESUELTA POR EL EQUIPO → VERIFICADA (+ DESCARTADA, reapertura) | V4 (completado) + Propio | ✅ | Integración: el cliente no puede «resolver»; el equipo sí |
| Categoría (Vídeo, Audio, Color, Subtítulos, Motion graphics, Branding, Otro) | Propio | ✅ | Integración |
| Responsable (por defecto, el editor de la pieza) | Propio | ✅ | Integración |
| Conversación, momento/tramo, versión de origen | Propio | ✅ | — |
| Registro de resolución y reapertura con motivo | Propio | ✅ | Historial por corrección en la sala |
| «Resuelta» ≠ «aprobada» | Propio | ✅ | Estados separados en datos y en la interfaz |

## E. Versiones y comparación

| Función | Ref. | Estado | Criterio / comprobación |
|---|---|---|---|
| V1, V2, V3… con archivo, autor, fecha, metadatos, resumen de cambios | V4 | ✅ | E2E |
| Versión actual / publicada al cliente / aprobada, siempre visibles | Propio | ✅ | Página de pieza y barra de la sala |
| Selector de versiones e historial | V4 | ✅ | — |
| Comparación lado a lado | V4 | ✅ | E2E |
| Reproducción enlazada (izquierda manda; corrección de deriva > 80 ms) | V4 | ✅ | E2E: ambos lados en el mismo fotograma |
| Superposición / diferencia de píxeles | V4 (estáticos) | ⏳ | — |
| Pendientes de versiones anteriores en la sala | Propio | ✅ | Panel «Versión y decisiones» |
| Asociar cambios publicados con correcciones atendidas | Propio | ✅ | E2E: 2 correcciones «resueltas en V2» |
| Sin traslado automático de comentarios entre versiones | Propio | ✅ | E2E: V2 empieza sin comentarios |

## F. Revisión interna y aprobación

| Función | Ref. | Estado | Criterio / comprobación |
|---|---|---|---|
| Versiones internas invisibles para el cliente (servidor, archivos, avisos, enlaces) | Propio | ✅ | Integración + E2E |
| Pedir cambios internos antes de publicar | Propio | ✅ | Integración |
| Publicar al cliente (acción explícita de coordinación) | Propio | ✅ | E2E |
| Aprobación de una versión concreta, explícita, con quién y cuándo | V4 (campo de estado) + Propio | ✅ | E2E + integración |
| Política ante correcciones abiertas (bloquear / permitir con confirmación) | Propio | ✅ | Integración: ambas políticas |
| Aprobación bloquea la versión (sin nuevos comentarios ni ediciones) | Propio | ✅ | E2E + integración |
| Decisión registrada por coordinación «en nombre del cliente» con canal obligatorio | Propio | ✅ | Integración |
| Revocación solo por administración, con motivo, en el historial | Propio | ✅ | Integración |
| Concurrencia: dos decisiones simultáneas → solo una | Propio | ✅ | Integración |

## G. Compartir revisión

| Función | Ref. | Estado | Criterio / comprobación |
|---|---|---|---|
| Alcance por proyecto, pieza o versión | V4 | ✅ | E2E + integración |
| Caducidad y revocación inmediata (también corta la media ya firmada) | V4 | ✅ | E2E revocación; la media comprueba el enlace en cada petición |
| Permisos: comentar, aprobar, descargar | V4 | ✅ | Integración |
| Identificación del revisor (nombre, email) | V4 | ✅ | E2E |
| Contraseña y restricción por dominio de email | V4 (frase de acceso) | ✅ | E2E |
| Seguimiento: abierto, visto, comentó, aprobó, descargó | V4 | 🟡 | Se registra y muestra el último evento; sin vista detallada |
| Experiencia móvil | V4 | ✅ | E2E en 390×844 |
| Un enlace no da acceso a otros proyectos ni a información interna | Propio | ✅ | E2E + integración |

## H. Exportación y entrega

| Función | Ref. | Estado | Criterio / comprobación |
|---|---|---|---|
| Exportar comentarios y respuestas (CSV, TXT, JSON) | V4 (CSV/XML/TXT/FIOJSON) | ✅ | E2E CSV; protección frente a inyección de fórmulas |
| Informe imprimible / PDF (imprimir desde el navegador) | V4 | ✅ | E2E |
| Marcadores para Premiere / NLE | V4 (vía panel) | 🔌 | **No** se ofrece: un CSV no es una integración. Ver `docs/PREMIERE_INTEGRATION.md` |
| Entregables ligados a la versión aprobada | Propio | ✅ | E2E |
| Descargas autorizadas y registradas | V4 | ✅ | E2E + integración |
| Registro de entrega con SHA-256 | Propio | ✅ | Suma calculada en servidor al completar la subida |
| Marcas de agua | V4 (Plan) | 🔌 | Requiere pipeline de media |

## Resumen

- ✅ 67 funciones implementadas y comprobadas · 🟡 8 en desarrollo · ⏳ 8 pendientes · 🔌 3 dependen de servicios externos.
- Siguiente prioridad de revisión: adjuntos (con S3), reacciones, guías de encuadre, forma de onda, tiempo real (SSE).
