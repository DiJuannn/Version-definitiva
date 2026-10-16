# 03 · Ajolote v2 — rig SVG + biblioteca de poses

Rol: diseño de personaje + animación 2D (escuela Duolingo / Headspace / Buck: formas planas, contorno de color, squash & stretch generoso, acting legible en silueta).

**Estado: construido, verificado (`npx hyperframes check` → 0 errores, 0 avisos) y revisado fotograma a fotograma.**

| Qué | Ruta |
|---|---|
| Fragmento del rig (pegar en la composición) | `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/rig/ajolote.html` |
| Módulo de poses (`window.AxRig`) | `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/rig/poses.js` |
| Generador de la geometría (plumas, brazos, cola inicial) | `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/rig/build/gen.js` |
| Composición de prueba HyperFrames (26,4 s, 12 bloques de poses) | `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/rig/test/index.html` |
| **Hoja de contactos final (primer plano)** | `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/rig/snaps/final-zoom/contact-sheet-1.jpg` y `contact-sheet-2.jpg` |
| Hoja de contactos final (encuadre completo, con asomarse y crecer) | `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/rig/snaps/final/contact-sheet-1.jpg` y `contact-sheet-2.jpg` |

Regenerar: `cd …/v2/rig && node build/gen.js && node build/test.js 26.4` (el segundo inserta el rig y copia `poses.js` a `test/assets/`).

---

## 1. Qué cambia respecto a la v1

| v1 | v2 |
|---|---|
| Elipses sueltas (cabeza, cuerpo, brazos-salchicha) | Paths bezier propios: cabeza "mochi" 268×190, cuerpo-pera 148×150, brazo cónico con manita de 3 dedos |
| Branquias = 3 elipses planas | 3 plumas por lado con 4 foliolos por borde, núcleo cálido y venas; cada pluma tiene 2 grupos (pose + ondulación) → follow-through con retardo 0,11 s entre ramas y 0,37 s entre lados |
| Cola rígida que rota | Un único path regenerado cada frame desde una espina de 18 segmentos: onda viajera (2 osciladores mezclables), aleta dorsal, franja, "lift" y "curl". Cero costuras |
| Ojos de punto sin estados | 4 estados por ojo (abierto, feliz ^, apretado > <, guiño), brillo que contra-mueve (parallax) cuando la pupila mira, escala para sorpresa, parpadeo independiente |
| Boca: línea + elipse | 10 bocas con la misma estructura `M C C Z` → se *morphean* con `attr:{d}` (GSAP core) + lengua recortada por la propia boca |
| Sin cejas | Cejas con 6 presets (neutral, up, worried, angry, think, sly) |
| Contorno ausente | Contorno rosa oscuro `#d0708a` 4–4,5 u en todo (nunca negro); sombra de contacto difusa |
| 4 acciones ad hoc | 20 funciones de pose reutilizables con anticipación, overshoot, follow-through, arcos y holds |

Fidelidad a la mascota original (`public/ajolote.png`): rosa pálido `#f7c1cc`, branquias rojo-anaranjadas plumosas `#ff6a45` con venas oscuras, ojos negros de punto, sonrisa simple, manitas con deditos, cola con franja rosa más oscura. Se simplifica a proporción chibi (cabeza ≈ 60 % de la altura).

## 2. Paleta del personaje

| Token | Hex | Uso |
|---|---|---|
| pink | `#f7c1cc` | piel base |
| light | `#fde3e8` | barriga, brillo de cabeza |
| shade | `#eea3b5` | sombra bajo la barbilla y en el cuello (clip a la forma) |
| line | `#d0708a` | contorno (rosa oscuro) |
| tail / stripe | `#f5b8c6` / `#e98ca3` | cola y su franja |
| gill / gillCore / gillLine / vein | `#ff6a45` / `#ff8a5e` / `#d9452f` / `#b8331f` | branquias |
| eye | `#2a1520` | ojos (no negro puro) |
| mouth / tongue | `#7a1f37` / `#ff7f99` | boca, lengua |
| cheek | `#ff8aa3` (op. 0,55, blur 2,4) | mejillas |
| brow | `#c05f7b` (op. 0,8) | cejas |
| FX | `#f0c94a` (gel preparar), `#ece8dc` (papel), `#9cc2ff` (gota) | "!", impactos, estrellas, burbujas de pensar, sudor |

## 3. Anatomía del rig (jerarquía)

Coordenadas: viewBox `-220 -380 440 420`; **(0,0) = punto entre los pies, sobre el suelo**. El contenedor HTML `#ax` (440×420, `left:-220px; top:-380px`) se mueve con GSAP `x/y` = posición de los pies en el escenario y escala con `transformOrigin:"220px 380px"`. A escala 1 el personaje mide ~330 px; en el tráiler usar `s` 0,55–0,8 (≈ 10–15 % de alto de pantalla en planos generales, 0,95–1,4 en primeros planos).

```
#ax (div)                       x, y, scale  (posición en escenario)
└ svg#ax-svg
  ├ #ax-shadow                  scaleX, opacity (se encoge al saltar)
  └ #ax-all  clip-path=#ax-clip (rect #ax-clipRect: asomarse)
    └ #ax-hop                   x, y   (saltos, asomarse)
      └ #ax-tilt                rotation (inclinación desde los pies)
        ├ #ax-flip              scaleX ±1 (lado de la cola; ax.turn)
        │ └ #ax-squash          scaleX/Y (squash & stretch de acciones)
        │   └ #ax-breath        scaleX/Y (respiración base)
        │     ├ #ax-tail, #ax-tailStripe   (d regenerado por JS)
        │     ├ cuerpo, barriga, pies
        │     ├ #ax-headY (y) > #ax-head (rotation, pivote cuello 0,-132)
        │     │   > #ax-headBob (y idle) > #ax-headBobR (rotation idle)
        │     │     ├ branquias: #ax-gL1..3 (pose) > #ax-gL1w..3w (ondulación); R espejado
        │     │     ├ cabeza + sombra + brillo
        │     │     └ #ax-face (x,y: giro 3/4 falso al mirar)
        │     │         ├ #ax-cheekL/R (scale, opacity)
        │     │         ├ #ax-eyeL/R (scale) > #ax-openL/R > #ax-blinkL/R (scaleY) > #ax-lookL/R (x,y) > #ax-hlL/R (x,y)
        │     │         │   + #ax-happyL/R, #ax-sqzL/R, #ax-winkL/R (opacity)
        │     │         ├ #ax-browL/R (y) > #ax-browLr/Rr (rotation)
        │     │         └ #ax-mouth (attr d) + lengua clip
        │     ├ claqueta: #ax-clapY (y) > #ax-clap (scale, rotation, opacity) > #ax-clapStick (rotation, bisagra)
        │     └ brazos: #ax-armL/R (rotation, hombro) > #ax-armLw/Rw (rotation: saludo) > #ax-armLs/Rs (scaleY: estirar) ; #ax-fingerL/R
        └ #ax-fx  #ax-fxBangY>#ax-fxBang, #ax-fxSpark, #ax-th1..3, #ax-fxImpact, #ax-fxImpact2, #ax-fxStars, #ax-fxSweatY>#ax-fxSweat
#ax-trail (div hermano, detrás)  16 × .ax-bub — estela de burbujas en coordenadas de escenario
```

**Reglas técnicas que se cumplen (y que hay que mantener si se edita):**

1. Ningún elemento animado tiene `transform` inicial (ni atributo ni CSS): los transforms fijos viven en `<g>` envoltorios que nunca se animan. Así `svgOrigin:"0 0"` es siempre el pivote local (hombro, base de pluma, bisagra…).
2. **Un elemento no mezcla traslación (`x/y`) con rotación/escala.** Descubierto en las pruebas: GSAP interpreta `svgOrigin` a través de la matriz actual del propio elemento; si ya está trasladado, el pivote se desplaza y `smoothOrigin` deja un offset permanente (la claqueta aparecía 45 u más abajo). Por eso hay pares `headY/head`, `clapY/clap`, `browL/browLr`, `fxBangY/fxBang`…
3. Todos los tweens SVG llevan `svgOrigin`; los del contenedor HTML, `transformOrigin`.
4. **Anti-solapes automático**: el helper interno `A()/F()` registra el último tween por elemento+propiedad y, si uno nuevo empieza mientras el anterior vive, acorta el anterior para que acabe justo ahí. Resultado: ningún aviso `gsap_tween_tail` y poses encadenables sin pensar.
5. Determinista: PRNG `mulberry32` con semilla (`AxRig(tl,{seed})`), sin relojes, sin `repeat:-1` (repeats calculados con `floor`).
6. **No lances una acción en el mismo instante exacto que `init`** (deja ≥ 0,02 s). Dos `tl.set` del mismo atributo en el mismo tiempo se resolvían distinto en el render de HyperFrames que en un seek lineal (lo vimos en el snapshot del nado).
7. Las poses se construyen en orden cronológico: el rig recuerda la orientación (`curFlip`) para que "señalar a la derecha" sea siempre la derecha de pantalla aunque haya nadado hacia la derecha.

## 4. Biblioteca de poses (API)

```js
const tl = gsap.timeline({ paused: true });
const ax = AxRig(tl, { seed: 11 });          // prefijo "ax"
ax.init(0, { x: -300, y: 640, s: 0.95 });   // estado neutro + posición
let t = 0.04;
t = ax.swimIn(t, { from:{x:-260,y:640}, to:{x:960,y:860}, s:0.95, d:1.5 });
t = ax.wave(t, { times: 3 });
// … resto de poses …
ax.base(0, END);      // respiración, branquias, cola (llamar al final)
ax.blinks(0, END);    // parpadeos que respetan las ventanas ocupadas por expresiones
window.__timelines["main"] = tl;
```

Todas las funciones: `(t, opts) → tiempo de fin`. Tiempos medidos en la prueba entre paréntesis.

| Función | Qué hace (principios) | Opciones |
|---|---|---|
| `swimIn(t,{from,to,d,s,bubbles,face})` (2,0 s) | Entra nadando: inclinación 14° hacia la marcha, brazos plegados 38°, branquias peinadas atrás (−18°), stretch 1,08/0,94, onda de cola rápida (amp2), arcos verticales ±26 u, estela de 14 burbujas en mundo. Llegada: contra-inclinación −7° (overshoot) + `elastic.out(1,0.45)`, flick de branquias, "grin" y giro a cámara (`turn`) | `face:false` para no girar |
| `hopTo(t,{x,y,s,d,arc,lean})` | Salto en arco a otra posición: anticipación squash 0,86/1,1 (0,1 s), stretch en el despegue, sombra que se encoge, aterrizaje con squash + elástico | `arc` px de altura |
| `turn(t,to)` (0,32 s) | Giro 180° (scaleX pasa por 0,08 con mini-salto y latigazo de cola) | `to: 1 | -1` |
| `wave(t,{side,times})` | Anticipación (brazo baja 22°), sube a −138° con `back.out(2)` y se estira ×1,3, 3 vaivenes de 0,15 s, cabeza ladeada 6°, ojos ^ ^, mejillas ×1,25 | `side:"L"|"R"` |
| `point(t,{dir,hold,keep})` (1,1 s c/u) | Señala `left/right/up`: anticipación 14°, brazo a −96° (lados) o −122° (arriba) estirado ×1,32/×1,5 ("rubber hose"), dedo índice con `back.out(3)`, mirada + giro de cara, inclinación 5°, "toque" de énfasis | `keep:true` deja el brazo puesto; `unpoint(t,{side})` |
| `surprise(t,{height,hold})` (1,4 s) | Squash 0,84 (0,11 s) → salto 70 u `power3.out` con stretch 1,14, ojos ×1,42 `back.out(4)`, boca "wow", cejas arriba, branquias abiertas 22°, "!" que entra girando, aterrizaje con squash y elástico | |
| `think(t,{d})` (1,9 s) | Mano a la barbilla (+152° cruzando el cuerpo), cabeza −7°, mirada arriba-izquierda, cejas asimétricas, boca "hmm", golpecitos del dedo, 3 burbujas que aparecen escalonadas 0,18 s, cola que se enrosca | |
| `celebrate(t,{jumps,height,hold})` (2,0 s) | Ojos ^ ^, boca "laugh", brazos arriba estirados, n saltos con squash/stretch alternando giro ±7°, brazos que se agitan con desfase, branquias que se abren en el aire y se cierran al caer, cola levantada | |
| `clapIn(t)` / `clapSnap(t,{open,angle,hold})` / `clapOut(t)` (2,2 s) | Claqueta entra con `back.out(2.2)` y las manos la agarran; abre la barra (−27°, anticipación con cuerpo hacia atrás y ceño), hold 0,25 s, cierre en 0,07 s `power4.in`, impacto: squash, rayas amarillas, ojos > <, cabeza sacudida elástica. `ax.hit` = instante del golpe (para SFX/flash) | |
| `wink(t,{hold})` (1,3 s) | Mira a cámara, cabeza 8°, guiño (ojo derecho), boca de medio lado, rubor ×1,45, destello, "pistolita" con la mano izquierda | |
| `trip(t)` (2,9 s) | Trastabilla hacia delante (+10°, brazos agitándose), sale despedido hacia atrás (−24°, y −36), culetazo con squash 0,76/1,2, rayas en el suelo, ojos > <, estrellitas orbitando 540°, cabeza que niega, gota de sudor, sonrisa avergonzada y se recompone | |
| `peek(t,{edge,d,line})` + `unpeek(t)` (2,0 s c/u) | Se asoma desde un borde con recorte SVG (no hace falta tapa): `bottom` (sube hasta los ojos, mira izq/der, sube un poco más con `back.out(2.4)`, se esconde con `back.in`) o `left/right` (se inclina 20–26° desde el lateral) | `line` = altura del borde en coords del rig |
| `scaleTo(t,{from,to})` (0,9 s) | Crecer/encoger con anticipación inversa (×0,88 antes de crecer, ×1,08 antes de encoger), overshoot ×1,1 y asentado elástico; cara feliz o preocupada | |
| `talk(t,d)` / `lipsync(lv,fps,t0)` | Aleteo de boca determinista (8 formas a 9–12 Hz) con cabeceo; o boca dirigida por la envolvente de la voz (niveles 0–3 → smile/talkB/talkA/o) como en `vo_env.js` | |
| Utilidades | `mouth(t,name,d)`, `eyes(t,style)`, `look(t,x,y,d)`, `brows(t,preset)`, `blush(t,k)`, `blink(t)`, `expr(t,name)` (neutral, happy, surprise, think, laugh, ouch, sly, worried), `gills(t,k)`, `gillFlick(t,k)`, `stretch(side,k,t)`, `land(t,k)`, `bubble(t,x,y,s)`, `place(t,{x,y,s,flip})` | |

### Integración en el tráiler v2

1. Pegar el contenido de `ajolote.html` dentro del `#root` (después de las escenas, para que quede encima; `#ax` tiene `z-index:30`, `#ax-trail` 29).
2. `<script src="assets/poses.js"></script>` después de `gsap.min.js`.
3. Cambios de plano: `ax.place(t,{x,y,s})` en el corte (o `hopTo` si el movimiento debe verse). Para que el personaje "viva" en la interfaz simulada: `peek` desde el borde de una tarjeta (pasar `line` = posición del borde relativa a los pies), `point` hacia el elemento que se explica, `clapSnap` sincronizado con un SFX en `ax.hit`.
4. Boca con la voz: `ax.lipsync(VO_ENV.lv, VO_ENV.fps)` **pero** no mientras una pose está fijando boca (o se pisan: el anti-solape acorta, no mezcla). Recomendación: lipsync solo en tramos de "habla" y las poses en silencios/remates.
5. Llamar `ax.base(0,END)` y `ax.blinks(0,END)` al final de la construcción.

## 5. Notas de acting y timing (para dirigir al ajolote en el guion)

- Timing variado: anticipaciones 0,09–0,14 s, acciones 0,18–0,35 s, asentados elásticos 0,5–1,0 s, holds 0,25–0,6 s. Nada dura lo mismo dos veces seguidas.
- Las branquias son el "pelo" del personaje: cualquier acción brusca llama a `gillFlick` (sacudida + elástico 0,3 de amortiguación), con retardo entre ramas y entre lados. Es lo que más vende la vida del rig.
- Mirada antes que gesto: en `point` los ojos llegan 0,05 s antes que el brazo (el público sigue la mirada).
- La cola nunca se para: oscilador base de 1,9 s + oscilador rápido 0,42 s que se mezcla al nadar/girar.
- La sombra en el suelo se encoge a 0,6 y baja a 0,4 de opacidad en el punto alto de cada salto: ancla al personaje en el espacio.
- Escala en pantalla: ≥ 0,55 para que se lean ojos y boca a 1080p. Por debajo, usar `expr` muy marcadas (happy, surprise) y evitar `think`/`sly`, que dependen de detalles finos.

## 6. Verificación

- `cd …/v2/rig/test && npx hyperframes check` → **Check passed, 0 errores, 0 avisos** (lint, layout, motion, contraste).
- Snapshots revisados con Read en 5 iteraciones. Correcciones hechas por lo visto: brazos-tubo → brazo cónico con manita; claqueta demasiado baja (bug de `svgOrigin` + traslación, resuelto separando grupos); claqueta tapando la cara (ángulo −36° → −27°, más baja); "señalar arriba" ilegible (brazo estirable ×1,5); señalar invertido tras nadar a la derecha (estado `curFlip` + `turn`); burbujas a la altura de la cabeza (ahora a la altura de la cola); asomarse lateral demasiado tímido (x 150→100→62, inclinación −20→−26°); avisos `gsap_tween_tail` (anti-solape automático).
- Pendiente/limitaciones: la prueba dura 26,4 s (no 12) porque enseña los 12 bloques sin prisas; el rig no tiene vista de perfil real (el nado lateral es inclinación + flip); los textos de la claqueta quedan parcialmente tapados por las manos (intencionado, se lee el "1 · 1").

---

## 7. Código completo

### 7.1 `rig/ajolote.html` (fragmento del rig, generado)

```html
<!-- ===== AJOLOTE v2 · rig SVG (ids con prefijo ax-) =====
     Pegar dentro del root de la composición. #ax se coloca con GSAP x/y = punto entre los pies.
     Requiere poses.js (window.AxRig). Generado por build/gen.js -->
<style>
  #ax { position: absolute; left: -220px; top: -380px; width: 440px; height: 420px; z-index: 30; pointer-events: none; }
  #ax-svg { display: block; width: 100%; height: 100%; overflow: visible; }
  #ax-trail { position: absolute; left: 0; top: 0; width: 1px; height: 1px; z-index: 29; pointer-events: none; }
  .ax-bub { position: absolute; display: block; left: -10px; top: -10px; width: 20px; height: 20px; border-radius: 50%;
    border: 2.5px solid rgba(236, 232, 220, 0.6); background: rgba(236, 232, 220, 0.07); opacity: 0; }
</style>
<div id="ax-trail"><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i><i class="ax-bub"></i></div>
<div id="ax">
<svg id="ax-svg" viewBox="-220 -380 440 420" xmlns="http://www.w3.org/2000/svg" aria-label="Ajolote">
  <defs>
    <filter id="ax-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <filter id="ax-blur" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>
    <clipPath id="ax-clip" clipPathUnits="userSpaceOnUse"><rect id="ax-clipRect" x="-3000" y="-3000" width="6000" height="6000"/></clipPath>
    <clipPath id="ax-headClip"><path d="M0 -314 C82 -314 134 -276 134 -214 C134 -152 78 -124 0 -124 C-78 -124 -134 -152 -134 -214 C-134 -276 -82 -314 0 -314 Z"/></clipPath>
    <clipPath id="ax-bodyClip"><path d="M0 -152 C50 -152 76 -108 74 -62 C72 -20 46 -2 0 -2 C-46 -2 -72 -20 -74 -62 C-76 -108 -50 -152 0 -152 Z"/></clipPath>
    <clipPath id="ax-mouthClip"><use href="#ax-mouth"/></clipPath>
  </defs>
  <g id="ax-shadow"><ellipse cx="0" cy="4" rx="96" ry="12" fill="#000" opacity="0.38" filter="url(#ax-blur)"/></g>
  <g id="ax-all" clip-path="url(#ax-clip)">
  <g id="ax-hop"><g id="ax-tilt">
    <g id="ax-flip"><g id="ax-squash"><g id="ax-breath">
      <path id="ax-tail" d="M28.4 -57.5 C29.9 -57.1 34.6 -56 37.7 -55.5 C40.9 -55.1 44.1 -54.7 47.3 -54.8 C50.5 -54.8 53.7 -55.2 56.9 -55.9 C60 -56.6 63 -57.6 66 -58.8 C68.9 -60 71.8 -61.5 74.5 -63.1 C77.3 -64.7 80 -66.5 82.6 -68.3 C85.2 -70.2 87.7 -72.2 90.3 -74.3 C92.8 -76.4 95.3 -78.7 97.7 -80.9 C100.2 -83.2 102.7 -85.6 105.1 -88 C107.5 -90.4 110 -92.8 112.4 -95.3 C114.8 -97.8 117.2 -100.4 119.5 -103 C121.8 -105.5 124 -108.2 126.2 -110.9 C128.3 -113.6 130.3 -116.3 132.2 -119.2 C134 -122.1 135.8 -125 137.2 -128.1 C138.7 -131.2 140 -134.5 140.9 -137.8 C141.8 -141.2 142.5 -144.7 142.8 -148.3 C143.1 -152 143 -155.7 142.5 -159.4 C142 -163.2 139.4 -170.5 140 -170.7 C140.6 -170.8 144.5 -164 146.2 -160.3 C147.9 -156.7 149.2 -152.7 150.1 -148.7 C151 -144.8 151.6 -140.6 151.7 -136.5 C151.9 -132.3 151.7 -128.1 151.1 -124 C150.5 -119.9 149.6 -115.8 148.4 -111.8 C147.2 -107.8 145.7 -103.9 144.1 -100.1 C142.4 -96.3 140.5 -92.7 138.4 -89.1 C136.4 -85.5 134.2 -82 131.9 -78.6 C129.5 -75.2 127.1 -71.9 124.4 -68.7 C121.8 -65.5 119.1 -62.3 116.2 -59.3 C113.3 -56.2 110.3 -53.2 107.1 -50.4 C103.8 -47.6 100.4 -44.9 96.9 -42.4 C93.3 -39.9 89.6 -37.5 85.7 -35.4 C81.8 -33.3 77.7 -31.4 73.5 -29.7 C69.3 -28.1 64.9 -26.8 60.6 -25.7 C56.2 -24.7 51.7 -23.9 47.2 -23.4 C42.7 -22.9 38.1 -22.7 33.6 -22.8 C29 -22.9 22.2 -23.7 20 -23.9 Z" fill="#f5b8c6" stroke="#d0708a" stroke-width="4" stroke-linejoin="round"/>
      <path id="ax-tailStripe" d="M47.3 -45.3 C49.1 -45.5 54.5 -45.9 58 -46.6 C61.5 -47.3 65 -48.3 68.4 -49.5 C71.8 -50.7 75.1 -52.2 78.3 -53.8 C81.5 -55.5 84.6 -57.3 87.6 -59.3 C90.6 -61.3 93.5 -63.4 96.3 -65.7 C99.2 -68 101.9 -70.4 104.6 -72.9 C107.3 -75.4 109.9 -78 112.5 -80.6 C115 -83.3 117.5 -86 119.9 -88.8 C122.3 -91.7 124.7 -94.5 126.9 -97.5 C129.1 -100.5 131.3 -103.5 133.2 -106.6 C135.1 -109.8 137 -113 138.5 -116.3 C140.1 -119.6 141.5 -123 142.6 -126.5 C143.7 -130 144.5 -133.7 145 -137.3 C145.4 -141 145.3 -146.6 145.4 -148.5" fill="none" stroke="#e98ca3" stroke-width="5" stroke-linecap="round"/>
      <path d="M0 -152 C50 -152 76 -108 74 -62 C72 -20 46 -2 0 -2 C-46 -2 -72 -20 -74 -62 C-76 -108 -50 -152 0 -152 Z" fill="#f7c1cc" stroke="#d0708a" stroke-width="4.5"/>
      <g clip-path="url(#ax-bodyClip)">
        <ellipse cx="0" cy="-50" rx="47" ry="41" fill="#fde3e8"/>
        <ellipse cx="0" cy="-134" rx="78" ry="26" fill="#eea3b5" opacity="0.6"/>
        <path d="M-30 -60 Q0 -54 30 -60 M-26 -38 Q0 -32 26 -38" fill="none" stroke="#eea3b5" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g><ellipse cx="-36" cy="-6" rx="22" ry="11.5" fill="#f7c1cc" stroke="#d0708a" stroke-width="4"/><path d="M-44 -9 L-44 -2 M-34 -9 L-34 -1" stroke="#d0708a" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/></g>
      <g><ellipse cx="36" cy="-6" rx="22" ry="11.5" fill="#f7c1cc" stroke="#d0708a" stroke-width="4"/><path d="M44 -9 L44 -2 M34 -9 L34 -1" stroke="#d0708a" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/></g>
      <g id="ax-headY"><g id="ax-head"><g id="ax-headBob"><g id="ax-headBobR">
        <g><g transform="translate(-104 -262) rotate(-146)"><g id="ax-gL1"><g id="ax-gL1w"><path d="M0 -5.8 Q4.9 -14.9 19.4 -15.2 Q17.4 -9.8 18.8 -8 Q23.7 -14.8 38.2 -15.1 Q36.2 -9.3 37.6 -7.3 Q42.5 -10.4 57 -10.6 Q55 -5.9 56.4 -4.3 Q61.3 -5.2 75.8 -5.4 Q73.8 -2.3 75.2 -1.2 L80 0 L75.2 1.2 Q73.8 2.3 75.8 5.4 Q61.3 5.2 56.4 4.3 Q55 5.9 57 10.6 Q42.5 10.4 37.6 7.3 Q36.2 9.3 38.2 15.1 Q23.7 14.8 18.8 8 Q17.4 9.8 19.4 15.2 Q4.9 14.9 0 5.8 Z" fill="#ff6a45" stroke="#d9452f" stroke-width="2.6" stroke-linejoin="round"/><path d="M4 -2.8 Q36 -9.3 68.8 0 Q36 9.3 4 2.8 Z" fill="#ff8a5e" opacity="0.75"/><path d="M6 0 Q40 -1.5 72 0 M21.6 0 L32 -7.2 M21.6 0 L32 7.2 M40.4 0 L50.8 -6.2 M40.4 0 L50.8 6.2 M59.2 0 L69.6 -3.3 M59.2 0 L69.6 3.3" fill="none" stroke="#b8331f" stroke-width="1.7" stroke-linecap="round" opacity="0.55"/></g></g></g><g transform="translate(-121 -224) rotate(-177)"><g id="ax-gL2"><g id="ax-gL2w"><path d="M0 -6.2 Q5.2 -15.9 21 -16.3 Q19 -10.5 20.7 -8.5 Q25.9 -15.7 41.6 -16.1 Q39.6 -9.9 41.4 -7.8 Q46.6 -11.1 62.3 -11.3 Q60.3 -6.3 62 -4.6 Q67.3 -5.6 83 -5.7 Q81 -2.4 82.7 -1.3 L88 0 L82.7 1.3 Q81 2.4 83 5.7 Q67.3 5.6 62 4.6 Q60.3 6.3 62.3 11.3 Q46.6 11.1 41.4 7.8 Q39.6 9.9 41.6 16.1 Q25.9 15.7 20.7 8.5 Q19 10.5 21 16.3 Q5.2 15.9 0 6.2 Z" fill="#ff6a45" stroke="#d9452f" stroke-width="2.6" stroke-linejoin="round"/><path d="M4 -3 Q39.6 -9.9 75.7 0 Q39.6 9.9 4 3 Z" fill="#ff8a5e" opacity="0.75"/><path d="M6 0 Q44 -1.5 79.2 0 M23.8 0 L35.2 -7.7 M23.8 0 L35.2 7.7 M44.5 0 L55.8 -6.6 M44.5 0 L55.8 6.6 M65.1 0 L76.5 -3.5 M65.1 0 L76.5 3.5" fill="none" stroke="#b8331f" stroke-width="1.7" stroke-linecap="round" opacity="0.55"/></g></g></g><g transform="translate(-113 -186) rotate(152)"><g id="ax-gL3"><g id="ax-gL3w"><path d="M0 -5.4 Q4.7 -13.9 18.6 -14.2 Q16.6 -9.1 17.9 -7.5 Q22.5 -13.8 36.5 -14.1 Q34.5 -8.6 35.7 -6.8 Q40.4 -9.7 54.4 -9.9 Q52.4 -5.5 53.6 -4 Q58.2 -4.9 72.2 -5 Q70.2 -2.1 71.4 -1.1 L76 0 L71.4 1.1 Q70.2 2.1 72.2 5 Q58.2 4.9 53.6 4 Q52.4 5.5 54.4 9.9 Q40.4 9.7 35.7 6.8 Q34.5 8.6 36.5 14.1 Q22.5 13.8 17.9 7.5 Q16.6 9.1 18.6 14.2 Q4.7 13.9 0 5.4 Z" fill="#ff6a45" stroke="#d9452f" stroke-width="2.6" stroke-linejoin="round"/><path d="M4 -2.6 Q34.2 -8.7 65.4 0 Q34.2 8.7 4 2.6 Z" fill="#ff8a5e" opacity="0.75"/><path d="M6 0 Q38 -1.5 68.4 0 M20.5 0 L30.4 -6.7 M20.5 0 L30.4 6.7 M38.4 0 L48.2 -5.8 M38.4 0 L48.2 5.8 M56.3 0 L66.1 -3.1 M56.3 0 L66.1 3.1" fill="none" stroke="#b8331f" stroke-width="1.7" stroke-linecap="round" opacity="0.55"/></g></g></g></g>
        <g transform="scale(-1 1)"><g transform="translate(-104 -262) rotate(-146)"><g id="ax-gR1"><g id="ax-gR1w"><path d="M0 -5.8 Q4.9 -14.9 19.4 -15.2 Q17.4 -9.8 18.8 -8 Q23.7 -14.8 38.2 -15.1 Q36.2 -9.3 37.6 -7.3 Q42.5 -10.4 57 -10.6 Q55 -5.9 56.4 -4.3 Q61.3 -5.2 75.8 -5.4 Q73.8 -2.3 75.2 -1.2 L80 0 L75.2 1.2 Q73.8 2.3 75.8 5.4 Q61.3 5.2 56.4 4.3 Q55 5.9 57 10.6 Q42.5 10.4 37.6 7.3 Q36.2 9.3 38.2 15.1 Q23.7 14.8 18.8 8 Q17.4 9.8 19.4 15.2 Q4.9 14.9 0 5.8 Z" fill="#ff6a45" stroke="#d9452f" stroke-width="2.6" stroke-linejoin="round"/><path d="M4 -2.8 Q36 -9.3 68.8 0 Q36 9.3 4 2.8 Z" fill="#ff8a5e" opacity="0.75"/><path d="M6 0 Q40 -1.5 72 0 M21.6 0 L32 -7.2 M21.6 0 L32 7.2 M40.4 0 L50.8 -6.2 M40.4 0 L50.8 6.2 M59.2 0 L69.6 -3.3 M59.2 0 L69.6 3.3" fill="none" stroke="#b8331f" stroke-width="1.7" stroke-linecap="round" opacity="0.55"/></g></g></g><g transform="translate(-121 -224) rotate(-177)"><g id="ax-gR2"><g id="ax-gR2w"><path d="M0 -6.2 Q5.2 -15.9 21 -16.3 Q19 -10.5 20.7 -8.5 Q25.9 -15.7 41.6 -16.1 Q39.6 -9.9 41.4 -7.8 Q46.6 -11.1 62.3 -11.3 Q60.3 -6.3 62 -4.6 Q67.3 -5.6 83 -5.7 Q81 -2.4 82.7 -1.3 L88 0 L82.7 1.3 Q81 2.4 83 5.7 Q67.3 5.6 62 4.6 Q60.3 6.3 62.3 11.3 Q46.6 11.1 41.4 7.8 Q39.6 9.9 41.6 16.1 Q25.9 15.7 20.7 8.5 Q19 10.5 21 16.3 Q5.2 15.9 0 6.2 Z" fill="#ff6a45" stroke="#d9452f" stroke-width="2.6" stroke-linejoin="round"/><path d="M4 -3 Q39.6 -9.9 75.7 0 Q39.6 9.9 4 3 Z" fill="#ff8a5e" opacity="0.75"/><path d="M6 0 Q44 -1.5 79.2 0 M23.8 0 L35.2 -7.7 M23.8 0 L35.2 7.7 M44.5 0 L55.8 -6.6 M44.5 0 L55.8 6.6 M65.1 0 L76.5 -3.5 M65.1 0 L76.5 3.5" fill="none" stroke="#b8331f" stroke-width="1.7" stroke-linecap="round" opacity="0.55"/></g></g></g><g transform="translate(-113 -186) rotate(152)"><g id="ax-gR3"><g id="ax-gR3w"><path d="M0 -5.4 Q4.7 -13.9 18.6 -14.2 Q16.6 -9.1 17.9 -7.5 Q22.5 -13.8 36.5 -14.1 Q34.5 -8.6 35.7 -6.8 Q40.4 -9.7 54.4 -9.9 Q52.4 -5.5 53.6 -4 Q58.2 -4.9 72.2 -5 Q70.2 -2.1 71.4 -1.1 L76 0 L71.4 1.1 Q70.2 2.1 72.2 5 Q58.2 4.9 53.6 4 Q52.4 5.5 54.4 9.9 Q40.4 9.7 35.7 6.8 Q34.5 8.6 36.5 14.1 Q22.5 13.8 17.9 7.5 Q16.6 9.1 18.6 14.2 Q4.7 13.9 0 5.4 Z" fill="#ff6a45" stroke="#d9452f" stroke-width="2.6" stroke-linejoin="round"/><path d="M4 -2.6 Q34.2 -8.7 65.4 0 Q34.2 8.7 4 2.6 Z" fill="#ff8a5e" opacity="0.75"/><path d="M6 0 Q38 -1.5 68.4 0 M20.5 0 L30.4 -6.7 M20.5 0 L30.4 6.7 M38.4 0 L48.2 -5.8 M38.4 0 L48.2 5.8 M56.3 0 L66.1 -3.1 M56.3 0 L66.1 3.1" fill="none" stroke="#b8331f" stroke-width="1.7" stroke-linecap="round" opacity="0.55"/></g></g></g></g>
        <path d="M0 -314 C82 -314 134 -276 134 -214 C134 -152 78 -124 0 -124 C-78 -124 -134 -152 -134 -214 C-134 -276 -82 -314 0 -314 Z" fill="#f7c1cc" stroke="#d0708a" stroke-width="4.5"/>
        <g clip-path="url(#ax-headClip)">
          <ellipse cx="0" cy="-116" rx="150" ry="36" fill="#eea3b5" opacity="0.55"/>
          <path d="M-78 -270 C-66 -292 -30 -302 0 -298 C-26 -292 -56 -282 -70 -262 C-74 -258 -80 -262 -78 -270 Z" fill="#fde3e8" opacity="0.9"/>
          <circle cx="22" cy="-294" r="5" fill="#fde3e8" opacity="0.85"/>
        </g>
        <g id="ax-face">
          <g transform="translate(-84 -176)"><ellipse id="ax-cheekL" rx="17" ry="10" fill="#ff8aa3" opacity="0.55" filter="url(#ax-soft)"/></g>
          <g transform="translate(84 -176)"><ellipse id="ax-cheekR" rx="17" ry="10" fill="#ff8aa3" opacity="0.55" filter="url(#ax-soft)"/></g>
          <g transform="translate(-48 -208)"><g id="ax-eyeL"><g id="ax-openL"><g id="ax-blinkL"><g id="ax-lookL"><ellipse rx="11" ry="13" fill="#2a1520"/><g id="ax-hlL"><circle cx="3.8" cy="-5" r="4.2" fill="#fff"/><circle cx="-3.6" cy="4.6" r="1.9" fill="#fff" opacity="0.85"/></g></g></g></g><path id="ax-happyL" opacity="0" d="M-11 4 Q0 -11 11 4" fill="none" stroke="#2a1520" stroke-width="5" stroke-linecap="round"/><path id="ax-sqzL" opacity="0" d="M-8 -8 L6 0 L-8 8" fill="none" stroke="#2a1520" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path id="ax-winkL" opacity="0" d="M-11 -1 Q0 7 11 -1" fill="none" stroke="#2a1520" stroke-width="5" stroke-linecap="round"/></g></g><g transform="translate(48 -208)"><g id="ax-eyeR"><g id="ax-openR"><g id="ax-blinkR"><g id="ax-lookR"><ellipse rx="11" ry="13" fill="#2a1520"/><g id="ax-hlR"><circle cx="3.8" cy="-5" r="4.2" fill="#fff"/><circle cx="-3.6" cy="4.6" r="1.9" fill="#fff" opacity="0.85"/></g></g></g></g><path id="ax-happyR" opacity="0" d="M-11 4 Q0 -11 11 4" fill="none" stroke="#2a1520" stroke-width="5" stroke-linecap="round"/><path id="ax-sqzR" opacity="0" d="M8 -8 L-6 0 L8 8" fill="none" stroke="#2a1520" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path id="ax-winkR" opacity="0" d="M-11 -1 Q0 7 11 -1" fill="none" stroke="#2a1520" stroke-width="5" stroke-linecap="round"/></g></g>
          <g transform="translate(-48 -238)"><g id="ax-browL"><path id="ax-browLr" d="M-9 2 Q-1 -3 9 0" fill="none" stroke="#c05f7b" stroke-width="4.2" stroke-linecap="round" opacity="0.8"/></g></g><g transform="translate(48 -238) scale(-1 1)"><g id="ax-browR"><path id="ax-browRr" d="M-9 2 Q-1 -3 9 0" fill="none" stroke="#c05f7b" stroke-width="4.2" stroke-linecap="round" opacity="0.8"/></g></g>
          <path id="ax-mouth" d="M-17 -170 C-11 -162 11 -162 17 -170 C11 -151 -11 -151 -17 -170 Z" fill="#7a1f37" stroke="#7a1f37" stroke-width="2" stroke-linejoin="round"/>
          <ellipse cx="0" cy="-138" rx="13" ry="9" fill="#ff7f99" clip-path="url(#ax-mouthClip)"/>
        </g>
      </g></g></g></g>
      <g transform="translate(0 -72) scale(1.15)"><g id="ax-clapY"><g id="ax-clap" opacity="0">
        <rect x="-60" y="-26" width="120" height="68" rx="7" fill="#1b1b20" stroke="#0b0b0d" stroke-width="3"/>
        <rect x="-60" y="-26" width="120" height="14" rx="3" fill="#ece8dc"/>
        <path d="M-54 -26 L-42 -26 L-48 -12 L-60 -12 Z M-30 -26 L-18 -26 L-24 -12 L-36 -12 Z M-6 -26 L6 -26 L0 -12 L-12 -12 Z M18 -26 L30 -26 L24 -12 L12 -12 Z M42 -26 L54 -26 L48 -12 L36 -12 Z" fill="#1b1b20"/>
        <line x1="-52" y1="12" x2="52" y2="12" stroke="#4a4a54" stroke-width="1.5"/>
        <line x1="0" y1="-6" x2="0" y2="36" stroke="#4a4a54" stroke-width="1.5"/>
        <text x="-26" y="6" text-anchor="middle" font-family="JB Mono, monospace" font-size="9" fill="#9a978f">ESCENA</text>
        <text x="26" y="6" text-anchor="middle" font-family="JB Mono, monospace" font-size="9" fill="#9a978f">TOMA</text>
        <text x="-26" y="31" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="17" fill="#f0c94a">1</text>
        <text x="26" y="31" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="17" fill="#ece8dc">1</text>
        <g transform="translate(-60 -28)"><g id="ax-clapStick">
          <rect x="0" y="-14" width="120" height="14" rx="3" fill="#ece8dc" stroke="#0b0b0d" stroke-width="2"/>
          <path d="M-6 -14 L6 -14 L12 0 L0 0 Z M18 -14 L30 -14 L36 0 L24 0 Z M42 -14 L54 -14 L60 0 L48 0 Z M66 -14 L78 -14 L84 0 L72 0 Z M90 -14 L102 -14 L108 0 L96 0 Z" fill="#1b1b20"/>
          <circle cx="5" cy="-1" r="3" fill="#4a4a54"/>
        </g></g>
      </g></g></g>
      <g transform="translate(-66 -106) scale(-1 1) rotate(-9)"><g id="ax-armL"><g id="ax-armLw"><g id="ax-armLs"><g id="ax-fingerL" opacity="0"><path d="M2 44 L3 68" stroke="#d0708a" stroke-width="13" stroke-linecap="round"/><path d="M2 44 L3 68" stroke="#f7c1cc" stroke-width="7.5" stroke-linecap="round"/></g><path d="M-11 -4 C-12 10 -11 22 -10 31 C-15 37 -15 45 -10 48 C-8 50 -4 50 -3 47 C-2 52 3 54 5 50 C7 53 12 51 12 47 C16 46 18 40 14 34 C12 24 12 10 11 -4 C11 -10 -11 -10 -11 -4 Z" fill="#f7c1cc" stroke="#d0708a" stroke-width="4" stroke-linejoin="round"/><path d="M-3 47 C-3 44 -2 42 -1 41 M5 50 C5 46 5 44 5 42" fill="none" stroke="#d0708a" stroke-width="2.2" stroke-linecap="round" opacity="0.75"/></g></g></g></g>
      <g transform="translate(66 -106) rotate(-9)"><g id="ax-armR"><g id="ax-armRw"><g id="ax-armRs"><g id="ax-fingerR" opacity="0"><path d="M2 44 L3 68" stroke="#d0708a" stroke-width="13" stroke-linecap="round"/><path d="M2 44 L3 68" stroke="#f7c1cc" stroke-width="7.5" stroke-linecap="round"/></g><path d="M-11 -4 C-12 10 -11 22 -10 31 C-15 37 -15 45 -10 48 C-8 50 -4 50 -3 47 C-2 52 3 54 5 50 C7 53 12 51 12 47 C16 46 18 40 14 34 C12 24 12 10 11 -4 C11 -10 -11 -10 -11 -4 Z" fill="#f7c1cc" stroke="#d0708a" stroke-width="4" stroke-linejoin="round"/><path d="M-3 47 C-3 44 -2 42 -1 41 M5 50 C5 46 5 44 5 42" fill="none" stroke="#d0708a" stroke-width="2.2" stroke-linecap="round" opacity="0.75"/></g></g></g></g>
    </g></g></g>
    <g id="ax-fx">
      <g transform="translate(128 -340) scale(1.5)"><g id="ax-fxBangY"><g id="ax-fxBang" opacity="0"><path d="M-7 -34 L7 -34 L4 2 L-4 2 Z" fill="#f0c94a" stroke="#0b0b0d" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="13" r="6" fill="#f0c94a" stroke="#0b0b0d" stroke-width="3"/></g></g></g>
      <g transform="translate(98 -256)"><g id="ax-fxSpark" opacity="0"><path d="M0 -16 Q2 -2 16 0 Q2 2 0 16 Q-2 2 -16 0 Q-2 -2 0 -16 Z" fill="#fff4c4"/></g></g>
      <g transform="translate(118 -306)"><circle id="ax-th1" r="6" fill="#ece8dc" opacity="0"/></g>
      <g transform="translate(142 -334)"><circle id="ax-th2" r="9" fill="#ece8dc" opacity="0"/></g>
      <g transform="translate(174 -366)"><circle id="ax-th3" r="13" fill="#ece8dc" opacity="0"/></g>
      <g transform="translate(0 -60)"><g id="ax-fxImpact" opacity="0" stroke="#f0c94a" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M-84 -40 L-102 -54"/><path d="M-90 -6 L-112 -6"/><path d="M-84 26 L-102 40"/>
        <path d="M84 -40 L102 -54"/><path d="M90 -6 L112 -6"/><path d="M84 26 L102 40"/>
      </g></g>
      <g transform="translate(0 -324) scale(1 0.36)"><g id="ax-fxStars" opacity="0">
        <path transform="translate(80 0)" d="M0 -13 L3.2 -4.4 L12.4 -4 L5.2 1.7 L7.6 10.5 L0 5.5 L-7.6 10.5 L-5.2 1.7 L-12.4 -4 L-3.2 -4.4 Z" fill="#f0c94a"/>
        <path transform="translate(-40 69)" d="M0 -11 L2.6 -3.6 L10.5 -3.4 L4.3 1.4 L6.5 8.9 L0 4.5 L-6.5 8.9 L-4.3 1.4 L-10.5 -3.4 L-2.6 -3.6 Z" fill="#ece8dc"/>
        <path transform="translate(-40 -69)" d="M0 -12 L2.9 -4 L11.4 -3.7 L4.8 1.5 L7.1 9.7 L0 5 L-7.1 9.7 L-4.8 1.5 L-11.4 -3.7 L-2.9 -4 Z" fill="#f0c94a"/>
      </g></g>
      <g transform="translate(118 -262)"><g id="ax-fxSweatY"><path id="ax-fxSweat" opacity="0" d="M0 -12 C6 -2 9 3 9 7 C9 12 5 15 0 15 C-5 15 -9 12 -9 7 C-9 3 -6 -2 0 -12 Z" fill="#9cc2ff" stroke="#5b86c9" stroke-width="2"/></g></g>
      <g transform="translate(0 -10) scale(1.1 0.7)"><g id="ax-fxImpact2" opacity="0" stroke="#f0c94a" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M-84 -40 L-102 -54"/><path d="M-90 -6 L-112 -6"/><path d="M-84 26 L-102 40"/>
        <path d="M84 -40 L102 -54"/><path d="M90 -6 L112 -6"/><path d="M84 26 L102 40"/>
      </g></g>
    </g>
  </g></g>
  </g>
</svg>
</div>
```

### 7.2 `rig/poses.js`

```js
/* =====================================================================
   AJOLOTE v2 · biblioteca de poses (GSAP 3)
   - Una sola gsap.timeline({paused:true}) para todo: cada función recibe
     el tiempo absoluto `t` y devuelve el tiempo en que termina la acción.
   - Determinista: PRNG con semilla, sin relojes, sin repeat:-1.
   - Cada tween SVG lleva svgOrigin; el contenedor HTML lleva transformOrigin.
   - Ningún elemento animado tiene transform inicial (ni CSS ni atributo):
     los transforms estáticos viven en <g> envoltorios que no se animan.
   Uso:
     const tl = gsap.timeline({ paused: true });
     const ax = AxRig(tl);           // prefijo "ax" por defecto
     ax.init(0); ax.place(0, {x:960, y:900, s:0.8});
     let t = ax.swimIn(0.2, {from:{x:-200,y:700}, to:{x:960,y:900}});
     t = ax.wave(t + 0.1); ...
     ax.base(0, END);  ax.blinks(0, END);   // al final (usa las ventanas ocupadas)
   ===================================================================== */
(function (root) {
  "use strict";

  /* ---------- paleta ---------- */
  const COL = {
    pink: "#f7c1cc", light: "#fde3e8", shade: "#eea3b5", line: "#d0708a",
    tail: "#f5b8c6", stripe: "#e98ca3",
    gill: "#ff6a45", gillCore: "#ff8a5e", gillLine: "#d9452f", vein: "#b8331f",
    eye: "#2a1520", mouth: "#7a1f37", tongue: "#ff7f99", cheek: "#ff8aa3", brow: "#c05f7b",
  };

  /* ---------- cola procedural (un único path que ondula sin costuras) ---------- */
  const TAIL = { x0: 24, y0: -40, n: 18, len: 210, a0: 14, k: -6.6, w0: 34, fin: 8 };
  const f1 = (v) => String(Math.round(v * 10) / 10);
  function crPath(pts, move) {
    let d = (move === false ? " L" : "M") + f1(pts[0][0]) + " " + f1(pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += " C" + f1(p1[0] + (p2[0] - p0[0]) / 6) + " " + f1(p1[1] + (p2[1] - p0[1]) / 6) + " " +
        f1(p2[0] - (p3[0] - p1[0]) / 6) + " " + f1(p2[1] - (p3[1] - p1[1]) / 6) + " " + f1(p2[0]) + " " + f1(p2[1]);
    }
    return d;
  }
  // s = { ph1, amp1, ph2, amp2, lift, curl }
  function tailPaths(s) {
    const T = TAIL, seg = T.len / T.n, rad = Math.PI / 180;
    let x = T.x0, y = T.y0, a = T.a0 - (s.lift || 0) * 10;
    const sp = [[x, y, a]];
    for (let i = 1; i <= T.n; i++) {
      const u = i / T.n;
      a += T.k * (1 + (s.curl || 0)) - (s.lift || 0) * 2.2 * u
        + (s.amp1 || 0) * 4.2 * u * Math.sin((s.ph1 || 0) - 0.48 * i)
        + (s.amp2 || 0) * 9.0 * u * Math.sin((s.ph2 || 0) - 0.62 * i);
      x += Math.cos(a * rad) * seg; y += Math.sin(a * rad) * seg;
      sp.push([x, y, a]);
    }
    const top = [], bot = [], str = [];
    sp.forEach((p, i) => {
      const u = i / T.n, w = T.w0 * Math.pow(1 - u, 0.85) + 0.6;
      const nx = -Math.sin(p[2] * rad), ny = Math.cos(p[2] * rad); // normal "abajo" de la marcha
      const fin = u > 0.12 ? T.fin * Math.pow(Math.sin(Math.PI * Math.min(1, (u - 0.12) / 0.85)), 1.4) : 0;
      const up = w * 0.52 + fin, dn = w * 0.48;
      if (i < T.n) { top.push([p[0] - nx * up, p[1] - ny * up]); bot.push([p[0] + nx * dn, p[1] + ny * dn]); }
      if (i >= 2 && i <= T.n - 2) str.push([p[0] - nx * (up * 0.42), p[1] - ny * (up * 0.42)]);
    });
    const tip = [sp[T.n][0], sp[T.n][1]];
    const ring = top.concat([tip], bot.reverse());
    return { body: crPath(ring) + " Z", stripe: crPath(str) };
  }

  /* ---------- bocas: todas con la misma estructura (M C C Z) para poder morphear ---------- */
  // [lx, ly, rx, ry, ctrlArriba, ctrlAbajo, inset]
  const MOUTHS = {
    smile:   [-17, -170, 17, -170, -162, -151, 6],
    grin:    [-20, -172, 20, -172, -168, -139, 4],
    talkA:   [-13, -169, 13, -169, -173, -148, 3],
    talkB:   [-10, -168, 10, -168, -167, -155, 3],
    o:       [-8, -167, 8, -167, -181, -151, 0.6],
    wow:     [-12, -168, 12, -168, -191, -142, 0],
    laugh:   [-23, -173, 23, -173, -177, -131, 2],
    hmm:     [-11, -164, 11, -166, -165, -160, 4],
    smirk:   [-15, -166, 19, -173, -161, -154, 6],
    ouch:    [-17, -163, 17, -163, -171, -155, 2],
  };
  function mouthD(n) {
    const m = MOUTHS[n] || MOUTHS.smile, [lx, ly, rx, ry, uy, by, c] = m;
    return `M${lx} ${ly} C${lx + c} ${uy} ${rx - c} ${uy} ${rx} ${ry} C${rx - c} ${by} ${lx + c} ${by} ${lx} ${ly} Z`;
  }

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* =================================================================== */
  function AxRig(tl, opt) {
    opt = opt || {};
    const P = opt.prefix || "ax";
    const q = (id) => "#" + P + "-" + id;
    const byId = (id) => document.getElementById(P + "-" + id);
    const WRAP = "#" + P;
    const TO = "220px 380px"; // pies del personaje dentro del contenedor 440x420
    const rnd = mulberry(opt.seed || 7);
    const busy = []; // ventanas en las que no se parpadea
    const ORIG = { shadow: "0 4", head: "0 -132", headBobR: "0 -132" };
    const SIDES = ["L", "R"];
    const GILLS = ["1", "2", "3"];

    const o = (id) => ORIG[id] || "0 0";
    // Anti-solapes: por elemento+propiedad se recuerda el último tween; si uno nuevo
    // empieza mientras el anterior sigue vivo, el anterior se acorta para acabar justo ahí
    // (así nunca hay dos tweens peleando por la misma propiedad).
    const NOKEY = { svgOrigin: 1, transformOrigin: 1, duration: 1, ease: 1, yoyo: 1, repeat: 1, immediateRender: 1, onUpdate: 1, onComplete: 1, delay: 1 };
    const reg = {};
    function track(id, vars, tw) {
      const st = tw.startTime(), en = st + tw.totalDuration();
      Object.keys(vars).forEach((k) => {
        if (NOKEY[k]) return;
        const arr = reg[id + "|" + k] || (reg[id + "|" + k] = []);
        arr.forEach((p) => {
          const ps = p.startTime(), pe = ps + p.totalDuration();
          if (ps < st && pe > st + 1e-4) p.totalDuration(Math.max(0.001, st - ps));
          else if (ps > st && en > ps + 1e-4) tw.totalDuration(Math.max(0.001, ps - st));
        });
        arr.push(tw);
      });
      return tw;
    }
    const add = (id, tw, vars, t) => { tl.add(tw, t); return track(id, vars, tw); };
    const A = (id, v, t) => add(id, gsap.to(q(id), Object.assign({ svgOrigin: o(id) }, v)), v, t);
    const S = (id, v, t) => tl.set(q(id), Object.assign({ svgOrigin: o(id) }, v), t);
    const F = (id, a, b, t) => add(id, gsap.fromTo(q(id), Object.assign({ svgOrigin: o(id) }, a), Object.assign({ svgOrigin: o(id), immediateRender: false }, b)), b, t);
    const W = (v, t) => add("wrap", gsap.to(WRAP, Object.assign({ transformOrigin: TO }, v)), v, t);
    const both = (fn) => SIDES.forEach(fn);

    /* ---- cola ---- */
    const tailS = { ph1: 0, amp1: 1, ph2: 0, amp2: 0, lift: 0, curl: 0 };
    const tailBody = byId("tail"), tailStripe = byId("tailStripe");
    const drawTail = () => { const p = tailPaths(tailS); tailBody.setAttribute("d", p.body); tailStripe.setAttribute("d", p.stripe); };
    const TT = (v, t) => add("tail", gsap.to(tailS, Object.assign({ onUpdate: drawTail }, v)), v, t);

    const ax = { tl, tailPaths, mouthD, MOUTHS, COL };
    // orientación actual (1 = cola a la derecha). Las poses se construyen en orden
    // cronológico, así que basta con un estado de "construcción".
    let curFlip = 1;

    /* ------------------------------------------------------------ */
    /* utilidades de cara                                            */
    /* ------------------------------------------------------------ */
    ax.mouth = (t, name, d = 0.12, ease = "power2.out") => {
      if (!d) S("mouth", { attr: { d: mouthD(name) } }, t);
      else A("mouth", { attr: { d: mouthD(name) }, duration: d, ease }, t);
      return t + d;
    };
    // style: "open" | "happy" | "sqz" | "wink"  ; o {L:"open", R:"wink"}
    ax.eyes = (t, style) => {
      const st = typeof style === "string" ? { L: style, R: style } : style;
      both((s) => ["open", "happy", "sqz", "wink"].forEach((k) => S(k + s, { opacity: st[s] === k ? 1 : 0 }, t)));
      return t;
    };
    ax.look = (t, x = 0, y = 0, d = 0.2, ease = "power3.out") => {
      both((s) => { A("look" + s, { x, y, duration: d, ease }, t); A("hl" + s, { x: -x * 0.45, y: -y * 0.45, duration: d, ease }, t); });
      A("face", { x: x * 0.7, y: y * 0.5, duration: d * 1.4, ease: "power2.out" }, t);
      return t + d;
    };
    const BROWS = {
      neutral: [[0, 0], [0, 0]], up: [[-8, 0], [-8, 0]], worried: [[-4, -14], [-4, -14]],
      angry: [[2, 14], [2, 14]], think: [[-9, -6], [2, 10]], sly: [[0, 0], [-7, -10]],
    };
    ax.brows = (t, name, d = 0.18, ease = "back.out(2)") => {
      const b = BROWS[name] || BROWS.neutral;
      A("browL", { y: b[0][0], duration: d, ease }, t); A("browLr", { rotation: b[0][1], duration: d, ease }, t);
      A("browR", { y: b[1][0], duration: d, ease }, t); A("browRr", { rotation: b[1][1], duration: d, ease }, t);
      return t + d;
    };
    ax.blush = (t, k = 1, d = 0.3) => { both((s) => A("cheek" + s, { scale: k, opacity: 0.45 + 0.25 * k, duration: d, ease: "power2.out" }, t)); return t + d; };
    ax.blink = (t) => {
      both((s) => { A("blink" + s, { scaleY: 0.08, duration: 0.06, ease: "power2.in" }, t); A("blink" + s, { scaleY: 1, duration: 0.1, ease: "power2.out" }, t + 0.07); });
      return t + 0.17;
    };
    ax.expr = (t, name, d = 0.14) => {
      const E = {
        neutral: ["open", "smile", "neutral"], happy: ["happy", "grin", "neutral"], surprise: ["open", "wow", "up"],
        think: ["open", "hmm", "think"], laugh: ["happy", "laugh", "up"], ouch: ["sqz", "ouch", "worried"],
        sly: [{ L: "open", R: "wink" }, "smirk", "sly"], worried: ["open", "o", "worried"],
      }[name];
      ax.eyes(t, E[0]); ax.mouth(t, E[1], d); ax.brows(t, E[2], d + 0.06);
      return t + d;
    };
    const markBusy = (a, b) => busy.push([a, b]);

    // gesto de branquias: k>0 abre el abanico, k<0 lo cierra/pliega hacia atrás
    const gills = (t, k, d = 0.25, ease = "back.out(2.4)", stag = 0.04) => {
      both((s, si) => GILLS.forEach((g, gi) => {
        const rot = [k, k * 0.25, -k][gi];
        A("g" + s + g, { rotation: rot, duration: d, ease }, t + gi * stag + si * 0.02);
      }));
      return t + d;
    };
    ax.gills = gills;
    // brazo "rubber hose": estira el brazo (scaleY del grupo w) para gestos legibles
    const stretch = (s, k, t, d = 0.25) => A("arm" + s + "s", { scaleY: k, duration: d, ease: k > 1 ? "back.out(2.5)" : "power2.inOut" }, t);
    ax.stretch = stretch;
    // sacudida con follow-through: abre, rebota, se asienta
    const gillFlick = (t, k = 16, d = 0.9) => {
      both((s, si) => GILLS.forEach((g, gi) => {
        const sgn = [1, 0.3, -1][gi], tt = t + gi * 0.05 + si * 0.025;
        A("g" + s + g, { rotation: k * sgn, duration: 0.12, ease: "power2.out" }, tt);
        A("g" + s + g, { rotation: 0, duration: d, ease: "elastic.out(1.1,0.32)" }, tt + 0.12);
      }));
      return t + d + 0.2;
    };
    ax.gillFlick = gillFlick;

    /* ------------------------------------------------------------ */
    /* estado inicial y capa base                                    */
    /* ------------------------------------------------------------ */
    // OJO: ninguna acción debe empezar en el mismo instante exacto que init (deja ≥ 0.02 s):
    // dos tl.set del mismo atributo en el mismo tiempo pueden resolverse distinto según el seek.
    ax.init = (t = 0, p = {}) => {
      tl.set(WRAP, { x: p.x == null ? 960 : p.x, y: p.y == null ? 900 : p.y, scale: p.s == null ? 1 : p.s, rotation: 0, transformOrigin: TO }, t);
      ["hop", "headY", "headBob", "face"].forEach((id) => S(id, { x: 0, y: 0 }, t));
      ["tilt", "flip", "squash", "breath", "head", "headBobR"].forEach((id) => S(id, { rotation: 0, scale: 1 }, t));
      both((s) => {
        S("arm" + s, { rotation: 0 }, t); S("arm" + s + "w", { rotation: 0 }, t); S("arm" + s + "s", { scaleY: 1 }, t); S("finger" + s, { opacity: 0, scale: 1 }, t);
        S("eye" + s, { scale: 1 }, t); S("blink" + s, { scaleY: 1 }, t); S("look" + s, { x: 0, y: 0 }, t); S("hl" + s, { x: 0, y: 0 }, t);
        S("brow" + s, { y: 0 }, t); S("brow" + s + "r", { rotation: 0 }, t); S("cheek" + s, { scale: 1, opacity: 0.55 }, t);
        GILLS.forEach((g) => { S("g" + s + g, { rotation: 0 }, t); });
      });
      ax.eyes(t, "open");
      S("mouth", { attr: { d: mouthD("smile") } }, t);
      S("shadow", { scaleX: 1, scaleY: 1, opacity: 1 }, t);
      S("clap", { opacity: 0, scale: 0.6, rotation: 0 }, t); S("clapY", { y: 0 }, t); S("clapStick", { rotation: 0 }, t);
      ["fxBang", "fxSpark", "fxImpact", "fxImpact2", "fxStars", "fxSweat", "th1", "th2", "th3"].forEach((id) => S(id, { opacity: 0, scale: 0.4, rotation: 0 }, t));
      ["fxBangY", "fxSweatY"].forEach((id) => S(id, { y: 0 }, t));
      tl.set(q("clipRect"), { attr: { x: -3000, y: -3000, width: 6000, height: 6000 } }, t);
      tl.set(tailS, { ph1: 0, amp1: 1, ph2: 0, amp2: 0, lift: 0, curl: 0, onComplete: drawTail }, t);
      return t;
    };

    // respiración + branquias + cola, de t0 a t1
    ax.base = (t0, t1) => {
      const D = t1 - t0, br = 1.15;
      const reps = (c) => Math.max(0, Math.floor(D / c) - 1);
      F("breath", { scaleY: 1, scaleX: 1 }, { scaleY: 1.035, scaleX: 0.986, duration: br, ease: "sine.inOut", yoyo: true, repeat: reps(br) }, t0);
      F("headBob", { y: 0 }, { y: 3, duration: br, ease: "sine.inOut", yoyo: true, repeat: reps(br) - 1 }, t0 + 0.2);
      F("headBobR", { rotation: -1.2 }, { rotation: 1.2, duration: 1.7, ease: "sine.inOut", yoyo: true, repeat: reps(1.7) - 1 }, t0 + 0.4);
      both((s, si) => GILLS.forEach((g, gi) => {
        const half = 0.78, off = gi * 0.11 + si * 0.37;
        F("g" + s + g + "w", { rotation: -5 }, { rotation: 6, duration: half, ease: "sine.inOut", yoyo: true, repeat: Math.max(0, Math.floor((D - off) / half) - 1) }, t0 + off);
      }));
      tl.fromTo(tailS, { ph1: 0, ph2: 0 }, { ph1: (D / 1.9) * Math.PI * 2, ph2: (D / 0.42) * Math.PI * 2, duration: D, ease: "none", onUpdate: drawTail, immediateRender: false }, t0);
      return t1;
    };
    ax.blinks = (t0, t1) => {
      for (let t = t0 + 1.4; t < t1 - 0.5; t += 2.3 + rnd() * 2.2) {
        if (busy.some(([a, b]) => t > a - 0.2 && t < b + 0.2)) continue;
        ax.blink(t);
        if (rnd() < 0.22) ax.blink(t + 0.24);
      }
    };

    /* ------------------------------------------------------------ */
    /* posición / desplazamientos                                    */
    /* ------------------------------------------------------------ */
    ax.place = (t, p) => {
      tl.set(WRAP, { x: p.x, y: p.y, scale: p.s == null ? 1 : p.s, transformOrigin: TO }, t);
      if (p.flip) { S("flip", { scaleX: p.flip }, t); curFlip = p.flip; }
      return t;
    };
    // salto en arco a otra posición, con anticipación y aterrizaje
    ax.hopTo = (t, p) => {
      const d = p.d || 0.6, arc = p.arc == null ? 90 : p.arc, dir = Math.sign((p.lean == null ? 1 : p.lean));
      A("squash", { scaleY: 0.86, scaleX: 1.1, duration: 0.1, ease: "power2.in" }, t);
      const t1 = t + 0.1;
      W({ x: p.x, y: p.y, scale: p.s, duration: d, ease: "power1.inOut" }, t1);
      A("hop", { y: -arc, duration: d / 2, ease: "power2.out" }, t1);
      A("hop", { y: 0, duration: d / 2, ease: "power2.in" }, t1 + d / 2);
      A("squash", { scaleY: 1.12, scaleX: 0.92, duration: 0.14, ease: "power2.out" }, t1);
      A("squash", { scaleY: 1, scaleX: 1, duration: d - 0.2, ease: "sine.inOut" }, t1 + 0.14);
      A("tilt", { rotation: 8 * dir, duration: d / 2, ease: "sine.out" }, t1);
      A("tilt", { rotation: 0, duration: d / 2, ease: "sine.in" }, t1 + d / 2);
      A("shadow", { scaleX: 0.6, opacity: 0.4, duration: d / 2, ease: "power2.out" }, t1);
      A("shadow", { scaleX: 1, opacity: 1, duration: d / 2, ease: "power2.in" }, t1 + d / 2);
      gills(t1, -12, 0.2, "power2.out");
      return land(t1 + d);
    };
    function land(t, k = 1) {
      A("squash", { scaleY: 1 - 0.16 * k, scaleX: 1 + 0.14 * k, duration: 0.07, ease: "power2.out" }, t);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.55, ease: "elastic.out(1.2,0.4)" }, t + 0.07);
      gillFlick(t, 15 * k, 0.8);
      return t + 0.45;
    }
    ax.land = land;

    // nadar desde from hasta to (coords de escenario), con estela de burbujas
    ax.swimIn = (t, p) => {
      const d = p.d || 1.5, from = p.from, to = p.to;
      const dir = Math.sign(to.x - from.x) || 1; // +1 → hacia la derecha
      const ease = "power2.out";
      tl.set(WRAP, { x: from.x, y: from.y, scale: p.s || 1, transformOrigin: TO }, t);
      S("flip", { scaleX: dir > 0 ? -1 : 1 }, t); // cola siempre detrás de la marcha
      curFlip = dir > 0 ? -1 : 1;
      S("shadow", { opacity: 0 }, t);
      W({ x: to.x, duration: d, ease }, t);
      W({ y: to.y, duration: d, ease: "sine.inOut" }, t);
      // ondulación vertical de nado (arcos)
      F("hop", { y: 0 }, { y: -26, duration: d / 4, ease: "sine.inOut", yoyo: true, repeat: 3 }, t);
      S("tilt", { rotation: 14 * dir }, t);
      A("tilt", { rotation: -7 * dir, duration: 0.35, ease: "power2.out" }, t + d - 0.25);
      A("tilt", { rotation: 0, duration: 0.6, ease: "elastic.out(1,0.45)" }, t + d + 0.1);
      S("squash", { scaleX: 1.08, scaleY: 0.94 }, t);
      A("squash", { scaleX: 1, scaleY: 1, duration: 0.5, ease: "elastic.out(1,0.5)" }, t + d - 0.1);
      both((s) => S("arm" + s, { rotation: 38 }, t));
      both((s) => A("arm" + s, { rotation: 0, duration: 0.5, ease: "back.out(2.2)" }, t + d - 0.15));
      gills(t, -18, 0.01);
      gillFlick(t + d - 0.2, 18, 1.0);
      TT({ amp2: 1, amp1: 0.3, duration: 0.01 }, t);
      TT({ amp2: 0, amp1: 1, duration: 0.8, ease: "power2.inOut" }, t + d - 0.3);
      A("shadow", { opacity: 1, duration: 0.4 }, t + d - 0.2);
      ax.expr(t, "neutral", 0.01); ax.mouth(t, "o", 0.01); ax.mouth(t + d - 0.1, "grin", 0.2); ax.mouth(t + d + 0.6, "smile", 0.25);
      ax.look(t, dir * 4, 0, 0.01);
      ax.look(t + d - 0.1, 0, 0, 0.3);
      // al llegar, giro a cámara (la cola cambia de lado con un "swish")
      if (p.face !== false && curFlip !== 1) ax.turn(t + d + 0.2, 1);
      // estela de burbujas en coordenadas de escenario
      const e = gsap.parseEase(ease), sc = p.s || 1;
      const n = p.bubbles == null ? 14 : p.bubbles;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n * 0.92, tb = t + u * d;
        const bx = from.x + (to.x - from.x) * e(u) - dir * (130 + rnd() * 70) * sc, by = from.y + (to.y - from.y) * u - (40 + rnd() * 110) * sc;
        bubble(tb, bx, by, (0.55 + rnd() * 0.9) * sc);
      }
      return t + d + 0.5;
    };
    // girarse: scaleX pasa por ~0 con un pequeño salto, como un giro de 180°
    ax.turn = (t, to) => {
      const from = curFlip;
      if (from === to) return t;
      A("flip", { scaleX: from * 0.08, duration: 0.11, ease: "power2.in" }, t);
      A("flip", { scaleX: to, duration: 0.2, ease: "back.out(2)" }, t + 0.11);
      A("hop", { y: -14, duration: 0.11, ease: "power2.out" }, t);
      A("hop", { y: 0, duration: 0.16, ease: "power2.in" }, t + 0.11);
      TT({ amp2: 0.8, duration: 0.1 }, t); TT({ amp2: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
      curFlip = to;
      return t + 0.32;
    };
    let bubI = 0;
    const bubs = Array.from(document.querySelectorAll("#" + P + "-trail .ax-bub"));
    function bubble(t, x, y, s) {
      if (!bubs.length) return;
      const b = bubs[bubI++ % bubs.length], life = 0.9 + rnd() * 0.6, rise = 90 + rnd() * 90;
      tl.fromTo(b, { x, y, scale: s * 0.3, opacity: 0 }, { x: x + (rnd() - 0.5) * 30, y: y - rise, scale: s, opacity: 0.9, duration: life * 0.35, ease: "power2.out", immediateRender: false }, t);
      tl.to(b, { y: y - rise * 1.8, opacity: 0, scale: s * 1.15, duration: life * 0.65, ease: "power1.in" }, t + life * 0.35);
    }
    ax.bubble = bubble;

    /* ------------------------------------------------------------ */
    /* gestos                                                        */
    /* ------------------------------------------------------------ */
    // saludar (brazo derecho por defecto)
    ax.wave = (t, p = {}) => {
      const s = p.side || "R", n = p.times || 3;
      A("tilt", { rotation: s === "R" ? -4 : 4, duration: 0.3, ease: "power2.out" }, t);
      A("arm" + s, { rotation: 22, duration: 0.1, ease: "power2.in" }, t); // anticipación
      A("arm" + s, { rotation: -138, duration: 0.32, ease: "back.out(2)" }, t + 0.1);
      stretch(s, 1.3, t + 0.1);
      F("arm" + s + "w", { rotation: 0 }, { rotation: -26, duration: 0.15, ease: "sine.inOut", yoyo: true, repeat: n * 2 - 1 }, t + 0.36);
      A("head", { rotation: s === "R" ? 6 : -6, duration: 0.35, ease: "back.out(2)" }, t + 0.08);
      ax.expr(t + 0.1, "happy", 0.16); ax.blush(t + 0.1, 1.25);
      gillFlick(t + 0.12, 10, 0.7);
      const te = t + 0.36 + n * 0.3;
      A("arm" + s, { rotation: 0, duration: 0.4, ease: "back.out(1.6)" }, te);
      stretch(s, 1, te, 0.3);
      A("head", { rotation: 0, duration: 0.5, ease: "back.out(1.6)" }, te);
      A("tilt", { rotation: 0, duration: 0.5, ease: "power2.inOut" }, te);
      ax.expr(te, "neutral", 0.18); ax.blush(te, 1);
      markBusy(t, te);
      return te + 0.4;
    };

    // señalar: dir = "left" | "right" | "up"
    ax.point = (t, p = {}) => {
      const dir = p.dir || "right", hold = p.hold == null ? 0.6 : p.hold;
      const F_ = curFlip, vis = dir === "left" ? "L" : "R";
      const s = F_ === 1 ? vis : (vis === "L" ? "R" : "L"); // brazo que queda en ese lado de pantalla
      const ang = dir === "up" ? -122 : -96;
      stretch(s, dir === "up" ? 1.5 : 1.32, t + 0.1, 0.28);
      const lx = dir === "left" ? -5 : dir === "right" ? 5 : 1, ly = dir === "up" ? -5 : -1;
      A("arm" + s, { rotation: 14, duration: 0.1, ease: "power2.in" }, t);
      A("arm" + s, { rotation: ang, duration: 0.28, ease: "back.out(2.6)" }, t + 0.1);
      S("finger" + s, { opacity: 1 }, t + 0.16);
      F("finger" + s, { scale: 0.3 }, { scale: 1, duration: 0.2, ease: "back.out(3)" }, t + 0.16);
      ax.look(t + 0.05, lx * F_, ly, 0.18);
      const lean = dir === "left" ? -5 : dir === "right" ? 5 : 0;
      A("tilt", { rotation: lean, duration: 0.35, ease: "back.out(2)" }, t + 0.08);
      A("head", { rotation: (dir === "up" ? -4 : lean * 0.8) * F_, duration: 0.35, ease: "back.out(2)" }, t + 0.1);
      ax.mouth(t + 0.12, "grin", 0.14); ax.brows(t + 0.1, "up");
      // pequeño "toque" de énfasis
      A("arm" + s + "w", { rotation: -8, duration: 0.1, ease: "power2.out" }, t + 0.42);
      A("arm" + s + "w", { rotation: 0, duration: 0.3, ease: "elastic.out(1,0.4)" }, t + 0.52);
      const te = t + 0.4 + hold;
      if (p.keep) return te;
      ax.unpoint(te, { side: s });
      return te + 0.35;
    };
    ax.unpoint = (t, p = {}) => {
      const s = p.side || "R";
      A("arm" + s, { rotation: 0, duration: 0.35, ease: "back.out(1.5)" }, t);
      stretch(s, 1, t, 0.3);
      S("finger" + s, { opacity: 0 }, t + 0.12);
      A("tilt", { rotation: 0, duration: 0.4, ease: "power2.inOut" }, t);
      A("head", { rotation: 0, duration: 0.4, ease: "power2.inOut" }, t);
      ax.look(t, 0, 0, 0.25); ax.mouth(t, "smile", 0.2); ax.brows(t, "neutral");
      return t + 0.4;
    };

    // sorpresa: anticipación, salto, ojos grandes, "!"
    ax.surprise = (t, p = {}) => {
      const h = p.height || 70;
      A("squash", { scaleY: 0.84, scaleX: 1.1, duration: 0.11, ease: "power2.in" }, t);
      ax.eyes(t, "open"); ax.look(t, 0, 0, 0.05);
      const t1 = t + 0.11;
      A("hop", { y: -h, duration: 0.24, ease: "power3.out" }, t1);
      A("hop", { y: 0, duration: 0.24, ease: "power2.in" }, t1 + 0.3);
      A("squash", { scaleY: 1.14, scaleX: 0.9, duration: 0.12, ease: "power2.out" }, t1);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.2, ease: "sine.inOut" }, t1 + 0.12);
      A("shadow", { scaleX: 0.62, opacity: 0.45, duration: 0.24, ease: "power3.out" }, t1);
      A("shadow", { scaleX: 1, opacity: 1, duration: 0.24, ease: "power2.in" }, t1 + 0.3);
      both((s) => { A("eye" + s, { scale: 1.42, duration: 0.18, ease: "back.out(4)" }, t1); A("arm" + s, { rotation: -62, duration: 0.18, ease: "back.out(3)" }, t1); });
      ax.mouth(t1, "wow", 0.12); ax.brows(t1, "up", 0.15);
      gills(t1, 22, 0.16, "power3.out", 0.02);
      S("fxBang", { opacity: 1 }, t1 + 0.05);
      F("fxBang", { scale: 0.2, rotation: -25 }, { scale: 1, rotation: 8, duration: 0.3, ease: "back.out(3.5)" }, t1 + 0.05);
      F("fxBangY", { y: 14 }, { y: 0, duration: 0.3, ease: "back.out(3)" }, t1 + 0.05);
      A("fxBang", { rotation: 0, duration: 0.4, ease: "elastic.out(1,0.35)" }, t1 + 0.35);
      A("fxBang", { opacity: 0, scale: 0.6, duration: 0.2, ease: "power2.in" }, t1 + 0.95);
      const tl2 = land(t1 + 0.54, 0.9);
      gills(t1 + 0.54, 0, 0.01);
      const te = t1 + 0.9 + (p.hold || 0);
      both((s) => { A("eye" + s, { scale: 1, duration: 0.3, ease: "back.out(2)" }, te); A("arm" + s, { rotation: 0, duration: 0.4, ease: "back.out(2)" }, te); });
      ax.mouth(te, "smile", 0.2); ax.brows(te, "neutral", 0.25);
      markBusy(t, te + 0.2);
      return Math.max(tl2, te + 0.35);
    };

    // pensar: mano a la barbilla, mirada arriba, burbujitas
    ax.think = (t, p = {}) => {
      const d = p.d || 1.6;
      A("armR", { rotation: 152, duration: 0.42, ease: "back.out(1.6)" }, t);
      A("head", { rotation: -7, duration: 0.5, ease: "back.out(1.8)" }, t + 0.05);
      A("tilt", { rotation: -3, duration: 0.5, ease: "power2.out" }, t);
      ax.look(t + 0.12, -4, -6, 0.3); ax.expr(t + 0.1, "think", 0.2);
      F("armRw", { rotation: 0 }, { rotation: 7, duration: 0.14, ease: "sine.inOut", yoyo: true, repeat: 3 }, t + 0.6);
      ["th1", "th2", "th3"].forEach((id, i) => {
        S(id, { opacity: 1 }, t + 0.35 + i * 0.18);
        F(id, { scale: 0.2 }, { scale: 1, duration: 0.3, ease: "back.out(3)" }, t + 0.35 + i * 0.18);
        A(id, { scale: 0.86, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: 1 }, t + 0.7 + i * 0.18);
      });
      TT({ curl: 0.25, duration: 0.6, ease: "sine.inOut" }, t);
      const te = t + d;
      ["th1", "th2", "th3"].forEach((id, i) => A(id, { opacity: 0, scale: 0.5, duration: 0.18, ease: "power2.in" }, te - 0.25 + i * 0.05));
      // ¡idea!: cejas arriba y vuelta
      A("armR", { rotation: 0, duration: 0.4, ease: "back.out(1.7)" }, te);
      A("head", { rotation: 0, duration: 0.45, ease: "back.out(2)" }, te);
      A("tilt", { rotation: 0, duration: 0.4, ease: "power2.inOut" }, te);
      ax.look(te, 0, 0, 0.2); ax.expr(te, "neutral", 0.2);
      TT({ curl: 0, duration: 0.6, ease: "sine.inOut" }, te);
      markBusy(t, te);
      return te + 0.4;
    };

    // risa / celebración con saltos
    ax.celebrate = (t, p = {}) => {
      const n = p.jumps || 2, h = p.height || 80;
      ax.expr(t, "laugh", 0.12); ax.blush(t, 1.4);
      both((s) => { A("arm" + s, { rotation: 20, duration: 0.1, ease: "power2.in" }, t); A("arm" + s, { rotation: -132, duration: 0.3, ease: "back.out(2.5)" }, t + 0.1); stretch(s, 1.35, t + 0.1); });
      TT({ lift: 1, duration: 0.4, ease: "back.out(2)" }, t);
      let tt = t + 0.05;
      for (let i = 0; i < n; i++) {
        A("squash", { scaleY: 0.84, scaleX: 1.12, duration: 0.09, ease: "power2.in" }, tt);
        const u = tt + 0.09, sp = i % 2 ? -1 : 1;
        A("hop", { y: -h, duration: 0.24, ease: "power3.out" }, u);
        A("hop", { y: 0, duration: 0.2, ease: "power2.in" }, u + 0.26);
        A("squash", { scaleY: 1.13, scaleX: 0.9, duration: 0.12, ease: "power2.out" }, u);
        A("squash", { scaleY: 1, scaleX: 1, duration: 0.18, ease: "sine.inOut" }, u + 0.12);
        A("tilt", { rotation: 7 * sp, duration: 0.23, ease: "sine.out" }, u);
        A("tilt", { rotation: 0, duration: 0.23, ease: "sine.in" }, u + 0.23);
        A("shadow", { scaleX: 0.6, opacity: 0.4, duration: 0.24, ease: "power3.out" }, u);
        A("shadow", { scaleX: 1, opacity: 1, duration: 0.2, ease: "power2.in" }, u + 0.26);
        both((s, si) => { A("arm" + s + "w", { rotation: -18, duration: 0.12, ease: "sine.inOut" }, u + si * 0.04); A("arm" + s + "w", { rotation: 6, duration: 0.14, ease: "sine.inOut" }, u + 0.2 + si * 0.04); });
        gills(u, 20, 0.14, "power3.out", 0.02);
        gills(u + 0.3, -8, 0.16, "power2.in", 0.02);
        A("squash", { scaleY: 0.86, scaleX: 1.12, duration: 0.06, ease: "power2.out" }, u + 0.46);
        tt = u + 0.52;
      }
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.5, ease: "elastic.out(1.2,0.4)" }, tt);
      gillFlick(tt - 0.06, 14, 0.8);
      const te = tt + (p.hold == null ? 0.3 : p.hold);
      both((s) => { A("arm" + s, { rotation: 0, duration: 0.45, ease: "back.out(1.6)" }, te); A("arm" + s + "w", { rotation: 0, duration: 0.3 }, te); stretch(s, 1, te, 0.3); });
      TT({ lift: 0, duration: 0.6, ease: "sine.inOut" }, te);
      ax.expr(te, "neutral", 0.2); ax.blush(te, 1);
      markBusy(t, te);
      return te + 0.45;
    };

    // claqueta: entra en las manos
    ax.clapIn = (t) => {
      S("clap", { opacity: 1 }, t);
      F("clap", { scale: 0.3, rotation: -14 }, { scale: 1, rotation: 0, duration: 0.42, ease: "back.out(2.2)" }, t);
      F("clapY", { y: 24 }, { y: 0, duration: 0.42, ease: "back.out(2.2)" }, t);
      both((s) => A("arm" + s, { rotation: 24, duration: 0.3, ease: "back.out(2)" }, t + 0.06));
      ax.mouth(t + 0.05, "grin", 0.15);
      return t + 0.45;
    };
    // abre (anticipación) y golpea
    ax.clapSnap = (t, p = {}) => {
      const open = p.open || 0.45, ang = p.angle || -27, hold = p.hold == null ? 0.25 : p.hold;
      A("clapStick", { rotation: ang, duration: open, ease: "back.out(1.8)" }, t);
      A("tilt", { rotation: -4, duration: open, ease: "power2.out" }, t);
      A("head", { rotation: -5, duration: open, ease: "power2.out" }, t);
      ax.brows(t, "angry", 0.2); ax.mouth(t, "hmm", 0.15);
      const hit = t + open + hold;
      A("clapStick", { rotation: 0, duration: 0.07, ease: "power4.in" }, hit - 0.07);
      A("tilt", { rotation: 2, duration: 0.07, ease: "power4.in" }, hit - 0.07);
      A("head", { rotation: 3, duration: 0.07, ease: "power4.in" }, hit - 0.07);
      A("clapY", { y: 5, duration: 0.05, ease: "power2.out" }, hit);
      A("clapY", { y: 0, duration: 0.3, ease: "elastic.out(1,0.4)" }, hit + 0.05);
      A("squash", { scaleY: 0.9, scaleX: 1.08, duration: 0.05, ease: "power2.out" }, hit);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.5, ease: "elastic.out(1.2,0.35)" }, hit + 0.05);
      S("fxImpact", { opacity: 1 }, hit);
      F("fxImpact", { scale: 0.5 }, { scale: 1.25, duration: 0.25, ease: "power3.out" }, hit);
      A("fxImpact", { opacity: 0, duration: 0.15, ease: "power1.in" }, hit + 0.16);
      ax.eyes(hit, "sqz"); ax.mouth(hit, "grin", 0.08);
      ax.eyes(hit + 0.3, "open"); ax.brows(hit + 0.3, "neutral");
      A("tilt", { rotation: 0, duration: 0.5, ease: "elastic.out(1,0.4)" }, hit + 0.07);
      A("head", { rotation: 0, duration: 0.6, ease: "elastic.out(1,0.35)" }, hit + 0.07);
      gillFlick(hit, 16, 0.8);
      markBusy(t, hit + 0.4);
      ax.hit = hit;
      return hit + 0.45;
    };
    ax.clapOut = (t) => {
      A("clap", { scale: 0.2, rotation: 18, opacity: 0, duration: 0.3, ease: "back.in(2)" }, t);
      both((s) => A("arm" + s, { rotation: 0, duration: 0.35, ease: "back.out(2)" }, t + 0.1));
      return t + 0.4;
    };

    // mirar a cámara y guiñar
    ax.wink = (t, p = {}) => {
      ax.look(t, 0, 0, 0.15);
      A("head", { rotation: 8, duration: 0.3, ease: "back.out(2.5)" }, t);
      A("tilt", { rotation: 3, duration: 0.3, ease: "power2.out" }, t);
      A("squash", { scaleY: 0.95, scaleX: 1.04, duration: 0.12, ease: "power2.out" }, t);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.4, ease: "elastic.out(1,0.45)" }, t + 0.12);
      ax.expr(t + 0.12, "sly", 0.12); ax.blush(t + 0.12, 1.45);
      S("fxSpark", { opacity: 1 }, t + 0.18);
      F("fxSpark", { scale: 0, rotation: -45 }, { scale: 1.1, rotation: 0, duration: 0.25, ease: "back.out(3)" }, t + 0.18);
      A("fxSpark", { scale: 0, rotation: 45, duration: 0.25, ease: "power2.in" }, t + 0.62);
      A("armL", { rotation: -40, duration: 0.25, ease: "back.out(2)" }, t + 0.06); S("fingerL", { opacity: 1, scale: 1 }, t + 0.1);
      const te = t + 0.5 + (p.hold == null ? 0.45 : p.hold);
      ax.eyes(te, "open"); ax.mouth(te, "smile", 0.2); ax.brows(te, "neutral"); ax.blush(te, 1);
      A("armL", { rotation: 0, duration: 0.35, ease: "back.out(2)" }, te); S("fingerL", { opacity: 0 }, te + 0.1);
      A("head", { rotation: 0, duration: 0.4, ease: "back.out(1.8)" }, te);
      A("tilt", { rotation: 0, duration: 0.4, ease: "power2.inOut" }, te);
      markBusy(t, te);
      return te + 0.35;
    };

    // tropiezo y culetazo cómico
    ax.trip = (t, p = {}) => {
      // 1. trastabilla hacia delante
      A("tilt", { rotation: 10, duration: 0.14, ease: "power2.out" }, t);
      ax.expr(t, "surprise", 0.08);
      both((s, si) => A("arm" + s, { rotation: -120 + si * 30, duration: 0.14, ease: "back.out(3)" }, t));
      F("armLw", { rotation: 0 }, { rotation: -30, duration: 0.07, ease: "sine.inOut", yoyo: true, repeat: 5 }, t + 0.1);
      F("armRw", { rotation: 0 }, { rotation: 30, duration: 0.07, ease: "sine.inOut", yoyo: true, repeat: 5 }, t + 0.13);
      // 2. vuela hacia atrás
      const t1 = t + 0.2;
      A("tilt", { rotation: -24, duration: 0.2, ease: "power2.out" }, t1);
      A("hop", { y: -36, duration: 0.2, ease: "power2.out" }, t1);
      gills(t1, 20, 0.12, "power2.out", 0.02);
      // 3. culetazo
      const hit = t1 + 0.38;
      A("hop", { y: 8, duration: 0.18, ease: "power3.in" }, hit - 0.18);
      A("tilt", { rotation: -12, duration: 0.18, ease: "power2.in" }, hit - 0.18);
      A("squash", { scaleY: 0.76, scaleX: 1.2, duration: 0.06, ease: "power2.out" }, hit);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.7, ease: "elastic.out(1.2,0.3)" }, hit + 0.06);
      A("headY", { y: 10, duration: 0.06, ease: "power2.out" }, hit);
      A("headY", { y: 0, duration: 0.6, ease: "elastic.out(1,0.3)" }, hit + 0.08);
      gillFlick(hit, -20, 1.0);
      both((s) => A("arm" + s, { rotation: -30, duration: 0.2, ease: "back.out(2)" }, hit));
      ax.expr(hit, "ouch", 0.06);
      S("fxImpact2", { opacity: 1 }, hit);
      F("fxImpact2", { scale: 0.6 }, { scale: 1.3, duration: 0.25, ease: "power3.out" }, hit);
      A("fxImpact2", { opacity: 0, duration: 0.15 }, hit + 0.15);
      // 4. estrellitas mareo
      S("fxStars", { opacity: 1, scale: 1 }, hit + 0.1);
      F("fxStars", { rotation: 0 }, { rotation: 540, duration: 1.3, ease: "none" }, hit + 0.1);
      A("fxStars", { opacity: 0, duration: 0.25 }, hit + 1.2);
      F("head", { rotation: 0 }, { rotation: 7, duration: 0.16, ease: "sine.inOut", yoyo: true, repeat: 3 }, hit + 0.45);
      // 5. sonrisa avergonzada + gota de sudor, se recompone
      const t3 = hit + 1.15;
      ax.eyes(t3, "happy"); ax.mouth(t3, "grin", 0.15); ax.brows(t3, "worried"); ax.blush(t3, 1.5);
      S("fxSweat", { opacity: 1, scale: 1 }, t3);
      F("fxSweat", { scale: 0.4 }, { scale: 1, duration: 0.3, ease: "back.out(2)" }, t3);
      F("fxSweatY", { y: -6 }, { y: 16, duration: 0.6, ease: "power1.in" }, t3);
      A("fxSweat", { opacity: 0, duration: 0.2 }, t3 + 0.5);
      A("hop", { y: 0, duration: 0.2, ease: "power2.out" }, t3 + 0.5);
      A("tilt", { rotation: 0, duration: 0.5, ease: "back.out(2)" }, t3 + 0.5);
      both((s) => A("arm" + s, { rotation: 0, duration: 0.4, ease: "back.out(2)" }, t3 + 0.5));
      A("squash", { scaleY: 0.9, scaleX: 1.08, duration: 0.1, ease: "power2.in" }, t3 + 0.45);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.45, ease: "elastic.out(1,0.4)" }, t3 + 0.55);
      const te = t3 + 0.9;
      ax.expr(te, "neutral", 0.2); ax.blush(te, 1);
      markBusy(t, te);
      return te + 0.3;
    };

    // asomarse desde un borde (el borde es la posición del contenedor)
    // edge: "bottom" (el suelo del contenedor es la línea) | "left" | "right"
    ax.peek = (t, p = {}) => {
      const edge = p.edge || "bottom", d = p.d || 1.8;
      S("shadow", { opacity: 0 }, t);
      if (edge === "bottom") {
        tl.set(q("clipRect"), { attr: { x: -3000, y: -3000, width: 6000, height: 3000 + (p.line || -40) } }, t);
        S("hop", { y: 360 }, t);
        A("hop", { y: 190, duration: 0.55, ease: "power2.out" }, t + 0.05); // asoma ojos
        A("hop", { y: 120, duration: 0.3, ease: "back.out(2.4)" }, t + 0.05 + 0.55 + 0.6);
      } else {
        const sg = edge === "right" ? 1 : -1; // right: se asoma desde la derecha hacia la izquierda
        tl.set(q("clipRect"), { attr: { x: sg > 0 ? -3000 : 0, y: -3000, width: 3000, height: 6000 } }, t);
        S("hop", { x: 300 * sg, y: 0 }, t);
        S("tilt", { rotation: 0 }, t);
        A("hop", { x: 100 * sg, duration: 0.55, ease: "power2.out" }, t + 0.05);
        A("tilt", { rotation: -20 * sg, duration: 0.55, ease: "power2.out" }, t + 0.05);
        A("hop", { x: 62 * sg, duration: 0.3, ease: "back.out(2.4)" }, t + 1.2);
        A("tilt", { rotation: -26 * sg, duration: 0.3, ease: "back.out(2.4)" }, t + 1.2);
      }
      ax.brows(t, "up"); ax.mouth(t, "o", 0.01);
      ax.look(t + 0.5, -5, 0, 0.18); ax.look(t + 0.85, 5, 0, 0.18); ax.look(t + 1.15, 0, -1, 0.15);
      ax.mouth(t + 1.2, "grin", 0.15); ax.blush(t + 1.2, 1.3);
      gillFlick(t + 1.2, 14, 0.7);
      const te = t + d;
      if (edge === "bottom") A("hop", { y: 360, duration: 0.28, ease: "back.in(1.8)" }, te);
      else { A("hop", { x: 320 * (edge === "right" ? 1 : -1), duration: 0.28, ease: "back.in(1.8)" }, te); A("tilt", { rotation: 0, duration: 0.28, ease: "power2.in" }, te); }
      ax.expr(te, "neutral", 0.1); ax.blush(te + 0.2, 1);
      markBusy(t, te);
      return te + 0.3;
    };
    // restaura tras peek (vuelve a mostrar entero y sin recorte)
    ax.unpeek = (t) => {
      tl.set(q("clipRect"), { attr: { x: -3000, y: -3000, width: 6000, height: 6000 } }, t);
      S("hop", { x: 0, y: 0 }, t); S("tilt", { rotation: 0 }, t); S("shadow", { opacity: 1 }, t);
      return t;
    };

    // encoger / crecer con anticipación y overshoot (escala del contenedor)
    ax.scaleTo = (t, p) => {
      const s0 = p.from, s1 = p.to, grow = s1 > s0;
      W({ scale: s0 * (grow ? 0.88 : 1.08), duration: 0.14, ease: "power2.in" }, t);
      W({ scale: s1 * (grow ? 1.1 : 0.92), duration: 0.24, ease: "power3.out" }, t + 0.14);
      W({ scale: s1, duration: 0.5, ease: "elastic.out(1,0.45)" }, t + 0.38);
      if (grow) { ax.expr(t + 0.1, "happy", 0.12); ax.expr(t + 0.8, "neutral", 0.2); }
      else { ax.expr(t + 0.1, "worried", 0.12); ax.expr(t + 0.8, "neutral", 0.2); }
      A("squash", { scaleY: grow ? 0.9 : 1.08, scaleX: grow ? 1.08 : 0.94, duration: 0.14, ease: "power2.in" }, t);
      A("squash", { scaleY: 1, scaleX: 1, duration: 0.6, ease: "elastic.out(1,0.4)" }, t + 0.14);
      gillFlick(t + 0.14, grow ? 16 : -12, 0.8);
      markBusy(t, t + 0.9);
      return t + 0.9;
    };

    // hablar (sin envolvente de audio): aleteo determinista de boca
    ax.talk = (t, d, p = {}) => {
      const seq = p.seq || ["talkA", "talkB", "o", "talkA", "smile", "talkB", "talkA", "o", "talkB"];
      let tt = t, i = 0;
      while (tt < t + d - 0.08) { ax.mouth(tt, seq[i % seq.length], 0.05, "none"); tt += 0.085 + rnd() * 0.05; i++; }
      ax.mouth(t + d, p.end || "smile", 0.1);
      F("headY", { y: 0 }, { y: 2.5, duration: 0.18, ease: "sine.inOut", yoyo: true, repeat: Math.max(1, Math.floor(d / 0.18) - 1) | 1 }, t);
      return t + d;
    };
    // sincronía con envolvente de voz: lv = niveles 0..3 por frame
    ax.lipsync = (lv, fps, t0 = 0) => {
      const M = ["smile", "talkB", "talkA", "o"];
      let prev = -1;
      lv.forEach((l, i) => { if (l === prev) return; prev = l; ax.mouth(t0 + i / fps, M[l] || "smile", 0.04, "none"); });
    };

    return ax;
  }

  root.AxRig = AxRig;
  root.AxTailPaths = tailPaths;
  root.AxMouthD = mouthD;
})(typeof window !== "undefined" ? window : globalThis);
```

### 7.3 `rig/build/gen.js` (generador de la geometría; opcional)

```js
// Genera rig/ajolote.html (fragmento estático) a partir de geometría paramétrica.
// node gen.js
const fs = require("fs");
const path = require("path");
const RIG = path.join(__dirname, "..");
const W = {};
new Function("window", fs.readFileSync(path.join(RIG, "poses.js"), "utf8"))(W);
const C = {
  pink: "#f7c1cc", light: "#fde3e8", shade: "#eea3b5", line: "#d0708a", tail: "#f5b8c6", stripe: "#e98ca3",
  gill: "#ff6a45", gillCore: "#ff8a5e", gillLine: "#d9452f", vein: "#b8331f",
  eye: "#2a1520", mouth: "#7a1f37", tongue: "#ff7f99", cheek: "#ff8aa3", brow: "#c05f7b",
};
const r1 = (v) => Math.round(v * 10) / 10;

// branquia plumosa a lo largo de +x (0..L), con `lobes` foliolos por lado
function plume(L, Wd, lobes) {
  const h = (u) => Wd * (0.62 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.15))) * Math.pow(1 - u, 0.55);
  const span = 0.94, step = span / lobes;
  const edge = (sg) => {
    const pts = [];
    for (let j = 0; j < lobes; j++) {
      const uv = j * step, ut = uv + step * 0.82, un = (j + 1) * step;
      const v = [L * uv, sg * h(uv) * 0.62], tp = [L * ut + 4, sg * (h(ut) + Wd * 0.18)], nv = [L * un, sg * h(un) * 0.62];
      pts.push({ v, tp, nv });
    }
    return pts;
  };
  let d = `M0 ${r1(-h(0) * 0.62)}`;
  edge(-1).forEach(({ v, tp, nv }) => {
    d += ` Q${r1(v[0] + (tp[0] - v[0]) * 0.25)} ${r1(tp[1] * 0.98)} ${r1(tp[0])} ${r1(tp[1])}`;
    d += ` Q${r1(tp[0] - 2)} ${r1((tp[1] + nv[1]) / 2 + (nv[1] - tp[1]) * 0.25)} ${r1(nv[0])} ${r1(nv[1])}`;
  });
  d += ` L${L} 0`;
  const low = edge(1).reverse();
  d += ` L${r1(low[0].nv[0])} ${r1(low[0].nv[1])}`;
  low.forEach(({ v, tp, nv }) => {
    d += ` Q${r1(tp[0] - 2)} ${r1((tp[1] + nv[1]) / 2 + (nv[1] - tp[1]) * 0.25)} ${r1(tp[0])} ${r1(tp[1])}`;
    d += ` Q${r1(v[0] + (tp[0] - v[0]) * 0.25)} ${r1(tp[1] * 0.98)} ${r1(v[0])} ${r1(v[1])}`;
  });
  d += " Z";
  // venas: eje + ramitas hacia cada foliolo
  let vein = `M6 0 Q${r1(L * 0.5)} -1.5 ${r1(L * 0.9)} 0`;
  for (let j = 1; j < lobes; j++) {
    const u = j * step + step * 0.15, x = L * u;
    vein += ` M${r1(x)} 0 L${r1(x + L * step * 0.55)} ${r1(-h(u) * 0.55)} M${r1(x)} 0 L${r1(x + L * step * 0.55)} ${r1(h(u) * 0.55)}`;
  }
  // núcleo más cálido (misma silueta, más estrecha)
  const core = `M4 ${r1(-h(0) * 0.3)} Q${r1(L * 0.45)} ${r1(-Wd * 0.62)} ${r1(L * 0.86)} 0 Q${r1(L * 0.45)} ${r1(Wd * 0.62)} 4 ${r1(h(0) * 0.3)} Z`;
  return { d, vein, core };
}
const GILLS = [
  { id: 1, x: -104, y: -262, a: -146, L: 80, W: 15, n: 4 },
  { id: 2, x: -121, y: -224, a: -177, L: 88, W: 16, n: 4 },
  { id: 3, x: -113, y: -186, a: 152, L: 76, W: 14, n: 4 },
];
function gillSide(S) {
  return GILLS.map((g) => {
    const p = plume(g.L, g.W, g.n);
    return `<g transform="translate(${g.x} ${g.y}) rotate(${g.a})"><g id="ax-g${S}${g.id}"><g id="ax-g${S}${g.id}w">` +
      `<path d="${p.d}" fill="${C.gill}" stroke="${C.gillLine}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="${p.core}" fill="${C.gillCore}" opacity="0.75"/>` +
      `<path d="${p.vein}" fill="none" stroke="${C.vein}" stroke-width="1.7" stroke-linecap="round" opacity="0.55"/>` +
      `</g></g></g>`;
  }).join("");
}
function star(r, ri, n = 5) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI / n) * i - Math.PI / 2, rr = i % 2 ? ri : r;
    d += (i ? " L" : "M") + r1(Math.cos(a) * rr) + " " + r1(Math.sin(a) * rr);
  }
  return d + " Z";
}
// brazo: tubo con contorno + manita de 3 deditos + dedo índice para señalar
function arm(S) {
  const ARM = "M-11 -4 C-12 10 -11 22 -10 31 C-15 37 -15 45 -10 48 C-8 50 -4 50 -3 47 C-2 52 3 54 5 50 C7 53 12 51 12 47 C16 46 18 40 14 34 C12 24 12 10 11 -4 C11 -10 -11 -10 -11 -4 Z";
  return `<g id="ax-arm${S}"><g id="ax-arm${S}w"><g id="ax-arm${S}s">` +
    `<g id="ax-finger${S}" opacity="0"><path d="M2 44 L3 68" stroke="${C.line}" stroke-width="13" stroke-linecap="round"/><path d="M2 44 L3 68" stroke="${C.pink}" stroke-width="7.5" stroke-linecap="round"/></g>` +
    `<path d="${ARM}" fill="${C.pink}" stroke="${C.line}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M-3 47 C-3 44 -2 42 -1 41 M5 50 C5 46 5 44 5 42" fill="none" stroke="${C.line}" stroke-width="2.2" stroke-linecap="round" opacity="0.75"/>` +
    `</g></g></g>`;
}
function eye(S) {
  const tx = S === "L" ? -48 : 48;
  const sqz = S === "L" ? "M-8 -8 L6 0 L-8 8" : "M8 -8 L-6 0 L8 8";
  return `<g transform="translate(${tx} -208)"><g id="ax-eye${S}">` +
    `<g id="ax-open${S}"><g id="ax-blink${S}"><g id="ax-look${S}">` +
    `<ellipse rx="11" ry="13" fill="${C.eye}"/>` +
    `<g id="ax-hl${S}"><circle cx="3.8" cy="-5" r="4.2" fill="#fff"/><circle cx="-3.6" cy="4.6" r="1.9" fill="#fff" opacity="0.85"/></g>` +
    `</g></g></g>` +
    `<path id="ax-happy${S}" opacity="0" d="M-11 4 Q0 -11 11 4" fill="none" stroke="${C.eye}" stroke-width="5" stroke-linecap="round"/>` +
    `<path id="ax-sqz${S}" opacity="0" d="${sqz}" fill="none" stroke="${C.eye}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path id="ax-wink${S}" opacity="0" d="M-11 -1 Q0 7 11 -1" fill="none" stroke="${C.eye}" stroke-width="5" stroke-linecap="round"/>` +
    `</g></g>`;
}
function brow(S) {
  const tr = S === "L" ? "translate(-48 -238)" : "translate(48 -238) scale(-1 1)";
  return `<g transform="${tr}"><g id="ax-brow${S}"><path id="ax-brow${S}r" d="M-9 2 Q-1 -3 9 0" fill="none" stroke="${C.brow}" stroke-width="4.2" stroke-linecap="round" opacity="0.8"/></g></g>`;
}
const tail0 = W.AxTailPaths({ ph1: 0, amp1: 1, ph2: 0, amp2: 0, lift: 0, curl: 0 });
const HEAD = "M0 -314 C82 -314 134 -276 134 -214 C134 -152 78 -124 0 -124 C-78 -124 -134 -152 -134 -214 C-134 -276 -82 -314 0 -314 Z";
const BODY = "M0 -152 C50 -152 76 -108 74 -62 C72 -20 46 -2 0 -2 C-46 -2 -72 -20 -74 -62 C-76 -108 -50 -152 0 -152 Z";
const stripes = (x0, y0, w, h, n, sk) => {
  let d = ""; const sw = w / n;
  for (let i = 0; i < n; i += 2) d += `M${r1(x0 + i * sw + sk)} ${y0} L${r1(x0 + (i + 1) * sw + sk)} ${y0} L${r1(x0 + (i + 1) * sw)} ${y0 + h} L${r1(x0 + i * sw)} ${y0 + h} Z `;
  return d.trim();
};

const svg = `<svg id="ax-svg" viewBox="-220 -380 440 420" xmlns="http://www.w3.org/2000/svg" aria-label="Ajolote">
  <defs>
    <filter id="ax-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <filter id="ax-blur" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>
    <clipPath id="ax-clip" clipPathUnits="userSpaceOnUse"><rect id="ax-clipRect" x="-3000" y="-3000" width="6000" height="6000"/></clipPath>
    <clipPath id="ax-headClip"><path d="${HEAD}"/></clipPath>
    <clipPath id="ax-bodyClip"><path d="${BODY}"/></clipPath>
    <clipPath id="ax-mouthClip"><use href="#ax-mouth"/></clipPath>
  </defs>
  <g id="ax-shadow"><ellipse cx="0" cy="4" rx="96" ry="12" fill="#000" opacity="0.38" filter="url(#ax-blur)"/></g>
  <g id="ax-all" clip-path="url(#ax-clip)">
  <g id="ax-hop"><g id="ax-tilt">
    <g id="ax-flip"><g id="ax-squash"><g id="ax-breath">
      <path id="ax-tail" d="${tail0.body}" fill="${C.tail}" stroke="${C.line}" stroke-width="4" stroke-linejoin="round"/>
      <path id="ax-tailStripe" d="${tail0.stripe}" fill="none" stroke="${C.stripe}" stroke-width="5" stroke-linecap="round"/>
      <path d="${BODY}" fill="${C.pink}" stroke="${C.line}" stroke-width="4.5"/>
      <g clip-path="url(#ax-bodyClip)">
        <ellipse cx="0" cy="-50" rx="47" ry="41" fill="${C.light}"/>
        <ellipse cx="0" cy="-134" rx="78" ry="26" fill="${C.shade}" opacity="0.6"/>
        <path d="M-30 -60 Q0 -54 30 -60 M-26 -38 Q0 -32 26 -38" fill="none" stroke="${C.shade}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g><ellipse cx="-36" cy="-6" rx="22" ry="11.5" fill="${C.pink}" stroke="${C.line}" stroke-width="4"/><path d="M-44 -9 L-44 -2 M-34 -9 L-34 -1" stroke="${C.line}" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/></g>
      <g><ellipse cx="36" cy="-6" rx="22" ry="11.5" fill="${C.pink}" stroke="${C.line}" stroke-width="4"/><path d="M44 -9 L44 -2 M34 -9 L34 -1" stroke="${C.line}" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/></g>
      <g id="ax-headY"><g id="ax-head"><g id="ax-headBob"><g id="ax-headBobR">
        <g>${gillSide("L")}</g>
        <g transform="scale(-1 1)">${gillSide("R")}</g>
        <path d="${HEAD}" fill="${C.pink}" stroke="${C.line}" stroke-width="4.5"/>
        <g clip-path="url(#ax-headClip)">
          <ellipse cx="0" cy="-116" rx="150" ry="36" fill="${C.shade}" opacity="0.55"/>
          <path d="M-78 -270 C-66 -292 -30 -302 0 -298 C-26 -292 -56 -282 -70 -262 C-74 -258 -80 -262 -78 -270 Z" fill="${C.light}" opacity="0.9"/>
          <circle cx="22" cy="-294" r="5" fill="${C.light}" opacity="0.85"/>
        </g>
        <g id="ax-face">
          <g transform="translate(-84 -176)"><ellipse id="ax-cheekL" rx="17" ry="10" fill="${C.cheek}" opacity="0.55" filter="url(#ax-soft)"/></g>
          <g transform="translate(84 -176)"><ellipse id="ax-cheekR" rx="17" ry="10" fill="${C.cheek}" opacity="0.55" filter="url(#ax-soft)"/></g>
          ${eye("L")}${eye("R")}
          ${brow("L")}${brow("R")}
          <path id="ax-mouth" d="${W.AxMouthD("smile")}" fill="${C.mouth}" stroke="${C.mouth}" stroke-width="2" stroke-linejoin="round"/>
          <ellipse cx="0" cy="-138" rx="13" ry="9" fill="${C.tongue}" clip-path="url(#ax-mouthClip)"/>
        </g>
      </g></g></g></g>
      <g transform="translate(0 -72) scale(1.15)"><g id="ax-clapY"><g id="ax-clap" opacity="0">
        <rect x="-60" y="-26" width="120" height="68" rx="7" fill="#1b1b20" stroke="#0b0b0d" stroke-width="3"/>
        <rect x="-60" y="-26" width="120" height="14" rx="3" fill="#ece8dc"/>
        <path d="${stripes(-60, -26, 120, 14, 10, 6)}" fill="#1b1b20"/>
        <line x1="-52" y1="12" x2="52" y2="12" stroke="#4a4a54" stroke-width="1.5"/>
        <line x1="0" y1="-6" x2="0" y2="36" stroke="#4a4a54" stroke-width="1.5"/>
        <text x="-26" y="6" text-anchor="middle" font-family="JB Mono, monospace" font-size="9" fill="#9a978f">ESCENA</text>
        <text x="26" y="6" text-anchor="middle" font-family="JB Mono, monospace" font-size="9" fill="#9a978f">TOMA</text>
        <text x="-26" y="31" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="17" fill="#f0c94a">1</text>
        <text x="26" y="31" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="17" fill="#ece8dc">1</text>
        <g transform="translate(-60 -28)"><g id="ax-clapStick">
          <rect x="0" y="-14" width="120" height="14" rx="3" fill="#ece8dc" stroke="#0b0b0d" stroke-width="2"/>
          <path d="${stripes(0, -14, 120, 14, 10, -6)}" fill="#1b1b20"/>
          <circle cx="5" cy="-1" r="3" fill="#4a4a54"/>
        </g></g>
      </g></g></g>
      <g transform="translate(-66 -106) scale(-1 1) rotate(-9)">${arm("L")}</g>
      <g transform="translate(66 -106) rotate(-9)">${arm("R")}</g>
    </g></g></g>
    <g id="ax-fx">
      <g transform="translate(128 -340) scale(1.5)"><g id="ax-fxBangY"><g id="ax-fxBang" opacity="0"><path d="M-7 -34 L7 -34 L4 2 L-4 2 Z" fill="#f0c94a" stroke="#0b0b0d" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="13" r="6" fill="#f0c94a" stroke="#0b0b0d" stroke-width="3"/></g></g></g>
      <g transform="translate(98 -256)"><g id="ax-fxSpark" opacity="0"><path d="M0 -16 Q2 -2 16 0 Q2 2 0 16 Q-2 2 -16 0 Q-2 -2 0 -16 Z" fill="#fff4c4"/></g></g>
      <g transform="translate(118 -306)"><circle id="ax-th1" r="6" fill="#ece8dc" opacity="0"/></g>
      <g transform="translate(142 -334)"><circle id="ax-th2" r="9" fill="#ece8dc" opacity="0"/></g>
      <g transform="translate(174 -366)"><circle id="ax-th3" r="13" fill="#ece8dc" opacity="0"/></g>
      <g transform="translate(0 -60)"><g id="ax-fxImpact" opacity="0" stroke="#f0c94a" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M-84 -40 L-102 -54"/><path d="M-90 -6 L-112 -6"/><path d="M-84 26 L-102 40"/>
        <path d="M84 -40 L102 -54"/><path d="M90 -6 L112 -6"/><path d="M84 26 L102 40"/>
      </g></g>
      <g transform="translate(0 -324) scale(1 0.36)"><g id="ax-fxStars" opacity="0">
        <path transform="translate(80 0)" d="${star(13, 5.5)}" fill="#f0c94a"/>
        <path transform="translate(-40 69)" d="${star(11, 4.5)}" fill="#ece8dc"/>
        <path transform="translate(-40 -69)" d="${star(12, 5)}" fill="#f0c94a"/>
      </g></g>
      <g transform="translate(118 -262)"><g id="ax-fxSweatY"><path id="ax-fxSweat" opacity="0" d="M0 -12 C6 -2 9 3 9 7 C9 12 5 15 0 15 C-5 15 -9 12 -9 7 C-9 3 -6 -2 0 -12 Z" fill="#9cc2ff" stroke="#5b86c9" stroke-width="2"/></g></g>
      <g transform="translate(0 -10) scale(1.1 0.7)"><g id="ax-fxImpact2" opacity="0" stroke="#f0c94a" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M-84 -40 L-102 -54"/><path d="M-90 -6 L-112 -6"/><path d="M-84 26 L-102 40"/>
        <path d="M84 -40 L102 -54"/><path d="M90 -6 L112 -6"/><path d="M84 26 L102 40"/>
      </g></g>
    </g>
  </g></g>
  </g>
</svg>`;

const bubs = Array.from({ length: 16 }, () => `<i class="ax-bub"></i>`).join("");
const frag = `<!-- ===== AJOLOTE v2 · rig SVG (ids con prefijo ax-) =====
     Pegar dentro del root de la composición. #ax se coloca con GSAP x/y = punto entre los pies.
     Requiere poses.js (window.AxRig). Generado por build/gen.js -->
<style>
  #ax { position: absolute; left: -220px; top: -380px; width: 440px; height: 420px; z-index: 30; pointer-events: none; }
  #ax-svg { display: block; width: 100%; height: 100%; overflow: visible; }
  #ax-trail { position: absolute; left: 0; top: 0; width: 1px; height: 1px; z-index: 29; pointer-events: none; }
  .ax-bub { position: absolute; display: block; left: -10px; top: -10px; width: 20px; height: 20px; border-radius: 50%;
    border: 2.5px solid rgba(236, 232, 220, 0.6); background: rgba(236, 232, 220, 0.07); opacity: 0; }
</style>
<div id="ax-trail">${bubs}</div>
<div id="ax">
${svg}
</div>
`;
fs.writeFileSync(path.join(RIG, "ajolote.html"), frag);
console.log("ok", frag.length);
```

### 7.4 `rig/build/test.template.html` (composición de prueba)

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/gsap.min.js"></script>
    <script src="assets/poses.js"></script>
    <style>
      @font-face { font-family: "Archivo"; src: url("assets/fonts/archivo.woff2") format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
      @font-face { font-family: "JB Mono"; src: url("assets/fonts/jbmono.woff2") format("woff2"); font-weight: 100 800; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0b0b0d; }
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; background: #151519; font-family: "Archivo", sans-serif; color: #ece8dc; }
      #floor { position: absolute; left: 0; right: 0; top: 860px; height: 2px; background: #2e2e35; }
      #edge { position: absolute; left: 1180px; top: 560px; width: 560px; height: 300px; z-index: 31; border-radius: 18px; background: #1d1d22; border: 2px solid #2e2e35; opacity: 0; }
      #edge i { position: absolute; left: 32px; right: 32px; height: 14px; border-radius: 7px; background: #2e2e35; display: block; }
      #lab { position: absolute; left: 96px; top: 84px; width: 900px; height: 140px; }
      #lab b { display: block; font-family: "JB Mono", monospace; font-size: 22px; letter-spacing: .14em; color: #f0c94a; text-transform: uppercase; }
      #lab .t { position: absolute; left: 0; top: 40px; font-size: 72px; font-weight: 800; font-stretch: 112%; letter-spacing: -.02em; opacity: 0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="__DUR__" data-width="1920" data-height="1080">
      <div id="floor"></div>
      <div id="edge"><i style="top:40px"></i><i style="top:72px;right:180px"></i><i style="top:104px;right:260px"></i></div>
      <div id="lab"><b>Ajolote v2 · biblioteca de poses</b>__LABELS__</div>
__RIG__
    </div>
    <script>
      const END = __DUR__;
      const tl = gsap.timeline({ paused: true });
      const ax = AxRig(tl, { seed: 11 });
      ax.init(0, { x: -300, y: 640, s: 0.95 });
      const X = 960, Y = 860, S = 0.95;
      const L = [];
      const label = (i, t0, t1) => {
        tl.fromTo("#lt" + i, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out", immediateRender: false }, t0);
        tl.to("#lt" + i, { opacity: 0, y: -16, duration: 0.2, ease: "power2.in" }, t1 - 0.2);
      };
      let t = 0.04, k = 0, s;
      window.__AX_STEPS = [];
      const step = (fn) => { s = t; t = fn(t); window.__AX_STEPS.push([s, t]); label(k++, s, t); };
      step((t) => ax.swimIn(t, { from: { x: -260, y: 640 }, to: { x: X, y: Y }, s: S, d: 1.5 }));
      step((t) => ax.wave(t, { times: 3 }));
      step((t) => { t = ax.point(t, { dir: "right", hold: 0.35 }); t = ax.point(t, { dir: "up", hold: 0.35 }); return ax.point(t, { dir: "left", hold: 0.35 }); });
      step((t) => ax.surprise(t));
      step((t) => ax.think(t, { d: 1.5 }));
      step((t) => ax.celebrate(t, { jumps: 2 }));
      step((t) => { t = ax.clapIn(t); t = ax.clapSnap(t + 0.1); return ax.clapOut(t + 0.1); });
      step((t) => ax.wink(t));
      step((t) => ax.trip(t));
      step((t) => {
        tl.to("#edge", { opacity: 1, duration: 0.3 }, t);
        ax.place(t, { x: 1460, y: 560, s: 0.8 });
        let tp = ax.peek(t, { edge: "bottom", d: 1.6, line: -2 });
        ax.unpeek(tp + 0.02); ax.place(tp + 0.02, { x: 1180, y: 760, s: 0.8, flip: 1 });
        tp = ax.peek(tp + 0.05, { edge: "right", d: 1.6 });
        tl.to("#edge", { opacity: 0, duration: 0.3 }, tp);
        ax.unpeek(tp + 0.05); ax.place(tp + 0.05, { x: X, y: Y, s: S });
        return tp + 0.1;
      });
      step((t) => { t = ax.scaleTo(t, { from: S, to: 1.35 }); return ax.scaleTo(t + 0.15, { from: 1.35, to: S }); });
      step((t) => ax.talk(t, 1.3));
      ax.base(0, END);
      ax.blinks(0, END);
      window.__AX_END = t;
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
```
