# Película de personaje (plantilla de 6 bloques · método Claw Machine)

Para piezas cortas (10–25 s) donde **un personaje actúa una historia con objetos reales**, no para un tráiler de funciones. Sale del *Prompt Pack: Claw Machine* (Opus 5.5 Motion Lab, `referencias/clawd-claw-machine.pdf`): 280 palabras de prompt, 7 rondas de correcciones de imagen y 3 de sonido.

**La idea clave:** un prompt corto y denso con **6 bloques fijos**. Solo cambia el bloque MARCA, y el resto del prompt usa los nombres que define ese bloque. Las 7 rondas de corrección hacen el resto (ver `follow-ups.md`).

---

## Los 6 bloques

| Bloque | Qué fija | Cómo se escribe |
|---|---|---|
| **MARCA** | Lo que se cambia de un proyecto a otro: el héroe, los objetos, la máquina o el escenario, el lugar, la paleta y **cómo falla cada intento** | Medidas y hex exactos. El héroe, descrito como una rejilla o con proporciones. Los fallos, uno distinto por intento: drop / slip / win |
| **FORMATO** | Un archivo, la librería, la resolución, los fps, la duración, y que cada fotograma sea **función pura del tiempo** | `renderAt(t)` muestrea una simulación física precalculada al cargar (*bake* con semilla) |
| **LOOK** | Qué emite la luz, qué tiene que verse en un móvil y el color que tiene que sobrevivir | «La máquina es la fuente de luz, bokeh de luces reales, luz principal neutra para que el héroe se lea D97757» |
| **BEATS** | Segundos y acción de actor, no descripciones | La mirada, un *take*, la decepción, el golpe cómico, **un aguante de respiración antes del gran momento**, la victoria y una mirada a cámara |
| **CÁMARA** | **Un único movimiento continuo** con una función en cada beat | Plano del gancho → atraviesa el cristal → dentro de la máquina en el golpe → cenital → macro → contrapicado → plano medio cálido del abrazo |
| **CHECKS** | Las reglas físicas y de actuación que hacen que se sienta real | Squash al aterrizar, péndulo de la garra, **nada se atraviesa**, los ojos van antes que el gesto |

---

## Plantilla para copiar (en inglés funciona mejor; el modelo la sigue tal cual)

```
BRAND
HERO: <personaje: proporciones o rejilla, hex del cuerpo, ojos, apéndices>
PROPS: <los objetos con los que actúa; cuántos; uno distinto (el «premio»)>
SET: <la máquina / el escenario: color de carcasa, materiales, rótulo con su texto exacto>
VENUE: <dónde está: luz ambiente, qué brilla>
PALETTE: <4–6 hex>
TRIES: <3 intentos: cómo falla cada uno y cómo gana el último>

One HTML file, three.js 0.160.0 (+ cannon-es if there is physics), 1920x1080, <fps> fps, <dur> s.
renderAt(t) samples a seeded physics bake. Every frame is a pure function of t.

LOOK: <la luz sale del objeto principal>, bokeh from real lights, neutral key so HERO reads <hex>.

BEATS (s):
0    HOOK: close on HERO's face, <lo que se mueve al lado>; <el disparador> 
<t>  try 1: eyes track <objeto>, HERO mimes <acción>; <fallo 1>; shoulders sag, huff
<t>  try 2: <determinación>; <fallo 2, casi lo consigue>; <golpe cómico + reacción>
<t>  last try: <música baja a latido>, stillness, held breath; <acción lenta y cuidadosa>
<t>  <EL GOLPE>; breath out; take, double take; <celebración>, one look at us
<t>  <el abrazo / el remate>; hold

CAMERA: one move: <plano por beat, cada uno con su función>.

CHECKS: squash on every landing, <péndulo / inercia del objeto>, no clipping, eyes lead.
```

---

## Ejemplo relleno: el ajolote de Taller en 3D (nuestro vídeo, `ejemplo-ajolote-3d/`)

```
BRAND
HERO: Taller axolotl vinyl toy, body F2A9BB, belly FBD6DF, head 60 % of height, 3 feathery gills
      per side FF7A45 / F0502A, black eyes with one highlight, cheeks FF8AA3
PROPS: 3 glowing app panels: GUION (Courier page, 3 scenes), PLAN DE RODAJE (3 day columns),
       HOJA DE LLAMADA (5 crew circles); a paper plane; a clapperboard "EL ÚLTIMO VERANO"
SET: dark studio table, panels are lit slabs, the clapperboard rises from below
VENUE: night edit suite, warm lamp per panel, fog 120D0B
PALETTE: F0C94A, 5FD38D, FF6A45, F7C1CC, 121212, ECE8DC
TRIES: not tries — 3 stations: every landing CHANGES the panel (highlight, card drops, check ✓)
```

Lo que nos faltó y el método Claw Machine sí tiene:
- **Un aguante de respiración antes del clímax**: quietud y la música baja a latido antes de ¡ACCIÓN!.
- **Un *double take*** y **una sola mirada a cámara**.
- **Un registro de choques**: el ajolote no debe hundirse en los paneles ni en la claqueta (`kit/checks/choques-3d.js`).
- **El color medido en los fotogramas finales**: el rosa salió más pálido que F2A9BB (`kit/checks/medir-color.py`).
- **Render suave**: muestras dentro del obturador para el desenfoque de movimiento (`kit/render/render-suave.mjs`).

---

## 3 trucos de la ficha (valen también en 2D)

1. **Guioniza el drama, simula el resto.** El balanceo en el borde es un keyframe con forma; en el momento en que cae, manda la física.
2. **Apunta al premio, no a la garra.** Re-apunta el movimiento cuando agarra para que lo que acaba sobre el objetivo sea el objeto, no el mecanismo.
3. **Filma la cara desde dentro.** Si el héroe mira a una máquina o pantalla, la cara solo se ve a través del cristal: pon la cámara dentro de la máquina.

## Cómo se renderizó (y cómo lo hacemos aquí)

| Claw Machine (con GPU) | Aquí (nube, SwiftShader) |
|---|---|
| `?t=` para dibujar solo el instante pedido; el *bake* físico corre una vez al cargar | `window.renderAt(t, {jx, jy})` en la página |
| Captura de cada fotograma a 2× (3840×2160) en Chrome headless con GPU | 1× (~1,1 s por muestra a 1080p): el 2× solo para planos cortos |
| 12 muestras por fotograma en luz lineal: tiempo dentro de un obturador de 0,45 fotogramas, punto en la lente (profundidad de campo) y desplazamiento sub-píxel | `kit/render/render-suave.mjs --muestras 6–12 --obturador 0.45` (tiempo + sub-píxel; sin profundidad de campo) |
| Tone map, Lanczos a 1920×1080 en luz lineal, un poco de grano y dither | `mezclar-muestras.py` (media en luz lineal + dither + grano con semilla) |
| H.264 High, 60 fps, 25 Mbps, WAV muxeado como AAC | CRF 17 + AAC 320k |

**Coste aquí:** 6 muestras ≈ 6,7 s por fotograma a 1080p, así que 12 s a 30 fps son unos 40 min. Con movimientos muy rápidos 6 muestras dejan copias escalonadas; sube a 12 o acorta el obturador.
