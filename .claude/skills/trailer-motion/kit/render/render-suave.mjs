// Render «suave»: desenfoque de movimiento + antialiasing reales promediando N muestras por fotograma
// (método Claw Machine: muestras dentro de un obturador de 0,45 fotogramas, desplazamiento sub-píxel, media en luz lineal).
//
// La página tiene que exponer   window.renderAt(t, { jx, jy })   que dibuja el instante t (s) de forma determinista;
// jx/jy (−0,5…0,5 px) es el desplazamiento sub-píxel de cámara (en Three.js: cam.setViewOffset(W,H,jx,jy,W,H); null → clearViewOffset()).
// Las capas DOM (títulos) entran en la captura, así que también se promedian.
//
// Uso:
//   node render-suave.mjs <url> <salida.mp4> [--fps 30] [--desde 0] [--hasta 12] [--muestras 6] [--obturador 0.45]
//                         [--ancho 1920] [--alto 1080] [--audio banda.wav] [--grano 0.6]
// Las muestras se mezclan en mezclar-muestras.py (numpy) y salen por tubería a ffmpeg (H.264 CRF 17, yuv420p).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const [url, out] = argv;
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i > 0 ? argv[i + 1] : d; };
const FPS = +opt("fps", 30), T0 = +opt("desde", 0), T1 = +opt("hasta", NaN), N = +opt("muestras", 6), SH = +opt("obturador", 0.45);
const W = +opt("ancho", 1920), H = +opt("alto", 1080), AUDIO = opt("audio", null), GRANO = opt("grano", "0.6");
if (!url || !out || !Number.isFinite(T1)) { console.error("uso: node render-suave.mjs <url> <salida.mp4> --hasta <s> [...]"); process.exit(1); }

// muestras: tiempo dentro del obturador (centrado en el fotograma) + jitter sub-píxel (secuencia R2, sin aleatorio)
const g = 1.32471795724474602596, a1 = 1 / g, a2 = 1 / (g * g);
const S = Array.from({ length: N }, (_, i) => ({ dt: N > 1 ? ((i + 0.5) / N - 0.5) * SH / FPS : 0, jx: ((0.5 + a1 * i) % 1) - 0.5, jy: ((0.5 + a2 * i) % 1) - 0.5 }));

const here = path.dirname(fileURLToPath(import.meta.url));
const mix = spawn("python3", ["-I", path.join(here, "mezclar-muestras.py"), String(W), String(H), String(N), GRANO], { stdio: ["pipe", "pipe", "inherit"] });
const ffArgs = ["-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-"];
if (AUDIO) ffArgs.push("-ss", String(T0), "-t", String(T1 - T0), "-i", AUDIO);
ffArgs.push("-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
if (AUDIO) ffArgs.push("-c:a", "aac", "-b:a", "320k", "-shortest");
ffArgs.push(out);
const ff = spawn("ffmpeg", ffArgs, { stdio: ["pipe", "inherit", "inherit"] });
mix.stdout.pipe(ff.stdin);

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on("pageerror", (e) => console.error("ERR", e.message));
await p.goto(url);
await p.waitForFunction(() => typeof window.renderAt === "function", null, { timeout: 60000 });

const frames = Math.round((T1 - T0) * FPS), t00 = Date.now();
const write = (buf) => new Promise((res) => { const len = Buffer.alloc(4); len.writeUInt32LE(buf.length); mix.stdin.write(len); mix.stdin.write(buf) ? res() : mix.stdin.once("drain", res); });
for (let f = 0; f < frames; f++) {
  const t = T0 + f / FPS;
  for (const s of S) {
    await p.evaluate(([tt, jx, jy]) => window.renderAt(tt, { jx, jy }), [Math.max(0, t + s.dt), N > 1 ? s.jx : 0, N > 1 ? s.jy : 0]);
    await write(await p.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }));
  }
  if (f % 15 === 0) process.stderr.write(`\r${f + 1}/${frames} fotogramas · ${((Date.now() - t00) / 1000 / (f + 1)).toFixed(2)} s/fotograma   `);
}
mix.stdin.end(); await b.close();
await new Promise((res) => ff.on("close", res));
console.error(`\nlisto: ${out} (${frames} fotogramas × ${N} muestras)`);
