# 01 · Referencias de motion design para el tráiler «Versión definitiva · Taller»

Investigación de los motion de lanzamiento y secuencias de títulos más admirados, traducida a técnicas concretas para HyperFrames (HTML/CSS/SVG + GSAP determinista, 1920x1080, 55-70 s, render por software).

---

## 0. Diagnóstico de la v1 (por qué "no fascina")

Lo he sacado de contact-sheet-1/2:

1. **Todas las escenas son la misma diapositiva.** Panel a la izquierda, titular a la derecha y ajolote en una esquina. Pasa 8 veces. Se ve como un deck con transiciones, no como un tráiler. Ninguna referencia de primer nivel repite la misma composición dos veces seguidas.
2. **No hay cámara.** Cada escena aparece y desaparece en su sitio. Falta lo que más fascina en Apple, Linear o Vercel: la sensación de que **una sola cámara recorre un mundo continuo**.
3. **El fondo es un degradado radial amarillo/rosa con burbujas.** Lee como "plantilla", no tiene materia y no cuenta nada. Además, las burbujas del acuario chocan con la metáfora de cine.
4. **El ajolote es una pegatina.** Siempre de frente, del mismo tamaño y en una esquina. No toca el interfaz, no lo empuja ni lo provoca. En Duolingo o Headspace la mascota **es la causa** de lo que pasa en pantalla.
5. **La tipografía no actúa.** Los titulares entran y se quedan quietos. En los títulos de referencia el texto se comprime, se estira, se corta y hace de puerta a la siguiente escena.
6. **Sin ritmo musical.** Los cambios no caen en golpes, y no hay silencio antes del clímax.
7. **El clímax (¡ACCIÓN!/¡CORTEN!) es la mejor parte**, pero el confeti genérico lo abarata y llega sin una tensión previa que lo justifique.

Conclusión: el salto no vendrá de pulir cada escena. Viene de **cambiar la gramática**: un mundo continuo, una cámara, transiciones que nacen de los objetos, tipografía que actúa, una mascota que causa las cosas y una música que manda.

---

## 1. Catálogo de técnicas (ordenadas por impacto)

Formato de cada técnica: **Qué es** · **Dónde se ve** · **Cómo en HTML/GSAP** · **Escena nuestra**.

### T1. Plano secuencia sobre un "mundo-lienzo" (one-take camera)
- **Qué:** todo el producto vive en un único plano gigante (p. ej. 7680x4320). La "cámara" es un contenedor que se traslada, escala y rota. No hay cortes, solo viajes. El espectador entiende que todo está **conectado**, que es justo el mensaje del producto (cadena guion→rodaje).
- **Dónde:** películas de producto de Apple en keynote (atraviesan el módulo de cámara del iPhone y salen a Apple Park, con el corte escondido); "Shot on iPhone: Hermitage" (5 h en una toma); los films de Linear, que mueven la cámara por el producto real "una acción cada vez"; Vercel Ship y Stripe Sessions, con zooms continuos por un lienzo de UI.
- **HTML/GSAP:** `#world { position:absolute; width:7680px; height:4320px; transform-origin:0 0 }`. Cada "estación" (Guion, Mesa, Desglose…) tiene coordenadas fijas. La cámara es una función:
  ```js
  function cam(x, y, s, r = 0, d = 1.4, ease = "expo.inOut", at) {
    // centra el punto (x,y) del mundo en pantalla con escala s
    tl.to("#world", { x: 960 - x * s, y: 540 - y * s, scale: s, rotation: r,
                      duration: d, ease }, at);
  }
  ```
  Entre estaciones: `expo.inOut` 1.2–1.6 s, o `power4.inOut` si va con golpe. Para "despegar" hay un dezoom intermedio con `keyframes` (s 1 → 0.45 → 1), que deja ver el camino recorrido. Usa `will-change: transform` y fija el texto con `force3D:false` al llegar, para que no salga borroso.
- **Escena:** la columna vertebral de todo el tráiler. Las 7 herramientas son estaciones de una misma "mesa de luz" vista desde arriba.

### T2. Match cut / transición nacida del objeto (graphic match)
- **Qué:** la forma final de una escena **es** la forma inicial de la siguiente. Un círculo se convierte en un sol, una línea de texto en una fila de tabla, un rectángulo en un encuadre.
- **Dónde:** Apple (pasar "a través" de la lente); "Any Given Wednesday" (iPad Pro), donde un movimiento motivado continúa en el plano siguiente y se sella con speed-ramp; Saul Bass (líneas que se vuelven edificios en *North by Northwest*); los títulos de *Catch Me If You Can*, donde las letras se integran en los decorados por petición de Spielberg.
- **HTML/GSAP:** FLIP manual. Se mide el `getBoundingClientRect()` del elemento A y el destino B se coloca encima, con su misma caja (`x,y,scaleX,scaleY`). Después se anima a su caja real mientras A hace `opacity:0` en 1 frame. En el instante del cambio se mete un **speed ramp**: `ease: "expo.inOut"` + 2-3 frames de `filter: blur(6px)` en el eje de movimiento (motion-blur falso con `scaleX:1.04`).
- **Escena:**
  - el encabezado `3. EXT. FURGONETA — DÍA` subrayado → se estira y se convierte en la **fila 3 de la Mesa**;
  - la palabra marcada `abrigo rojo` → vuela y se convierte en una **muestra de color de la paleta** del Moodboard;
  - el rectángulo de un plano del storyboard → se convierte en la **casilla de una jornada** del plan;
  - la claqueta que cierra → **corte a negro** sincronizado.

### T3. Música manda: edición al golpe + "drop" con silencio previo
- **Qué:** cada cambio importante cae en un beat. Antes del clímax hay **0.4–0.8 s de silencio casi total**, que prepara la explosión.
- **Dónde:** cualquier tráiler de Pixar/Illumination (el "beat… beat… ¡golpe!" del gag final); Apple (cortes al tempo del tema); Vercel Ship (contadores sincronizados).
- **HTML/GSAP:** fija un BPM (p. ej. **112 BPM → 0.536 s por beat**, compás = 2.143 s) y define `const B = 60/112; const at = n => n*B;`. Todo el timeline va en múltiplos de beat: `tl.add(label, at(32))`. Usa `hyperframes beats` para extraer los golpes de la pista y redondear. El drop:
  ```js
  tl.to("#world", { scale: s*1.06, duration: at(2), ease: "sine.in" }, at(96)); // tensión lenta
  tl.set("#vo, #music", { /* ducking a -30 dB */ }, at(98));           // silencio
  tl.from("#accion", { scale: 3, opacity: 0, duration: 0.18, ease: "power4.out" }, at(99)); // golpe
  ```
- **Escena:** transición "Plan de rodaje → ¡ACCIÓN!". El ajolote coge aire (anticipación) en el silencio y la palabra golpea en el beat 1 del drop.

### T4. Tipografía cinética que hace de decorado (type as set)
- **Qué:** las palabras no rotulan la escena: **son** la escena. Se comprimen, se estiran y llenan la pantalla, y la cámara las atraviesa.
- **Dónde:** "chapter push" de *Stranger Things* (Imaginary Forces, heredado de Pablo Ferro en *Bullitt*): las letras se deslizan, se juntan y la cámara empuja **a través** de ellas; los títulos de crédito de Saul Bass; Figma Config y Apple WWDC (tipografía variable que respira).
- **HTML/GSAP:** Archivo variable (wdth 62–125, wght 100–900). Para la palabra entera, ancho comprimido → expandido sincronizado a la VO:
  ```css
  .kin { font-family: Archivo; font-variation-settings: "wdth" var(--w), "wght" var(--g); }
  ```
  ```js
  tl.fromTo(".kin", { "--w": 62, "--g": 900, letterSpacing: "-0.06em" },
                    { "--w": 125, "--g": 800, letterSpacing: "0em", duration: 0.7, ease: "expo.out" });
  ```
  (registra `--w` y `--g` con `@property` como `<number>` para que interpolen.) Para el **push-through**: `scale` de 1 a 18 en 0.6 s `power4.in`, con el centro en el hueco interior de una letra (la "O" de RODAJE o la "Ó" de ACCIÓN). En ese hueco ya está la escena siguiente, así que pasas por dentro de la letra.
- **Escena:** apertura ("De una idea… a un rodaje"), la palabra RODAJE como puerta al acto 3, y el logo final.

### T5. Personaje con rig y animación de 12 principios (squash, anticipación, follow-through)
- **Qué:** la mascota se mueve como un dibujo animado de verdad: anticipación antes de cada acción, squash/stretch en arranques y aterrizajes, partes que **llegan tarde** (branquias y cola) y parpadeos.
- **Dónde:** Duo de Duolingo (Duolingo compró los estudios Gunner y Hobbes; su motion usa squash & stretch, follow-through y anticipación); Headspace (personajes blandos que respiran); Freddie de Mailchimp; los cortos de Pixar/Illumination.
- **HTML/GSAP:** **rehacer el ajolote como SVG en capas** a partir de `public/ajolote.png`, sin cambiar el diseño. El PNG sirve solo como referencia de trazado, y si el usuario prefiere conservar el PNG, se usan recortes por capas. Grupos: `#body`, `#head`, `#gillL1..3`, `#gillR1..3`, `#tail`, `#armL/#armR`, `#eyeL/#eyeR`, `#mouth`, `#blush`. Cada grupo con `transform-origin` en su articulación.
  - Idle (respirar): `#body scaleY 1→1.03` y `scaleX 1→0.985`, 1.6 s `sine.inOut`, yoyo.
  - Branquias con retardo (follow-through): misma onda `rotation ±6°` desfasada 0.08 s por pluma (`stagger: {each: .08, from: "start"}`). Al frenar la cámara, las branquias sobrepasan 10° y vuelven (`back.out(2)` solo aquí).
  - Salto: anticipación `scaleY .85 scaleX 1.12` en 0.12 s `power2.in` → vuelo `scaleY 1.15 scaleX .9` en 0.25 s `power3.out` → aterrizaje squash `scaleY .88` en 0.06 s → asentarse `power3.out` 0.3 s.
  - Parpadeo: `#eyeL,#eyeR scaleY 1→0.1→1` en 0.12 s, a tiempos fijos y no regulares (2.1, 5.8, 6.1, 11.4 s…), con doble parpadeo de vez en cuando.
  - Mirada: las pupilas se desplazan ±4 px **antes** de que el cuerpo gire (los ojos lideran, la cabeza sigue 0.1 s después y el cuerpo 0.2 s después).
  - Boca sincronizada a la VO: 3 formas (cerrada / media / abierta) intercambiadas según la amplitud del TTS precalculada (`hyperframes transcribe` → onsets), cambiando cada 2–3 frames.
- **Escena:** todas. Lo esencial es que **el ajolote cause cada transición** (ver T6).

### T6. La mascota como motor de la acción (character-driven UI)
- **Qué:** la mascota no comenta: **hace**. Empuja la tabla, marca palabras con un rotulador, arrastra fotos y da la palmada que cierra la claqueta.
- **Dónde:** anuncios de Duolingo; Clippy/Freddie en spots de Mailchimp; la secuencia de *Catch Me If You Can*, donde dos figuras se persiguen por decorados con flechas amarillas que las siguen y el color de cada decorado cambia.
- **HTML/GSAP:** el ajolote tiene una `MotionPath` (SVG path invisible) por escena. Al llegar a un elemento, su "mano" (`#armR`) se alinea con el target y el target reacciona en el mismo frame (`physics-press-reaction`: el target baja 3 px y escala 0.97, luego vuelve con `power3.out`). Para una "flecha amarilla" al estilo Bass, un triángulo `#f0c94a` sigue al ajolote con `lag` de 0.15 s.
- **Escena:**
  - Desglose: el ajolote lleva un **rotulador** gordo y subraya `taza rota`. El trazo se dibuja con `stroke-dashoffset` siguiendo su mano.
  - Mesa: el ajolote salta sobre una casilla roja "Falta" y la vuelve verde (squash al aterrizar + la casilla hace pop).
  - Moodboard: lanza las fotos como cartas.
  - Rodaje: cierra la claqueta.

### T7. Fondo con materia: superficie física, luz y grano (sustituye al degradado)
- **Qué:** el fondo es un **sitio**, no un color: una mesa de luz de montador, una mesa de corte o un papel de guion. Tiene textura, marcas de registro, reglas, cinta y una luz que cambia con la fase.
- **Dónde:** títulos de *Juno* (Shadowplay): todo digital pero con aspecto de lápiz de color y recorte de papel fotocopiado; los "light hits" de *Stranger Things*, luz que atraviesa la película; los mundos táctiles de Oddfellows y Giant Ant; las texturas de grano de Arc Browser.
- **HTML/GSAP:**
  - Base plana `#0b0b0d`. **Sin degradado radial**.
  - **Retícula de mesa de corte**: SVG `pattern` de líneas `#1d1d22` cada 48 px y `#2e2e35` cada 240 px, con números de regla en JetBrains Mono 11 px `#2e2e35` en los bordes del mundo. Al mover la cámara, la retícula da la sensación de velocidad y de escala.
  - **Grano estático determinista**: `<filter><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/></filter>` sobre un `rect` a pantalla completa con `mix-blend-mode: overlay`. Para que "viva", cambia `seed` cada 2 frames con una tabla fija (`[7,13,2,29,…]`), es decir, grano a 12 fps como en película.
  - **Luz de mesa** (sustituye al glow): no es un degradado de fondo. Es un **haz rectangular** de esquinas suaves (`filter: blur(80px)` sobre un `div` de 1400x900 color del gel de la fase con `opacity .07`) que la cámara "pisa", como la caja de luz sobre la que se ponen los negativos. Cambia de gel por fase: `#ece8dc` escribir → `#f0c94a` preparar → `#f0503f` rodar → `#4fc47f` entregar (crossfade de 0.8 s).
  - **Objetos de mesa** dispersos en el mundo, en capas de parallax (T8): trozos de cinta de carrete, marcas de registro (cruz con círculo de 1 px), clips, una regla y las perforaciones de película.
- **Escena:** todas. Es el "decorado" del plano secuencia.

### T8. Parallax de 3–4 planos con profundidad real
- **Qué:** al mover la cámara, los planos cercanos van más rápido que los lejanos. Da volumen sin 3D.
- **Dónde:** los títulos de Pixar (*Up*, *Coco*); ManvsMachine; Apple (dispositivos flotando sobre el fondo).
- **HTML/GSAP:** cuatro contenedores con su propio factor, que siguen a la cámara en el mismo tween:
  ```js
  const layers = [["#bgGrid", .35], ["#bgObjs", .6], ["#world", 1], ["#fgObjs", 1.35]];
  function camAll(x, y, s, d, ease, at) {
    layers.forEach(([sel, k]) => tl.to(sel, { x: (960 - x*s)*k, y: (540 - y*s)*k,
      scale: 1 + (s-1)*k, duration: d, ease }, at));
  }
  ```
  El primer plano (`#fgObjs`: un trozo de celo, el borde desenfocado de una claqueta, una hoja de guion) va con `filter: blur(6px)` y `opacity .5`, que funciona como **profundidad de campo**.
- **Escena:** todos los viajes de cámara entre estaciones.

### T9. Revelado por máscara/forma (clip-path, iris, cortinilla con forma de la marca)
- **Qué:** la escena siguiente aparece **dentro de una forma** que significa algo: el visor de cámara, la silueta del ajolote o el rectángulo de una claqueta.
- **Dónde:** iris de los títulos clásicos; las transiciones de Stripe Sessions; máscaras tipográficas de Apple (la imagen dentro de las letras); los títulos de *Catch Me If You Can*.
- **HTML/GSAP:**
  ```js
  tl.fromTo("#sceneB", { clipPath: "inset(48% 46% 48% 46% round 12px)" },
           { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: .9, ease: "expo.inOut" });
  ```
  Para la máscara con silueta del ajolote, un `<clipPath>` SVG con el path del cuerpo escalado de 0.1 a 40 desde la cabeza. Para el visor de cámara, las cuatro esquinas `⌜ ⌝ ⌞ ⌟` (líneas SVG) se cierran sobre un plano y `clip-path` lo recorta al instante (6 frames).
- **Escena:** Planos/storyboard. El encuadre del visor "fotografía" la escena: flash `#f1eee6` con opacity 0→.6→0 en 0.15 s y el plano queda congelado como viñeta del storyboard.

### T10. Construcción "del boceto al acabado" (dibujo de trazos)
- **Qué:** las cosas se **dibujan** antes de existir: trazos que se completan y después se rellenan de color.
- **Dónde:** Saul Bass; *Juno* (contorno a mano y luego color); los explicativos de Oddfellows y Buck.
- **HTML/GSAP:** `stroke-dasharray/offset` con longitud calculada por `getTotalLength()`. Trazo `#f1eee6` de 3 px, 0.6 s `power2.inOut`, y luego el relleno con `opacity`/`clip-path` de izquierda a derecha en 0.3 s. Para que parezca a mano, aplica a las líneas un `feTurbulence` + `feDisplacementMap scale="2"` con semilla fija.
- **Escena:** storyboard automático. Las viñetas se dibujan solas (personaje simple, línea de horizonte), una tras otra con un stagger de 0.12 s, y la última se rellena de color al aplicar la paleta del moodboard (conecta T2).

### T11. Contadores, datos y "UI que trabaja sola" (product proof)
- **Qué:** se demuestra que el producto **hace algo**: números que suben, filas que pasan de rojo a verde, un cursor que no hace falta.
- **Dónde:** Linear (UI real a cámara, una acción cada vez); Vercel Ship (métricas que suben); Raycast (comandos que se ejecutan en ráfaga).
- **HTML/GSAP:** contador con proxy y `snap`:
  ```js
  const o = { v: 0 }; tl.to(o, { v: 10, duration: .8, ease: "power2.out", snap: { v: 1 },
    onUpdate: () => el.textContent = o.v }, t);
  ```
  Barrido de "lectura IA": una línea `#f0c94a` de 2 px con `box-shadow: 0 0 24px #f0c94a` baja por la página. Las líneas de guion que pasan se resaltan con un `background` que crece `scaleX 0→1` (`transform-origin:left`), en `stagger .04`.
- **Escena:** subir guion (escenas/personajes/lugares contados) y la Mesa (el % "Preparado" sube a la vez que las casillas se vuelven verdes en ola diagonal: `stagger: { grid: [8,5], from: "start", each: .03 }`).

### T12. Stagger orgánico en rejilla (olas, no filas)
- **Qué:** los elementos entran como una ola que se propaga desde un punto de origen (el sitio donde "tocó" el ajolote), no todos a la vez ni de arriba abajo.
- **Dónde:** Apple (rejillas de iconos), Notion y Figma Config.
- **HTML/GSAP:** `stagger: { grid: "auto", from: [row, col], amount: .6, ease: "power2.in" }` combinado con `y: 24, opacity: 0, scale: .96`, `power3.out`, 0.5 s.
- **Escena:** Mesa de preparación y Plan de rodaje (las tarjetas de escena caen en las columnas de jornadas).

### T13. Velocidad variable dentro del plano (speed ramp)
- **Qué:** un movimiento arranca lento, se dispara y frena en seco. Es la marca del tráiler moderno.
- **Dónde:** "Any Given Wednesday" (Apple), los films de deportes de ManvsMachine para Nike.
- **HTML/GSAP:** ease personalizado con `CustomEase` (si está disponible) o eases encadenados: `power2.in` 0.5 s (60 % del recorrido) → `expo.out` 0.6 s (resto). Durante la parte rápida, `filter: blur(4px)` + `scaleX 1.03` en el eje y fuera al frenar.
- **Escena:** cada viaje de cámara principal (sobre todo Moodboard → Plan).

### T14. Paleta como dramaturgia (color por acto)
- **Qué:** el color avanza con la historia. Cada fase tiene su luz.
- **Dónde:** *Catch Me If You Can* (cada decorado tiene su paleta); Apple ("colores" de producto); Headspace.
- **HTML/GSAP:** variables CSS `--gel` y `--gel-soft` que se animan con `tl.to(":root", {"--gel": "#f0c94a"})` (con `@property` de tipo `<color>`). La luz de mesa (T7), los subrayados, el cursor de lectura y la barra de progreso heredan `var(--gel)`. Hay **un solo color de acento a la vez**.
- **Escena:** escribir (hueso #ece8dc) → preparar (amarillo #f0c94a) → rodar (rojo #f0503f) → entregar (verde #4fc47f, solo en el final).

### T15. Momento "wow" de escala (zoom out revelador)
- **Qué:** llevamos 30 s mirando trozos y de golpe la cámara se aleja y **vemos todo el mundo**: todas las herramientas conectadas por un hilo, como un mapa.
- **Dónde:** el dezoom de las keynotes de Apple; "zoom-out-workspace-reveal" (blueprint de HyperFrames); el final de los títulos de Pixar.
- **HTML/GSAP:** `cam(3840, 2160, .22, 0, 2.2, "expo.inOut")`. Mientras se aleja, un **hilo rojo** (`path` SVG `#f0503f`, 3 px) se dibuja uniendo las 7 estaciones (`strokeDashoffset`, 1.8 s `power2.inOut`, empezando 0.3 s después de la cámara). Al llegar, una pausa de 0.6 s y luego la cámara se lanza en picado hacia la estación "Rodaje" (`expo.in` 0.8 s).
- **Escena:** bisagra entre el acto 2 (preparar) y el acto 3 (rodar). Es el **midpoint wow**.

### T16. Profundidad con capas 3D CSS (cartas, fotos, hojas)
- **Qué:** las fotos del moodboard y las hojas de llamada tienen grosor, sombra y una inclinación ligera, y caen sobre la mesa como objetos reales.
- **Dónde:** Arc Browser; Notion (tarjetas apiladas); ManvsMachine.
- **HTML/GSAP:** `perspective: 1600px` en el contenedor; cada foto `rotationX: 55, rotationZ: -12, z: 400` → `rotationX: 0, rotationZ: ±4 (tabla fija), z: 0`, 0.7 s `power3.out`, con sombra que se contrae al tocar la mesa (`box-shadow` de 60 px/0.5 a 12 px/0.35). El "golpe" al tocar: la foto hace `scale .98→1` en 0.1 s y la mesa vibra 1 px.
- **Escena:** Moodboard / Biblia visual.

### T17. Rótulo de capítulo / "slate" como signo de puntuación
- **Qué:** entre bloques aparece una cartela breve (0.6–0.9 s) con número y nombre, como los intertítulos de un film.
- **Dónde:** el chapter push de *Stranger Things*; Vercel Ship (capítulos numerados); Stripe Sessions.
- **HTML/GSAP:** JetBrains Mono 18 px, `letter-spacing .2em`, mayúsculas `#2e2e35` → `var(--gel)`: `01 — ESCRIBIR`. Entra con `clip-path inset(0 100% 0 0)` → `inset(0 0 0 0)` en 0.35 s `power3.out` y sale empujada por la cámara (sin fade).
- **Escena:** las 4 fases: 01 ESCRIBIR / 02 PREPARAR / 03 RODAR / 04 ENTREGAR.

### T18. Luz que atraviesa (light leak / flare de película)
- **Qué:** destellos de luz suaves que barren el cuadro en momentos clave y dan sensación de película.
- **Dónde:** *Stranger Things* (Lens Distortions "Light Hits", usados con moderación); tráileres de cine.
- **HTML/GSAP:** un `div` de 2600x1400 (más grande que el frame, como pide el catálogo de HyperFrames) con un gradiente lineal del gel a transparente, `mix-blend-mode: screen`, `opacity 0→.35→0`, que se desplaza 600 px en 0.9 s `sine.inOut`. **Máximo 3 veces** en todo el tráiler: al arrancar el acto 3, en ¡ACCIÓN! y en el logo.
- **Escena:** ¡ACCIÓN! y el cierre.

### T19. Sobreimpresión de interfaz "simplificada" (UI como ilustración)
- **Qué:** la interfaz se muestra **reducida a su esencia**: bloques, chips y líneas, con 1–2 detalles reales legibles. No es una captura, es un dibujo de la UI.
- **Dónde:** Linear (UI con realce selectivo); Stripe (UI estilizada con ritmo); Slack (spots de producto ilustrados).
- **HTML/GSAP:** solo 3 niveles de información por panel: titular legible (Archivo 600, 28 px), 1 dato real resaltado (`taza rota`, `Falta: actor para MARCO`) y el resto barras `#2e2e35` de 10 px. El resto de la UI **se atenúa** (`opacity .35`) cuando el ajolote actúa sobre un elemento (spotlight).
- **Escena:** todas las estaciones (la v1 ya va en esta línea, pero hay que podar aún más el texto).

### T20. Voz en off como guion de tráiler (estructura de 3 tiempos + giro)
- **Qué:** frases cortas, con promesa → conflicto → solución → llamada. El humor viene de la mascota. Ninguna frase explica la UI, porque eso lo hace la imagen.
- **Dónde:** tráileres de Pixar ("Este verano…"); Apple ("Hola."); Duolingo (la mascota rompe la cuarta pared).
- **HTML/GSAP:** subtítulos cinéticos por palabra con los timestamps del TTS (`hyperframes transcribe`), con entrada `y 14→0, opacity`, deslizamiento decreciente 80→12 px (técnica 4 del `techniques.md` de HyperFrames). La palabra clave de cada frase va en `var(--gel)` y en Archivo 800 wdth 112.
- **Escena:** todo. Ver la propuesta de guion en §3.

### T21. Gag y pausa cómica (timing de animación clásica)
- **Qué:** un momento en que todo se para para un chiste visual. La sorpresa crea afecto.
- **Dónde:** Illumination (Minions en los logos), Pixar (la lámpara Luxo aplastando la "I"), Duolingo.
- **HTML/GSAP:** una congelación de 0.4 s (`tl.to({}, {duration:.4})`) tras un error deliberado. El ajolote pone un **post-it al revés**, se da cuenta (ojos grandes, `scale 1.2` en 0.08 s), le da la vuelta y mira a cámara con un parpadeo lento.
- **Escena:** en el desglose. El ajolote marca "furgoneta" como **vestuario**, se corrige y la cambia a vehículo. Así se muestra que puedes corregir a la IA. También como **sting final**: el ajolote se tropieza con el logo y lo endereza (homenaje a Luxo).

### T22. Cierre en "lockup" con construcción (logo assemble)
- **Qué:** el logo **se construye** a partir de los elementos del tráiler: las 4 rayas de color de las fases convergen y forman la firma.
- **Dónde:** el final de Apple (logo en negro con 1 golpe de sonido); Vercel (triángulo construido); Figma Config.
- **HTML/GSAP:** las 4 líneas de gel (que han estado subrayando todo el tráiler) vuelan desde fuera de cuadro (`motionPath` curvos, 0.9 s `expo.out`, stagger .08) y se colocan como la tira `— — — —` bajo el nombre. El nombre aparece con `"wdth" 62→100` y `letter-spacing -.04em → 0`. El ajolote asoma por detrás de la "V" con un saludo (3 frames de anticipación + saludo de 2 ciclos `rotation ±18°`).
- **Escena:** final (últimos 5 s).

### T23. Respiración en el plano fijo (micro-movimiento constante)
- **Qué:** nada está 100 % quieto. Los planos "fijos" derivan 1–2 %, que es la diferencia entre "diapositiva" y "película".
- **Dónde:** Apple (dolly lento sobre producto); todo Buck/Ordinary Folk.
- **HTML/GSAP:** durante cualquier pausa de cámara: `tl.to("#world", { scale: "+=0.015", x: "-=12", duration: holdDur, ease: "none" })`. Las sombras del ajolote laten con su respiración.
- **Escena:** todas las pausas de lectura.

---

## 2. Las 5 que harían el salto de calidad

1. **Plano secuencia sobre una mesa de luz (T1 + T7 + T8).** Un único mundo continuo, con una retícula de corte, grano de película y objetos de mesa en parallax, sustituye al degradado y elimina el look de diapositiva. Es el cambio de mayor impacto y responde a la vez a dos críticas: "el fondo no me gusta" y "no es espectacular".
2. **Match cuts nacidos del objeto (T2).** Encabezado → fila de la Mesa, palabra marcada → color de la paleta, viñeta → casilla de jornada. Cuentan visualmente "todo está conectado", que es la propuesta de valor del producto.
3. **Ajolote en SVG con rig y 12 principios, que causa la acción (T5 + T6).** Respira, parpadea, lleva las branquias con retardo, salta con anticipación, sincroniza la boca a la VO y es él quien subraya, salta sobre las casillas, lanza fotos y cierra la claqueta. Responde a "pule el ajolote".
4. **Edición al beat con silencio antes del drop + midpoint wow de dezoom (T3 + T15).** El tráiler pasa de "presentación" a "experiencia": a mitad, la cámara se aleja y revela todo el mapa unido por un hilo rojo; después hay un silencio y llega ¡ACCIÓN!.
5. **Tipografía que actúa y hace de puerta (T4 + T17).** Archivo variable comprimida→expandida, chapter push a través de la "O" de RODAJE y cartelas de capítulo numeradas con el gel de cada fase.

---

## 3. Propuesta de estructura de tráiler (≈64 s · 112 BPM · 1 beat = 0.536 s · 1 compás = 2.14 s)

Regla general: cada acto dura un número entero de compases, los cambios caen en beat 1 y no hay ninguna composición repetida dos veces.

| Tiempo | Compases | Acto | Qué pasa (imagen) | VO del ajolote (borrador) | Técnicas |
|---|---|---|---|---|---|
| 0:00–0:06.4 | 1–3 | **Cold open** | Negro. Una lucecita se enciende en el centro: es la mesa de luz. Grano. El ajolote entra de puntillas al cuadro (de perfil), mira a cámara y parpadea. | (susurro) "Psst… ¿tienes una historia?" | T7, T5, T23 |
| 0:06.4–0:12.8 | 4–6 | **Promesa** | Tipografía a pantalla completa: "UNA IDEA" (wdth 62) → la cámara empuja a través de la "D" → "UN RODAJE" (wdth 125). | "Entre una idea y un rodaje… hay mil cosas." | T4, T13 |
| 0:12.8–0:15 | 7 | Cartela | `01 — ESCRIBIR`, gel hueso | — | T17, T14 |
| 0:15–0:23.5 | 8–11 | **Acto 1: el guion** | Una hoja cae sobre la mesa (3D, T16). El haz de lectura la barre, las escenas se iluminan y los contadores suben 10/4/7. Los nombres de los personajes "saltan" de la página como fichas. | "Sube tu guion. Lo leo en segundos: escenas, personajes, lugares." | T11, T16, T12 |
| 0:23.5–0:25.7 | 12 | Match cut | El encabezado `3. EXT. FURGONETA` se estira → fila 3 de la Mesa. Cartela `02 — PREPARAR`, el gel cambia a amarillo. | — | T2, T14, T17 |
| 0:25.7–0:32 | 13–15 | **Acto 2a: la Mesa** | La tabla se monta en ola desde la fila 3. Casillas rojas parpadean. El ajolote salta sobre una, la vuelve verde y el % sube. | "Te digo qué está listo… y qué falta." | T12, T6, T11 |
| 0:32–0:38.5 | 16–18 | **Acto 2b: desglose** | La cámara baja a la página. El ajolote con rotulador subraya `taza rota`, `abrigo rojo`… y **el gag**: marca la furgoneta como vestuario, se da cuenta y la corrige. | "Atrezzo, vestuario, vehículos… ¡ups!… nada se queda fuera." | T6, T10, T21 |
| 0:38.5–0:42.8 | 19–20 | **Acto 2c: planos** | `abrigo rojo` vuela → muestra de color. Las esquinas del visor se cierran: clic + flash, y las viñetas del storyboard se dibujan solas. | "Plano a plano." | T2, T9, T10 |
| 0:42.8–0:47 | 21–22 | **Acto 2d: moodboard** | Las fotos caen en 3D y la paleta se extrae; la última viñeta se colorea. | "Y con su propia luz." | T16, T14 |
| 0:47–0:51.4 | 23–24 | **MIDPOINT WOW** | Dezoom enorme: se ve toda la mesa, con las 6 estaciones unidas por un hilo rojo. Las tarjetas vuelan y se ordenan en jornadas. | "Todo conectado. Ordenado por jornadas." | T15, T12, T13 |
| 0:51.4–0:52.5 | 25 (½) | **Silencio** | La cámara cae en picado hacia la claqueta. La música corta. El ajolote coge aire (anticipación, se aplasta). | (respiración) | T3, T5 |
| 0:52.5–0:56.8 | 25–27 | **Clímax: ¡ACCIÓN!** | Golpe: el ajolote cierra la claqueta y "¡ACCIÓN!" atraviesa la pantalla. Gel rojo, light leak y la cámara se mete en la Ó. Ráfaga de 4 planos de la hoja de llamada / equipo confirmado (6 frames cada uno). | "¡Y… ACCIÓN!" | T3, T4, T18, T13 |
| 0:56.8–0:59 | 28 | Resolución | "¡CORTEN!" Un momento cálido: gel verde; en lugar de confeti, las tarjetas del rodaje pasan a "hecho" en cascada verde. | "¡Corten! …y se queda." | T14, T12 |
| 0:59–1:04.3 | 29–30 | **Lockup** | Las 4 rayas de gel convergen en la firma "Versión definitiva · Taller". Wdth 62→100. El ajolote asoma por la "V" y saluda. | "Versión definitiva. Del guion al rodaje." | T22, T5 |
| 1:04.3 | — | **Sting** | 1 s después: el ajolote empuja el punto del logo, que estaba torcido, y mira a cámara. Negro. | — | T21 |

**Curva de energía:** baja (0–6 s, intriga) → media y creciente (acto 1 y 2, cada estación más rápida que la anterior: 8.5 s → 6.3 → 6.5 → 4.3 → 4.2) → pico de escala (midpoint) → **silencio** → pico máximo (¡ACCIÓN!) → calidez → firma. La aceleración progresiva de las estaciones es lo que da la sensación de "tráiler".

**Reglas de pulido transversales:**
- Eases: viajes `expo.inOut`; entradas `power3.out`; golpes `power4.out`; respiración `sine.inOut`; overshoot (`back.out(1.7)`) **solo** en el ajolote y en el pop de las casillas.
- Nunca usar `opacity` como única transición entre bloques. Siempre hay movimiento de cámara o match cut.
- Máximo 1 color de acento por plano; el resto en tintas y papel.
- Los subtítulos/titulares nunca ocupan la misma posición dos veces seguidas.
- Determinismo: todo pseudoaleatorio sale de un PRNG con semilla (`mulberry32(42)`), incluidos grano, rotaciones de fotos y parpadeos.
- Fuentes: Archivo variable + JetBrains Mono son suficientes. No hace falta descargar nada más. Opcional: una fuente de mano (p. ej. `@fontsource/caveat`) para las anotaciones del rotulador del ajolote.

---

## Fuentes consultadas

- [Art of the Title — Catch Me If You Can](https://www.artofthetitle.com/title/catch-me-if-you-can/)
- [Senses of Cinema — Catch Me If You Can](https://www.sensesofcinema.com/?p=3985)
- [Art of the Title — Juno](https://www.artofthetitle.com/title/juno)
- [Videomaker — Analysis of Creative Opening Titles](https://www.videomaker.com/article/f8/17951-analysis-of-creative-opening-titles)
- [Watch the Titles — Juno](https://www.watchthetitles.com/?p=346)
- [Lens Distortions — Stranger Things](https://lensdistortions.com/stranger-things/)
- [SYFY Wire — Stranger Things titles, Imaginary Forces interview](https://syfy.com/syfy-wire/stranger-things-opening-titles-imaginary-forces-interview)
- [Promax — Design Dissect: Stranger Things](https://oldbrief.promax.org/article/design-dissect-stranger-things-titles)
- [9to5Mac — Apple keynote videos transitions and editing](https://9to5mac.com/2023/06/21/apple-keynote-videos-transitions-and-editing/)
- [IndieTips — Creative transitions from Apple's iPad Pro ad](https://indietips.com/?p=63494)
- [B&T — Apple Hermitage 5-hour one take](https://www.bandt.com.au/apple-flaunts-iphone-camera-quality-and-battery-life-in-epic-5-hour-ad/)
- [Lago — We killed our motion design job (sobre los films de Linear)](https://getlago.com/blog/we-killed-our-motion-design-job)
- [Motion Social Club — Why an app bought 2 motion studios (Duolingo)](https://themotionsocialclub.substack.com/p/why-an-app-bought-2-motion-studios)
- [Duolingo Blog — Building character](https://blog.duolingo.com/building-character/)
- Skills locales: `/root/.claude/skills/hyperframes-animation/techniques.md`, `transitions/catalog.md`, `adapters/gsap-easing-and-stagger.md`.
