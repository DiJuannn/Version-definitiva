import { chromium } from "playwright-core";

export const BASE = process.env.BASE_URL ?? "http://localhost:3100";
export const PW = "demo-corte-2026";
export const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export async function launch() {
  return chromium.launch({ executablePath: CHROME, args: ["--autoplay-policy=no-user-gesture-required"] });
}

export async function session(browser, email, { mobile = false } = {}) {
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror ${email}]`, e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("Failed to load resource")) console.log(`  [console ${email}]`, m.text());
  });
  if (email) {
    await page.goto(`${BASE}/entrar`);
    await page.fill("#email", email);
    await page.fill("#password", PW);
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 60000 }), page.click("button[type=submit]")]);
  }
  return { ctx, page };
}

export async function shot(page, name) {
  const file = `e2e/artifacts/${name}.png`;
  await page.screenshot({ path: file });
  return file;
}

export function step(msg) {
  console.log(`\n▶ ${msg}`);
}

export function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
  console.log(`  ✓ ${msg}`);
}
