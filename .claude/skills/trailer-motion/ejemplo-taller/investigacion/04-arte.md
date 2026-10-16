# 04 · Dirección de arte v2: «MESA DE LUZ»

Archivos que acompañan este documento (todo probado y renderizado con Chromium):

- `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/arte/arte.css`: tokens `:root`, grano, caja de luz, geles, papel, cinta, UI simulada y celuloide. Se puede copiar tal cual.
- `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/arte/ajolote.js`: ajolote v2 generado en SVG de forma determinista. Tiene branquias plumosas, manos de 3 dedos, cola en S con franja y modo silueta.
- `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/arte/frames.html`: maqueta 1920×1080 con los 4 fotogramas póster. Incluye el filtro SVG `#sticker`.
- Renders: `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/arte/frame-1.png` (Encendido), `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/arte/frame-2.png` (Guion), `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/arte/frame-3.png` (Mesa de preparación), `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/arte/frame-4.png` (¡Acción!)
- Fuentes nuevas ya descargadas de npm @fontsource en `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/arte/fonts/` (courier-400/700.woff2 y marker.woff2)
- Script de render: `node /tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/render-arte.cjs <dir>` (usa puppeteer-core y `/opt/pw-browsers/chromium-1194`)

---

## 0. Diagnóstico de la v1 (por qué no fascina)

1. **El fondo no está en ningún sitio.** Dos `radial-gradient` muy suaves sobre `#151519` y burbujas de contorno. Es el fondo por defecto de cualquier vídeo SaaS hecho con IA. No hay superficie, ni luz, ni objeto.
2. **El negro es igual en las 12 escenas.** No hay ritmo de color, así que el ojo no nota que «cambiamos de fase». La marca tiene 4 geles por fase y la v1 los usa solo como chips de 12 px.
3. **La UI es una tarjeta gris dentro de una caja gris.** Nada distingue un «papel» de una «pantalla».
4. **El ajolote es una pegatina flotante sobre negro.** Las branquias son óvalos, no tienen pluma, y el personaje no interactúa con ningún material.
5. **Ningún fotograma funciona como póster.** Si pausas en cualquier segundo, no hay una imagen que quieras compartir.

---

## 1. Tres direcciones exploradas

### A. «Plató de papel» (recortes, collage, stop-motion)
- **Moodboard (descrito):** los títulos de *Catch Me If You Can* (Kuntzel+Deygas) con figuras planas en recorte, los carteles de Saul Bass (*Anatomy of a Murder*), el stop-motion de papel de *Kubo* y de los anuncios de Lego/Moleskine, y los decorados de cartón pluma de Michel Gondry (*La ciencia del sueño*). Las escenas se montan con capas de cartulina, sombras duras de 6 px, cinta de carrocero y el corte de cúter visible.
- **Fuerte:** muy de «hecho a mano» y cálido. El ajolote encaja como recorte.
- **Débil:** derrapa con facilidad hacia el cliché crema + terracota. Además, la UI de la app (tablas, estados) en papel recortado parece un juguete, no una herramienta profesional. Y no tiene nada de «luz», que es la palabra de la marca.

### B. «Mesa de luz» (caja de luz opal + geles translúcidos de colorista)  ← ELEGIDA
- **Moodboard (descrito):**
  - mesa de montaje de negativos y diapositivas: metacrilato opal encendido, marco negro, lupa, marcas de registro y regla;
  - muestrarios de geles Rosco/Lee abiertos en abanico, con láminas de color de borde duro que, al solaparse, mezclan su color (multiply real);
  - la luz plana y saturada de Wes Anderson y del cartel de *Moonrise Kingdom*;
  - los planos de color sólido de los tráileres de A24 y de los *title cards* de Apple TV+, donde la pantalla entera es un único color y una palabra;
  - la sombra chinesca de Lotte Reiniger: siluetas negras sobre luz;
  - la rapidez de las cortinillas de color de los tráileres de *Spider-Verse*.
- **Idea central:** el fondo **no es un fondo, es una superficie que emite luz**. Todo lo que se apoya en ella queda retroiluminado: el papel del guion transparenta, la silueta del ajolote se ve negra y los geles tiñen. **Cada fase de la cadena es un gel**: al cambiar de fase, un gel cruza la mesa y la «inunda» de su color. Así el fondo cambia de color sólido escena a escena sin un solo degradado.

### C. «Celuloide» (película, perforaciones, grano, gate weave)
- **Moodboard (descrito):** la cuenta atrás de la *Academy leader*, los títulos de *Se7en* (Kyle Cooper: rasguños y fotogramas sucios), el *gate weave* de proyector de 16 mm, los códigos de borde Kodak en amarillo y el soporte naranja de un negativo.
- **Fuerte:** es cine al instante y el grano da textura gratis.
- **Débil:** es retro y oscuro, empuja hacia el «negro + acento». Además la textura sucia se pelea con una UI limpia y con el ajolote cuco. En 60 s cansa.

### Decisión: **B, con acentos de C** en tres momentos puntuales (apertura, ¡Acción! y cierre)
- **Es literalmente la marca.** «Mesa de luz» deja de ser un nombre y pasa a ser el plató del tráiler. Nadie más puede tener este tráiler.
- **Resuelve la queja del degradado.** La luz se expresa con *superficie plana encendida* + *geles de borde duro* + *sombras tintadas* + *grano*. Hay cero `radial-gradient` decorativos.
- **Da ritmo de color.** Hueso → amarillo → rojo → verde siguen la cadena real del producto (escribir → preparar → rodar → entregar). El espectador aprende el producto por color sin leer.
- **La UI tiene un sitio natural.** Son tarjetas oscuras (pantallas) apoyadas sobre la mesa encendida, y el contraste de figura y fondo es brutal y limpio.
- **El ajolote gana dos estados.** Es silueta en sombra chinesca (misterio, apertura) y pegatina de color con borde opal (personaje). Vive en el mundo físico de la mesa.
- **Evita los clichés.** No hay crema + serif + terracota (el opal es un blanco frío-neutro y no usamos serif display), no hay negro + verde ácido (el negro solo enmarca, y el verde es el gel de entregar, ni ácido ni dominante) y no hay periódico con filetes.

---

## 2. El mundo: capas y fondos concretos

Todas las capas son elementos planos. Orden de abajo arriba:

| z | Capa | Implementación | Movimiento |
|---|---|---|---|
| 0 | **Sala** `--ink-0` | color sólido | ninguno |
| 1 | **Tablero de la mesa** `.desk` `--ink-1` | sólido | parallax 0.2 |
| 2 | **Caja de luz** `.lightbox` (opal + marco `outline 18px --ink-2` + bisel `--ink-3`) | sólido + outline | parallax 0.4. En los planos cerrados se escala hasta salirse del cuadro: la mesa *es* el fotograma |
| 3 | **Bandas de tubo** `.tubes i` | rectángulos `#fbf9f3` (+2 % de luminancia) con `filter: blur(46px)` estático | deriva Y ±20 px en 8 s (`sine.inOut`, yoyo). Es la única «suavidad» permitida y casi no se ve |
| 4 | **Geles** `.gel` (multiply, canto `inset 2px rgba(255,255,255,.28)`, reflejo especular plano oblicuo 9 % de ancho) | sólidos | entran deslizando (ver §8) |
| 5 | **Objetos** (papel, tarjetas UI, claqueta, diapositivas, cinta) | sólidos + sombra tintada | parallax 1.0 |
| 6 | **Ajolote** | SVG | personaje |
| 7 | **Marcas de mesa**: regla superior, cruces de registro, timecode mono | SVG pattern | estáticas (anclan el plano) |
| 8 | **Grano** `.grain` | SVG feTurbulence | por pasos (ver §6) |
| 9 | **Celuloide** (solo en 3 momentos) `.perfs` + `.edge-code` | SVG pattern | scroll vertical de perforaciones a 24 fps |

**Fondo por escena (color sólido, «inundación de gel»):**

| Escena | Fase | Superficie | Gel protagonista | Gel «siguiente» asomando |
|---|---|---|---|---|
| 0 Encendido | — | sala `#0b0b0d` → mesa opal `#f6f3ea` dentro de marco | abanico de los 4 | — |
| 1 Guion | escribir | flood opal `#f6f3ea` | `#8fd0d6` agua (esquina, «el ajolote vive aquí») | — |
| 2 Mesa de preparación | preparar | flood `#f0c94a` | — | rojo `#f0503f` en esquina sup. dcha. |
| 3 Desglose | preparar | opal + página | marcadores-gel sobre texto | — |
| 4 Planos/storyboard | preparar | **sala oscura** `#151519` con caja de luz pequeña: viñetas como transparencias encendidas | — | — |
| 5 Moodboard | preparar | opal con **diapositivas 35 mm** (marcos de cartón `#ece8dc` y ventana de color) | — | — |
| 6 Plan + hoja de llamada | preparar | flood `#f0c94a` | verde asomando | — |
| 7 ¡Acción! / Día de rodaje | rodar | flood `#f0503f` + perforaciones | amarillo esquina inf. izq. (mezcla `#e23f12`) | — |
| 8 ¡Corten! / Entrega | entregar | flood `#4fc47f` | — | — |
| 9 Cierre (logo) | — | sala `#0b0b0d`, se apaga la mesa y queda solo el abanico de geles + logo | — | — |

La alternancia **claro (opal) → color (amarillo) → oscuro (planos) → claro (moodboard) → color → rojo → verde → negro** crea el ritmo visual que faltaba en la v1.

---

## 3. Paleta exacta (hex) y contraste comprobado (WCAG, calculado)

```
Sala/tintas   #0b0b0d  #151519  #1d1d22  #2e2e35  #4a4a54
Texto 2º      #9a978f (sobre oscuro)   #5c5a54 (sobre opal)
Luz           opal #f6f3ea · banda #fbf9f3 · papel #f1eee6 · papel sobre mesa #e9e5da
Geles         escribir #ece8dc · preparar #f0c94a · rodar #f0503f · entregar #4fc47f · agua #8fd0d6
Mezclas       prep×rodar #e23f12 · prep×entregar #4a9a25 · rodar×entregar #4a3d1f
Sombras       opal rgba(60,52,38,.28) · amarillo #9c7a1f · rojo #8e2a20 · verde #2b7a4a
Ajolote       piel #f7c1cc · piel 2 #f3aebd · vientre #fbd5dc · branquia #ff6440 · vena #c8361f · mejilla #ff8fa3 · ojo #1e1418 · franja #e98da2
Subrayados    amarillo #f0c94a · rojo suave #f7a198 · verde suave #a7e2bf · agua #8fd0d6
```

| Par | Ratio | Uso permitido |
|---|---|---|
| `#151519` sobre opal `#f6f3ea` | 16.4 | todo |
| `#151519` sobre papel `#e9e5da` | 14.5 | guion Courier 27 px |
| `#151519` sobre amarillo `#f0c94a` | 11.4 | todo |
| `#151519` sobre verde `#4fc47f` | 8.3 | todo |
| `#151519` sobre rojo `#f0503f` | 5.1 | todo (AA). **El texto sobre rojo siempre en tinta** |
| papel `#f1eee6` sobre rojo | 3.06 | **prohibido** salvo ≥ 96 px negrita |
| `#9a978f` sobre `#151519` | 6.2 | etiquetas mono UI |
| `#5c5a54` sobre opal | 6.2 | etiquetas mono sobre mesa (`#8a877e` daba 3.2: descartado) |
| amarillo/verde/rojo sobre `#151519` | 11.4 / 8.3 / 5.1 | pills y números en UI oscura |
| `#4a3d12` sobre amarillo | ≈ 8 | kicker mono sobre gel amarillo |

**El ajolote sobre rojo o amarillo:** el rosa y el naranja de las branquias se funden con los geles cálidos. Por eso fuera de la mesa opal el ajolote **siempre lleva el filtro `#sticker`**: borde opal de 6 px (`feMorphology dilate`) + sombra dura de 5 px al 22 %. Verificado en frame-3 y frame-4: se lee perfecto.

---

## 4. Sistema tipográfico

Archivo variable es la voz principal. Su eje `wdth` es la herramienta de jerarquía: expandida para gritar y condensada para rotular.

| Rol | Familia | wdth | wght | Tamaño 1080p | Interlineado | Tracking |
|---|---|---|---|---|---|---|
| Slam (¡ACCIÓN!, ¡CORTEN!) | Archivo | 125 | 900 | 200–240 px | .86 | −0.035em |
| Hero (frases de VO en pantalla) | Archivo | 118 | 850 | 120–150 px | .90 | −0.03em |
| Titular de escena | Archivo | 112 | 800 | 84 px | .95 | −0.02em |
| Números grandes (10 escenas, 85 %) | Archivo | 125 | 900 | 120 px (en UI 40–72) | .8 | 0 |
| Rótulo de gel / etiqueta | Archivo | 62 | 700 | 40–44 px, MAYÚSC. | 1 | +0.01em |
| UI (filas, nombres) | Archivo | 100 | 600 | 26 px (mín. 24) | 1.2 | 0 |
| Cuerpo (pocas veces) | Archivo | 100 | 500 | 30 px | 1.25 | 0 |
| Datos, timecode, kicker | JetBrains Mono | — | 500–600 | 20 px MAYÚSC. (26 px números) | — | +0.12em |
| **Texto de guion** | **Courier Prime** | — | 400/700 | 27 px | 1.45 | 0 |
| **Notas a rotulador** (cinta) | **Permanent Marker** | — | 400 | 34–40 px | 1 | 0 |

**Fuentes extra (ya descargadas):**
- **`@fontsource/courier-prime`**: los guiones profesionales se escriben en Courier 12 pt. Courier Prime es *la* versión para guionistas (John August). Hace que el papel parezca un guion de verdad al primer vistazo y se diferencia del mono de datos (JetBrains = la máquina; Courier = el papel). Úsala solo dentro de `.page`.
- **`@fontsource/permanent-marker`**: las notas del ajolote van en cinta de carrocero escrita a rotulador, como se rotula en un set real (las cajas, la claqueta, el suelo). Le da voz «manual» al personaje sin caer en la caligrafía cursi. **Máximo 3–4 apariciones** en todo el tráiler, siempre sobre `.tape`.
- No hace falta una serif display: el contraste lo dan la anchura variable y Courier.

**Animación tipográfica asociada al arte:** los titulares hero entran animando `font-stretch` de 62 % a 118 % junto con `y` (0.55 s, `expo.out`): la palabra «se abre» como la luz al encenderse. El slam entra en 4 frames a escala 1.18 → 1 (`power4.out`) con un temblor de gate weave de ±3 px durante 6 frames.

---

## 5. UI simulada (simplificada, iconográfica, elegante)

- **Material:** tarjetas «pantalla» `#151519` apoyadas en la mesa. Nunca grises sobre gris: la UI siempre es oscura sobre superficie de luz o de gel. En la escena oscura (planos) se invierte y la UI pasa a ser transparencias encendidas.
- **Radios:** tarjeta 14 px · fila y celda 8 px (barras 5 px) · pill 999 px. La claqueta usa 10/14 px.
- **Grosores:** bordes 2 px `#2e2e35` · separador de filas 1 px `#1d1d22` · iconos de trazo 2.5 px, `round` en extremos y uniones, 34 px de caja. Sin rellenos en iconos.
- **Estados:** celda = barra 96×16 px de color de gel (verde listo / amarillo casi / rojo falta / `#2e2e35` vacío). Pill rellena para listo y casi; **pill contorneada en rojo para «falta»** (que salte por diferencia de forma, no solo de color).
- **Densidad:** 4–5 filas máximo, columnas reales del producto (Guion, Desglose, Planos, Reparto, Lugar) y 1 dato protagonista (85 %).
- **Sombra de tarjeta:** `0 2px 0 rgba(0,0,0,.25)` (contacto) + `0 30px 50px -24px var(--tint)`. `--tint` es la sombra del gel de la escena (`#9c7a1f` sobre amarillo, `#8e2a20` sobre rojo).
- **Nada de:** glassmorphism, blur de fondo, iconos emoji, cromos de navegador ni barras de ventana macOS.
- **Componentes listos en `arte.css`:** `.card .hdr .row .pill.ok/.warn/.miss .cellbar .seg .ico .tape .page .hl.y/.r/.g/.b`.

---

## 6. Luz, sombras, grano y textura

**Luz (sin degradados):**
- La luz *es* la superficie opal. El «brillo» se comunica por contraste: un objeto oscuro sobre opal parece retroiluminado.
- **Encendido de la mesa (apertura):** parpadeo de fluorescente. Opacidad de la capa opal en keyframes por pasos `0 → .7 → 0 → 1 → .85 → 1` en frames 0, 2, 4, 9, 11, 14 (a 30 fps), `ease: "steps(1)"`. Sonido de cebador.
- **Papel retroiluminado:** el papel sobre la mesa se ve **más oscuro** (`#e9e5da`) que el opal. Lleva fibra anisótropa `feTurbulence baseFrequency=".012 .35"` en multiply al 55 %. Es físico y elegante.

**Sombras:**
- Doble sombra: contacto duro de 2 px + sombra larga y difusa con `spread` negativo.
- **Siempre tintadas** con el color del gel × 0.55. **Nunca negro puro.**
- Sobre opal: `rgba(60,52,38,.28)`.

**Grano (SVG feTurbulence, ya en `.grain`):**
- Tile de 256 px, `fractalNoise baseFrequency .9 numOctaves 2 seed 7`, desaturado, `mix-blend-mode: overlay` opacidad .32 sobre claro y `soft-light` .22 sobre oscuro.
- **Animarlo determinista** (grano «vivo» a 12 fps, como la película):
  ```js
  // 8 posiciones fijas, un salto cada 2 frames a 24 fps
  const G = [[0,0],[-97,41],[63,-118],[-152,-23],[121,88],[-38,-160],[177,12],[-81,133]];
  const grainTl = gsap.timeline({ repeat: Math.ceil(DUR / (8/12)) - 1 });
  G.forEach((p, i) => grainTl.set(".grain", { backgroundPosition: `${p[0]}px ${p[1]}px` }, i / 12));
  tl.add(grainTl, 0);
  ```
- **Gate weave** (solo en los momentos «celuloide»): `#world` con x/y de una tabla sembrada de 24 valores de ±0.8 px. Se aplica con `set` cada frame entre `t0` y `t1`. Prohibido `Math.random`: usa la tabla o un `mulberry32(42)`.
- **Polvo** (opcional, solo en apertura y cierre): 12 puntos y 3 pelos SVG `#151519` al 50 %, que aparecen 1 frame cada uno en tiempos fijos.

**Geles:**
- Borde duro, canto claro de 2 px y un reflejo especular **plano** oblicuo (un rectángulo `skewX(-18deg)` al 16 % de blanco, no un degradado).
- Rótulo condensado impreso «PREPARAR / VD-02», como en un muestrario.
- `mix-blend-mode: multiply`. Los solapes generan las mezclas reales (ver paleta). En el abanico, el solape rojo×verde da un marrón `#4a3d1f` que funciona como «sombra» del muestrario: intencional.

---

## 7. El ajolote en este mundo (resumen; el detalle del personaje lo cubre su propio documento)

- **Rediseño SVG** (`ajolote.js`):
  - 3 branquias por lado, cada una con tallo curvo de 9 px, filamentos de 3.6 px cada 10 % del tallo inclinados 140° hacia la base (aspecto de pluma) y vena `#c8361f` de 2.2 px;
  - cabeza más ancha (path, no elipse), brillo frontal en trazo `#fbd5dc` y mejillas al 70 %;
  - manos con 3 deditos;
  - cola larga en S con franja dorsal `#e98da2`, fiel a `public/ajolote.png`.
  Las piezas tienen clases (`.head .gill .armL .armR .tail .eyes`) para animarlas por separado: las branquias ondulan con `rotation` ±6° desfasado 0.08 s entre las tres (`sine.inOut`).
- **Tres estados de material:**
  1. **Silueta** (sombra chinesca, `silhouette:true`, `#151519`) sobre opal en la apertura. Al encenderse la mesa del todo, la silueta «se colorea» con un fundido de 0.4 s.
  2. **Al natural** sobre opal (escenas de guion y moodboard).
  3. **Pegatina** (`.axo.sticker`, borde opal de 6 px + sombra) sobre geles de color y en la UI oscura.
- **Tamaño:** 280–360 px de alto en planos de UI (≈ 30 % de la altura) y 420 px en los pósters.
- **Interacciones de material** (lo que lo hace parecer vivo en la mesa):
  - empuja un gel con la mano para que entre;
  - asoma por debajo del papel (el papel se levanta 3° por la esquina);
  - pega la cinta «¡falta Marco!»;
  - sostiene la claqueta;
  - nada sobre el gel agua (único lugar con burbujas: círculos de contorno opal de 3 px, subiendo con `y` lineal y oscilación `x` sinusoidal sembrada).

---

## 8. Movimiento propio de la dirección de arte (para el documento de animación)

- **Transición firma: «barrido de gel».** Una lámina del color de la fase siguiente (con su canto claro y su reflejo) cruza el cuadro en diagonal ligera (rotación −4°), de fuera a fuera, en 0.45 s con `power3.inOut`. Detrás queda el flood del nuevo color, y los objetos de la escena nueva entran 0.12 s después con `back.out(1.4)`. Se usa en Guion → Mesa (amarillo), Plan → ¡Acción! (rojo) y ¡Corten! → Entrega (verde).
- **Transición «apagar y encender».** Entre una escena clara y la escena oscura de Planos: la mesa parpadea y se apaga en 4 frames por pasos y quedan solo las transparencias encendidas.
- **Cámara.** Push-in continuo de 1.0 → 1.04 por escena (`none`) más el parallax de capas (0.2 / 0.4 / 1.0). En cada barrido, punch-in de 1.04 → 1.12 durante 0.3 s (`expo.in`) que el gel tapa.
- **Subrayado-gel.** Las marcas del desglose son `.hl::before` con `--s` animado de 0 a 1 en 0.28 s con `power2.out`, escalonadas 0.09 s. El color entra como si el gel se posara.
- **Abanico de geles.** Rotaciones desde −90° hasta las finales (−40 / −28 / −14 / 0) con stagger de 0.07 s y `back.out(1.6)`. Es el «logo animado» de la apertura y del cierre.

---

## 9. Cuatro momentos de imagen (fotogramas póster)

1. **«Encendido»** (`frame-1.png`, ~0–6 s). Mesa opal con marco sobre la sala oscura, regla, cruces de registro y timecode. A la derecha, el abanico de los 4 geles con rótulos condensados. El ajolote en **sombra chinesca** delante de los geles. Titular hero en tinta: «Toda película empieza en una mesa.» Es la imagen de portada del vídeo y la miniatura de YouTube.
2. **«El guion se ilumina»** (`frame-2.png`). Página en Courier Prime girada −2.2° sobre la mesa, con fibra de papel:
   - encabezados de escena con gel amarillo;
   - atrezzo y vestuario en rojo suave, vehículo en agua, personaje en verde.
   El gel agua asoma en la esquina, el ajolote se asoma por debajo y la cinta dice «¡lo subrayo yo!». A la derecha, «Lo lee por ti.» con 10 / 4 / 7 en Archivo 125/900.
3. **«Qué está listo. Qué falta.»** (`frame-3.png`). Flood amarillo total. La tarjeta UI oscura tiene 4 escenas × 5 columnas de barras de estado, la pill «FALTA ACTOR» contorneada en rojo y una barra de 85 %. El ajolote es pegatina, sorprendido (boca «o»), con la cinta «¡falta Marco!». El gel rojo asoma arriba a la derecha para anunciar la fase siguiente.
4. **«¡ACCIÓN!»** (`frame-4.png`). Flood rojo, perforaciones de película a ambos lados, código de borde vertical «VD-03 ▸ RODAR ▸ 24 FPS» y slam en tinta 125/900. Debajo, la claqueta abierta («El último verano · ESC 3 · PLANO 1A · TOMA 1»). El ajolote pegatina feliz (ojos ^ ^) la sostiene. Abajo, en mono, «Jornada 1 · Playa · Citación 07:30» y «● REC».
   - **Extra (sin maqueta):** el cierre en sala negra, con la mesa apagada, el abanico de geles flotando, el logo «Versión definitiva · Taller» en Archivo 118/850 papel sobre `#0b0b0d` (17.7:1) y el ajolote en silueta, que gira la cabeza y se colorea un último instante.

---

## 10. Reglas rápidas (checklist para quien construya la v2)

- [ ] Cero `radial-gradient`/`linear-gradient` decorativos (las únicas excepciones: patrones SVG de regla y perforaciones).
- [ ] Cada escena tiene una superficie (opal / gel / sala) y como máximo **un** gel secundario.
- [ ] El texto sobre rojo va siempre en `#151519`, y el kicker mono sobre opal en `#5c5a54`.
- [ ] El ajolote fuera del opal lleva `.sticker`.
- [ ] El grano siempre está activo y por pasos; el gate weave solo en apertura, ¡Acción! y cierre.
- [ ] Courier Prime solo dentro del papel y Permanent Marker solo en cinta (≤ 4 veces).
- [ ] Sombras tintadas por gel, nunca `rgba(0,0,0,.5)` sobre color.
- [ ] Copiar `fonts/` (5 woff2) al `assets/fonts/` del proyecto HyperFrames y ajustar las rutas `url()` de `arte.css`.
