// Recorrido completo en navegador real (Chromium) contra un servidor en marcha.
// Crea sus propios datos con un sufijo único: no toca proyectos existentes.
// Uso: npm run e2e   (BASE_URL=http://localhost:3100 por defecto)
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { assert, BASE, launch, PW, session, shot, step } from "./lib.mjs";

// Las pruebas inician sesión muchas veces: se reinician SOLO los contadores de
// intentos de login (el límite sigue activo y se prueba en los tests unitarios).
{
  const db = new PrismaClient();
  await db.rateLimit.deleteMany({ where: { key: { startsWith: "login:" } } });
  await db.$disconnect();
}

const RUN = Date.now().toString(36);
const MEDIA = new URL("../test-media/", import.meta.url).pathname;
if (!existsSync(`${MEDIA}vertical-9x16.webm`)) {
  console.error("Faltan los vídeos de prueba: ejecuta `npm run media:test`.");
  process.exit(1);
}

const coordEmail = `coord-${RUN}@e2e.test`;
const editorEmail = `editor-${RUN}@e2e.test`;
const clientEmail = `cliente-${RUN}@e2e.test`;
const client2Email = `cliente2-${RUN}@e2e.test`;
const userPw = `Clave-${RUN}-2026`;

const b = await launch();
const results = [];
const pages = {};
const check = (cond, msg) => {
  assert(cond, msg);
  results.push(msg);
};

async function login(email, pw = userPw, opts) {
  const { ctx, page } = await session(b, null, opts);
  await page.goto(`${BASE}/entrar`);
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 60000 }), page.click("button[type=submit]")]);
  pages[email] = page;
  return { ctx, page };
}

async function seek(page, s) {
  await page.evaluate((t) => {
    const v = document.querySelector("video");
    v.pause();
    v.currentTime = t;
  }, s);
  await page.waitForFunction((t) => Math.abs(document.querySelector("video").currentTime - t) < 0.2, s);
  await page.evaluate(() => document.activeElement?.blur());
}

async function waitVideo(page) {
  await page.waitForFunction(() => {
    const v = document.querySelector("video");
    return v && v.readyState >= 2 && v.videoWidth > 0;
  }, null, { timeout: 30000 });
}

async function sendComment(page, text) {
  await page.fill("#composer textarea", text);
  await page.click("#composer button:has-text('Enviar')");
  await page.waitForSelector(`article:has-text("${text.slice(0, 30)}")`, { timeout: 15000 });
}

async function api(page, path, init) {
  return page.evaluate(
    async ({ path, init }) => {
      const r = await fetch(path, init);
      let body = null;
      try {
        body = await r.json();
      } catch {
        /* sin cuerpo JSON */
      }
      return { status: r.status, body };
    },
    { path, init },
  );
}

try {
  // ─── 1. Administración crea usuarios, clientes y proyecto ──────────────
  step("1. Administración crea clientes, usuarios y proyecto");
  const { page: admin } = await session(b, "admin@demo.test");
  for (const name of [`Cliente E2E ${RUN}`, `Otro cliente ${RUN}`]) {
    await admin.goto(`${BASE}/clientes/nuevo`);
    await admin.fill("#c-name", name);
    await admin.fill("#c-email", `contacto-${RUN}@e2e.test`);
    await Promise.all([admin.waitForURL(/\/clientes\/(?!nuevo)[a-z0-9]+$/), admin.click("button:has-text('Crear cliente')")]);
  }
  await admin.goto(`${BASE}/ajustes`);
  const createUser = async (name, email, role, clientName) => {
    await admin.fill("#u-name", name);
    await admin.fill("#u-email", email);
    await admin.selectOption("#u-role", role);
    if (clientName) {
      const v = await admin.locator("#u-client option", { hasText: clientName }).getAttribute("value");
      await admin.selectOption("#u-client", v);
    }
    await admin.fill("#u-pw", userPw);
    await admin.click("button:has-text('Crear usuario')");
    await admin.waitForSelector(`text=${email}`);
  };
  await createUser(`Coordinadora ${RUN}`, coordEmail, "COORDINATOR");
  await createUser(`Editor ${RUN}`, editorEmail, "EDITOR");
  await createUser(`Clienta ${RUN}`, clientEmail, "CLIENT", `Cliente E2E ${RUN}`);
  await createUser(`Cliente dos ${RUN}`, client2Email, "CLIENT", `Otro cliente ${RUN}`);
  check(true, "Usuarios creados desde Ajustes (coordinación, edición, dos clientes)");

  await admin.goto(`${BASE}/proyectos/nuevo`);
  await admin.selectOption("#clientId", await admin.locator("#clientId option", { hasText: `Cliente E2E ${RUN}` }).getAttribute("value"));
  await admin.fill("#name", `Proyecto E2E ${RUN}`);
  await admin.selectOption("#coordinatorId", await admin.locator("#coordinatorId option", { hasText: `Coordinadora ${RUN}` }).getAttribute("value"));
  await Promise.all([admin.waitForURL(/\/proyectos\/(?!nuevo)[a-z0-9]+$/), admin.click("button:has-text('Crear proyecto')")]);
  const projectUrl = admin.url();
  const projectId = projectUrl.split("/").pop();
  await admin.click("button:has-text('Añadir pieza')");
  await admin.fill("#piece-title", `Reel vertical ${RUN}`);
  await admin.selectOption("#piece-ar", "9:16");
  await admin.click("button:has-text('Crear pieza')");
  await admin.waitForSelector(`a:has-text("Reel vertical ${RUN}")`);
  const pieceHref = await admin.locator(`a:has-text("Reel vertical ${RUN}")`).getAttribute("href");
  const pieceId = pieceHref.split("/").pop();
  check(!!projectId && !!pieceId, "Proyecto y pieza creados");
  await shot(admin, "e2e-01-project");

  // ─── 2. Coordinación asigna editor ─────────────────────────────────────
  step("2. Coordinación asigna editor");
  const { page: coord } = await login(coordEmail);
  await coord.goto(`${BASE}/inicio`);
  check(await coord.locator(`text=Reel vertical ${RUN}`).first().isVisible(), "La pieza sin asignar aparece en Próximas acciones de coordinación");
  await coord.goto(`${BASE}${pieceHref}`);
  await coord.selectOption("#editorId", await coord.locator("#editorId option", { hasText: `Editor ${RUN}` }).getAttribute("value"));
  await coord.click("button:has-text('Asignar')");
  await coord.waitForSelector("text=Editor asignado");
  check(await coord.locator("text=Asignada").first().isVisible(), "Estado de la pieza: Asignada");

  // ─── 3. Editor publica una versión (V1 interna) ───────────────────────
  step("3. Editor sube V1");
  const { page: ed } = await login(editorEmail);
  await ed.goto(`${BASE}/inicio`);
  check(await ed.locator(`text=Reel vertical ${RUN}`).first().isVisible(), "El editor ve la pieza en «Ahora»");
  await ed.goto(`${BASE}${pieceHref}`);
  await ed.click("button:has-text('Empezar a editar')");
  await ed.waitForSelector("text=Subir V1");
  await ed.setInputFiles("input[aria-label='Archivo de vídeo']", `${MEDIA}vertical-9x16.webm`);
  await ed.waitForSelector("text=Subido y verificado", { timeout: 60000 });
  await ed.fill("#summary", "Primer montaje.");
  await ed.selectOption("#fps", "25");
  await Promise.all([ed.waitForURL(/\/revision\//, { timeout: 30000 }), ed.click("button:has-text('Crear V1')")]);
  const v1 = ed.url().split("/revision/")[1].split("?")[0];
  await waitVideo(ed);
  check(await ed.locator("text=Versión interna").isVisible(), "V1 se abre como versión interna");

  // ─── 4. Coordinación revisa internamente y publica ────────────────────
  step("4. Revisión interna y publicación");
  await coord.goto(`${BASE}/revision/${v1}`);
  await waitVideo(coord);
  await seek(coord, 1);
  await sendComment(coord, "Nota interna: subir el logo antes de enseñarlo");
  check(await coord.locator("article:has-text('Nota interna') >> text=Interno").isVisible(), "El comentario en versión no publicada queda marcado como interno");
  await coord.click("header button:has-text('Publicar al cliente')");
  await coord.click("dialog button:has-text('Publicar')");
  await coord.waitForSelector("text=Publicada al cliente");
  await shot(coord, "e2e-04-published");

  // ─── 5. Cliente accede a la versión publicada ─────────────────────────
  step("5. Cliente accede a la versión publicada");
  const { page: cl } = await login(clientEmail);
  await cl.goto(`${BASE}/inicio`);
  check(await cl.locator(`text=Reel vertical ${RUN}`).first().isVisible(), "El cliente ve la pieza en «Listo para revisar»");
  await cl.click("a:has-text('Revisar vídeo')");
  await cl.waitForURL(/\/revision\//);
  await waitVideo(cl);
  check(!(await cl.locator("text=Nota interna").count()), "El cliente NO ve el comentario interno (UI)");
  const payloadClient = await api(cl, `/api/review/${v1}`);
  check(payloadClient.status === 200 && payloadClient.body.comments.every((c) => c.visibility === "CLIENT"), "El cliente NO recibe comentarios internos (API)");

  // ─── 6. Cliente comenta instante, tramo y nota general ────────────────
  step("6. Comentarios de instante, tramo y general");
  await seek(cl, 2);
  await sendComment(cl, "Aquí el texto entra demasiado pronto");
  await seek(cl, 4);
  await cl.keyboard.press("i");
  await seek(cl, 7);
  await cl.keyboard.press("o");
  await sendComment(cl, "Este tramo va lento, recortar");
  await cl.click("#composer [role=radio]:has-text('General')");
  await sendComment(cl, "En general me gusta mucho el ritmo");

  // ─── 7. Cliente dibuja sobre el vídeo ─────────────────────────────────
  step("7. Dibujo sobre la imagen");
  await seek(cl, 10);
  await cl.click("#composer [role=radio]:has-text('Instante')");
  await cl.click("#composer button:has-text('Dibujar')");
  await cl.click("[aria-label='Flecha']");
  const surf = await cl.locator("[aria-label='Zona de dibujo sobre el vídeo']").boundingBox();
  await cl.mouse.move(surf.x + surf.width * 0.25, surf.y + surf.height * 0.3);
  await cl.mouse.down();
  await cl.mouse.move(surf.x + surf.width * 0.5, surf.y + surf.height * 0.55, { steps: 8 });
  await cl.mouse.up();
  await cl.click("[aria-label='Rectángulo']");
  await cl.mouse.move(surf.x + surf.width * 0.55, surf.y + surf.height * 0.55);
  await cl.mouse.down();
  await cl.mouse.move(surf.x + surf.width * 0.8, surf.y + surf.height * 0.7, { steps: 6 });
  await cl.mouse.up();
  await cl.click("[aria-label='Deshacer']");
  await cl.click("[aria-label='Rehacer']");
  await cl.click("button:has-text('Listo')");
  await sendComment(cl, "La pelota debería estar más a la izquierda");
  const p6 = await api(cl, `/api/review/${v1}`);
  const drawn = p6.body.comments.find((c) => c.body.startsWith("La pelota"));
  check(drawn?.annotation?.shapes?.length === 2, "El dibujo se guarda con 2 formas (deshacer/rehacer funciona)");
  const arrow = drawn.annotation.shapes[0];
  check(
    Math.abs(arrow.pts[0][0] - 0.25) < 0.03 && Math.abs(arrow.pts[0][1] - 0.3) < 0.03 && Math.abs(arrow.pts[1][0] - 0.5) < 0.03,
    "Coordenadas normalizadas al área real de la imagen (sin barras negras)",
  );
  const kinds = p6.body.comments.filter((c) => !c.parentId);
  check(kinds.some((c) => c.timeMs != null && c.endMs == null) && kinds.some((c) => c.endMs != null) && kinds.some((c) => c.timeMs == null), "Hay comentario de instante, de tramo y general");
  const rangeC = kinds.find((c) => c.endMs != null);
  check(Math.abs(rangeC.timeMs - 4000) < 80 && Math.abs(rangeC.endMs - 7000) < 80, `El tramo marcado con I/O va de 4 s a 7 s (${rangeC.timeMs}–${rangeC.endMs} ms)`);
  const instant = kinds.find((c) => c.body.startsWith("Aquí el texto"));
  check(Math.abs(instant.timeMs - 2000) < 80, `El comentario de instante queda en 2 s (${instant.timeMs} ms)`);
  await shot(cl, "e2e-07-client-review");
  // Reabrir en móvil y ver el dibujo en la misma posición relativa.
  const { page: clm } = await login(clientEmail, userPw, { mobile: true });
  await clm.goto(`${BASE}/revision/${v1}?c=${drawn.id}`);
  await waitVideo(clm);
  await clm.waitForTimeout(1200);
  const svgBox = await clm.locator("section[aria-label='Reproductor'] svg").first().boundingBox();
  const vid = await clm.evaluate(() => {
    const v = document.querySelector("video");
    const r = v.getBoundingClientRect();
    return { w: r.width, h: r.height, vw: v.videoWidth, vh: v.videoHeight, x: r.x, y: r.y };
  });
  const scale = Math.min(vid.w / vid.vw, vid.h / vid.vh);
  check(svgBox && Math.abs(svgBox.width - vid.vw * scale) < 2 && Math.abs(svgBox.height - vid.vh * scale) < 2, "En móvil el dibujo se pinta sobre el área real de la imagen");
  await shot(clm, "e2e-07-client-mobile");

  // ─── 8. Editor responde y atiende correcciones ────────────────────────
  step("8. Editor responde y atiende correcciones");
  await ed.goto(`${BASE}/inicio`);
  check(await ed.locator("text=Aquí el texto entra demasiado pronto").isVisible(), "Las correcciones del cliente aparecen en el panel del editor");
  await ed.goto(`${BASE}/revision/${v1}`);
  await waitVideo(ed);
  const art = ed.locator("article:has-text('Aquí el texto entra demasiado pronto')");
  await art.locator("button:has-text('Responder')").click();
  await art.locator("textarea").fill("Hecho en la siguiente versión");
  await art.locator("button:has-text('Responder')").last().click();
  await ed.waitForSelector("text=Hecho en la siguiente versión");
  await ed.locator("article:has-text('Este tramo va lento') button:has-text('Empezar')").click();
  await ed.waitForSelector("article:has-text('Este tramo va lento') >> text=En curso");
  check(true, "El editor responde y marca una corrección en curso");
  await ed.goto(`${BASE}${pieceHref}`);
  await ed.setInputFiles("input[aria-label='Archivo de vídeo']", `${MEDIA}vertical-9x16-v2.webm`);
  await ed.waitForSelector("text=Subido y verificado", { timeout: 60000 });
  await ed.fill("#summary", "Texto retrasado y tramo recortado.");
  await ed.selectOption("#fps", "25");
  await ed.locator("label:has-text('Aquí el texto entra demasiado pronto') input").check();
  await ed.locator("label:has-text('Este tramo va lento') input").check();
  await Promise.all([ed.waitForURL(/\/revision\//, { timeout: 30000 }), ed.click("button:has-text('Crear V2')")]);
  const v2 = ed.url().split("/revision/")[1].split("?")[0];

  // ─── 9. Se publica otra versión sin perder historial ──────────────────
  step("9. Publicar V2 sin perder historial");
  await coord.goto(`${BASE}/revision/${v2}`);
  await waitVideo(coord);
  await coord.click("header button:has-text('Publicar al cliente')");
  await coord.click("dialog button:has-text('Publicar')");
  await coord.waitForSelector("text=Publicada al cliente");
  const hist = await api(cl, `/api/review/${v1}`);
  check(hist.status === 200 && hist.body.comments.filter((c) => !c.parentId).length === 4, "V1 conserva sus 4 comentarios del cliente");
  const v2p = await api(cl, `/api/review/${v2}`);
  check(v2p.body.comments.length === 0, "Los comentarios NO se copian automáticamente a V2");
  const resolved = hist.body.comments.filter((c) => c.correction?.status === "RESOLVED" && c.correction.addressedIn === 2);
  check(resolved.length === 2, "Las 2 correcciones atendidas quedan «resueltas por el equipo» en V2");

  // ─── 10. Cliente compara y aprueba ────────────────────────────────────
  step("10. Comparar y aprobar");
  await cl.goto(`${BASE}/revision/${v2}/comparar?con=${v1}`);
  await cl.waitForFunction(() => [...document.querySelectorAll("video")].filter((v) => v.readyState >= 2).length === 2, null, { timeout: 30000 });
  await cl.click("button[aria-label='Reproducir']");
  await cl.waitForTimeout(1500);
  const sync = await cl.evaluate(() => {
    const [a, b] = document.querySelectorAll("video");
    return { a: a.currentTime, b: b.currentTime, playing: !a.paused && !b.paused };
  });
  check(sync.playing && Math.abs(sync.a - sync.b) < 0.25, "Comparación con reproducción enlazada");
  await shot(cl, "e2e-10-compare");
  await cl.goto(`${BASE}/revision/${v2}`);
  await waitVideo(cl);
  await cl.locator(`article:has-text("Aquí el texto entra") button:has-text('Verificar')`).count(); // en V1, no en V2
  await cl.click("header button:has-text('Aprobar V2')");
  await cl.waitForSelector("dialog[open]");
  const needsAck = await cl.locator("dialog >> text=Apruebo esta versión aunque").count();
  if (needsAck) await cl.locator("dialog input[type=checkbox]").check();
  await cl.click("dialog button:has-text('Aprobar V2')");
  await cl.waitForSelector("text=Versión aprobada", { timeout: 15000 });
  const approved = await api(cl, `/api/review/${v2}`);
  check(approved.body.version.status === "APPROVED" && approved.body.approvals[0].actorName.startsWith("Clienta"), "V2 aprobada con autor y fecha registrados");
  check(approved.body.approvals[0].openCorrections >= 1 && approved.body.approvals[0].acknowledgedOpen, "La aprobación registra las correcciones abiertas y la confirmación explícita");
  const edit = await api(cl, `/api/review/${v2}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: "tarde" }) });
  check(edit.status === 403, "Una versión aprobada ya no admite comentarios nuevos");

  // ─── 11. Entrega del archivo autorizado ───────────────────────────────
  step("11. Entrega final");
  await coord.goto(`${BASE}${pieceHref}`);
  await coord.setInputFiles("input[aria-label='Subir archivo final']", `${MEDIA}vertical-9x16-v2.webm`);
  await coord.waitForSelector("button:has-text('Entregar al cliente')", { timeout: 60000 });
  await coord.click("button:has-text('Entregar al cliente')");
  await coord.waitForSelector("text=Entrega final >> xpath=ancestor::section//button[contains(., 'Descargar')]", { timeout: 15000 });
  check(await coord.locator("text=Entrega final").first().isVisible(), "Coordinación registra la entrega ligada a la versión aprobada");
  await cl.goto(`${BASE}${pieceHref}`);
  const [download] = await Promise.all([cl.waitForEvent("download", { timeout: 30000 }), cl.click("button:has-text('Descargar')")]);
  const dlPath = await download.path();
  check(!!dlPath && download.suggestedFilename().endsWith(".webm"), "El cliente descarga la entrega autorizada");
  await shot(cl, "e2e-11-delivered");

  // ─── 12. Otro cliente no puede acceder ────────────────────────────────
  step("12. Aislamiento entre clientes y organizaciones");
  const { page: other } = await login(client2Email);
  const r1 = await other.goto(`${BASE}${pieceHref}`);
  check(r1.status() === 404, "Otro cliente: la página de la pieza responde 404");
  const r2 = await other.goto(`${BASE}/revision/${v2}`);
  check(r2.status() === 404, "Otro cliente: la sala de revisión responde 404");
  check((await api(other, `/api/review/${v2}`)).status === 404, "Otro cliente: la API de revisión responde 404");
  check((await api(other, `/api/review/${v2}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: "x" }) })).status === 404, "Otro cliente: no puede comentar por petición directa");
  const deliveryAsset = await api(cl, `/api/review/${v2}`);
  check((await api(other, "/api/downloads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: deliveryAsset.body.media.assetId }) })).status === 404, "Otro cliente: no puede pedir la descarga por petición directa");
  const { page: foreign } = await login("cliente@otra.test", PW);
  check((await api(foreign, `/api/review/${v2}`)).status === 404, "Cliente de otra organización: 404");
  const mediaUrl = approved.body.media.url;
  const anon = await b.newContext();
  const anonPage = await anon.newPage();
  const m1 = await anonPage.request.get(`${BASE}${mediaUrl}`, { headers: { Range: "bytes=0-99" } });
  check(m1.status() === 206, "La URL firmada de media sirve rangos (206)");
  const forged = mediaUrl.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  check((await anonPage.request.get(`${BASE}${forged}`)).status() === 403, "Una URL de media manipulada se rechaza (403)");
  check((await anonPage.request.get(`${BASE}/api/review/${v2}`)).status() === 401, "Sin sesión: la API pide autenticación (401)");

  // ─── Enlaces de invitado ───────────────────────────────────────────────
  step("Extra. Enlace de revisión para invitados");
  await coord.goto(`${BASE}/proyectos/${projectId}/compartir?pieza=${pieceId}&version=${v1}`);
  await coord.fill("#s-name", "Invitado E2E");
  await coord.click("button:has-text('Crear enlace')");
  await coord.waitForSelector("input[aria-label='Enlace de revisión']");
  const link = await coord.inputValue("input[aria-label='Enlace de revisión']");
  const guestCtx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const guest = await guestCtx.newPage();
  await guest.goto(link);
  await guest.fill("#g-name", "Invitada");
  await guest.fill("#g-email", "invitada@e2e.test");
  await Promise.all([guest.waitForURL(/\/v\//), guest.click("button:has-text('Entrar a la revisión')")]);
  await waitVideo(guest);
  check(!(await guest.locator("text=Nota interna").count()), "El invitado no ve comentarios internos");
  const linkId = await guest.evaluate(() => document.cookie);
  check(!linkId.includes("corte_g_"), "La cookie de invitado es httpOnly (no accesible desde JS)");
  await shot(guest, "e2e-guest-mobile");
  const otherVersionAsGuest = await guest.goto(`${link.replace(/\/r\/.*/, "")}${new URL(link).pathname}/v/${v2}`);
  check(otherVersionAsGuest.status() === 404, "Un enlace de versión no da acceso a otra versión");
  await coord.reload();
  await coord.click("button:has-text('Revocar ahora')");
  await coord.waitForTimeout(800);
  await guest.goto(link);
  check(await guest.locator("text=Este enlace no está disponible").isVisible(), "Tras revocar, el enlace deja de funcionar");

  // ─── Avisos ────────────────────────────────────────────────────────────
  step("Extra. Avisos");
  await cl.goto(`${BASE}/avisos`);
  check(await cl.locator("text=Nueva versión para revisar").first().isVisible(), "El cliente recibió aviso de versión publicada");
  await coord.goto(`${BASE}/avisos`);
  check(await coord.locator("text=aprobada").first().isVisible(), "Coordinación recibió aviso de aprobación");

  console.log(`\n✅ ${results.length} comprobaciones superadas`);
} catch (err) {
  for (const [who, pg] of Object.entries(pages)) await pg.screenshot({ path: `e2e/artifacts/fail-${who.split("@")[0]}.png` }).catch(() => {});
  console.error("\n❌ Fallo:", err.message.split("\n")[0], "\n", (err.stack ?? "").split("\n").find((l) => l.includes("run.mjs")));
  process.exitCode = 1;
} finally {
  await b.close();
}
