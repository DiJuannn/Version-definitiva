# Demo «Del guion al rodaje» (`/demo`)

Página pública con el ajolote de guía. Las pantallas son capturas de la app real; el guion (textos de la voz, capítulos y encuadres de la cámara) está en `lib/demo-script.ts`.

## Rehacer las capturas

Con la base de desarrollo y el servidor en marcha (`npm run dev`) y una sesión de prueba:

1. Completar el proyecto de ejemplo: `psql $DATABASE_URL -f scripts/demo/seed-distorsion.sql`
2. Capturar: `DEMO_IDS='{"screenplay":"…","scene1":"…","day1":"…"}' node scripts/demo/capture.mjs '<cookie de sesión JSON>'`
   - `directo` y `claqueta` se capturan con la jornada 1 en la fecha de hoy (`ONLY=directo,claqueta`); el resto, con su fecha.
3. Pasar a WebP: `for f in public/demo/shots/*.png; do ffmpeg -i "$f" -c:v libwebp -quality 82 "${f%.png}.webp"; done`

Si cambia el tamaño de una captura, actualizar `SHOT_SIZE` en `lib/demo-script.ts`.

## Voz del ajolote

Sin grabaciones, la página lee los textos con la voz del navegador (en Windows y Mac hay voces en español). Para la voz definitiva:

- **ElevenLabs:** `ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node scripts/demo/voz.mjs` genera `public/demo/voz/<id>.mp3` y `manifest.json`.
- **Grabada por una persona:** un MP3 por capítulo con el id del capítulo (`hola`, `guion`, `mesa`, `desglose`, `planos`, `moodboard`, `personajes`, `plan`, `rodaje`, `fin`) y añadir los ids a `public/demo/voz/manifest.json`.

Cada capítulo dura lo que dura su audio: la cámara y los subtítulos se ajustan solos.

## Vídeo

Se graba la propia página con Playwright (`recordVideo`) y se pasa a MP4 con ffmpeg. Para el vídeo con voz, montar los MP3 sobre la grabación (los capítulos empiezan uno tras otro con 1,1 s de pausa).
