# 05 · Coreografía, cámara, transiciones y ritmo musical (v2)

Rol: dirección de animación y montaje. Este documento cubre **cómo se mueve** el tráiler. El qué dice lo cubre `02-guion.md` y el aspecto, `04-arte.md`. Los tiempos de abajo son los del guion 02, ya **cuantizados a una rejilla de 120 BPM**.

**Pruebas hechas en esta investigación** (las dos pasan `npx hyperframes check` con 0 errores):
- `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/coreo/index.html`. Es una cámara one-take sobre un mundo de 5760×3240 con 3 planos de parallax, cámara en mano determinista y desenfoque de movimiento por velocidad. Incluye dos transiciones: **whip-pan con estela direccional** y **picado a través del ojo del ajolote → negro → iris con aro rojo**. También tiene el salto del ajolote con squash & stretch. Los fotogramas están en `coreo/snaps/` y `coreo/snaps2/`.
- `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/coreo-fold/index.html`. Prueba el **papel que se pliega en acordeón y se convierte en la primera fila de la tabla**, con 3D CSS que sí se renderiza en el render por software. Los fotogramas están en `coreo-fold/snaps3/`.
- `/tmp/claude-0/-home-user/a998811e-5362-50ee-99b9-816e224e6aa5/scratchpad/hf/v2/coreo/audio/sfxlib.py` y `demo_build.py`. Son la librería numpy de música y SFX de tráiler, ya probada: build-up, riser, redoble que acelera, silencio, claqueta y drop. Genera 14 s en 1,8 s. Salida: `coreo/assets/audio/demo.wav` y `demo_cues.json`.

---

## 0 · Qué falla en el movimiento de la v1 (leído del código)

| Defecto | Dónde (v1 `index.html`) | Efecto |
|---|---|---|
| **Una sola transición, repetida 8 veces** | `#wipe`: `x -2700→2700, skewX -12, 0.7 s, power2.inOut` en cada `T.sN - 0.35` | Parece un pase de diapositivas. El cerebro la predice a la tercera vez. |
| **El ajolote se teletransporta** | `place(x,y,s, T.sN - 0.01)` con `tl.set` al empezar cada escena | No hay continuidad física. El personaje no "va" a ningún sitio, aparece. |
| **No hay cámara** | todo el contenido tiene `position:absolute` fijo en un cuadro de 1920 | Sin espacio, sin profundidad y sin sensación de viaje. |
| **Dos curvas para todo** | `power4.out` en todos los textos (`words()`) y `back.out(2–2.5)` en todos los pops | El ritmo es monótono: todo "rebota" igual y nada pesa más que nada. |
| **Las escenas "aparecen"** | `fromTo(opacity 0→1)` en tabla, visor, paleta… | Nada causa nada. Falta la regla "cada entrada tiene un motivo". |
| **Composición repetida** | titular arriba-izq o derecha + objeto a la izq. en 6 de 9 escenas | El ojo no viaja, así que no hay *eye-trace*. |
| **Música desconectada** | 96 BPM de pad + kick, cortes en 6,6/14,6/21,4… (sin rejilla) | Los cortes no caen en el golpe. No hay build-up, ni silencio, ni drop. |
| **SFX genéricos** | el mismo `whoosh()` en mono en cada corte, `pop()` con frecuencia aleatoria | Sin paneo, sin capas, sin cola de sala. |
| **Idle mecánico** | burbujas `sine` y ajolote con `y ±7` en yoyo de 1,15 s todo el tráiler | Respiración de metrónomo, sin variación. |
| **Clímax plano** | ¡ACCIÓN! = escala 2,4→1 + shake de 16 px | Antes no hay silencio, ni anticipación, ni cambio de espacio. |

---

## 1 · Principios de movimiento de la v2

### 1.1 Vocabulario de curvas propio (`vd.*`)

GSAP 3.15 core trae `gsap.registerEase(nombre, fn)` y no necesita CustomEase. Las curvas son cubic-bezier resueltas por Newton + bisección y un resorte amortiguado. Están probadas en `coreo/index.html`.

| Nombre | Curva | Uso | Nunca para |
|---|---|---|---|
| `vd.land` | `cubic-bezier(.16, 1, .30, 1)` | Entradas de UI y objetos: llegan rápido y aterrizan largo. Es el "out" por defecto. | Cámara |
| `vd.settle` | `(.00, .65, .51, .99)` | Contadores, logo, lockups: deceleración profunda sin rebote | Golpes |
| `vd.glide` | `(.70, 0, .20, 1)` | **Cámara** entre estaciones: arranque perezoso y frenada larga | UI pequeña |
| `vd.push` | `(.33, 0, .67, 1)` | Empuje lento dentro de un plano (1,00→1,06) y deriva | — |
| `vd.whip` | `(.86, 0, .12, 1)` | Latigazos: el 70 % del tiempo en los extremos y el centro borroso | Nada que deba leerse durante el movimiento |
| `vd.dive` | `(.55, 0, .95, .55)` | Picado que acelera **hasta el corte** (no aterriza): ojo, claqueta | Lo que se queda en pantalla |
| `vd.exit` | `(.70, 0, .84, 0)` | Salidas que se cortan antes de terminar | Entradas |
| `vd.slam` | keyframes de escala `1.9 → 0.94 → 1.02 → 1` a 0 / 0,10 / 0,16 / 0,26 s | Rótulos-golpe (¡ACCIÓN!, UN DÍA…) | Texto de lectura larga |
| `vd.spring` | `1 − e^(−ζωp)·cos(ω√(1−ζ²)p)` con ζ = 0,42 y ω = 13 | **Solo el ajolote** y los chips que él lanza: 2 oscilaciones visibles | UI, cámara |
| `vd.fold` | cúbica inOut simétrica | Plegados de papel | — |

```js
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (p) => {
    if (p <= 0) return 0; if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 6; i++) { const e = sx(t) - p, d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
    if (t < 0 || t > 1) { let lo = 0, hi = 1; t = p; for (let i = 0; i < 30; i++) { sx(t) < p ? (lo = t) : (hi = t); t = (lo + hi) / 2; } }
    return sy(t);
  };
}
const spring = (z = 0.42, w = 13) => (p) => (p >= 1 ? 1 : 1 - Math.exp(-z * w * p) * Math.cos(w * Math.sqrt(1 - z * z) * p));
const EASE = {
  "vd.land": bez(.16, 1, .3, 1), "vd.settle": bez(0, .65, .51, .99), "vd.glide": bez(.7, 0, .2, 1),
  "vd.push": bez(.33, 0, .67, 1), "vd.whip": bez(.86, 0, .12, 1), "vd.dive": bez(.55, 0, .95, .55),
  "vd.exit": bez(.7, 0, .84, 0), "vd.spring": spring(),
  "vd.fold": (p) => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
};
Object.entries(EASE).forEach(([k, f]) => gsap.registerEase(k, f));
```

**Jerarquía de personalidad.** Solo el foco del plano lleva la curva con carácter (`vd.spring`, `vd.slam`). El resto usa `vd.land` o `vd.settle`, y la cámara siempre es más tranquila que lo que filma. **Prohibido** `back.out` genérico: el rebote es del ajolote.

### 1.2 Escala de duraciones (render a **30 fps**; 1 f = 33 ms)

| Nivel | Frames | s | Para |
|---|---|---|---|
| micro | 4–6 | 0,13–0,20 | Clics, check, parpadeo de celda, flash |
| pequeño | 8–10 | 0,27–0,33 | Chip, celda, palabra |
| medio | 14–16 | 0,47–0,53 | Tarjeta, página, titular |
| grande | 22–26 | 0,73–0,87 | Objeto que cruza media pantalla, plegado |
| cámara | 36–60 | 1,2–2,0 | Viaje entre estaciones (`vd.glide`) |
| whip | 12–14 | 0,40–0,47 | Latigazo con overshoot (+0,45 s de recuperación) |
| slam | 8 | 0,26 | Rótulos-golpe |

Regla de distancia: si recorre más de 600 px de pantalla, súbelo un nivel. **No hay ningún tween de cámara por debajo de 0,8 s salvo el whip.**

### 1.3 Stagger (escalonado)

- **Ola desde un origen con significado**, nunca "fila por fila". El retraso de cada elemento es `d = hypot(fila − f0, col − c0) × 0,06 s` (2 f). El origen es la celda roja, el dedo del ajolote o el punto de corte de la transición (probado en `coreo`, celda (2,3)).
- Tope: **elementos × stagger ≤ 0,5 s**. Si hay más elementos, baja el stagger hasta 1 f o agrupa.
- Palabras de un titular: 3 f (0,10 s). Letras: solo en slams, 1 f (0,033 s).
- Opacidad: llega a 1 en el **40 %** de la duración del movimiento. La posición sigue asentándose ("opacidad pronto, asiento tarde").

### 1.4 Holds (lectura)

- Titular: hold ≥ `max(1,0 s; 0,30 s × palabras)` **ya asentado** antes de que la cámara se lo lleve.
- Dato (10 escenas / 4 personajes / 7 lugares): 0,8 s tras terminar el contador.
- Intertítulos A24 (DEL CAOS…): 1,0–1,5 s quietos, con 1,00→1,03 de escala lineal para que no se congelen. Salen por **corte seco** en el golpe, nunca por fundido.
- Plano final (logo): ≥ 2,5 s estable. Solo respiran las branquias.

### 1.5 Los tres tiempos en todo lo que se mueve

1. **Anticipación**: 15–25 % de la duración, en sentido contrario y al 8–12 % de la distancia. Por ejemplo, la claqueta se abre −4° más antes de cerrar y la tarjeta baja 12 px antes de salir disparada.
2. **Acción**: `vd.land`, `vd.whip` o `vd.dive`.
3. **Asentamiento**: overshoot ≤ 6 % en **una sola** propiedad (la escala o la rotación, no las dos), o `vd.spring` en el ajolote.

### 1.6 Squash & stretch y principios de personaje (ajolote)

Todo con **volumen constante**: `scaleX = 1 / scaleY`. El origen está en los pies (`transformOrigin: "50% 100%"`). Valores probados en `coreo` (`#axA`):

| Fase | Duración | sx / sy | y |
|---|---|---|---|
| Anticipación (agacharse) | 0,16 s `power2.out` | 1,16 / 0,84 | 0 |
| Despegue (estirado) | 0,24 s `power2.out` | 0,88 / 1,14 | −150 |
| Vuelo | 0,14 s `sine.inOut` | 1 / 1 | −150 |
| Caída | 0,20 s `power2.in` | 1 / 1 | 0 |
| Impacto | 0,06 s (2 f) | 1,22 / 0,80 | 0 |
| Recuperación | 0,50 s `vd.spring` | 1 / 1 | 0 |

- **Follow-through**: la cabeza rota −5° en el despegue, +4° en la caída y 0 con `vd.spring`. Las **branquias van 2–3 f por detrás del cuerpo**: su rotación es la del cuerpo retrasada 0,08 s y ×1,6. Las tres branquias de cada lado van desfasadas 0,08 s entre sí. La cola va 0,12 s por detrás.
- **Smear frame** en desplazamientos rápidos (>60 px/f): 1–2 frames con `scaleX 1,25 · scaleY 0,85` a lo largo de la velocidad. Es más barato y más "animación clásica" que un blur.
- **Parpadeo**: cierre 2 f, cerrado 1 f, apertura 3 f. Intervalos sembrados de 2,4–4,2 s. Se parpadea **justo antes** de mirar a otro sitio (es el "corte" del ojo).
- **Mirada que guía**: el ajolote mira hacia donde irá la cámara 0,3 s antes del movimiento (desplaza las pupilas 3 px). El espectador mira donde mira el personaje.
- **Respiración** viva y no de metrónomo: `y = 3·sin(2π·0,42t) + 1,2·sin(2π·1,07t + 1)` como función pura de t, nunca un yoyo de periodo fijo.
- **Labios**: se conserva el sistema de la v1 por niveles de `VO_ENV`, pero se añade 1 frame de "o" en cada sílaba acentuada y se cierra la boca 2 f antes del silencio.

### 1.7 Desenfoque de movimiento (tres niveles; nunca todos a la vez)

1. **Cámara (gratis, ya probado)**: velocidad de pantalla calculada por diferencia central sobre la función pura de cámara. Se aplica `feGaussianBlur stdDeviation="bx by"` al **contenedor fijo `#lens`**, que no se transforma, para que el blur sea de espacio-pantalla y barato: `b = min(28, v·0,35)`, con v en px/frame. Se desactiva cuando el zoom cambia más de un 2 % por frame, porque una estela lineal en un zoom queda mal (sería radial).
2. **Objetos-golpe (componente del registry `motion-blur`)**: solo 2–3 objetivos (¡ACCIÓN!, los palos de la claqueta, el avión de papel), con `samplesPerFrame: 8`. **No compensa ancestros transformados**: si el objeto se mueve porque se mueve la cámara, no deja estela, así que solo sirve para lo que se mueve por sí mismo.
3. **Smear frames** en el personaje (ver 1.6).

### 1.8 Reglas de montaje

- **Nada aparece sin causa.** Todo entra por una de cuatro vías: (a) la cámara llega a ello, (b) lo trae un objeto puente (match), (c) lo provoca el ajolote o (d) cae en un golpe musical. Un fade de opacidad solo, nunca.
- **Eye-trace**: el foco del plano siguiente empieza donde terminó el del anterior (±150 px). En la v1 saltaba de lado a lado.
- **Velocidad creciente por acto**: las estaciones duran 8,5 → 6,3 → 5,0 → 4,5 → 4,0 s. La sensación de "tráiler" es aceleración.
- Una transición primaria (el viaje de cámara, ~60 %) + 3 acentos firmados (ojo, plegado, claqueta). Ninguna se repite más de 2 veces, salvo el viaje.

---

## 2 · Sistema de CÁMARA virtual (one-take)

### 2.1 Arquitectura (probada)

```
#root
 ├─ #lens  (1920×1080, overflow:hidden, NO se transforma; aquí va el filter de blur)
 │   ├─ #far   .plane  d=0.85  tablero liso + texturas sin registro (pueden derivar)
 │   ├─ #world .plane  d=1.00  TODO lo que tiene que encajar: cajas de luz, papel, UI, ajolote
 │   ├─ #fore  .plane  d=1.30  cruces de registro, rótulos VD-0x, cinta, polvo
 │   └─ #grain (fuera de la cámara; salta 8 posiciones a 12 fps)
 ├─ intertítulos / flashes / iris (clips por encima: tapan y permiten cortes "bajo cubierta")
```

**Lección de la prueba**: el parallax con `d ≠ 1` desplaza los planos entre sí. Si el fondo de una estación (caja de luz, sala oscura) va en `#far`, se descuadra con sus objetos en cuanto la cámara viaja. El amarillo de la Mesa invadía la sala oscura (ver `coreo/snaps/contact-sheet-2.jpg`). **Regla: el fondo que tiene que encajar con el contenido va en `d = 1`. En los planos `d ≠ 1` solo va decorado libre.** Además, cualquier texto en `#far` queda tapado por el tablero opaco de `#world` (`text_occluded`), así que los rótulos van en `#fore`.

### 2.2 La cámara es una **función pura del tiempo**

Una tabla de keyframes y una función `cam(t)`. Un único tween conductor la llama. Es seek-safe por construcción: ningún `to()` encadenado guarda estado, y además permite **rebobinar** (re-muestrear la tabla al revés) y calcular **velocidad** para el blur.

```js
// x,y = punto del mundo en el centro de pantalla; s = zoom; r = giro (°); h = peso de cámara en mano (0..1)
// ease = curva del tramo que LLEGA a ese key; cut:true = salto instantáneo (bajo un negro/intertítulo)
const K = [
  { t: 0.0,  x: 1180, y: 1400, s: 0.90, r: -0.8, h: 1 },
  { t: 2.0,  x: 1230, y: 1395, s: 1.00, r: 0,   h: 1, ease: "vd.push" },
  { t: 2.42, x: 4290, y: 1405, s: 1.00, r: 1.2, h: 0, ease: "vd.whip" },  // se pasa 90 px…
  { t: 2.9,  x: 4200, y: 1400, s: 1.00, r: 0,   h: 1, ease: "vd.land" },  // …y recupera
  { t: 4.2,  x: 4230, y: 1410, s: 1.06, r: 0,   h: 1, ease: "vd.push" },
  { t: 5.6,  x: EYE.x, y: EYE.y, s: 210, r: 9,  h: 0, ease: "vd.dive" },  // a través del ojo
  { t: 5.6,  x: 4200, y: 2900, s: 1.18, r: -2,  h: 0, cut: true },        // corte bajo negro
  { t: 8.0,  x: 4200, y: 2900, s: 1.00, r: 0,   h: 1, ease: "vd.land" },
];
const lerp = (a, b, e) => a + (b - a) * e;
function cam(t) {
  if (t >= K[K.length - 1].t) return { ...K[K.length - 1] };
  let i = 1;
  for (let k = 1; k < K.length; k++) if (t < K[k].t || (t === K[k].t && !K[k].cut)) { i = k; break; }
  const a = K[i - 1], b = K[i];
  const p = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));
  const e = gsap.parseEase(b.ease || "none")(p);
  const s = Math.exp(lerp(Math.log(a.s), Math.log(b.s), e));            // zoom en espacio LOG
  const w = Math.abs(Math.log(b.s / a.s)) > 1                            // zoom grande: el centro sigue al zoom
    ? (1 / a.s - 1 / s) / (1 / a.s - 1 / b.s) : e;                       // (si no, el objetivo "resbala")
  return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), s, r: lerp(a.r, b.r, e), h: lerp(a.h ?? 1, b.h ?? 1, e) };
}
const hand = (t) => ({  // cámara en mano: senos inconmensurables, px de pantalla, sin aleatorio
  x: 2.6 * Math.sin(2 * Math.PI * 0.31 * t + 1.3) + 1.1 * Math.sin(2 * Math.PI * 0.77 * t + 0.4),
  y: 1.9 * Math.sin(2 * Math.PI * 0.23 * t + 2.1) + 0.9 * Math.sin(2 * Math.PI * 0.91 * t + 5.2),
  r: 0.12 * Math.sin(2 * Math.PI * 0.17 * t + 0.7),
});
const PLANES = [[$("#far"), 0.85], [$("#world"), 1], [$("#fore"), 1.3]];
function applyCamera(t) {
  const c = cam(t), n = hand(t);
  for (const [el, d] of PLANES) {
    const s = 1 + (c.s - 1) * d;
    el.style.transform = `translate(${960 + n.x * c.h}px, ${540 + n.y * c.h}px) rotate(${c.r * d + n.r * c.h}deg) scale(${s}) translate(${-c.x * d}px, ${-c.y * d}px)`;
  }
  const h = 0.5 / FPS, c0 = cam(Math.max(0, t - h)), c1 = cam(Math.min(DUR, t + h));
  const vx = Math.abs(c1.x - c0.x) * c.s, vy = Math.abs(c1.y - c0.y) * c.s;      // px/frame
  const pan = Math.abs(Math.log(c1.s / c0.s)) < 0.02;                              // sin estela en zooms ni cortes
  const bx = pan ? Math.min(28, vx * 0.35) : 0, by = pan ? Math.min(28, vy * 0.35) : 0;
  if (bx + by > 0.6) { cbx.setAttribute("stdDeviation", `${bx.toFixed(2)} ${by.toFixed(2)}`); lens.style.filter = "url(#camblur)"; }
  else lens.style.filter = "none";
}
const camDriver = { t: 0 };
tl.fromTo(camDriver, { t: 0 }, { t: DUR, duration: DUR, ease: "none", onUpdate: () => applyCamera(camDriver.t) }, 0);
applyCamera(0);
```

CSS imprescindible: `.plane { position:absolute; left:0; top:0; width:5760px; height:3240px; transform-origin:0 0; will-change:transform }`, `data-layout-allow-overflow` en cada plano y en el grano, y el filtro `<filter id="camblur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur id="cbx"/></filter>`.

**Extensiones** (mismo patrón, dentro de `cam(t)`):
- **Seguir a un objeto** (avión de papel, ajolote que salta): un key con `follow: (t) => ({x, y})` que devuelve la posición del objeto, calculada con la **misma** función pura que lo mueve, nunca con `getBoundingClientRect`. Su peso se interpola con el tramo.
- **Punch-in en el golpe**: un multiplicador `1 + 0,035·pulse(t − tGolpe)`, con `pulse` = subida en 2 f y caída exponencial en 8 f. Se multiplica sobre `s`, así que no hay un segundo escritor de transform.
- **Rebobinado** (guion 14, "Del primer folio, al último plano"): `cam(remap(t))` con `remap` que recorre de 46 s a 9 s en 1,2 s con `vd.whip`. Como el mundo ya está completo (todas las estaciones en su estado final), el vuelo hacia atrás se lee como resumen. Termina en un dezoom a `s = 0,28`: el mapa entero, unido por el hilo rojo.

### 2.3 Mapa del mundo v2 (coordenadas de centro de estación, mundo de 9600×5400)

```
           x→   1600        4200        6800        8400
y 1200   [E1 Guion]──────[E2 Mesa]──────[E3 Desglose]
                                              │ (baja)
y 3000   [E6 Plan/Jornadas]──[E5 Moodboard]──[E4 Planos·sala oscura]
y 4500                [E7 Plató / claqueta]  (el "piso de abajo": rodaje)
```

Un hilo rojo (`#f0503f`, 4 px, SVG path dibujado con `stroke-dashoffset`) une las estaciones en orden y se dibuja mientras la cámara viaja. En el dezoom del rebobinado se ve entero: es la imagen de "todo conectado".

### 2.4 Guion de cámara del tráiler (tiempos cuantizados, ver §4)

| t (s) | Key | Curva | Nota |
|---|---|---|---|
| 0,0–5,0 | Caos: cámara **fija con en-mano fuerte** (h = 2,5) sobre la pila, zoom 1,0→1,08 lineal | `none` | La quietud nerviosa contrasta con lo que vendrá |
| 5,0 | time-freeze: `h → 0` en 0,2 s | `vd.exit` | El mundo se para, la cámara también |
| 6,5–9,0 | baja a la mesa limpia, centrada en el ajolote | `vd.glide` | |
| 9,0 | **corte bajo intertítulo** DEL CAOS… → E1 | `cut` | |
| 10,5–13,5 | E1: el guion cae; push 1,0→1,06 | `vd.push` | |
| 13,5–18,5 | E1: dezoom suave a 0,92 mientras salen las fichas | `vd.glide` | |
| 18,0–18,5 | **plegado** → la cámara acompaña la tira hacia E2 | `vd.glide` 1,0 s | La cámara viaja con el objeto puente |
| 21,0 | push hacia la celda roja (s 1,0→1,45) | `vd.glide` 1,2 s | Guiño del ajolote |
| 23,0 | **corte bajo** …AL ORDEN… → E3 | `cut` | |
| 24,5–29,0 | E3: travelling lateral lento siguiendo el rotulador | `vd.push` | |
| 29,0–29,45 | **whip** E3→E4 (baja) | `vd.whip` + overshoot | Estela vertical |
| 29,5–34,5 | E4: tamaños de plano = zooms 1,0 / 1,35 / 2,1 en cada palabra | `vd.land` 0,35 s | La cámara *es* el visor |
| 34,5–35,0 | dezoom revelando las 12 viñetas | `vd.settle` | |
| 36,5–37,0 | **whip** E4→E5 | `vd.whip` | |
| 40,0 | **corte bajo** …A LA MAGIA. → E6 | `cut` | |
| 41,5–46,5 | E6: sigue al avión de papel (follow) hasta los avatares | `follow` | |
| 46,5–48,5 | dezoom + **picado al ojo** del ajolote → negro | `vd.dive` | "Y entonces… llega el día" |
| 49,0–51,0 | intertítulos UN DÍA / UN EQUIPO / UNA TOMA (sin cámara) | — | |
| 51,0–53,5 | E7: claqueta en primer plano, push imperceptible 1,00→1,02 | `none` | Tensión = quietud |
| 53,5 | CLAC → negro 0,25 s → flash → montaje | `cut` | |
| 54,0–56,0 | montaje a corcheas (0,25 s/plano): cortes secos entre 8 encuadres del mundo | `cut` ×8 | El one-take se "rompe" a propósito en el clímax |
| 56,0–58,5 | rebobinado + dezoom al mapa | `remap` | |
| 58,5–62,0 | el mapa se pliega en el logo | `vd.settle` | |

---

## 3 · Catálogo de transiciones a medida

Reparto: **primaria = viaje de cámara/whip** (5 costuras). Los acentos van firmados y se usan una sola vez: ojo, plegado, claqueta, burbuja. Código en GSAP sobre el `tl` único. Nada usa `gsap.set` en clips de escenas posteriores.

### T1 · Time-freeze + burbuja que estalla (Caos → Mesa limpia) · 5,0–8,0 s
El caos se congela, porque todas sus posiciones son función de `tc = min(t, 5,0)`. Se desatura con `filter: grayscale(1) brightness(.8)` en 0,2 s. Cae un folio a cámara lenta (`y` en 1,2 s con `sine.inOut`). Asoman las branquias. El ajolote sopla una burbuja (escala 0→1 en 0,9 s) y **¡pop!** en 8,0 s: un **iris** de 0 a 1150 px nace en el centro de la burbuja y deja ver la mesa limpia. A la vez, los papeles salen disparados radialmente con `vd.exit` y motion blur.
```js
const freeze = (t) => Math.min(t, 5.0);               // el caos lee freeze(t), no t
tl.fromTo("#chaos", { filter: "grayscale(0) brightness(1)" }, { filter: "grayscale(1) brightness(0.8)", duration: 0.2, ease: "none" }, 5.0);
tl.fromTo("#bubble", { scale: 0 }, { scale: 1, duration: 0.9, ease: "vd.settle" }, 7.0);
tl.fromTo(["#irisHole1", "#irisRim1"], { attr: { r: 0 } }, { attr: { r: 1150 }, duration: 0.6, ease: "vd.land" }, 8.0);
PAPERS.forEach((p, i) => tl.to(`#pp${i}`, { x: p.dx * 1400, y: p.dy * 900, rotation: p.rot, duration: 0.5, ease: "vd.exit" }, 8.0 + (i % 5) * 0.02));
```
El iris es un SVG con `<mask>`: `rect` blanco + `circle` negro cuyo `attr.r` se anima, y un aro de 6 px encima. Así está probado en `coreo` (§T9).

### T2 · Smash cut a intertítulo + corte "bajo cubierta" · 9,0 / 23,0 / 40,0 s
Sin transición: es el contraste. Corte seco a negro en el golpe. El rótulo entra con `letter-spacing 0,4em → −0,02em` en 0,45 s `expo.out` y sale por corte seco en el siguiente golpe. **Mientras el negro tapa, la cámara salta** (key `cut:true`) a la siguiente estación, que ya está montada. Al volver, el plano nuevo arranca en movimiento (un push que ya lleva velocidad), nunca quieto.

### T3 · El escáner despega las palabras (Guion → recuento) · 12,0–13,5 s
Una barra de luz (gel `#ece8dc`, 6 px + halo plano) recorre el folio con `vd.push`. Cada encabezado, nombre o lugar que toca **se despega** del papel: es un clon colocado en las coordenadas de autor de la palabra (constantes CSS, no medidas en tiempo de tween). Viaja en arco (x lineal, y `power2.out`, rotación ±8°) hasta su columna: ESCENAS / PERSONAJES / LUGARES. Llegada `vd.land` 0,4 s, stagger 0,05 s, tope 0,5 s. El contador de cada columna sube **una unidad por palabra que aterriza** (cada llegada es un tick sonoro), no con un tween continuo.

### T4 · El papel se pliega y se vuelve tabla (Guion → Mesa) · 18,0–19,0 s · **probado**
Bandas **anidadas**: cada una cuelga del borde inferior de la anterior y lleva un recorte del mismo folio desplazado `top: −i·H`. Al rotar en zigzag (−172° / +172° / −172°) se pliegan en acordeón real. La tira resultante viaja y se aplasta hasta medir y estar donde está la fila 0. Las demás filas salen "de debajo" de ella.
```js
let html = "";
for (let i = N - 1; i >= 0; i--) html = `<div class="band" id="b${i}" style="top:${i ? H : 0}px"><div class="clipb"><div class="sheet" style="top:${-i * H}px">${PAGE}</div><i class="shade"></i></div>${html}</div>`;
stage.innerHTML = html;   // #stage { perspective: 2200px } · .band { transform-style: preserve-3d; backface-visibility: hidden }
for (let i = 1; i < N; i++) {
  const ang = (i % 2 ? -1 : 1) * 172, d = T0 + (N - 1 - i) * 0.07;           // pliega de abajo arriba
  tl.fromTo(`#b${i}`, { rotationX: 0 }, { rotationX: ang, transformOrigin: "50% 0%", duration: 0.8, ease: "vd.fold" }, d);
  tl.fromTo(`#b${i} > .clipb .shade`, { opacity: 0 }, { opacity: i % 2 ? 0.45 : 0.15, duration: 0.8, ease: "vd.fold" }, d);
}
const TF = T0 + 0.9;  // tira 640×205 en (640,130) → fila 0 1200×64 en (360,300)
tl.fromTo("#stage", { x: 0, y: 0, scaleX: 1, scaleY: 1 }, { x: 360 - 640, y: 300 - 130, scaleX: 1200 / 640, scaleY: 64 / 205, transformOrigin: "0% 0%", duration: 0.4, ease: "power3.inOut" }, TF);
tl.fromTo("#stage .clipb", { backgroundColor: "#e9e5da" }, { backgroundColor: "#1d1d22", duration: 0.25, ease: "none" }, TF + 0.15); // papel → tinta (fondo bajo el folio)
tl.fromTo("#stage .sheet", { opacity: 1 }, { opacity: 0, duration: 0.25, ease: "none" }, TF + 0.15);                         // el folio se funde sobre ese fondo
tl.set("#stage", { opacity: 0 }, TF + 0.4); tl.set("#r0", { opacity: 1 }, TF + 0.4);
tl.fromTo("#table .row:not(#r0)", { y: (i) => -(i + 1) * 78, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "vd.land", stagger: 0.05 }, TF + 0.4);
```
Pendiente detectado en la prueba: fundir solo el folio dejaba un frame de tira vacía (amarillo de fondo) antes de la fila. La versión de arriba funde el folio **sobre** un `.clipb` que a la vez vira a tinta. Esa variante no está en la prueba: comprobarla con snapshot en TF+0,2 / +0,4. El `#stage` necesita `data-layout-ignore` porque los clones se solapan a propósito y disparan `text_occluded`.

### T5 · La celda roja se convierte en jornada (Mesa → Plan) · referencia para 41,5 s
La celda "falta" ya resuelta pasa a verde (el ajolote salta encima). Entonces **crece** con `card-morph-anchor`: `scaleX` y `scaleY` desde 120×36 hasta 290×74, que es el bloque de una jornada, con `borderRadius 10→12` y `backgroundColor` verde → color EXT/INT, en 0,6 s `vd.glide`. La cámara la sigue con un key `follow` mientras las demás celdas de su fila se convierten en los otros bloques del día (stagger 0,06). Al llegar, aparecen las columnas JORNADA 1/2/3 alrededor, en ola desde el bloque. Si el guion no pasa por la Mesa justo antes, se usa la ficha de escena como puente: la misma mecánica.

### T6 · Rotulador → chip → categoría (Desglose) · 24,5–29,0 s
El subrayado es un `scaleX 0→1` en 0,28 s `power2.out` y cae en la pregunta de la VO. En cuanto termina, el texto subrayado se **clona como chip** y salta en parábola (vuelo 0,45 s, aterrizaje `vd.spring`) a su columna: ATREZZO / VESTUARIO / VEHÍCULOS. En "Apuntado" cae un **sello**: escala 1,6→1 en 0,12 s `power4.in` + punch-in de cámara de 3,5 % + 2 f de temblor de 6 px (función pura de t).

### T7 · Esquinas del visor → primera viñeta (Planos → Storyboard) · 32,5 s
Las 4 esquinas del visor (que ya "eran" los tamaños de plano) se cierran hacia dentro: `x` e `y` hacia el centro en 0,3 s `vd.exit` + flash de obturador (`#fff` 0,9 → 0 en 4 f). Al abrir, las esquinas encierran exactamente la viñeta 1A del storyboard: es un match de forma. Desde ahí las 12 viñetas caen en cascada con ola desde 1A, y sus trazos se dibujan con `stroke-dashoffset` (0,8 s `vd.settle`, stagger 0,04 s). El ajolote aparece **dentro** de una viñeta como actor.

### T8 · Whip-pan con estela direccional · 29,0 y 36,5 s · **probado**
El key de llegada está 90 px más allá del destino (`vd.whip`, 0,42–0,45 s) y la recuperación es de 0,45 s con `vd.land`. La estela sale sola de la velocidad (§2.2), con tope de 28 px y solo sobre el eje del movimiento. SFX: whoosh paneado en el sentido de la cámara, con su pico (55 % de la duración) en el frame de máxima velocidad. Ver `coreo/snaps2/contact-sheet.jpg`, frame de 2,3 s.

### T9 · Picado a través del ojo → negro → iris con aro rojo · 46,5–49,0 s · **probado**
"Y entonces… llega el día". La cámara apunta a un punto **dentro de la pupila izquierda pero lejos del brillo blanco** (en el SVG `axoSVG`: (95, 103,5) de 240×280). Va de `s ≈ 1` a `s = 210` con `vd.dive` y gira 0→9° (espiral) en 1,4 s. A `s = 210` la pupila cubre la diagonal entera (el margen mínimo pupila−objetivo es 4,3 u × 1,25 × 210 = 1130 px > 1101 px de media diagonal) y el brillo queda fuera de cuadro. Últimos 0,08 s: fundido a un negro sólido `#0b0b0d` (la pupila es `#1e1418`). Corte de cámara bajo el negro. Iris de 0 a 1150 px en 0,9 s `vd.land` con aro `#f0503f` de 6 px que se desvanece. Aquí el iris nace del **piloto REC**, no del centro: `cx/cy` = posición del REC.
```js
tl.fromTo("#blackout", { opacity: 0 }, { opacity: 1, duration: 0.08, ease: "none" }, T - 0.08);
tl.set("#blackout", { opacity: 0 }, T); tl.set("#irisSvg", { opacity: 1 }, T);
tl.fromTo(["#irisHole", "#irisRim"], { attr: { r: 0 } }, { attr: { r: 1150 }, duration: 0.9, ease: "vd.land" }, T + 0.15);
tl.fromTo("#irisRim", { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "none" }, T + 0.75);
tl.set("#irisSvg", { opacity: 0 }, T + 1.1);
```
En el guion definitivo el iris se puede guardar para S4, y aquí dejar el negro, con el REC parpadeando solo. Se decide en montaje: los dos funcionan.

### T10 · Match cut de la claqueta + barrido de rayas · 51,0–54,0 s
1. 51,0 s: la claqueta mini en las manos del ajolote **casa por forma** con la claqueta gigante. Corte seco a la gigante, misma rotación (−6°) y mismo centro de pantalla. La regla de match cut es igualar posición, ángulo y dirección de movimiento en el frame del corte.
2. 51,0–53,5 s: los palos están abiertos −30°, y −34° como anticipación en 52,9 s. Silencio total desde 52,0.
3. 53,5 s, **CLAC**: los palos cierran en 3 f con `power4.in` (+ `data-hf-motion-blur` en los palos). Temblor de 3 f: `x = 14·sin(t·90)·e^(−t·18)`.
4. 53,5–53,75 s: negro. En 53,75 entran **las rayas blancas y negras del palo, escaladas a pantalla completa**, que cruzan en diagonal (−30°) en 0,25 s `vd.whip` y destapan el montaje del drop en 54,0. La transición sale del propio objeto.

### T11 · Rebobinado → mapa → logo · 56,0–62,0 s
La cámara re-muestrea su propia tabla hacia atrás (§2.2). Durante el rebobinado: grano al 0,25, una "barra de rebobinado" mono en la esquina (`◀◀ 46:00 → 09:00`, texto que cambia por pasos) y un whoosh inverso. En el dezoom final a `s = 0,28` el hilo rojo une las 7 estaciones. Después **cada estación se convierte en una franja de gel**: escala a una barra de 70×14 (`card-morph-anchor`) y vuela a la fila de geles del logo, stagger 0,07 s y `vd.spring` solo en la última. El logo se monta encima con wdth 62 → 118 en 0,7 s `vd.settle` (la variación de `font-stretch` se anima con `fontStretch`).

### T12 · Barrido de gel (firma de arte, 04 §8) · máximo 2 veces
Lámina del color de la fase siguiente, rotada −4°, de fuera a fuera en 0,45 s `power3.inOut`, con canto claro y reflejo plano. **Va siempre unida a un punch-in de cámara 1,04→1,12 (`expo.in`) que la lámina tapa** y a un cambio de estación bajo ella. Usos: Guion→Mesa (si no se usa T4) y ¡Corten!→Entrega. Es la versión rica del barrido de la v1, así que nunca debe ser la transición por defecto.

---

## 4 · Música por beats y diseño sonoro

### 4.1 Rejilla: **120 BPM** (beat 0,5 s · compás 2,0 s · corchea 0,25 s)

Elegida porque cuadra los tiempos del guion 02 moviendo cada evento ≤ 0,3 s, y porque la aritmética es trivial (`beat(n) = n·0,5`). Una **única fuente de verdad**: `build_audio.py` escribe `assets/cues.js` (`window.CUES = {...}`) con todos los golpes. El timeline de GSAP lee `CUES` y el audio usa la misma tabla, de modo que nunca se desincronizan.

| Evento (guion 02) | t guion | **t v2** | Rejilla |
|---|---|---|---|
| Ping inicial | 0,10 | 0,00 | — |
| VO 1 «Cuarenta guasaps…» | 0,40 | 0,50 | beat 1 |
| Time-freeze + tape-stop | 5,40 | 5,00 → 5,50 | compás 3,3 |
| Silencio absoluto | — | 5,50–6,50 | 2 beats |
| VO 2 «Vale. Respira…» | 6,60 | 6,50 | |
| ¡Pop! burbuja + primer kick | — | 8,00 | **compás 5** |
| BOOM + DEL CAOS… | 8,80 | 9,00 | beat 3 (síncopa: entra "tarde") |
| VO 3 | 10,40 | 10,50 | |
| Escáner (S2) | 12,10 | 12,00–13,50 | compás 7 |
| VO 4 | 13,60 | 13,50 | |
| VO 5 + plegado→Mesa | 18,40 | 18,00 / VO 18,50 | compás 10 |
| VO 6 «te lo chivo yo» + guiño | 21,00 | 21,00 (guiño en 22,50) | |
| BOOM + …AL ORDEN… | 23,10 | 23,00 | beat 3 |
| VO 7 + 3 rotuladores | 24,30 | 24,50; trazos 25,0 / 26,0 / 27,5 | en cada pregunta |
| Sello «Apuntado» | ~28,9 | 29,00 | **compás 15** |
| Whip a Planos + VO 8 | 29,40 | 29,00–29,45 / VO 29,50 | |
| Clics de obturador (PG·PM·PP·PD) | — | 30,0 / 30,5 / 31,0 / 31,5 | negras |
| Storyboard (S3) + swell | 32,30 | 32,50–34,50 | |
| VO 9 | 34,30 | 34,50 | |
| Whip a Moodboard + VO 10 | 36,80 | 36,50 / VO 37,00 | |
| Campanillas swatches | — | 38,0 / 38,25 / 38,5 / 38,75 / 39,0 | corcheas |
| Platillo invertido | — | 39,00→40,00 | |
| BOOM + …A LA MAGIA. | 40,20 | 40,00 | **compás 21** |
| VO 11 + pings-alivio (1 por avatar) | 41,60 | 41,50; pings 44,0–45,5 a corcheas | |
| VO 12 «Y entonces…» + riser empieza | 46,90 | 47,00 | |
| UN DÍA / UN EQUIPO / UNA TOMA | 49,10 | 49,00 / 49,50 / 50,00 | negras sobre riser |
| VO 13a «Preparados…» | 51,10 | 51,00 | |
| **Corte del riser → silencio** | 52,10 | 52,00 | **compás 27** |
| VO 13b «¡Acción!» | 52,80 | 52,90 | |
| **CLAC** | 53,55 | 53,50 | |
| **DROP** | 53,85 | 54,00 | **compás 28** |
| VO 14 | 55,60 | 56,00 | |
| VO 15 | 58,40 | 58,50 | |
| Acorde final + button | 62,30 | 62,00 | **compás 32** |
| VO 16 «¿Otra, por seguridad?» | 63,40 | 63,50 | |
| Mini-clac | 65,10 | 65,00 | |
| FIN | 65,50 | 65,50 | |

En el timeline:
```js
const C = window.CUES.hits;                    // { boom1: 9.0, clac: 53.5, drop: 54.0, ... }
const beat = (n) => n * window.CUES.beat;      // por si hace falta construir golpes nuevos
tl.fromTo("#accion", { scale: 1.9 }, { keyframes: [{ scale: 0.94, duration: 0.1 }, { scale: 1.02, duration: 0.06 }, { scale: 1, duration: 0.1 }], ease: "power4.out" }, C.clac);
```
Regla de sincronía: los impactos visuales caen **en el frame del golpe o 1 f antes**, nunca después (el ojo percibe 1–2 f de retraso como "lag"). Los whooshes se colocan de modo que su **pico** coincida con la velocidad máxima de la cámara: `tWhoosh = tPico − 0,55·d`. Con `npx hyperframes beats` se comprueba que la detección coincide con la rejilla.

### 4.2 Estructura musical (La menor, Am–F–C–G, un acorde por compás)

| Sección | t | Contenido | Nivel |
|---|---|---|---|
| **Intro caos** | 0–5,0 | Drone grave (sierras de 55 Hz filtradas a 300 Hz + sub), tic-tac a corcheas, **pings que se aceleran** de 1/s a 8/s: `t_k = 5·(1 − 0,82^k)`, cada uno +40 cents | −20 dBFS RMS |
| Tape-stop | 5,0–5,5 | `tape_stop()` sobre toda la mezcla | → 0 |
| **Silencio** | 5,5–6,5 | nada (ni sala) | −∞ |
| Ternura | 6,5–8,0 | Pluck tipo celesta, motivo de 4 notas (E5 C5 A4 B4) | −22 |
| **A · orden** | 8,0–23,0 | Kick a negras, hat a contratiempos, arpegio pluck a corcheas, pad suave | −16 |
| **B · capa** | 23,0–40,0 | + cuerdas (pad de sierras desafinadas ±12 cents, corte 2,5 kHz) + hats a semicorcheas desde 32,5 | −14 |
| Swell storyboard | 32,5–34,5 | pad con ataque 1,5 s + `sparkle` | +3 dB |
| **C · magia** | 40,0–47,0 | todo + campana (seno 2·f, caída 1,2 s) en el 1 de cada compás | −13 |
| **Build-up** | 47,0–52,0 | Fuera la percusión. Pulso de sub a negras. `riser(5,0)` + redoble que acelera (corcheas 49–50, semicorcheas 50–51, fusas 51–52). Golpes en 49,0 / 49,5 / 50,0 | −18 → −8 |
| **SILENCIO** | 52,0–53,5 | **corte total** (bajo la VO «¡Acción!» no hay nada) | −∞ |
| CLAC | 53,5 | `clapper()` con sala corta | pico −3 |
| **DROP** | 54,0–62,0 | `boom()` + kick, hats a semicorcheas, bajo a corcheas, pad completo, la melodía del motivo una octava arriba | −11 |
| Final | 62,0 | Acorde Am(add9) largo + boom suave + cola de reverb de 3,5 s | |
| Stinger | 63,5–65,5 | solo la cola; mini-clac a −10 dB en 65,0 | |

**El motivo del ping** (guion 02, punto 3): el mismo `ping()` vuelve en 44,0–45,5 s, uno por avatar a corcheas, pero ahora **afinado a la escala** (A5 C6 E6 A6). Lo que era estrés se oye ordenado y en tono.

### 4.3 SFX (todos en `sfxlib.py`, estéreo, deterministas)

| SFX | Receta | Cuándo |
|---|---|---|
| `whoosh(d, f0, f1, p0, p1)` | ruido con banda (STFT) cuyo centro sube y baja con la "velocidad" `sin(πu)^1,5`, de 250 a 4000 Hz, envolvente con pico al 55 % y **paneo que sigue a la cámara** | whips, vuelos de papel/avión |
| `riser(d)` | ruido con banda de 200 a 7000 Hz (`u^1,6`) + seno con glissando de 110 a 880 Hz + trémolo que acelera (2→16 Hz), volumen `u^2,5`, 5 ms de Haas | build-up 47–52 |
| `boom()` | sub de 58 a 31 Hz (τ 0,35 s) + golpe de ruido paso-bajo 1,8 kHz + "braam" de sierras 55/82/110 Hz paso-bajo 700 Hz | intertítulos, drop |
| `reverse_cymbal()` | ruido paso-alto 5 kHz con caída exponencial, invertido | 39,0→40,0 y antes del drop |
| `ping(f)` | FM 2:1 de índice decreciente + parcial ×1,5, caída 90 ms | caos y callback |
| `pop()` | seno de 320 a 1500 Hz en 12 ms + clic de 1 ms | burbuja, chips |
| `ui_click()` | ruido paso-alto 4 ms + seno de 3,2 kHz 6 ms | celdas, checks, contadores (1 por unidad) |
| `shutter()` | dos clics separados 45 ms | tamaños de plano |
| `clapper()` | **dos** transitorios separados 9 ms (banda 2,6 kHz) + cuerpo modal de madera 212/487/1130 Hz + sala de 0,6 s | ¡Acción! y mini-clac |
| `marker_swipe()` | ruido de 3,4 kHz con modulación de fibra de 32 Hz y paneo L→R | subrayados |
| `pencil()` | ruido de 4,5 kHz con AM de 6,5 Hz (trazos) × 47 Hz (grano) | storyboard |
| `stamp()` | golpe de 70→110 Hz + papel | «Apuntado» |
| `sparkle()` | 14 senos de 2,2 a 7 kHz ascendentes, paneo alterno, reverb 0,9 s | moodboard, logo |
| `tape_stop(buf, t0, d)` | re-muestreo con velocidad `(1−u)^2` | 5,0 s |

**Mezcla**: VO por líneas sueltas (un WAV por línea en su `t v2`), `sidechain(music, vo, −8 dB, att 30 ms, rel 250 ms)` (causal; el de la v1 era simétrico), SFX a −3 dB respecto a la música, `master()` con saturación tanh y limitador con look-ahead de 5 ms y techo de −0,6 dBFS. Objetivo integrado de unos −14 LUFS: la demo da −12,8 dB RMS en las partes llenas, así que hay que bajar 1–2 dB. Todo estéreo a 48 kHz.

**Demo probada** (`demo_build.py`): groove (0–6 s) → boom (2,0) → whoosh paneado → pop + sparkle → riser y redoble que acelera (6–9,5) → **silencio exacto 9,5–10,5 (−180 dB medido)** → claqueta (10,5) → drop (11,0). Detalle detectado al medir: si el groove se para durante el riser, el build-up queda flaco (−47 dB en 6,5 s). En el tráiler hay que mantener un pulso de sub a negras bajo el riser.

---

## 5 · Registry de HyperFrames: qué usar

Consultado con `npx hyperframes catalog --query …` (447 movimientos). Instalados para inspección en `coreo/compositions/components/`.

| Ítem | Veredicto | Cómo |
|---|---|---|
| **`motion-blur`** (component) | **Sí**, para 2–3 objetivos | Pegar el snippet y poner `data-hf-motion-blur='{"samplesPerFrame": 8}'` en los palos de la claqueta, en «¡ACCIÓN!» y en el avión de papel. Direccionar por `id` (las copias heredan clases). No marcar un contenedor ni algo que solo mueve la cámara. |
| `char-slam-explode` (component) | **Referencia**, no instalar tal cual | Su tabla de dispersión precalculada + slam con temblor de 3 frames es justo el patrón para «¡ACCIÓN!» y «UN DÍA…». Copiar la mecánica a nuestro timeline (su `#root` y su timeline propios chocan con el one-take). |
| `beat-accent` (component) | **Referencia** | Envolvente de golpe: flash radial + micro-escala + caída inmediata, con `IMPACT_AT` declarado. Sirve como modelo del `pulse()` de cámara. |
| `whip-pan-cut`, `iris-reveal` (components) | **No** como componentes | Son puentes entre dos paneles a pantalla completa (slots before/after) e incompatibles con el mundo continuo. Útiles como lectura: el tope de 16 px del blur y la velocidad igualada en la costura. Nuestra T8 y T9 ya los cubren. |
| `grain-overlay` (component) | **No** | Usa `@keyframes … infinite` de CSS. Nuestro grano por `tl.set` a 12 fps (04 §6) es igual de barato, sale del timeline y está probado. |
| `text-shimmer` / `shimmer-sweep` | **Opcional** | Un solo barrido especular en «…A LA MAGIA.». Es `background-clip:text` y no se aplica dentro de un plano con blur. |
| `confetti` | **No** | 04 pide cascada verde de "hecho" en lugar de confeti. |
| Bloques shader (`whip-pan`, `sdf-iris`, `light-leak`, `cinematic-zoom`) | **No** | El probe dice `browserGpuMode → software (WebGL unavailable)`. Además, las transiciones shader obligan a que las raíces sean transparentes. |
| `organic-light-leak-overlay` (block) | **Quizá**, 1 vez | Fuga de luz finita en CSS para el flash post-CLAC (53,75 s). Probar coste en el render por software antes de comprometerlo. |

`hyperframes add` necesita red (solo los manifiestos se cachean). En este entorno funcionó: `npx hyperframes add motion-blur --no-clipboard`.

---

## 6 · Errores de lint y determinismo a evitar (incluye los aprendidos en las pruebas)

**Del contrato (hyperframes-core):**
1. Un solo `gsap.timeline({ paused: true })`, registrado **al final** en `window.__timelines["main"]`. Si se construye dentro de `document.fonts.ready`, se registra al final del callback (`gsap_timeline_registered_before_async_build`).
2. Nada de `Math.random()` sin semilla, `Date.now()` o `performance.now()`. PRNG sembrado (`mulberry32(20261016)`) o senos con fase fija.
3. `repeat` finito: `Math.max(0, Math.floor(dur / ciclo) - 1)`, con `floor` y no `ceil` (`gsap_repeat_ceil_overshoot`). Mejor aún: idles como función pura de `t` dentro de un conductor (respiración, branquias, grano).
4. No animar `display`, `visibility` ni `autoAlpha` sobre un `.clip` (`gsap_animates_clip_element`): se anima un hijo.
5. No hacer `gsap.set` al cargar en clips de escenas posteriores. Los estados iniciales van en `fromTo` o en CSS.
6. `fromTo` siempre con estado inicial explícito. Al reutilizar un objetivo, `immediateRender: false` en los siguientes `fromTo` sobre la **misma propiedad**. La v1 lo necesitó en `#wipe`, y ese es el síntoma de que había que hacerlo distinto.
7. Ninguna `transition` de CSS en elementos animados.
8. Transformar solo elementos block o inline-block **con tamaño** (un `<span>` inline no escala).
9. `<br>` solo en titulares de display (palabra por línea).
10. Prohibido medir con `getBoundingClientRect` en tiempo de tween. En montajes multi-escena, coordenadas de autor (constantes que casan con el CSS).
11. El mismo atributo en el mismo elemento no lo pueden escribir dos tweens a la vez (la v1 solapaba `place()` + `tl.to(ax…)`). Con la cámara, **un solo escritor**: `applyCamera`.
12. Ningún clip puede terminar después del `data-duration` raíz (`clip_ends_past_root_duration`): la raíz mide **65,5** s.

**Aprendidos en `coreo/` y `coreo-fold/`:**
13. Planos de mundo gigantes → `layout`: `escaped_container`, `container_overflow` y `canvas_overflow`. Solución: `data-layout-allow-overflow` en cada `.plane` y en el grano.
14. Texto en un plano de fondo tapado por un plano opaco → `text_occluded` (error). Los rótulos van en el plano de primer término y los fondos del plano de objetos son transparentes donde no hace falta.
15. Clones superpuestos a propósito (bandas del plegado, palabras que se despegan, copias de rebobinado) → `text_occluded`. Solución: `data-layout-ignore` en el contenedor del efecto.
16. El chequeo de **contraste** confunde el fondo cuando texto y superficie viven en planos distintos (dio 1,04:1 con texto negro sobre amarillo). Son warnings, pero conviene comprobar a ojo con `snapshot`.
17. **Registro de parallax**: el fondo de una estación nunca va en `d ≠ 1` (§2.1).
18. **Filtros caros**: el blur va en el `#lens` fijo (1920×1080) y no en el mundo transformado de 5760×3240 (el filtro se calcula en espacio local antes del transform). `filter: none` cuando b < 0,6.
19. Desenfoque de cámara solo en paneos. En zooms (d log s > 0,02/f) da una "papilla" (frames de 4,8 s en la primera prueba).
20. Zoom: interpolar **en log** y, para zooms de más de e×, usar el peso `w = (1/a.s − 1/s)/(1/a.s − 1/b.s)` en x,y. Si no, el objetivo resbala fuera del centro.
21. Picado a `s > 100` sobre SVG: bien en el render por software (probado a 210×), pero apunta lejos de los brillos o cruzarán el cuadro como manchas blancas.
22. 3D CSS (`preserve-3d`, `perspective`, `rotationX`) **funciona** en el render por software (probado). `backface-visibility: hidden` en las bandas y sombreado con una capa `opacity` (no con `filter: brightness`).
23. Componente `motion-blur`: un elemento marcado no puede tener un ancestro marcado. Si está dentro de un plano de cámara, la estela no incluye el movimiento de cámara.
24. Sin WebGL: nada de bloques shader ni `@hyperframes/shader-transitions`.
25. Validación en cada iteración: `npx hyperframes check` (0 errores) y `npx hyperframes snapshot --at <tiempos de transición ±2 f> --describe false`. Sin el `--describe false`, intenta Gemini si hay clave.

---

## 7 · Resumen operativo para quien monte la v2

1. Copiar de `coreo/index.html` la cámara (`bez`, `EASE`, `K`, `cam`, `hand`, `applyCamera`) y el iris SVG. Sustituir el ajolote de prueba por el rig de `v2/rig/poses.js`.
2. Montar el mundo de 9600×5400 con las 7 estaciones de §2.3. Fondos de estación en `#world`, decorado en `#far` y `#fore`.
3. Escribir la tabla `K` de §2.4 con los tiempos de la columna **t v2** de §4.1, leídos de `window.CUES`.
4. Implementar las transiciones T1, T4, T9 y T10 (las firmadas) y luego T2, T3, T6, T7, T8 y T11. T5 y T12 quedan en reserva.
5. Extender `build_audio.py` con `sfxlib.py` según §4.2 y §4.3, y emitir `cues.js`.
6. `check` + `snapshot` en cada costura antes del render.
