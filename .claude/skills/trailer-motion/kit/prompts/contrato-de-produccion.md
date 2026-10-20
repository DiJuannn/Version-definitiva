# Contrato de producción (plantilla para cualquier vídeo de motion)

El prompt bueno no es «haz un vídeo viral». Es un contrato con bloques fijos, compuertas de revisión y condiciones de parada. Solo cambias el bloque **MARCA**; todo lo demás usa los nombres que define ese bloque.

```
MARCA (lo único que se cambia de un proyecto a otro)
  HÉROE:     quién provoca la acción. Mascota, mano, cursor o la propia tipografía.
             Medidas y colores exactos (hex).
  PRODUCTO:  la app, la obra o el servicio. Paneles y estados reales, con sus etiquetas.
             Sin logos inventados.
  RESULTADO: qué queda construido al final, lo que el espectador se lleva.
  MUNDO:     superficie y materiales del mundo del cliente (mesa de luz, papel, tinta…).
  PALETA:    3–5 hex con su uso. Nada de franjas ni degradados de color si la marca lo prohíbe.
  HECHOS:    lo que NO se puede inventar: textos reales, créditos y el papel de cada uno,
             cifras, fechas. Si falta un dato, se marca [CONFIRMAR] y no sale en imagen.

FORMATO
  1080×1920 (o 1920×1080) · 30 fps · duración exacta · BPM elegido para que
  N compases llenen la duración. Una única tabla de tiempos y posiciones
  (cues.js / timeline.py) que leen la imagen, el audio y los textos.

BEATS (segundos; cada beat con estado de entrada → estado de salida → por qué existe)
  0,0–2,0  gancho: el primer fotograma ya es un póster
  …
  (si un beat no cambia nada en pantalla, se corta)

CÁMARA
  Cómo se mueve y por qué. Una toma que acompaña al héroe, latigazos a cada objetivo,
  final en el resultado solo.

LOOK
  Una línea con lo que más se rompe: contraste, legibilidad, el color que tiene que
  sobrevivir. Grano solo si no se dispara el bitrate.

REGLAS DE MOVIMIENTO (una por clase de objeto)
  control pequeño: chasquea · panel grande: se asienta · cámara: lenta, sin desorientar ·
  titular: entra rápido y se QUEDA lo bastante para leerse (≥ 1,2 s) · el logo nunca quieto.

COMPUERTAS (no se avanza sin evidencia)
  G1  lista de assets reales revisada; si falta uno, PARAR y preguntar (nunca dibujar uno falso)
  G2  hoja de contactos de cada sección (un fotograma por beat) antes de integrar
  G3  18 fotogramas del montaje entero a media resolución antes del render final
  G4  render + sonoridad por medio segundo + fotogramas consecutivos en las transiciones rápidas
  G5  variantes de formato compuestas de nuevo, nunca un recorte del centro
```

Notas:
- **Separa hechos de decisiones.** El modelo puede inventar la cámara, pero no tu interfaz, tus créditos ni tu logo.
- **Dale una referencia que pueda inspeccionar** (un fotograma, un vídeo, un trabajo anterior) y pídele que escriba lo que ha aprendido como guía de estilo. Sin referencia, rellena con los mismos tópicos de siempre: texto grande en el centro, degradado y fundidos.
- **Muestra la lógica real del oficio:** keyframes que saltan a su pose, un cabezal que reproduce, CORTE / L-CUT / J-CUT en el beat. Quien conoce el programa sonríe al verlo.
