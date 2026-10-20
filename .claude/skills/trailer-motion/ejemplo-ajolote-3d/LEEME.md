# Ejemplo: el ajolote de Taller en 3D (12 s, 16:9, 30 fps)

Película de personaje en Three.js renderizada en la nube, sin GPU (WebGL2 por SwiftShader, ~0,4 s por fotograma con `npx hyperframes render`).

**La historia:**
1. El ajolote es una pegatina 2D en la pantalla del guion: llama desde dentro, se despega y salta en 3D.
2. Salta sobre las 3 escenas del guion (desglose).
3. Da un salto mortal al plan de rodaje, donde las escenas caen en las jornadas.
4. Pasa a la hoja de llamada y avisa al equipo (5/5).
5. La hoja se dobla en un avión de papel que vuela hasta la claqueta: ¡ACCIÓN!
6. Los paneles caen y aparece el título.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La escena, con `render(t)` como función pura. Incluye `window.renderAt(t, {jx, jy})` para `kit/render/render-suave.mjs` |
| `assets/cues.js` | La única fuente de verdad: tiempos (golpes en beats de 120 BPM), paneles (posición, tamaño, lienzo) y dónde aterriza el ajolote |
| `assets/ajolote3d.js` | El modelo, un juguete de vinilo hecho con primitivas, y `pose()`: squash, parpadeo, ojos felices, boca, branquias, brazos, cola, mirada… |
| `assets/panels.js` | Los 3 paneles de la app dibujados en `CanvasTexture`, que se redibujan en cada fotograma («la comp es un canvas») |
| `audio/build.py` | La banda sonora sintetizada (usa `kit/audio/sfxlib.py`), leída de `cues.js` |

## Para montarlo
1. Copia en `assets/`:
   - `three.min.js` de `three@0.149.0`: `npm pack three@0.149.0` → `build/three.min.js` (UMD).
   - `gsap.min.js`.
   - Las fuentes de `kit` §1 en `assets/fonts/` (`archivo.woff2`, `jbmono.woff2`, `courier-400.woff2`, `courier-700.woff2`).
2. Pon `sfxlib.py` junto a `audio/build.py` y ejecuta `python3 audio/build.py` (sale `assets/audio/banda.wav`).
3. Haz `npx hyperframes snapshot . --at 2.3,4.3,7,9.85,10.1 --no-end`, luego `npx hyperframes render` y normaliza el audio con loudnorm.

## Lecciones (y su arreglo)

| Problema | Arreglo |
|---|---|
| Los colores salían lavados | `THREE.ColorManagement.legacyMode = false`, `outputEncoding = sRGBEncoding` y tone mapping ACES |
| La pegatina se veía pálida | `toneMapped: false` en su material |
| La cola salía a bultos | 44 esferas solapadas a lo largo de una CatmullRom |
| Las branquias salían en púas | Foliolos aplanados |
| La cámara de seguimiento se retrasaba en los saltos rápidos (el ajolote se salía por arriba) | Promediar posiciones **centradas** en t, no pasadas |
| Faltó, frente al método Claw Machine | Aguante antes de ¡ACCIÓN!, *double take*, registro de choques y medición del rosa (salió más pálido que F2A9BB, ΔE ≈ 18) |

## Registro de choques (kit/checks/choques-3d.js) sobre este ejemplo
`window.__solidos` está en `index.html`. Pasada de 2 a 10,4 s, cada 2 fotogramas, con margen de 2 cm:

| Par | Cuándo | Cuánto se hunde | Qué es |
|---|---|---|---|
| ajolote × avión | 8,5–9,4 s | 15 cm | Va montado: subir el ajolote 0,15 sobre el avión |
| claqueta × avión | 9,73–9,87 s | 11 cm | El avión atraviesa los palos: desviar `planePath` por encima |
| ajolote × claqueta | 10,07 s | 2,6 cm | Aterrizaje justo: `stickY` +0,03 |
