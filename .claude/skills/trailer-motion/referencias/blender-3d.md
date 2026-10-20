# Cuándo y cómo pasar a 3D (Blender), según el método Clawd Motion Lab

Los dos PDF de esta carpeta (`clawd-no-after-effects.pdf`, `clawd-neon-jump.pdf`) son películas de personaje en 3D real: Blender 5 por Python, Cycles en GPU y sonido sintetizado con numpy. Usan la misma filosofía que nuestra skill: una tabla de tiempos única, revisión por hojas de contactos y correcciones con números. Cambia el motor.

## ¿Lo necesitamos?
- **No**, para lo que hacemos casi siempre: reels de marca, tipografía, UI, guion, fotos reales y créditos. HyperFrames + GSAP es más rápido, más editable y no necesita GPU.
- **Sí**, cuando el plano exige volumen, luz o física de verdad: una mascota que sale de la pantalla en 3D, un coche, un mundo por el que se vuela.
- **Requisitos:** Blender 5, una GPU NVIDIA (OptiX) y ffmpeg. En esta sesión en la nube no hay ninguno de los dos primeros, así que el 3D se hace en el PC del usuario con Claude Code local.

## Las técnicas que se copian (aunque sigamos en 2D)
1. **Construir la UI en HTML** y capturarla a 3× como textura: nítida como la app real y con cada píxel conocido. Nosotros ya lo hacemos con los mockups de Taller.
2. **Un layout, tres lectores:** la misma tabla guarda las posiciones de los botones en píxeles de UI y todos los eventos. La leen el HTML, la escena y el sonido. En HyperFrames corresponde a `CUES.layout` + `CUES.hits`.
3. **Losas, no captura:** cada panel es una pieza propia, para poder encenderla, pulsarla o hacerla caer sola.
4. **El resultado se dibuja por fotograma a partir del tiempo del cabezal**, así los keyframes y el cabezal siguen la lógica real del programa.
5. **Cada salto cambia algo.** Un movimiento que no pulsa nada se corta.
6. **Para el bucle, repetir el mundo:** un tramo instanciado varias veces, de modo que el fotograma 1 y el N+1 son el mismo sitio. El tempo se elige para que N compases llenen la duración, y el despegue y el aterrizaje caen en beats.
7. **El slow-mo reduce la distancia, no la gravedad:** se remapea cuánto ha avanzado y el arco no se deforma.
8. **El audio de un bucle:** se renderizan tres vueltas y se queda la del medio, así las colas enlazan con el principio. Los ciclos del motor tienen que completarse en número entero.

## Lecciones de luz (solo 3D)
- **Cristal brillante y luces de área grandes se pelean:** las luces se reflejan como bloques blancos. Hay que esconderlas de los rayos glossy, bajar el especular de la UI a 0,1 y subir la rugosidad a 0,32.
- **Una luz de relleno pequeña que viaja con el héroe** y apunta a su cara. El neón solo pinta reflejos.
- **Exposición:** si el color de marca sale lavado (salmón en lugar de terracota), se baja la exposición y se oscurece el color base hasta que el render dé el hex.

## Comandos (en el PC con GPU)
```
blender -b --factory-startup -P scene.py            # construye el .blend a partir del script
blender -b escena.blend -P gpu.py -f 120            # gpu.py activa OptiX: es una preferencia del usuario y NO viaja en el .blend
# primero 9–18 fotogramas a 50 % y 40–48 muestras, como hoja de contactos; después el render completo
ffmpeg -framerate 30 -i f%04d.png -i banda.wav -c:v libx264 -profile:v high -crf 17 -pix_fmt yuv420p -c:a aac -b:a 320k -movflags +faststart out.mp4
```
- **Grano por fotograma:** no se lo pongas. El encoder no lo puede compartir entre fotogramas y el archivo pasó de 29 a 118 MB. Viñeta suave sí.
