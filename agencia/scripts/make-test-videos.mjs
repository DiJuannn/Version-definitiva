// Genera vídeos de prueba deterministas (número de fotograma y timecode
// impresos en cada imagen) para tests y demo. Uso: node scripts/make-test-videos.mjs
// Requiere Chromium (Playwright) y un ffmpeg con libvpx.
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const FFMPEG = process.env.FFMPEG_PATH ?? "/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux";
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = new URL("../test-media/", import.meta.url).pathname;
const FPS = 25;
const SECONDS = Number(process.env.SECONDS ?? 20);

const variants = [
  { name: "horizontal-16x9", w: 1280, h: 720, hue: 210 },
  { name: "vertical-9x16", w: 720, h: 1280, hue: 30 },
  { name: "square-1x1", w: 720, h: 720, hue: 140 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setContent("<canvas id=c></canvas>");

for (const v of variants) {
  for (const suffix of ["", "-v2"]) {
    const file = `${OUT}${v.name}${suffix}.webm`;
    // Este ffmpeg no admite stdin: los JPEG se escriben a un archivo intermedio.
    const frames = path.join(tmpdir(), `frames-${v.name}${suffix}.mjpeg`);
    const out = createWriteStream(frames);
    const total = FPS * SECONDS;
    for (let f = 0; f < total; f++) {
      const b64 = await page.evaluate(
        ({ w, h, hue, f, fps, label }) => {
          const c = document.getElementById("c");
          c.width = w;
          c.height = h;
          const g = c.getContext("2d");
          const t = f / fps;
          g.fillStyle = `hsl(${hue + (f % 50)}, 45%, 22%)`;
          g.fillRect(0, 0, w, h);
          // Barras de color en la parte superior
          const bars = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];
          bars.forEach((col, i) => { g.fillStyle = col; g.fillRect((i * w) / 7, 0, w / 7 + 1, h * 0.12); });
          // Cuadrícula de referencia (para comprobar anotaciones)
          g.strokeStyle = "rgba(255,255,255,0.18)";
          for (let i = 1; i < 4; i++) {
            g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.stroke();
            g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke();
          }
          // Objeto que se mueve
          const x = ((Math.sin(t * 1.3) + 1) / 2) * (w - 120) + 60;
          g.fillStyle = "#FFD23F";
          g.beginPath(); g.arc(x, h * 0.62, Math.min(w, h) * 0.06, 0, Math.PI * 2); g.fill();
          const ss = Math.floor(t), ff = f % fps;
          const tc = `00:00:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
          g.fillStyle = "#fff";
          g.font = `bold ${Math.round(Math.min(w, h) * 0.11)}px monospace`;
          g.textAlign = "center";
          g.fillText(`F${String(f).padStart(4, "0")}`, w / 2, h * 0.36);
          g.font = `${Math.round(Math.min(w, h) * 0.06)}px monospace`;
          g.fillText(tc, w / 2, h * 0.46);
          g.fillText(label, w / 2, h * 0.9);
          return c.toDataURL("image/jpeg", 0.85).split(",")[1];
        },
        { ...v, f, fps: FPS, label: `${v.name}${suffix ? " · V2" : ""}` },
      );
      if (!out.write(Buffer.from(b64, "base64"))) await new Promise((r) => out.once("drain", r));
    }
    await new Promise((r) => out.end(r));
    const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", frames, "-c:v", "libvpx", "-b:v", "1500k", "-g", String(FPS), "-auto-alt-ref", "0", file], { stdio: "inherit" });
    await new Promise((res, rej) => ff.on("exit", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg ${code}`)))));
    rmSync(frames, { force: true });
    console.log("ok", file);
  }
}
await browser.close();
