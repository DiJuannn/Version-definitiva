# Prompt Pack: Claw Machine (Opus 5.5 Motion Lab) · resumen y prompt literal

Ficha original: `clawd-claw-machine.pdf` (5 páginas).
- **La pieza:** película de personaje, 20 s, 16:9, 60 fps, 1200 fotogramas, renderizada a 2×.
- **Cómo se hizo:** un solo HTML con three.js y cannon-es, un prompt de 280 palabras y 7 + 3 correcciones (imagen y sonido).

**Historia.** De noche, en un salón recreativo, la mascota de Claude está subida a un taburete frente a una máquina de gancho, con tres monedas.
1. **Intento 1:** la pinza agarra flojo y suelta el peluche.
2. **Intento 2:** el peluche resbala hasta la barandilla de la rampa, se tambalea y vuelve a caer. La mascota se acerca y se da con la frente en el cristal.
3. **Intento 3:** aguanta la respiración y… THUNK.

Al final baja, saca el peluche (una versión en peluche de sí misma), lo abraza, y el peluche nos parpadea despacio.

## La fórmula (6 puntos)
1. **Una pila física de verdad.** 32 peluches asentados en un *bake* determinista de cannon-es. La garra es un cuerpo cinemático que empuja a los vecinos, y cada aterrizaje aplasta al peluche que cae.
2. **Las pinzas se paran al tocar.** En cada paso físico, cada pinza se cierra solo hasta que su caja toca el premio, y se abren del todo antes de soltar.
3. **Cero atravesamientos, medido.** Test de intersección por fotograma de cada peluche, pinza, moneda, el héroe y la carcasa, hasta que no registró nada en los 1200 fotogramas.
4. **Un cristal que actúa.** Reflejo real en las dos caras, un tinte que se flexiona con el golpe y una mancha de vaho donde dio la frente.
5. **Actuar con un plan.** Los ojos guían cada movimiento, *take* y *double take* en cada gag, una respiración contenida antes del gran momento y una sola mirada al objetivo.
6. **Medir, no adivinar.** El naranja se midió en los fotogramas finales, la trayectoria de cámara se probó contra la geometría y cada golpe se comprobó en su fotograma.

## El prompt literal (pegar tal cual en Claude Code con Opus 5.5, esfuerzo alto)

```
BRAND
HERO: 20x13 pixel mascot D97757: body 14x10 at (3,0), arms 3x2 at (0,5) and (17,5), legs 2x3 at x 4, 7, 11, 14
on row 10, eyes 0F0F0F 2x3 at (6,3) and (12,3)
PRIZES: 32 pillowy plush HEROs, felt eyes, some with a bow or beanie, one orange
MACHINE: teal cabinet 1F6F6B, cream trim, chrome 3-prong claw, bulb frame, MARQUEE "CLAW"
VENUE: night arcade, glowing cabinets
PALETTE: D97757, F3E6CF, 8DBFAF, F2C14E, E8A6B4, 7FA7D9
TRIES: 3 coins: drop, slip, win

One HTML file, three.js 0.160.0 + cannon-es, 1920x1080, 60 fps, 20 s. renderAt(t) samples a seeded physics bake.

LOOK: glass with a real reflection, warm LED strip inside, bokeh from real lights, neutral key so HERO reads D97757.

BEATS (s):
0 HOOK: close on HERO's determined face at the glass, claw swinging; coin in, bulbs chase awake
1 try 1: eyes track the claw, HERO mimes the grab; the plush lifts, drops; shoulders sag, huff
4.6 coin 2, squint; HERO leans with the claw; the plush slips onto the chute edge, teeters, tumbles back; HERO
leans in: BONK on the glass, flex, fog smudge, dazed blink, rubs forehead
10 last coin, heartbeat music, tiny nudges; stillness, cheeks puffed; slow grab, sway, carry
15.6 THUNK; breath out; take, double take; hop down, victory wiggle, one look at us
17 pulls the plush from the flap, hugs it, eyes shut, blush, rocking; the plush slowly blinks at us; hold

CAMERA: one move: pull back from the hook, through the glass for the claw, inside the machine for the bonk, top-
down into the pile, slow macro carry, low on the drop, warm medium hug.

CHECKS: plush squash, claw pendulum, no clipping, eyes lead.
```

Variante «hazlo tuyo» (solo cambia el bloque BRAND): ranas de peluche 7CC37A con coronas, una dorada F2C14E; máquina rosa caramelo E86A92 con garra de latón de 4 pinzas, rótulo «GRAB»; un rincón de centro comercial en un día de lluvia; 3 fichas: falla, se engancha en la barandilla, gana.

## Cada beat en su fotograma (60 fps; el sonido llega 1 fotograma, 17 ms, después de la imagen)

| Tiempo | Imagen | Sonido |
|---|---|---|
| 0,00–0,30 s | Primer plano decidido, la garra se balancea; la moneda entra | Tintineo de moneda |
| 0,30–1,20 s | Las bombillas se encienden en cadena; los ojos se abren | Jingle de arranque, ambiente de recreativos |
| 1,20–2,42 s | Joystick: la grúa se desliza, la garra se balancea | Clics del microinterruptor, zumbido del motor |
| 2,42–3,40 s | Botón; la garra baja y cierra, la mascota imita el agarre | Botón, carraca del cable, clac de las pinzas |
| 3,42–4,52 s | Sube, resbala y cae al montón; hombros caídos, resoplido | Golpe suave, «womp», resoplido |
| 4,62–6,22 s | Moneda 2, mirada decidida, apunta al segundo peluche | Moneda, campanita, clics, botón |
| 6,28–8,46 s | Agarra, sube y lo lleva; la mascota se inclina con él | Carraca, clac, motor |
| 8,56–9,20 s | Resbala a la barandilla, se tambalea y vuelve a caer | Clac al abrir, golpes suaves |
| 9,20–10,05 s | BONK contra el cristal: se flexiona, vaho, parpadeo aturdido, se frota | Golpe con resonancia de cristal, «boing», tono tambaleante |
| 10,05–12,48 s | Última moneda, pequeños ajustes, respiración contenida | Latido y tic-tac; después solo el latido |
| 12,52–15,60 s | Bajada lenta, agarre, balanceo, transporte cuidadoso | Botón, carraca, clac, motor |
| 15,70–16,18 s | El premio cae por la rampa: THUNK, suelta el aire | THUNK grave, jingle de victoria, arpegio |
| 16,25–17,00 s | *Double take*, una mirada a cámara, salto de victoria | Whoosh, pequeño aterrizaje |
| 17,05–20,00 s | Saca el peluche, lo abraza, se sonroja; el peluche parpadea | Clac de la trampilla, chirrido, brillo, «tink» |

## Qué hemos adoptado en la skill
- Plantilla de 6 bloques → `kit/prompts/pelicula-de-personaje.md`
- Prompt de sonido y sus 3 correcciones → `kit/prompts/prompt-de-sonido.md`
- Las 7 correcciones por tipo → `kit/prompts/follow-ups.md`
- Registro de choques → `kit/checks/choques-3d.js`
- Color medido y albedo corregido → `kit/checks/medir-color.py`
- Golpe de sonido un fotograma tarde → `kit/checks/sincronia-golpes.py`
- Limitador que informa (≤ 3 dB) → `kit/audio/limitador.py`
- Render con muestras en el obturador → `kit/render/render-suave.mjs`
