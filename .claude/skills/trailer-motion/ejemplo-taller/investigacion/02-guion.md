# 02 · GUION v2 — Tráiler "Versión definitiva · Taller"

Voz: ajolote (Kokoro `ef_dora`, pitch subido). Ritmo de cálculo: **13,5 caracteres/s** (con espacios y signos).
Duración total: **65,5 s**, con **~14 s de silencio de voz intencionado** (21 %).

---

## 1 · Tres conceptos

### A) «DEL CAOS A ¡ACCIÓN!» — tráiler épico con contraste (ELEGIDO)
**Logline:** Preparar un rodaje es una guerra de guasaps, excels y papeles… hasta que un ajolote pequeñito dice «yo me encargo» y convierte el caos en un día de rodaje perfecto.
**Tono:** arranca como tráiler de catástrofe (drone grave, pings que se aceleran, tipografía gigante) y se rompe con la ternura del ajolote. Tríada de intertítulos DEL CAOS · AL ORDEN · A LA MAGIA. Clímax con claqueta. Stinger cómico tras el logo.
**Referencias:** tráileres de A24 (intertítulos secos sobre negro), Apple keynote reveals (producto que "se ordena solo"), el "time-freeze" de *Spider-Verse*, la cuenta atrás de *Whiplash*.

### B) «TREINTA DÍAS PARA RODAR» — thriller de cuenta atrás
**Logline:** Faltan treinta días para el rodaje y nada está listo; cada intertítulo resta días (30… 12… 3… 1) mientras el ajolote va tachando problemas.
**Tono:** tensión Nolan/Zimmer, tic-tac constante, BRAAMs. Muy cinematográfico, pero el ajolote queda como copiloto nervioso y el humor tiene poco hueco; además el tic-tac tapa la locución.

### C) «EL DIARIO DEL AJOLOTE» — making-of íntimo
**Logline:** El ajolote, ayudante de dirección de un corto de estudiantes, nos enseña su cuaderno: así preparó la película, página a página.
**Tono:** cálido, simétrico a lo Wes Anderson, piano y pizzicato. Muy cuco y muy de marca, pero no tiene «golpe»: no hay gancho en los 3 primeros segundos ni pico de "wow".

### Por qué A
1. **Gancho en 3 s:** el dolor real del público (guasaps, excels, «¿quién trae la escalera?») se reconoce al instante; la gente de cine se ríe porque lo ha vivido.
2. **Arco claro y medible** (caos → orden → magia → el gran día) que se lleva a la imagen tal cual: el fondo pasa del desorden de papeles a la mesa de luz limpia y luego a la luz roja de REC. El cambio de gel por fase (#ece8dc → #f0c94a → #f0503f → #4fc47f) cuenta la historia por sí solo.
3. **Motivo que vuelve:** los pings del principio (estrés) vuelven en la hoja de llamada (alivio): mismo sonido, sentido contrario. Es el truco de guion que hace que un tráiler se sienta "escrito".
4. Hay sitio para la personalidad del ajolote (el chivatazo, el guiño, el «¿otra, por seguridad?») sin caer en lo infantil.

---

## 2 · Guion final

**Convenciones**
- *Locución* = texto exacto para el TTS (ya con la grafía fonética; ver §2.3).
- *Pantalla* = kinetic type, **no se locuta**.
- Silencio = **sin voz**, la música o el SFX llevan el momento.
- Duración = caracteres / 13,5, redondeada; generar **un WAV por línea** y colocarlo en `data-start`, nunca un WAV único (así los silencios son exactos).

| nº | Inicio | Dur. | Locución (TTS) | Texto en pantalla | Qué se ve | Intención | Música / SFX |
|---|---|---|---|---|---|---|---|
| 0 | 0,00 | 0,4 | — (silencio) | — | Negro total. Un único globo de chat aparece en el centro: «¿Quién trae la escalera?» | Intriga | Un **ping** de notificación seco en 0,10. Nada más. |
| 1 | 0,40 | 5,0 | «Cuarenta guasaps. Tres éxcels. Y nadie sabe quién trae la escalera.» | Nombres de archivo que se apilan: `guion_FINAL_v7_ahorasí.docx`, `planing (2).xlsx`, `NO BORRAR.pdf` | Avalancha: globos de chat, celdas de hoja de cálculo que se multiplican, post-its, contador «43 mensajes sin leer» subiendo. Ajolote **no** se ve. | Caos, reconocimiento, risa nerviosa | Drone grave + pings que se aceleran (de 1/s a 8/s); reloj de fondo. |
| S1 | 5,40 | 1,2 | — (silencio) | — | **Time-freeze**: todo se congela en el aire, desaturado; cae un único folio a cámara lenta. Asoman dos branquias rosas por detrás de la pila. | Respiración, sorpresa | *Tape-stop* (la música se "desinfla") + silencio absoluto 0,6 s. |
| 2 | 6,60 | 2,2 | «Vale. Respira. Yo me encargo.» | — | El ajolote salta de la pila, hace una burbuja y **¡pop!**: los papeles salen volando fuera de plano. Queda la mesa de luz limpia, oscura (#0b0b0d) con papel #f1eee6. | Alivio, ternura, presentación del héroe | Pop de burbuja + entra el **primer kick** del beat. |
| T1 | 8,80 | 1,6 | — | **DEL CAOS…** | Intertítulo a pantalla completa, Archivo wdth 62 / wght 900, papel sobre negro, *tracking* que se cierra. | Promesa | Golpe grave (*boom*) en 8,80. |
| 3 | 10,40 | 1,7 | «Tú solo, dame el guion.» | — | El ajolote atrapa al vuelo un guion encuadernado y lo deja caer sobre la mesa. | Complicidad | *Whoosh* + golpe de papel. |
| S2 | 12,10 | 1,5 | — (silencio) | `ESCENAS 24 · PERSONAJES 9 · LUGARES 6` | **Wow 1**: barrido de luz de escáner (gel #ece8dc) sobre el guion; las palabras se despegan del folio y vuelan a tres columnas; contadores que suben. | Asombro | Shimmer ascendente + ticks de contador. |
| 4 | 13,60 | 4,5 | «En segundos, sé cuántas escenas tienes, quién sale, y dónde.» | — | Fichas de personaje y de lugar se ordenan en rejilla. Ajolote con gafas de leer (*opcional, si la pose existe*). | Competencia, rapidez | Beat estable. |
| 5 | 18,40 | 2,4 | «Todo tu rodaje, en una sola mesa.» | MESA DE PREPARACIÓN | La rejilla se convierte en la tabla escena a escena; las filas se iluminan una tras otra en verde (#4fc47f) y amarillo (#f0c94a). | Orden, control | Cada fila = un *tick* suave en el beat. |
| 6 | 21,00 | 2,1 | «Lo que falta, te lo chivo yo.» | — | Una celda se queda roja (#f0503f). El ajolote se asoma por el borde de la tabla, la señala y **guiña un ojo**. | Humor, cercanía | *Boop* juguetón. |
| T2 | 23,10 | 1,2 | — | **…AL ORDEN…** | Intertítulo, mismo estilo; el subrayado es una barra de gel amarillo #f0c94a. | Escalada | Boom + la música sube una capa (cuerdas o sinte en ostinato). |
| 7 | 24,30 | 4,7 | «¿Una taza? ¿Un abrigo rojo? ¿Un coche de los ochenta? Apuntado.» | `ATREZZO · VESTUARIO · VEHÍCULOS` | Texto de guion en pantalla; marcador fluorescente que subraya «taza», «abrigo rojo», «coche»; cada palabra salta como chip a su categoría. En «Apuntado» cae un sello. | Ritmo, eficacia, gracia | Tres *swipes* de rotulador sincronizados con cada pregunta + **sello** en «Apuntado». |
| 8 | 29,40 | 2,9 | «Tú me dices cómo lo ves, plano a plano.» | PG · PM · PP · PD | Visor de cámara (esquinas de encuadre) que cambia de tamaño de plano con cada palabra. | Autoría: tú decides | Clics de obturador en cada cambio. |
| S3 | 32,30 | 2,0 | — (silencio) | — | **Wow 2**: el storyboard se dibuja solo; 12 viñetas en cascada, trazos SVG que se pintan (stroke-dashoffset), con el ajolote dentro de una viñeta como "actor". | Magia | Lápiz rasgando + *swell* de música. |
| 9 | 34,30 | 2,0 | «Y el estoribord, sale solo.» | STORYBOARD | La rejilla de viñetas hace zoom-out y se asienta. | Remate del wow | Golpe suave al cerrar. |
| 10 | 36,80 | 3,4 | «Luego, le damos alma. Luz, color, referencias.» | BIBLIA VISUAL | Moodboard: polaroids que se abren en abanico, muestras de paleta que caen como fichas, cuentagotas que toma un color. | Emoción estética | Pad cálido, campanilla en cada swatch. |
| T3 | 40,20 | 1,4 | — | **…A LA MAGIA.** | Intertítulo con *shimmer* que lo recorre. | Plenitud | Boom + platillo invertido que lleva al siguiente bloque. |
| 11 | 41,60 | 5,0 | «Organizo las jornadas. Y la hoja de llamada, vuela a todo el equipo.» | JORNADA 1 · JORNADA 2 · JORNADA 3 | Calendario: bloques de escena que encajan en jornadas (*snap*). La hoja de llamada se pliega en avión de papel y vuela a una fila de avatares que se iluminan. | Alivio colectivo | **Callback**: los mismos pings del inicio, ahora alegres y ordenados, uno por avatar, a tempo. |
| 12 | 46,90 | 2,2 | «Y entonces… llega el día.» | — | Se apagan las luces de la mesa. Solo queda un piloto rojo REC (#f0503f) parpadeando. | Tensión, solemnidad | La música cae a un pulso grave; *riser* empieza. |
| S4 | 49,10 | 1,8 | — (silencio de voz) | **UN DÍA.** / **UN EQUIPO.** / **UNA TOMA.** (0,6 s cada uno) | Tres cortes a negro con intertítulo, cada uno más grande. | Clímax que se acerca | Tres golpes en el beat sobre el *riser*. |
| 13a | 51,10 | 1,0 | «Preparados…» (susurrado) | — | Primer plano de la claqueta abierta; el ajolote la sostiene, apenas asoma por detrás. | Contención | *Riser* al máximo, todo lo demás fuera. |
| — | 52,10 | 0,7 | — (silencio) | — | Plano sostenido. Hasta la respiración se para. | Suspense | **Silencio total** (corte del riser en 52,10). |
| 13b | 52,80 | 0,7 | «¡Acción!» | — | La claqueta se cierra. | Explosión | **CLAC** exacto en 53,55 (fotograma del cierre). |
| S5 | 53,55 | 2,0 | — (silencio de voz) | — | 0,3 s de negro → flash blanco → montaje rápido del "día de rodaje en directo": escena marcada como rodada, toma 1, 2, 3… ✓ en verde (#4fc47f), contador de jornada avanzando. | Euforia | **Drop** de la música a plena potencia en 53,85. |
| 14 | 55,60 | 2,5 | «Del primer folio, al último plano.» | — | Rewind ultra rápido de todo el tráiler en miniatura que se condensa en el logo. | Síntesis | La música mantiene; *whoosh* inverso en el rewind. |
| 15 | 58,40 | 3,9 | «Versión definitiva. Taller. Tu película empieza aquí.» | **Versión definitiva · Taller** / tagline: **Prepara la película. No el caos.** | Logo sobre negro con los cuatro geles alineados como una barra de progreso que se completa. Ajolote sentado en la «a» de Taller. | Cierre memorable, llamada a la acción | Acorde final y *button* (golpe de cierre) en 62,30. |
| S6 | 62,30 | 1,1 | — (silencio) | (CTA abajo) **Empieza tu primer proyecto** | Logo quieto. Solo el piloto de las branquias "respira". | Poso | Cola de reverb del acorde. |
| 16 | 63,40 | 1,6 | «¿Otra, por seguridad?» | — | **Stinger**: el ajolote vuelve a asomar con una claqueta en miniatura, mira a cámara, ladea la cabeza. | Guiño cinéfilo, sonrisa final | Mini-*clac* de claqueta en 65,10. |
| — | 65,10 | 0,4 | — | — | Corte a negro. | — | Silencio. **FIN 65,5 s.** |

### 2.1 · Locución completa (para comprobar el ritmo leyéndola en voz alta)
> Cuarenta guasaps. Tres éxcels. Y nadie sabe quién trae la escalera.
> *(silencio)*
> Vale. Respira. Yo me encargo.
> *(DEL CAOS…)*
> Tú solo, dame el guion.
> *(silencio)*
> En segundos, sé cuántas escenas tienes, quién sale, y dónde.
> Todo tu rodaje, en una sola mesa.
> Lo que falta, te lo chivo yo.
> *(…AL ORDEN…)*
> ¿Una taza? ¿Un abrigo rojo? ¿Un coche de los ochenta? Apuntado.
> Tú me dices cómo lo ves, plano a plano.
> *(silencio)*
> Y el estoribord, sale solo.
> Luego, le damos alma. Luz, color, referencias.
> *(…A LA MAGIA.)*
> Organizo las jornadas. Y la hoja de llamada, vuela a todo el equipo.
> Y entonces… llega el día.
> *(UN DÍA. UN EQUIPO. UNA TOMA.)*
> Preparados… *(silencio)* ¡Acción!
> *(silencio, drop)*
> Del primer folio, al último plano.
> Versión definitiva. Taller. Tu película empieza aquí.
> *(silencio)*
> ¿Otra, por seguridad?

Total locutado ≈ 47 s · silencios de voz ≈ 14 s · intertítulos sin voz: 7.

### 2.2 · Arco y cobertura de funciones
| Fase | Tiempo | Gel dominante | Funciones (contadas como beneficio) |
|---|---|---|---|
| Caos | 0–8,8 | desaturado, sin gel | el dolor: guasaps, excels, papeles |
| Orden | 8,8–29 | #ece8dc → #f0c94a | subir guion + lectura IA · Mesa de preparación · Desglose |
| Magia | 29–46,9 | #f0c94a → pad cálido | Planos + storyboard automático · Moodboard/Biblia visual · Plan por jornadas + hoja de llamada |
| El gran día | 46,9–55,6 | #f0503f | Día de rodaje en directo |
| Entrega | 55,6–65,5 | #4fc47f en la barra del logo | marca, tagline, CTA |

### 2.3 · Notas para el TTS (Kokoro `ef_dora`)
- **Grafía fonética** (la pantalla usa la correcta, el TTS la fonética):
  - whatsapps → `guasaps`
  - Excel → `éxcels`
  - storyboard → `estoribord`
  - «Versión definitiva» y «Taller» se leen bien tal cual; separar con punto para que haga pausa y baje la entonación.
- **Puntos > comas** en las enumeraciones del gancho (línea 1): Kokoro aplica una pausa más larga y una caída de tono que suena a "remate", que es lo que buscamos.
- `…` (puntos suspensivos) en 12 y 13a: si Kokoro los ignora, generar «Y entonces.» y «llega el día.» como dos WAV separados por 0,35 s.
- **13a «Preparados…»**: generar a `speed 0.85` y bajar ganancia −6 dB para que suene a susurro; **13b «¡Acción!»** a `speed 1.1` y +2 dB.
- **16 «¿Otra, por seguridad?»**: `speed 0.95`; es el chiste de rodaje ("otra por seguridad" es la frase real del set), que llegue con calma.
- Si una línea se pasa de su hueco más de 0,3 s, recortar texto antes que acelerar el TTS (por encima de `speed 1.15` la voz pierde lo cuco).
- Ducking de la música −8 dB bajo cada línea; en los silencios S1, S3 y S5 la música manda.

### 2.4 · Kinetic type (intertítulos)
- Fuente: **Archivo** variable, `font-variation-settings: "wdth" 62, "wght" 900`, mayúsculas, color #f1eee6 sobre #0b0b0d, ~22 vh de alto.
- Entrada: `letter-spacing` de 0.4em → -0.02em + `opacity` 0→1 en 0,45 s, `ease: "expo.out"`; los puntos suspensivos aparecen uno a uno (0,08 s).
- Salida: corte seco (sin fade) justo en el siguiente golpe de música: el corte seco es lo que da el sabor de tráiler.
- DEL CAOS / AL ORDEN / A LA MAGIA comparten posición y tamaño: se leen como **una sola frase** repartida en el tiempo.
- UN DÍA / UN EQUIPO / UNA TOMA: escala 1,0 → 1,15 → 1,3 entre cortes, 0,6 s cada uno, en el beat.
- Rótulos funcionales (MESA DE PREPARACIÓN, STORYBOARD…): JetBrains Mono 500, 14–18 px equivalente, tracking 0.2em, en una esquina, con el gel de la fase como punto de color. Nunca compiten con el intertítulo grande.

---

## 3 · Taglines alternativas
1. **«Prepara la película. No el caos.»** (la elegida: contrasta con el gancho y cierra el arco)
2. «Del caos, a ¡acción!»
3. «Tú pon la mirada. El Taller pone el orden.»

Stinger alternativo (guiño a *Casablanca*), si «¿Otra, por seguridad?» no funciona en el TTS: «Creo que esto es el comienzo, de una hermosa amistad.» (≈3,9 s; alarga el final hasta ~67,8 s, sigue dentro del límite).
