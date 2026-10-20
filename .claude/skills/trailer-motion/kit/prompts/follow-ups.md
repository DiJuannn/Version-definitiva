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
