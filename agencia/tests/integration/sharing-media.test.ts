import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { sha256 } from "@/lib/auth/crypto";
import { loadVersion } from "@/lib/authz/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { assignEditor, changePieceStatus } from "@/lib/services/pieces";
import { createVersion, publishVersion } from "@/lib/services/versions";
import { addComment } from "@/lib/services/comments";
import { decideVersion } from "@/lib/services/approvals";
import { createShareLink, findLinkByToken, revokeShareLink } from "@/lib/services/shares";
import { appendChunk, completeUpload, requestDownload, startUpload } from "@/lib/services/media";
import { getReviewPayload } from "@/lib/services/review";
import { notify } from "@/lib/notifications/notify";
import { processOutbox } from "@/lib/notifications/outbox";
import { guestFor, readyPreview, scenario } from "./fixtures";

async function status(p: Promise<unknown>) {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof AppError) return e.status;
    if ((e as { name?: string }).name === "ZodError") return 422;
    throw e;
  }
}

async function twoVersions() {
  const s = await scenario();
  await assignEditor(s.coord, s.piece.id, s.editor.id);
  await changePieceStatus(s.editor, s.piece.id, "IN_EDIT");
  const v1 = await createVersion(s.editor, s.piece.id, { assetId: (await readyPreview(s.org.id, s.piece.id, s.editor.id)).id });
  await publishVersion(s.coord, v1.id);
  const v2 = await createVersion(s.editor, s.piece.id, { assetId: (await readyPreview(s.org.id, s.piece.id, s.editor.id)).id });
  return { s, v1, v2 };
}

describe("enlaces de revisión", () => {
  it("un enlace de versión solo da acceso a esa versión publicada", async () => {
    const { s, v1, v2 } = await twoVersions();
    expect(await status(createShareLink(s.coord, { name: "xx", scope: "VERSION", projectId: s.project.id, pieceId: s.piece.id, versionId: v2.id }))).toBe(400);
    expect(await status(createShareLink(s.editor, { name: "xx", scope: "PROJECT", projectId: s.project.id }))).toBe(403);
    const { link, token } = await createShareLink(s.coord, { name: "Marta", scope: "VERSION", projectId: s.project.id, pieceId: s.piece.id, versionId: v1.id, canComment: true });
    expect(link.tokenHash).toBe(sha256(token));
    expect(link.tokenHash).not.toContain(token);
    const guest = await db.reviewGuest.create({ data: { shareLinkId: link.id, name: "G", sessionTokenHash: sha256("g" + token) } });
    const g = guestFor(link, guest.id);
    expect(await status(loadVersion(g, v1.id))).toBe(200);
    expect(await status(loadVersion(g, v2.id))).toBe(404);
    await addComment(s.coord, v1.id, { body: "secreto", visibility: "INTERNAL", timeMs: 10 });
    const p = await getReviewPayload(g, v1.id);
    expect(p.comments.every((c) => c.visibility === "CLIENT")).toBe(true);
    expect(p.participants.every((x) => x.name)).toBe(true);
    expect(p.perms.decide).toBe(false);
    expect(await status(decideVersion(g, v1.id, { decision: "APPROVED" }))).toBe(403);
    await addComment(g, v1.id, { body: "comentario invitado", timeMs: 500 });
    await revokeShareLink(s.coord, link.id);
    expect((await findLinkByToken(token))?.usable).toBe(false);
  });

  it("un enlace sin permiso de comentar no deja comentar; uno con aprobación exige identidad", async () => {
    const { s, v1 } = await twoVersions();
    const { link } = await createShareLink(s.coord, { name: "solo ver", scope: "PIECE", projectId: s.project.id, pieceId: s.piece.id, canComment: false });
    const guest = await db.reviewGuest.create({ data: { shareLinkId: link.id, name: "G", sessionTokenHash: sha256(link.id) } });
    expect(await status(addComment(guestFor(link, guest.id), v1.id, { body: "x" }))).toBe(403);
    expect(await status(createShareLink(s.coord, { name: "yy", scope: "PIECE", projectId: s.project.id, pieceId: s.piece.id, canApprove: true, requireIdentity: false }))).toBe(400);
  });
});

describe("subidas y descargas", () => {
  it("sube por trozos, rechaza offsets erróneos y trozos dañados, y verifica al final", async () => {
    const s = await scenario();
    await assignEditor(s.coord, s.piece.id, s.editor.id);
    const data = new Uint8Array(1000).map((_, i) => i % 251);
    const { assetId } = await startUpload(s.editor, { kind: "PREVIEW", pieceId: s.piece.id, filename: "a.webm", sizeBytes: 1000, mimeType: "video/webm" });
    expect(await status(startUpload(s.editor2, { kind: "PREVIEW", pieceId: s.piece.id, filename: "a.webm", sizeBytes: 10, mimeType: "video/webm" }))).toBe(404);
    expect(await status(startUpload(s.editor, { kind: "PREVIEW", pieceId: s.piece.id, filename: "a.txt", sizeBytes: 10, mimeType: "text/plain" }))).toBe(400);
    await appendChunk(s.editor, assetId, 0, data.slice(0, 400));
    const wrong = await status(appendChunk(s.editor, assetId, 0, data.slice(0, 400)));
    expect(wrong).toBe(409);
    expect(await status(appendChunk(s.editor, assetId, 400, data.slice(400, 800), "0".repeat(64)))).toBe(400);
    expect(await status(completeUpload(s.editor, assetId))).toBe(400);
    expect(await status(appendChunk(s.editor2, assetId, 400, data.slice(400)))).toBe(404);
    await appendChunk(s.editor, assetId, 400, data.slice(400));
    const done = await completeUpload(s.editor, assetId);
    expect(done.sha256).toMatch(/^[0-9a-f]{64}$/);
    const v = await createVersion(s.editor, s.piece.id, { assetId });
    expect(v.number).toBe(1);
    // La vista previa interna no es descargable por el cliente.
    expect(await status(requestDownload(s.cA, assetId))).toBe(404);
    expect(await status(requestDownload(s.editor, assetId))).toBe(200);
    expect(await db.downloadLog.count({ where: { assetId } })).toBe(1);
  });

  it("límite de tamaño del almacenamiento local", async () => {
    const s = await scenario();
    expect(await status(startUpload(s.cA, { kind: "SOURCE", projectId: s.project.id, filename: "bruto.mov", sizeBytes: 50 * 1024 ** 3 }))).toBe(400);
  });
});

describe("avisos y correo", () => {
  it("agrupa avisos sin leer, nunca entrega internos a clientes y no duplica emails", async () => {
    const s = await scenario();
    const base = { organizationId: s.org.id, type: "COMMENT" as const, title: "t", url: "/x", groupKey: "g1", internal: true };
    await db.$transaction((tx) => notify(tx, { ...base, recipients: [s.coord.id, s.cA.id], eventKey: "e1" }));
    await db.$transaction((tx) => notify(tx, { ...base, recipients: [s.coord.id, s.cA.id], eventKey: "e2" }));
    await db.$transaction((tx) => notify(tx, { ...base, recipients: [s.coord.id], eventKey: "e2" }));
    const n = await db.notification.findMany({ where: { userId: { in: [s.coord.id, s.cA.id] } } });
    expect(n).toHaveLength(1);
    expect(n[0].userId).toBe(s.coord.id);
    expect(n[0].count).toBe(3);
    expect(await db.emailOutbox.count({ where: { to: { contains: s.cA.email } } })).toBe(0);
    expect(await db.emailOutbox.count({ where: { idempotencyKey: `e2:${s.coord.id}` } })).toBe(1);
    await db.notificationPreference.create({ data: { userId: s.coord.id, type: "COMMENT", inApp: true, email: false } });
    await db.$transaction((tx) => notify(tx, { ...base, recipients: [s.coord.id], eventKey: "e3" }));
    expect(await db.emailOutbox.count({ where: { idempotencyKey: `e3:${s.coord.id}` } })).toBe(0);
  });

  it("sin proveedor, la bandeja marca los emails como omitidos (visible, sin reintentos infinitos)", async () => {
    const s = await scenario();
    await db.emailOutbox.create({ data: { organizationId: s.org.id, idempotencyKey: `x-${s.org.id}`, to: "a@t.test", subject: "s", body: "b" } });
    await processOutbox(500);
    const row = await db.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: `x-${s.org.id}` } });
    expect(row.status).toBe("SKIPPED");
    expect(row.lastError).toContain("proveedor");
  });

  it("límite de intentos por ventana", async () => {
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 3; i++) expect(await rateLimit(key, 3, 60_000)).toBe(true);
    expect(await rateLimit(key, 3, 60_000)).toBe(false);
  });
});
