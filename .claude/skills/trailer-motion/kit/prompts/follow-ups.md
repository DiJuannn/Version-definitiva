# Cómo escribir las correcciones (follow-ups)

Después de cada hoja de contactos o render: **lo que se ve → el cambio en números → qué se vuelve a renderizar.** Nada de «mejóralo».

Ejemplos reales (Clawd Motion Lab):
- «El destello son diez rayas finísimas: cada rayo, el doble de ancho. En el 3.er keyframe el título se sale por la derecha: esa pose, a 190 px a la derecha y al 100 %. OPUS 5.5 no se lee: 78 px.»
- «A media altura del salto se sale del cuadro por arriba: baja el vértice de 0,55 a 0,36 m. Vuelve a renderizar solo los fotogramas 105–145 y 285–360.»

Ejemplos reales (reels de JD Molina, mismas reglas):
- «El ritmo a veces es tan rápido que no se entiende» → toda la partitura × 1,25 (de 120 a 96 BPM). La música y la imagen se estiran juntas.
- «El JDM se quita muy rápido» y luego «dura mucho quieto» → pausa de 0,8 s CON animación (entran las esquinas del visor, empuje, cierre). Nunca un logo congelado.
- «Las imágenes de ESCRIBO y DIRIJO son muy largas» → corte de partitura de pulsos enteros (0,5·n s) para no romper el groove. Después se sustituyeron por motion graphics (páginas de guion que pasan, plano de planta).
- «El guion puede ser digital, no esa foto que se ve mal» → página de guion en HTML con el texto real, nítida.
- Datos: «la hora es la 1:39» → se comprueba en el guion (PDF) antes de tocar nada.

Reglas:
1. Una ronda corrige lo que se vio, en orden, y nada más.
2. Si el cambio solo afecta a un tramo, se vuelve a renderizar solo ese tramo (o se valida con snapshots en ese rango).
3. Tras cada corrección, hoja de contactos otra vez y comparar antes y después.

## Las 7 rondas del Claw Machine, por tipo de problema

Cada ronda empieza diciendo **qué evidencia se ha mirado** (las fotos, las tiras, el registro de choques, una medición) y sigue con lo que se ve y el cambio. Agrupadas para reutilizarlas:

| Tipo | Lo que se vio | La corrección (números o reglas) |
|---|---|---|
| **Física de partida** | Los peluches aparecen unos dentro de otros y salen volando; dos caen por la rampa mientras se asienta el montón | Aparecer repartidos en una capa escalonada, rampa cerrada mientras se asienta, los 3 peluches de la historia se dejan caer boca arriba **encima** del montón ya asentado |
| **El mecanismo** | La garra arrastra el montón; las pinzas bajan encima del peluche y no alrededor | Viajar más alto, balancearse menos; pinzas más largas y más abiertas; **apuntar para que el peluche, no la garra, acabe sobre la rampa** |
| **La cara tapada** | El montón tapa la cara del héroe desde dentro (aún en las rondas 5 y 6) | Peluches más pequeños (0,36 por píxel), franja de suelo libre delante de la cara, subir el taburete y los mandos 2,5 unidades y las cámaras interiores con ellos |
| **Choques** (registro: 76 pares) | Brazos dentro del joystick, pies dentro del taburete, el salto de victoria atraviesa el cristal, detrás de la trampilla hay carcasa maciza | Test de intersección por fotograma de **cada** pieza sólida; arreglar hasta que no registre nada: «things may touch, never sink in». Bajar los mandos, levantar un brazo cuando se hundiría, saltar primero hacia fuera, vaciar el conducto |
| **Color medido** | El héroe mide C6775D dentro y E58B68 / EB886A con luz: salmón en vez de D97757 | Calibrar el albedo con números (lineal 0,83 / 0,65 / 0,60) y volver a medir |
| **Cámara** | El primer plano del aguante se corta por el paso a cenital; la mirada a cámara está demasiado cerca; el golpe se ve de lado; una pinza cromada se convierte en un arcoíris a 14,8 s | Mantener el plano hasta que acabe la quietud y después subir; abrir a 32°; encuadrar la barandilla y la cara juntas y empujar en el golpe; alejar el macro, subir el umbral del bloom y bajar el reflejo más brillante del cromo |
| **Actuación** | La niebla del golpe es una banda blanca brillante; el baile de victoria se para en seco a 18,3 s; el parpadeo del peluche no se lee en un móvil | Mancha pequeña y tenue; suavizar la entrada y la salida; terminar con un empuje lento al abrazo, lo bastante bajo para que se vea la cara del peluche |
| **Encuadre de salida** | No se ve el peluche saliendo por la trampilla | Encuadrar desde delante-izquierda, luego desde la derecha y por fin desde arriba del taburete, hasta que se vean el brazo entrando y el peluche saliendo |

**Lección:** la mitad de las rondas son el **mismo problema** (la cara tapada, el encuadre de la trampilla) que vuelve. No se cierra hasta que la evidencia (foto o medición) lo demuestra resuelto.

### Lo mismo en nuestro ajolote 3D (sesión del 20-10-2026)
- «Al saltar del avión a la claqueta (9,7–9,95 s) el ajolote se sale por arriba del cuadro»:
  - La cámara de seguimiento promediaba posiciones **pasadas**, así que iba con retraso. Se cambió a un promedio **centrado** en t (`t + (i − 2,5)·0,05`).
  - La llave de 9,75 s se convirtió en seguimiento: `off [0,3; 0,75; 4,6]`.
  - La de 10,1 s se subió: `fix y 1,75 → 2,0`, `look y 1,25 → 1,5`.
  - Se comprobó con snapshots en 9,6 / 9,75 / 9,85 / 9,95 / 10,0 / 10,1 s.
