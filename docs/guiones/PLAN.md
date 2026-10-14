# Guiones — plan del módulo de escritura

> Herramienta de escritura de guiones (cortometrajes, largometrajes y series)
> dentro de Taller. **Independiente** de los proyectos de producción, **en
> tiempo real** desde el primer día y **sin IA que escriba**: la historia es
> siempre del equipo. La IA solo podrá entrar más adelante en herramientas
> que sumen alrededor (nunca proponiendo historia), y siempre opcional.

---

## 1. Principios

1. **El guion es una historia, no un documento.** Escenas, personajes,
   localizaciones, tramas y siembras son datos vivos. La página es una vista
   más, no la única.
2. **Todo de vosotros.** Ninguna función genera texto narrativo. Las ayudas
   para desbloquear son preguntas, mapas y espacios de prueba, no respuestas.
3. **Tiempo real por defecto.** Varios guionistas en la misma página, cada uno
   con su cursor, sin "guardar" ni conflictos (CRDT con Yjs).
4. **Formato profesional sin pensar.** Tab/Enter cambian el tipo de bloque
   como en Final Draft; el PDF sale con el formato estándar de la industria.
5. **Formatos abiertos.** Importar/exportar Fountain (y FDX más adelante): tu
   guion nunca queda encerrado en Taller.
6. **Puente con producción.** Cuando el guion se bloquea, pasa a un proyecto
   de Taller sin subir PDFs ni análisis con IA, y cada revisión posterior avisa
   a producción de qué ha cambiado.

---

## 2. Arquitectura

### 2.1 Dónde vive

- Zona propia en el menú principal: **`/app/guiones`** (nivel organización,
  como Calendario o Tareas). No depende de ningún proyecto.
- Cada guion: **`/app/guiones/[screenplayId]`** con pestañas por vista
  (Página, Corcho, Línea temporal, Personajes…).
- Más adelante, **enlace de lector** público: `/guion/[token]` (como ya
  existe `/hoja` o `/pizarra` para compartir).

### 2.2 Modelo de datos (Prisma)

Fase 1:

```prisma
enum ScreenplayFormat { SHORT FEATURE SERIES_EPISODE OTHER }

model Screenplay {
  id             String           @id @default(cuid())
  organizationId String
  createdById    String?
  title          String
  format         ScreenplayFormat @default(SHORT)
  logline        String?
  // Estado Yjs completo (binario). Es la fuente de verdad del texto.
  ydoc           Bytes?
  // Copia JSON del documento (derivada del Yjs en cada guardado): sirve
  // para PDF, Fountain, búsquedas y estadísticas sin cargar Yjs.
  content        Json?
  pageCount      Int              @default(0)
  sceneCount     Int              @default(0)
  wordCount      Int              @default(0)
  // Fase 5: proyecto de Taller al que se pasó el guion.
  projectId      String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
}
```

Fases siguientes (se añadirán al llegar):

| Modelo | Fase | Para qué |
|---|---|---|
| `ScreenplayCard` | 2 | Tarjeta del corcho (escena o beat), acto/secuencia, color, tensión 0-10, orden de historia vs. orden en pantalla |
| `ScreenplayCharacter` | 2-3 | Ficha: deseo, miedo, secreto, arco, entrevista |
| `ScreenplayThread` | 3 | Siembra ↔ recogida, preguntas abiertas al público |
| `ScreenplayKnowledge` | 3 | Qué sabe cada personaje / el público en cada escena |
| `ScreenplayBranch` | 3 | Ramas "¿Y si…?" (copia Yjs de una escena o acto) |
| `ScreenplayVersion` | 3 | Instantáneas con nombre (borrador 1, 2, bloqueado…) |
| `ScreenplayComment` | 4 | Comentarios anclados a una posición del texto |
| `ScreenplayShare` | 4 | Enlaces de lector y de lectura de mesa |
| `ScreenplayRevision` | 5 | Revisiones de colores tras bloquear (azul, rosa, amarillo…) |

### 2.3 Documento del editor

Editor **TipTap (ProseMirror)** con un esquema propio de guion. Cada línea es
un bloque con tipo:

| Bloque | Ejemplo | Enter → | Tab → |
|---|---|---|---|
| `sceneHeading` | INT. COCINA - NOCHE | Acción | Acción |
| `action` | Lucía abre la nevera. | Acción | Personaje |
| `character` | LUCÍA | Diálogo | Acción |
| `parenthetical` | (en voz baja) | Diálogo | Diálogo |
| `dialogue` | No queda nada. | Personaje | Acotación |
| `transition` | CORTE A: | Encabezado | Encabezado |
| `shot` | PLANO DETALLE: la llave | Acción | Acción |
| `note` | Nota privada (no se imprime) | Acción | Acción |

Atajos: `Ctrl/⌘ + 1…8` para cambiar el tipo directamente. Escribir `INT.`,
`EXT.` o `INT./EXT.` al principio de una acción la convierte en encabezado; una
línea en mayúsculas acabada en `A:` se convierte en transición.

Autocompletado: personajes ya usados (al escribir en `character`),
localizaciones y momentos del día (`- DÍA`, `- NOCHE`, `- ATARDECER`…) en
encabezados.

### 2.4 Tiempo real

Ya existe Supabase Realtime en el repo (moodboard, plan de rodaje, mapa del
proyecto, presencia). El guion lo usa así:

```
Navegador A ──(update Yjs, base64)──► canal Supabase "guion:<id>" ──► Navegador B
     │                                                                    │
     └──── cada ~2 s: guardar estado ──► servidor fusiona (Y.applyUpdate) ◄┘
                                          en Postgres + JSON derivado
```

- **Edición:** cada cambio local se emite como update de Yjs por *broadcast*.
  Los demás lo aplican; Yjs garantiza que todos convergen al mismo texto.
- **Al entrar:** se carga el estado guardado en la base de datos y se pide a
  los conectados lo que falte (intercambio de *state vectors*).
- **Guardado:** el servidor **fusiona** el update recibido con el que tiene
  (no lo sustituye), así dos guardados simultáneos nunca se pisan.
- **Presencia y cursores:** *awareness* de Yjs por el mismo canal; cada
  guionista con nombre y color (mismo sistema de colores que el moodboard).

**Canal en vivo del resto de Taller (pendiente, herramienta a
herramienta):** un canal por proyecto `proyecto-vivo:<projectId>`. Toda acción
que guarda (desglose, shot list, tareas, presupuesto, call sheets…) emite
`{ tipo, id, quien }` y las pantallas abiertas de ese proyecto se refrescan
solas (`router.refresh()`), con un aviso discreto "Marta actualizó el
desglose".

---

## 3. Fases

### Fase 1 — Base ✅ (rama `feature/guiones`)

- [x] Modelo `Screenplay` + migración.
- [x] `/app/guiones`: lista con título, formato, páginas, escenas, última
      edición; crear guion (título, formato, logline).
- [x] Editor con formato profesional (bloques, Tab/Enter, atajos, conversión
      automática, autocompletado de personajes).
- [x] Página con aspecto de folio real (Courier 12, márgenes estándar),
      contador de páginas (≈1 página/minuto) y navegador de escenas.
- [x] Tiempo real con Yjs: edición simultánea, cursores con nombre, quién está
      conectado.
- [x] Guardado automático con fusión en servidor + indicador "Guardado".
- [x] Exportar **PDF** con formato estándar (portada, escenas numeradas,
      `(MÁS)`/`(CONT.)` en cortes de diálogo), en A4 o Carta.
- [x] Importar y exportar **Fountain**.
- [x] Entrada "Guiones" en el menú de Taller.

### Fase 2 — Vistas de la historia ✅ + Referencias e IA ✅

Todo vive en el mismo documento Yjs que el texto (mapas `scenes`, `acts`,
`structure`, `characters`, `refs`, `ai`): llega en tiempo real a todo el
equipo y se guarda con el guion. Cada escena tiene un id propio (`sid` en su
encabezado) que sobrevive a moverla o renumerarla.

- [x] **Corcho:** una ficha de cartulina por escena, por actos (3, 5 o libre).
      Sinopsis, tensión, color y referencias en la ficha; arrastrar (o ←/→)
      mueve la escena en el guion.
- [x] **Doble línea temporal:** orden en pantalla vs. orden en la historia;
      las líneas que se cruzan marcan los saltos en el tiempo.
- [x] **Curva de tensión** por escena, con los actos marcados.
- [x] **Personajes:** ficha (quiere, necesita, teme, oculta, arco, notas),
      su hilo escena a escena y sus referencias ("me recuerda a…").
- [x] **Referencias** a mano o sugeridas por la IA, ancladas a la historia,
      a una escena o a un personaje: películas, escenas, series, libros, arte,
      música, escenarios, ideas de montaje, notas de dirección. Mesa con
      filtros y buscador; marca en las escenas que tienen referencias.
- [x] **IA que entiende la historia (Mistral)**, sin escribir nunca guion:
      - *Historia*: lectura de premisa, temas, tono, personajes y estructura,
        corregible por el equipo (la versión corregida guía las demás ayudas).
      - *Referencias sugeridas* por escena, personaje o historia, a una
        bandeja (borde discontinuo) que el equipo guarda o descarta.
      - *Preguntas para seguir* cuando no sabes cómo continuar.
      - Límite diario por guion (gratis 3, PRO 40) y el texto se envía a
        Mistral solo al pulsar una ayuda.

### Rediseño ✅ — un camino en 3 pasos

Tras probar las pestañas (Página, Corcho, Tiempo, Personajes, Referencias,
Historia) quedó claro que había demasiadas tarjetas y demasiado que explorar.
Ahora el guion se trabaja en **modo foco** (sin el menú de Taller), en claro
como el papel, y en tres pasos que no son obligatorios:

1. **Idea:** idea, tesis, logline, sinopsis, tono y mundo, personajes (con
   ficha e imágenes) y referencias. Todo opcional.
2. **Escaleta:** la historia escena a escena en una lista por actos, con la
   curva de tensión y el orden "como se ve" / "como pasa". Añadir aquí una
   escena crea su encabezado en el guion.
3. **Guion:** el folio, con un panel lateral de la escena (de qué va, quién
   sale, referencias, «¿atascada?»).

- Al crear un guion se elige por dónde empezar; se puede saltar de paso
  cuando se quiera, y lo que se escribe en el guion rellena solo la escaleta
  y los personajes.
- La IA vive en un único botón (**Asistente IA**) y en el panel de la escena.
  Opción de **proponer referencias solas al terminar cada escena**.
- **Vínculo con Taller** (Ajustes → Proyecto): las fichas aparecen en
  Personajes y las referencias e imágenes en el Moodboard, al día solos.
- **Proveedor de IA intercambiable:** Mistral (por defecto), Gemini o Groq
  con `SCREENPLAY_AI_PROVIDER`.

### Importar, revisar y reparto ✅

- **Importar PDF** sin IA: escenas (también numeradas, "3.EXT."), personajes,
  acotaciones y diálogos (aunque estén centrados), transiciones; quita las
  cabeceras y pies repetidos y toma la autoría de un "Grup:/Autor:" repetido.
  Probado con *Distorsión* (17 págs.): 10 escenas y 4 personajes.
- **Revisar mi guion** (IA): dudas concretas por escena (siembras sin recoger,
  continuidad, motivación, claridad, ritmo, personajes). Salen en el Asistente,
  en el panel de cada escena y como marca en la lista de escenas.
- **Más contexto para la IA:** las ayudas de una escena leen la escena entera,
  la anterior, la siguiente y la historia resumida escena a escena.
- **Mesa de guiones:** cada guion es su portada en papel; la cabecera del
  editor mantiene el estilo de Taller para que entrar no sea un salto.
- **Personajes de Taller como reparto:** retrato por personaje, actor, escenas
  en las que sale y lo esencial de su ficha del guion.

### Fase 3 — Oficio y desbloqueo

- **Siembra y recogida:** marcar un detalle como siembra y enlazar su pago;
  aviso de siembras sin recoger.
- **Mapa de conocimiento:** qué sabe cada personaje y el público en cada
  escena (ironía dramática, giros).
- **Ramas "¿Y si…?":** versiones alternativas de una escena o acto, comparar
  y fusionar.
- **Versiones:** instantáneas con nombre y comparación lado a lado.
- **Estadísticas:** reparto de diálogo por personaje, escenas por
  localización, día/noche, interior/exterior, páginas por acto.
- **Panel "Hilos sueltos"** (desbloqueo): siembras sin pagar, preguntas sin
  responder, personajes desaparecidos N páginas, actos vacíos.
- **Baraja de preguntas de oficio** según el punto de la estructura (escritas
  por personas; editable por la organización).
- **Escribir hacia atrás:** empezar por el final o una escena clave suelta.
- **Entrevista al personaje:** responder como el personaje; las respuestas van
  a su ficha.
- **Borrador sucio:** espacio de escritura libre sin formato ni páginas.
- **Sala de guionistas en vivo:** pizarra compartida para lanzar ideas, votar
  y pasar la ganadora al corcho.
- **Modo foco y sprints:** pantalla limpia, objetivos de páginas, racha.

### Fase 4 — Lectura y feedback

- **Enlace de lector** con comentarios anclados a una línea.
- **Modo lectura de mesa:** cada actor lee desde su móvil con sus frases
  resaltadas; se mide la duración real de cada escena.
- **Notas de revisión** con estado (pendiente, resuelta, descartada).

### Fase 5 — Puente con producción

- **Lente de producción** (opcional mientras escribes): nº de localizaciones,
  escenas de noche, personajes con frase, figuración.
- **Bloquear guion → proyecto de Taller:** crea escenas, personajes y
  localizaciones del proyecto directamente, sin PDF ni IA.
- **Revisiones de colores:** tras bloquear, los cambios generan páginas de
  revisión; producción recibe en vivo "la escena 23 cambió → revisa desglose y
  día 4 del plan".
- **Web pública `/taller`:** nueva sección "Guiones" en la presentación.

### Más adelante (opcional, a decidir)

- IA **"espejo"**: solo hace preguntas o resume lo escrito, nunca propone
  historia. Desactivada por defecto.
- Exportar/importar **Final Draft (FDX)**.
- App móvil: lectura y comentarios.

---

## 4. Decisiones técnicas

| Tema | Decisión | Motivo |
|---|---|---|
| Editor | TipTap 3 (ProseMirror) | Esquema propio, extensible, integración oficial con Yjs |
| Tiempo real | Yjs sobre Supabase Realtime (broadcast) | Ya se usa Supabase Realtime; Vercel no mantiene websockets propios |
| Persistencia | Estado Yjs en `Bytes` + JSON derivado | Fusión segura en servidor; JSON para PDF/búsquedas sin Yjs |
| PDF | `@react-pdf/renderer` (ya instalado) | Mismo sistema que call sheets |
| Formato abierto | Fountain | Estándar abierto, texto plano, compatible con Highland, WriterSolo, Final Draft (import) |
| Permisos | Por organización (como proyectos) | Coherente con el resto de Taller |

## 5. Riesgos y cómo se cubren

- **Tamaño del canal:** los updates de Yjs son pequeños (bytes por tecla);
  un guion largo entero (~120 págs.) ocupa unos cientos de KB, solo se manda
  al entrar y por diferencias.
- **Sin conexión un rato:** Yjs guarda los cambios locales y los fusiona al
  volver; el indicador muestra "Sin conexión — se guardará al volver".
- **Dos pestañas del mismo usuario:** cada pestaña es un cliente Yjs distinto,
  no hay conflicto.
