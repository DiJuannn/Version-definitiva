---
name: trailer-motion
description: Método probado (v2, con el enfoque «estudio, no prompt») para hacer reels, tráileres / vídeos promocionales de producto en motion graphics con nivel "Apple / Linear / Buck" (mascota animada que guía con voz en off, UI simulada, cámara viva, música sincronizada por beats, todo sintetizado en local) usando HyperFrames + GSAP y equipos de agentes. Usar SIEMPRE que pidan un tráiler, vídeo demo, promo, explainer animado o "un vídeo como el del ajolote", para este u otro producto/público. Contiene el pipeline completo, las plantillas de prompts para los agentes, la librería de sonido y voz, el rig de personaje y un ejemplo real terminado.
---

# Tráiler en motion graphics · método "ajolote"

Este método produjo el tráiler v2 de *Versión definitiva · Taller* (65,5 s, 1920×1080, 30 fps), que el usuario aprobó a la primera ("me encantó, está perfecto"). La v1, hecha a mano en una sola pasada, fue rechazada por plana. Lo que cambió no fue la herramienta: fue el **proceso**. Sigue el proceso.

> **Regla de oro:** el estilo es fijo, el contenido cambia. Para otro producto o público se cambian el guion, el mundo visual y la mascota. Se mantienen el pipeline, el nivel de exigencia, las reglas de movimiento y el sistema de sonido.

---

## 0. Qué gustó (no lo pierdas al adaptarlo)

1. **Gancho de dolor real en 3 s**, no "¡Hola, soy X!". Ejemplo: «Cuarenta guasaps. Tres éxcels. Y nadie sabe quién trae la escalera.» Primero caos y después un *time-freeze*.
2. **Arco emocional** caos → orden → magia → el gran día → cierre, con intertítulos de tráiler de cine (fondo negro, Archivo condensada 900, corte seco en el golpe): DEL CAOS… / …AL ORDEN… / …A LA MAGIA. / UN DÍA. UN EQUIPO. UNA TOMA.
3. **Las funciones contadas como beneficio**, con frases cortas y personalidad («Lo que falta, te lo chivo yo.»), y un remate cómico tras el logo («¿Otra, por seguridad?»).
4. **Mundo visual con identidad, sin degradados**. Superficies planas encendidas (mesa de luz opal) e inundaciones de color sólido por fase (geles), papel, sombras tintadas, grano de película y perforaciones. Cada fotograma pausado funciona como póster.
5. **Una mascota que actúa** y provoca la acción: revienta la burbuja, señala, guiña, va en el avión de papel, sostiene la claqueta. Rig SVG con squash & stretch, branquias con *follow-through*, 10 bocas y *lipsync* con la voz.
6. **Transiciones que nacen de los objetos** (nunca el mismo barrido repetido):
   - la página se pliega en acordeón y se vuelve tabla;
   - las palabras se despegan del guion y vuelan a contarse;
   - picado de cámara a través del ojo de la mascota;
   - las rayas de la claqueta barren la pantalla;
   - rebobinado que condensa la historia en el logo.
7. **Música de tráiler a 120 BPM**: subida de tensión (*build-up*) con *riser* y redoble que acelera, **silencio total** antes del clímax, golpe exacto y *drop*. Hay un motivo que vuelve: los pings de estrés del principio regresan afinados y alegres.
8. **Todo sincronizado desde una única tabla de tiempos** (`cues.js`), compartida por el audio y la imagen.

---

## 1. Herramientas (todo local y gratuito, sin APIs de pago)

| Pieza | Qué es | De dónde sale |
|---|---|---|
| Render de vídeo | **HyperFrames** (HeyGen): composiciones HTML + GSAP renderizadas a MP4 con Chrome headless | `npx hyperframes …` (CLI de npm). Las skills `hyperframes`, `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-registry` y `hyperframes-cli` se instalan/actualizan con `npx hyperframes skills update <nombre>` |
| Animación | **GSAP 3** (un único `gsap.timeline({paused:true})` por composición) | `npm i gsap` → copiar `node_modules/gsap/dist/gsap.min.js` a `assets/` (no CDN) |
| Voz en off | **Kokoro TTS** (modelo abierto, ONNX, en local) | `pip install kokoro-onnx soundfile`. Modelos de las releases de GitHub: `https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx` (guardar como `kokoro.onnx`) y `…/voices-v1.0.bin` (guardar como `voices.bin`). Hugging Face estaba bloqueado en el entorno; GitHub funcionó |
| Voz "cuca" | Voz española `ef_dora` + filtro ffmpeg `asetrate=24000*1.2,aresample=48000,atempo=0.86` (tono +20 % y tempo compensado) + recorte de silencios | `kit/tts/voz.sh` |
| Música y efectos | **100 % sintetizados con numpy**: no hay ningún sample ni librería de sonidos externa, así que no hay problemas de licencias | `kit/audio/sfxlib.py` |
| Fuentes | Archivo variable (wdth 62–125, wght 100–900), JetBrains Mono, Courier Prime (texto de guion), Permanent Marker (notas a rotulador, ≤4 usos) | `npm pack @fontsource-variable/archivo`, `@fontsource-variable/jetbrains-mono`, `@fontsource/courier-prime`, `@fontsource/permanent-marker` → extraer los `.woff2` de `files/` |
| Verificación | `npx hyperframes check`, `npx hyperframes snapshot --at … --no-end --describe false`, ffmpeg para extraer fotogramas y medir audio (`ebur128`, `volumedetect`) | — |

**Entorno:** Chromium ya instalado (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). HyperFrames descarga su propio Chrome la primera vez. El render es por software (no hay WebGL), así que **nada de shaders**; el 3D CSS sí funciona. Usa siempre `ffmpeg -nostdin` dentro de bucles.

---

## 2. El pipeline (5 fases)

```
F0 Brief + v1 rápida ──► F1 5 especialistas (investigación y diseño, en paralelo)
      ──► F2 Síntesis: voz por líneas + banda sonora + cues.js + contrato BUILD.md + root
      ──► F3 5 constructores (una sección cada uno, en paralelo, con autocrítica por snapshots)
      ──► F4 Integración, fotogramas clave al usuario, render, normalización
```

Coste orientativo del ejemplo:
- **F1:** 5 agentes, unos 0,85 M tokens y unos 30 min.
- **F3:** 5 agentes, unos 1,7 M tokens y unos 80 min.
- **Render:** 14 min para 65 s, por software.

La regla de la sesión fue que solo se lanzan workflows multiagente si el usuario lo pide; aquí lo pidió («pon a 5 agentes en ello»). Si no lo pide, ofrécelo con este coste.

### F0 · Brief y v1 rápida (opcional pero útil)
- Fija el producto, su cadena real de funciones (lo que se va a enseñar), el público, la mascota (imagen de referencia), la paleta y la marca, la duración (55–70 s) y el formato (16:9; 9:16 si es para Reels/TikTok).
- Elegir la voz entre 2–3 muestras del TTS ayuda: el usuario eligió la «voz 2».
- Una v1 rápida de una sola pasada sirve de referencia negativa para los especialistas («esto es lo que NO queremos»). Guarda sus hojas de contacto.

### F1 · Cinco especialistas en paralelo (plantilla: `kit/workflows/fase1-especialistas.js`)
Cada uno recibe el **mismo bloque de CONTEXTO** (producto, cadena de funciones, marca, mascota, crítica del usuario, recursos, restricciones técnicas) y escribe un `.md` accionable con valores concretos (hex, eases, tiempos, código):

| Agente | Entregable | Lo que aportó en el ejemplo |
|---|---|---|
| **1. Referencias** | Catálogo de 15–25 técnicas de tráileres admirados (Apple, Linear, Stripe, Duolingo, Saul Bass, *Catch Me If You Can*, *Stranger Things*, Buck, Spider-Verse…), cada una con su traducción a HTML/GSAP, «las 5 que dan el salto» y la estructura de actos | Plano secuencia, transiciones que nacen del objeto, montaje al ritmo de la música, tipografía que actúa |
| **2. Guion** | 3 conceptos → el elegido justificado; tabla con nº, inicio, duración (13,5 car/s), locución exacta con grafía fonética para el TTS, texto en pantalla, qué se ve, intención y música/SFX; taglines | Concepto «Del caos a ¡acción!», intertítulos, *callback* de los pings, remate tras el logo |
| **3. Personaje** | Rig SVG nuevo + biblioteca de poses en GSAP + una composición de prueba revisada con snapshots en ≥3 rondas | `poses.js`: swimIn, hopTo, wave, point, surprise, think, celebrate, clapSnap, wink, trip, peek, scaleTo, lipsync… |
| **4. Dirección de arte** | 3 direcciones exploradas → 1 elegida; capas del mundo, paleta exacta con contraste WCAG comprobado, sistema tipográfico, UI simulada, luz, grano, 4 fotogramas póster renderizados | «Mesa de luz»: opal + geles por fase, sin degradados, filtro *sticker* para la mascota sobre color |
| **5. Coreografía** | Eases propios, escala de duraciones, cámara como función pura del tiempo, catálogo de transiciones con código probado, música por beats (BPM, estructura, SFX), qué bloques del registry de HyperFrames sirven y una lista de errores de lint | Curvas `vd.*`, cámara one-take con parallax y desenfoque, picado al ojo, plegado 3D, `sfxlib.py` |

Pide en cada prompt que **critique la v1** y que **pruebe su propuesta** (snapshots o render) antes de entregar. Los entregables completos del ejemplo están en `ejemplo-taller/investigacion/01…05.md`: léelos como modelo de profundidad.

### F2 · Síntesis (la hace la sesión principal, no un agente)
1. **Fijar la tabla de tiempos.** Coge los tiempos del guion y cuantízalos a la rejilla de 120 BPM (beat 0,5 s, compás 2 s). Los golpes importantes caen en el compás; los intertítulos, en contratiempo.
2. **Voz por líneas.** Genera **un WAV por frase** con `kit/tts/voz.sh "texto" Lxx.wav [vel]`, mide su duración y comprueba que cabe en su hueco: si no cabe, recorta texto (no subas la velocidad por encima de 1,15). La grafía fonética va solo para el TTS: «guasaps», «éxcels», «estoribord». Usa velocidad 0,85 y −6 dB para susurrar («Preparados…»), y 1,1 y +2 dB para el grito («¡Acción!»).
3. **Banda sonora + `cues.js`** con `ejemplo-taller/audio/build.py` como plantilla, apoyado en `kit/audio/sfxlib.py`. Coloca cada voz en su tiempo, define los golpes (`H = {...}`), la música por secciones, los SFX en cada golpe, el *sidechain* de la música bajo la voz y el *master*. El script escribe `assets/audio/banda.wav` y `assets/cues.js` (golpes, voz, envolvente para el *lipsync* a 30 fps). Comprueba los silencios (deben medir −180 dB) y la sonoridad (≈ −17 LUFS; al final se normaliza a −14).
4. **Contrato `BUILD.md`** (modelo: `ejemplo-taller/BUILD.md`): objetivo de calidad, tiempos, reparto de secciones con contenido golpe a golpe, reglas técnicas, cómo probar y qué entregar.
5. **Root `index.html`** (modelo: `ejemplo-taller/index.html`): el audio, los slots de las sub-composiciones, los intertítulos, el grano global a 12 fps y las fuentes.
6. **Proyecto compartido:** `assets/` con gsap, poses.js, el rig, arte.css, fuentes, voz, banda y cues.

### F3 · Cinco constructores en paralelo (plantilla: `kit/workflows/fase2-constructores.js`)
- Cada uno construye **una sub-composición** (`compositions/secX.html`, con `<template>`, tiempo local, timeline `window.__timelines["secX"]` e ids prefijados `secX-`), con su propio arnés de prueba (copia del proyecto + `index.html` que monta solo su sección + el audio de su tramo con `data-media-start`).
- **Cortar el tráiler por los intertítulos negros** (9,0 / 23,0 / 40,0 / 49,0 s): así cada sección empieza y acaba «bajo cubierta» y la integración es trivial. Cuando un corte no tiene intertítulo (whip de C→D1), el contrato fija la dirección y velocidad del latigazo a ambos lados.
- **Mascota con prefijo distinto por sección** (`axA`, `axB`…): `AxRig(tl,{prefix:"axB"})` y reemplazo del prefijo en el marcado.
- Cada constructor debe hacer **≥3 rondas de snapshots** en los golpes ±2 fotogramas, criticarlos como director/a de arte exigente y, si puede, renderizar su tramo y revisarlo a 10 fps.
- El prompt base insiste en el nivel: «el usuario quiere que la gente quede fascinada; la v1 fue rechazada por plana; nada aparece con fade; todo entra por una causa».

### F4 · Integración y entrega
1. `npx hyperframes check` en el root. Con 6 sub-composiciones pesadas, la auditoría de navegador puede agotar su tiempo (`check_runtime_failure`): en ese caso vale el check de cada sección por separado más snapshots del total.
2. `npx hyperframes snapshot --at <~36 tiempos> --no-end --timeout 60000 --describe false` → mira las hojas de contacto, corrige y **envía los fotogramas clave al usuario antes del render final**.
3. Render: `npx hyperframes render -o out.mp4` (en segundo plano; unos 13 s de render por segundo de vídeo).
4. Normaliza el audio para redes: `ffmpeg -i out.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.0:LRA=11 -c:a aac -b:a 192k final.mp4`.
5. Extrae 5 fotogramas en los golpes para verificar la sincronía y entrega con `SendUserFile`, avisando de que el scratchpad se borra.

---

## 3. Reglas de calidad (las que más se notaron)

**Movimiento** (detalle en `ejemplo-taller/investigacion/05-coreografia.md`):
- **Curvas propias** registradas con `gsap.registerEase` (bezier + resorte, sin CustomEase):

  | Curva | Uso |
  |---|---|
  | `vd.land` | entradas |
  | `vd.settle` | contadores y logo |
  | `vd.glide` | cámara |
  | `vd.push` | empujes lentos |
  | `vd.whip` | latigazos |
  | `vd.dive` | picados |
  | `vd.exit` | salidas |
  | `vd.spring` | **solo** la mascota |

  `back.out` genérico está prohibido.
- **Cada entrada tiene causa:** la cámara llega, un objeto puente la trae, la mascota la provoca o cae en un golpe musical. Nunca un fade a secas.
- Anticipación (15–25 %) → acción → asentamiento con *overshoot* ≤6 % en una sola propiedad.
- *Stagger* en ola desde un origen con sentido, con tope total de 0,5 s.
- *Holds* de lectura: un titular necesita al menos máx(1 s; 0,3 s × palabras).
- **La cámara es una función pura de t** sobre una tabla de *keyframes*: zoom en escala logarítmica, cámara en mano con senos y sin aleatorio, parallax de 3 planos, y desenfoque calculado de la velocidad, aplicado a un contenedor fijo y solo en paneos.
- Las estaciones duran cada vez menos: el tráiler se siente así porque acelera.
- **Mascota:**
  - squash & stretch con volumen constante;
  - las branquias o el pelo van 2–3 fotogramas por detrás;
  - la mirada llega antes que el gesto;
  - la respiración es una suma de senos, no un yoyo;
  - parpadeo de 2 + 1 + 3 fotogramas;
  - *lipsync* por niveles de la envolvente de la voz, solo en los tramos de habla.

**Arte** (detalle en `ejemplo-taller/investigacion/04-arte.md`):
- Cero `radial-gradient`/`linear-gradient` decorativos.
- Cada escena tiene una superficie (claro, color de fase u oscuro) y como mucho un acento. Alternar claro → color → oscuro da ritmo.
- Sombras tintadas con el color de la superficie, nunca negro puro sobre color.
- Texto sobre rojo siempre en tinta oscura; contraste AA comprobado.
- La mascota lleva el filtro *sticker* (borde claro de 6 px + sombra) siempre que esté fuera de una superficie clara.
- Grano global animado por pasos a 12 fps. Perforaciones de película solo en 2–3 momentos.
- Evita los tres clichés de IA: crema + serif + terracota, negro + verde ácido, y periódico con filetes.

**Sonido:**
- La voz va en líneas sueltas, la música baja −8 dB bajo la voz y los golpes visuales caen en el fotograma del golpe o uno antes.
- Los *whooshes* llevan su pico en el momento de máxima velocidad de la cámara, con paneo que sigue el movimiento.
- Silencio total antes del clímax, con un pulso grave debajo del *riser* para que el *build-up* no quede flaco.

**Contrato técnico de HyperFrames** (lo que más errores dio):
- Un solo timeline pausado, registrado **al final** del script.
- Sin `Math.random` ni `Date.now`: PRNG con semilla. `repeat` finitos con `Math.max(0, Math.floor(...)-1)`.
- Ningún CSS `transform` inicial en algo que anima GSAP: usa `fromTo`. Si repites `fromTo` sobre la misma propiedad, pon `immediateRender:false` en los siguientes.
- No animar `visibility`/`display` de un `.clip`, ni `letterSpacing` (salta de píxel): usa `scaleX`.
- `<audio>` con `id` y sin `crossorigin`. `@font-face` local para cada familia con nombre.
- Sin `getBoundingClientRect` en tiempo de tween: coordenadas de autor.
- En el rig SVG, un mismo elemento no mezcla traslación con rotación o escala (grupos `xY` / `x`), y cada tween SVG lleva `svgOrigin`.
- **Bug conocido del rig:** `poses.js` (≈ línea 349) tiene la clase `.ax-bub` cableada. Con otro prefijo, las burbujas de estela no salen. Si las necesitas, cámbialo por `"." + P + "-bub"`.

---

## 4. Cómo adaptarlo a OTRO proyecto (público o producto distinto, mismo estilo)

1. **Rellena el CONTEXTO** de `kit/workflows/fase1-especialistas.js`:
   - producto y cadena real de funciones;
   - público y su dolor concreto, que es la fuente del gancho;
   - marca (colores y nombre);
   - mascota (ruta de la imagen) y su mundo (agua para el ajolote);
   - plataforma y duración;
   - lo que el usuario ya ha rechazado.

   Cambia las rutas `S`/`P` de los scripts.
2. **Traduce la metáfora del mundo, no la copies.** «Mesa de luz con geles por fase» funcionó porque *es* la marca de una app de cine. Para otro producto, pide al agente de arte la superficie equivalente del mundo del cliente y que conserve las reglas: superficies planas que emiten luz o color, un color por fase de la cadena del producto, materiales físicos y cero degradados. Ejemplos: cocina → encimera y azulejo con salsas como geles; música → mesa de mezclas con LEDs de canal; educación → pizarra y tizas de color.
3. **Traduce el arco:** el dolor reconocible del público → un *freeze* → la mascota toma el mando → la cadena de funciones con intertítulos de tres palabras → el clímax con el objeto icónico del sector (claqueta → horno que suena, pitido de salida, campana…) → el logo → el remate cómico con la frase real del gremio.
4. **Mascota:**
   - Si es el ajolote, reutiliza `kit/rig/` tal cual.
   - Si es otra, el agente de personaje rehace el rig con `kit/rig/gen.js` y `poses.js` como plantilla (misma jerarquía de grupos y API de poses; cambian la geometría y los apéndices con *follow-through*).
   - Si no hay mascota, el papel de «quien provoca la acción» lo hace un objeto: un cursor, una mano, la propia tipografía.
5. **Reparte las secciones** cortando por los intertítulos y escribe el `BUILD.md` partiendo del ejemplo: cambia la tabla de secciones y los tiempos y deja intactas las reglas técnicas y de prueba.
6. **Formatos:**
   - **9:16:** 1080×1920; repite F3 con la tabla de secciones adaptada, sin intentar reencuadrar el 16:9.
   - **15–30 s:** quita una estación por acto y conserva gancho, *freeze*, clímax y logo.

---

## 4 bis. Método «estudio, no prompt» (v2 de la skill)

Sale de dos reels de marca (JD Molina, 9:16) y de las fichas de Clawd Motion Lab / *Motion Engineering* (`referencias/`). Es lo que separa un vídeo «hecho con IA» que se parece a todos (texto grande centrado, degradado, fundidos y logo al final) de uno dirigido.

1. **Contrato de producción, no «vibe prompt».** Usa `kit/prompts/contrato-de-produccion.md`:
   - Un bloque **MARCA** que es lo único que cambia: HÉROE, PRODUCTO, RESULTADO, MUNDO, PALETA y HECHOS.
   - FORMATO, BEATS (con estado de entrada, estado de salida y motivo), CÁMARA, LOOK, una regla de movimiento por cada clase de objeto, y COMPUERTAS.
2. **Hechos frente a decisiones.** El modelo inventa la cámara; nunca la interfaz, los créditos, las cifras ni el papel de cada persona.
   - Ejemplo: en *A un minuto de la libertad*, JD Molina fue ayudante, no director.
   - Si falta un asset o un dato: **parar y preguntar**, o marcarlo `[CONFIRMAR]` y dejarlo fuera de la imagen. Antes de dibujar un dato, compruébalo en la fuente: la hora 1:39 salía del PDF del guion.
3. **Una tabla para todo:** `cues.js` con los tiempos (hits) **y** las posiciones (layout). La leen la imagen, el audio y los textos. El tempo se elige para que N compases llenen la duración.
4. **Cada movimiento cambia algo.** Si un beat no cambia el estado de la pantalla, se corta. Muestra la lógica real del oficio: keyframes, cabezal, CORTE / L-CUT / J-CUT.
5. **Ritmo legible.** Cada titular o imagen importante se lee con calma (≥ 1,2 s). Se puede acelerar sin perder legibilidad.
   - Para re-temporizar una pieza ya hecha **sin rehacerla**, usa el mapa partitura→tiempo real de `kit/warp/`: estirar ×K (120 → 96 BPM), pausas animadas y cortes de pulso entero.
   - El audio aplica el mismo mapa (`R()`, `cut()`).
6. **El logo nunca quieto.** Si tiene que quedarse en pantalla, entra un visor, empuja y se cierra (el sting JDM de 0,8 s).
7. **Las fotos flojas se sustituyen por motion graphics con intención:** una página de guion digital en lugar de la foto borrosa de la hoja, o un plano de planta dibujándose en lugar de una foto de ensayo.
8. **Mide, no adivines.** Usa los scripts de `kit/checks/`:
   - `hoja-contactos.sh`: un fotograma por beat.
   - `tira-transicion.sh`: fotogramas consecutivos en los cortes rápidos.
   - `sonoridad-medio-segundo.py`: comprueba que el drop cae donde explota la imagen.
   - `espectrograma.sh`: detecta un muro de graves o un slow-mo sin hueco.
   - `costura-bucle.py`: para loops, la costura tiene que quedar dentro del rango de los fotogramas vecinos.
9. **Correcciones con números** (`kit/prompts/follow-ups.md`): lo que se ve → el cambio exacto → solo ese tramo.
10. **Variantes compuestas, no recortadas.** El 9:16 se monta de nuevo, con tipografía mayor y menos elementos a la vez.
11. **El estudio vive en archivos.** BUILD.md, cues.js, build.py, la guía de estilo y los checks. La siguiente pieza cambia la MARCA y conserva todo lo demás.
12. **Entrega:**
    - Sonoridad: −14 LUFS para redes y −1 dBTP.
    - Vídeo: H.264 CRF 17–18 con `+faststart`.
    - Grano sutil solo si no dispara el bitrate.
13. **3D real** (mascota que sale de la pantalla, coches, mundos): Blender + GPU, en el PC del usuario. Ver `referencias/blender-3d.md`. En la nube no hay GPU: quédate en HyperFrames.

---

## 5. Archivos de esta skill

```
kit/
  audio/sfxlib.py          librería numpy: whoosh, riser, boom, reverse_cymbal, ping, pop, ui_click, shutter,
                           clapper, sparkle, stamp, marker_swipe, pencil, tape_stop, reverb, kick, hat, pluck,
                           pad, sidechain, master (estéreo, 48 kHz, deterministas)
  tts/say.py, voz.sh       Kokoro local + filtro "voz 2"
  rig/poses.js             AxRig(tl,{prefix,seed}) → poses (ver ejemplo-taller/investigacion/03-ajolote.md §3–§5)
  rig/ajolote.html         marcado SVG del rig con prefijo "ax"
  rig/gen.js               generador de la geometría del rig
  arte/arte.css            tokens y componentes de la dirección "Mesa de luz"
  workflows/fase1-especialistas.js   script de Workflow: 5 especialistas (adaptar CONTEXTO y rutas)
  workflows/fase2-constructores.js   script de Workflow: 5 constructores (adaptar secciones y rutas)
  prompts/contrato-de-produccion.md  plantilla de brief: bloque MARCA intercambiable + beats + compuertas
  prompts/follow-ups.md              cómo escribir correcciones con números (ejemplos reales)
  checks/                  hoja-contactos.sh, tira-transicion.sh, sonoridad-medio-segundo.py,
                           espectrograma.sh, costura-bucle.py
  warp/                    mapa partitura→tiempo real (estirar, pausas animadas, cortes de pulso):
                           build-con-mapa.py (audio), envoltorio-seccion.js (imagen), sincronizar-duraciones.py
referencias/
  clawd-no-after-effects.pdf, clawd-neon-jump.pdf   fichas originales (Blender + Opus)
  motion-engineering-articulo.md                     artículo «Build a Video Studio Around Opus»
  blender-3d.md            cuándo pasar a 3D y las técnicas que se copian aunque sigamos en 2D
ejemplo-taller/
  investigacion/01-referencias.md … 05-coreografia.md   entregables reales de F1 (modelo de profundidad)
  BUILD.md                 contrato real de F3
  index.html               root real (intertítulos, grano, slots)
  compositions/secA…secE   las 6 secciones reales del tráiler aprobado
  audio/build.py           banda sonora real + generador de cues.js
  audio/locuciones.tsv     las 17 líneas de voz (id, velocidad, texto)
```

Los binarios (modelo de Kokoro de 92 MB, WAV, MP4) no están en el repo: se regeneran con los pasos de §1 y §2.
