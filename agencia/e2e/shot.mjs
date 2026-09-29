// Captura pantallas autenticadas: node e2e/shot.mjs <email> <ruta> [nombre] [--mobile]
import { chromium } from "playwright-core";

const [email, route, name = "shot", ...flags] = process.argv.slice(2);
const mobile = flags.includes("--mobile");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext(
  mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
);
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
if (email && email !== "-") {
  await page.goto(`${BASE}/entrar`);
  await page.fill("#email", email);
  await page.fill("#password", process.env.PW ?? "demo-corte-2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 30000 }), page.click("button[type=submit]")]);
}
await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(process.env.WAIT ?? 400));
const file = `e2e/artifacts/${name}${mobile ? "-m" : ""}.png`;
await page.screenshot({ path: file, fullPage: process.env.FULL === "1" });
console.log(file);
await browser.close();
