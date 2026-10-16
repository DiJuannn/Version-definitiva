// Genera la voz del ajolote para la demo con ElevenLabs: un MP3 por capítulo
// en public/demo/voz/<id>.mp3 y el manifest.json que la página lee.
//   ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node scripts/demo/voz.mjs
// Los textos salen de lib/demo-script.ts (el mismo guion que los subtítulos).
// Sin grabaciones, la demo usa la voz del navegador.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID;
if (!key || !voice) {
  console.error("Faltan ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID.");
  process.exit(1);
}

// Lee id y voice de cada capítulo directamente del guion.
const src = readFileSync("lib/demo-script.ts", "utf8");
const chapters = [...src.matchAll(/id: "([^"]+)",[\s\S]*?voice: "([^"]+)"/g)].map((m) => ({ id: m[1], text: m[2] }));

mkdirSync("public/demo/voz", { recursive: true });
const done = [];
for (const { id, text } of chapters) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    console.error(`✗ ${id}: ${res.status} ${await res.text()}`);
    continue;
  }
  writeFileSync(`public/demo/voz/${id}.mp3`, Buffer.from(await res.arrayBuffer()));
  done.push(id);
  console.log("✓", id);
}
writeFileSync("public/demo/voz/manifest.json", JSON.stringify({ voces: done }, null, 2) + "\n");
console.log(`${done.length} de ${chapters.length} capítulos con voz.`);
