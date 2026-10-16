// Capturas de la app real para la demo (/demo). Se lanza contra el servidor
// de desarrollo con el proyecto de ejemplo «Distorsión» completo (ver
// seed-distorsion.sql) y una sesión de prueba:
//   node scripts/demo/capture.mjs [cookie de sesión]
// Escribe public/demo/shots/<nombre>.png (luego se pasan a WebP).

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(process.env.PLAYWRIGHT_REQUIRE ?? import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.DEMO_BASE ?? "http://localhost:3000";
const OUT = "public/demo/shots";
const [, , cookieArg] = process.argv;
const ids = JSON.parse(process.env.DEMO_IDS ?? "{}");

// nombre, ruta, opciones: alto de la captura (para recorrerla con la cámara),
// paso previo (clic, localStorage…).
const SHOTS = [
  ["inicio", "/app", { height: 1000 }],
  ["guion", `/app/guiones/${ids.screenplay}?paso=guion`, { height: 1000, storage: { "sp-panel": "radiografia" } }],
  ["mesa", `/app/proj-dis`, { height: 1500 }],
  ["desglose", `/app/proj-dis/desglose?escena=${ids.scene1}`, { height: 1200 }],
  ["planos", `/app/proj-dis/shot-list?escena=${ids.scene1}`, { height: 1300 }],
  ["tecnico", `/app/proj-dis/shot-list?vista=tecnico`, { height: 1300 }],
  ["storyboard", `/app/proj-dis/storyboard`, { height: 1200 }],
  ["moodboard", `/app/proj-dis/moodboard`, { height: 1000 }],
  ["biblia", `/app/proj-dis/moodboard?vista=biblia`, { height: 1800 }],
  ["personajes", `/app/proj-dis/personajes`, { height: 1300 }],
  ["plan", `/app/proj-dis/plan-de-rodaje`, { height: 1300 }],
  ["hoja", `/app/proj-dis/call-sheets/${ids.day1}`, { height: 1500 }],
  ["directo", `/app/proj-dis/plan-de-rodaje/directo?dia=${ids.day1}`, { height: 1400 }],
  ["claqueta", `/app/proj-dis/claqueta`, { height: 1000 }],
  ["resumen", `/app/proj-dis/resumen`, { height: 1400 }],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const only = process.env.ONLY?.split(",");
for (const [name, path, opts] of SHOTS) {
  if (only && !only.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25, colorScheme: "dark" });
  if (cookieArg) await ctx.addCookies([JSON.parse(cookieArg)]);
  if (opts.storage) await ctx.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)), opts.storage);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180_000);
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  // Sin el indicador de desarrollo de Next.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.setViewportSize({ width: 1440, height: opts.height });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await ctx.close();
  console.log("✓", name);
}
await browser.close();
