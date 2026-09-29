import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { loadPiece, loadProject, loadVersion } from "@/lib/authz/guards";
import { assignEditor, changePieceStatus } from "@/lib/services/pieces";
import { createVersion, publishVersion, requestInternalChanges } from "@/lib/services/versions";
import { addComment, editComment, withdrawComment } from "@/lib/services/comments";
import { updateCorrection } from "@/lib/services/corrections";
import { decideVersion, revokeApproval } from "@/lib/services/approvals";
import { getReviewPayload } from "@/lib/services/review";
import { listProjects } from "@/lib/services/projects";
import { projectFinance } from "@/lib/services/finance";
import { readyPreview, scenario } from "./fixtures";

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

async function upToPublished() {
  const s = await scenario();
  await assignEditor(s.coord, s.piece.id, s.editor.id);
  await changePieceStatus(s.editor, s.piece.id, "IN_EDIT");
  const a1 = await readyPreview(s.org.id, s.piece.id, s.editor.id);
  const v1 = await createVersion(s.editor, s.piece.id, { assetId: a1.id, changeSummary: "V1", durationMs: 20000, fps: 25 });
  return { s, v1 };
}

describe("alcance y aislamiento", () => {
  it("cada rol ve solo lo suyo", async () => {
    const s = await scenario();
    expect(await status(loadProject(s.admin, s.project.id))).toBe(200);
    expect(await status(loadProject(s.coord, s.project.id))).toBe(200);
    expect(await status(loadProject(s.coord2, s.project.id))).toBe(404);
    expect(await status(loadProject(s.editor, s.project.id))).toBe(404);
    expect(await status(loadProject(s.cA, s.project.id))).toBe(200);
    expect(await status(loadProject(s.cB, s.project.id))).toBe(404);
    expect(await status(loadProject(s.foreign, s.project.id))).toBe(404);
    await assignEditor(s.coord, s.piece.id, s.editor.id);
    expect(await status(loadPiece(s.editor, s.piece.id))).toBe(200);
    expect(await status(loadPiece(s.editor2, s.piece.id))).toBe(404);
    expect((await listProjects(s.cB)).length).toBe(0);
  });

  it("un coordinador no puede asignar en proyectos ajenos ni un editor asignar", async () => {
    const s = await scenario();
    expect(await status(assignEditor(s.coord2, s.piece.id, s.editor.id))).toBe(404);
    // Un editor sin la pieza ni la ve (404); con la pieza asignada, no puede reasignar (403).
    expect(await status(assignEditor(s.editor, s.piece.id, s.editor.id))).toBe(404);
    await assignEditor(s.coord, s.piece.id, s.editor.id);
    expect(await status(assignEditor(s.editor, s.piece.id, s.editor2.id))).toBe(403);
    expect(await status(assignEditor(s.coord, s.piece.id, s.cA.id))).toBe(400);
  });

  it("la información económica exige permiso específico", async () => {
    const s = await scenario();
    expect(await status(projectFinance(s.coord, s.project.id))).toBe(403);
    await db.user.update({ where: { id: s.coord.id }, data: { canViewFinance: true } });
    expect(await status(projectFinance({ ...s.coord, canViewFinance: true }, s.project.id))).toBe(200);
    expect(await status(projectFinance(s.cA, s.project.id))).toBe(403);
    expect(await status(projectFinance(s.editor, s.project.id))).toBe(403);
  });
});

describe("revisión interna y cliente", () => {
  it("una versión interna es invisible para el cliente y su conversación es interna", async () => {
    const { s, v1 } = await upToPublished();
    expect(await status(loadVersion(s.cA, v1.id))).toBe(404);
    const c = await addComment(s.coord, v1.id, { body: "logo pequeño", timeMs: 1000, visibility: "CLIENT" });
    expect((await db.comment.findUniqueOrThrow({ where: { id: c.id } })).visibility).toBe("INTERNAL");
    expect(await status(addComment(s.cA, v1.id, { body: "hola" }))).toBe(404);
  });

  it("publicar muestra la versión al cliente sin los comentarios internos", async () => {
    const { s, v1 } = await upToPublished();
    await addComment(s.coord, v1.id, { body: "interno previo", timeMs: 500 });
    expect(await status(publishVersion(s.editor, v1.id))).toBe(403);
    await publishVersion(s.coord, v1.id);
    await addComment(s.coord, v1.id, { body: "interno posterior", timeMs: 700, visibility: "INTERNAL" });
    await addComment(s.cA, v1.id, { body: "cambio del cliente", timeMs: 900 });
    const p = await getReviewPayload(s.cA, v1.id);
    expect(p.comments.map((c) => c.body)).toEqual(["cambio del cliente"]);
    const internal = await getReviewPayload(s.coord, v1.id);
    expect(internal.comments).toHaveLength(3);
    expect(await status(getReviewPayload(s.cB, v1.id))).toBe(404);
  });

  it("el cliente no puede forzar un comentario interno ni mencionar a quien no puede verlo", async () => {
    const { s, v1 } = await upToPublished();
    await publishVersion(s.coord, v1.id);
    const c = await addComment(s.cA, v1.id, { body: "x", visibility: "INTERNAL", timeMs: 100 });
    expect((await db.comment.findUniqueOrThrow({ where: { id: c.id } })).visibility).toBe("CLIENT");
    const i = await addComment(s.coord, v1.id, { body: "@cliente", visibility: "INTERNAL", mentionIds: [s.cA.id, s.editor.id] });
    const mentions = await db.commentMention.findMany({ where: { commentId: i.id } });
    expect(mentions.map((m) => m.userId)).toEqual([s.editor.id]);
  });

  it("cambios internos devuelven la pieza al editor", async () => {
    const { s, v1 } = await upToPublished();
    await requestInternalChanges(s.coord, v1.id, "Sube el volumen");
    expect((await db.version.findUniqueOrThrow({ where: { id: v1.id } })).status).toBe("INTERNAL_CHANGES");
    expect((await db.piece.findUniqueOrThrow({ where: { id: s.piece.id } })).status).toBe("IN_EDIT");
  });
});

describe("correcciones, versiones y aprobación", () => {
  it("recorrido completo con historial y política de aprobación", async () => {
    const { s, v1 } = await upToPublished();
    await publishVersion(s.coord, v1.id);
    const c1 = await addComment(s.cA, v1.id, { body: "texto antes", timeMs: 2000, category: "SUBTITLES" });
    const c2 = await addComment(s.cA, v1.id, { body: "tramo lento", timeMs: 4000, endMs: 7000 });
    await addComment(s.cA, v1.id, { body: "me gusta", timeMs: null, isCorrection: false });
    const corr1 = await db.correction.findUniqueOrThrow({ where: { commentId: c1.id } });
    const corr2 = await db.correction.findUniqueOrThrow({ where: { commentId: c2.id } });
    expect(corr1.category).toBe("SUBTITLES");
    expect(corr1.assigneeId).toBe(s.editor.id);
    expect(await db.correction.count({ where: { pieceId: s.piece.id } })).toBe(2);

    // El cliente no puede marcar como resuelta; el editor sí.
    expect(await status(updateCorrection(s.cA, corr1.id, { status: "RESOLVED" }))).toBe(400);
    await updateCorrection(s.editor, corr2.id, { status: "IN_PROGRESS" });

    // V2 atiende la corrección 1.
    await decideVersion(s.cA, v1.id, { decision: "CHANGES_REQUESTED", note: "ver comentarios" });
    await changePieceStatus(s.editor, s.piece.id, "IN_CORRECTION");
    const a2 = await readyPreview(s.org.id, s.piece.id, s.editor.id);
    const v2 = await createVersion(s.editor, s.piece.id, { assetId: a2.id, addressedCorrectionIds: [corr1.id] });
    expect((await db.correction.findUniqueOrThrow({ where: { id: corr1.id } })).status).toBe("RESOLVED");
    expect((await db.correction.findUniqueOrThrow({ where: { id: corr1.id } })).addressedInVersionId).toBe(v2.id);
    await publishVersion(s.coord, v2.id);

    // El historial de V1 se conserva y los comentarios no se copian.
    expect(await db.comment.count({ where: { versionId: v1.id } })).toBe(3);
    expect(await db.comment.count({ where: { versionId: v2.id } })).toBe(0);
    expect((await db.version.findUniqueOrThrow({ where: { id: v1.id } })).status).toBe("CHANGES_REQUESTED");

    // Política ALLOW_WITH_ACK: sin confirmación no se aprueba (queda 1 abierta).
    expect(await status(decideVersion(s.cA, v2.id, { decision: "APPROVED" }))).toBe(409);
    // BLOCK_IF_OPEN: ni con confirmación.
    await db.organization.update({ where: { id: s.org.id }, data: { approvalPolicy: "BLOCK_IF_OPEN" } });
    expect(await status(decideVersion(s.cA, v2.id, { decision: "APPROVED", acknowledgeOpen: true }))).toBe(409);
    await db.organization.update({ where: { id: s.org.id }, data: { approvalPolicy: "ALLOW_WITH_ACK" } });
    // Otro cliente no puede aprobar.
    expect(await status(decideVersion(s.cB, v2.id, { decision: "APPROVED", acknowledgeOpen: true }))).toBe(404);
    // Coordinación solo con nota del canal.
    expect(await status(decideVersion(s.coord, v2.id, { decision: "APPROVED", acknowledgeOpen: true }))).toBe(400);

    const ap = await decideVersion(s.cA, v2.id, { decision: "APPROVED", acknowledgeOpen: true, note: "ok" });
    expect(ap.openCorrections).toBe(1);
    expect(ap.acknowledgedOpen).toBe(true);
    const v2db = await db.version.findUniqueOrThrow({ where: { id: v2.id } });
    expect(v2db.status).toBe("APPROVED");
    expect(v2db.lockedAt).not.toBeNull();
    const piece = await db.piece.findUniqueOrThrow({ where: { id: s.piece.id } });
    expect(piece.approvedVersionId).toBe(v2.id);
    expect(piece.status).toBe("APPROVED");

    // Historial aprobado protegido.
    expect(await status(addComment(s.cA, v2.id, { body: "tarde" }))).toBe(403);
    expect(await status(decideVersion(s.cA, v2.id, { decision: "CHANGES_REQUESTED" }))).toBe(400);

    // Revocar: solo administración y con motivo.
    expect(await status(revokeApproval(s.coord, ap.id, "motivo largo"))).toBe(403);
    await revokeApproval(s.admin, ap.id, "El cliente se equivocó de versión");
    const after = await db.version.findUniqueOrThrow({ where: { id: v2.id } });
    expect(after.status).toBe("CLIENT_REVIEW");
    expect((await db.approval.findUniqueOrThrow({ where: { id: ap.id } })).revokedAt).not.toBeNull();
    expect((await db.piece.findUniqueOrThrow({ where: { id: s.piece.id } })).approvedVersionId).toBeNull();
  });

  it("dos decisiones simultáneas: solo una gana", async () => {
    const { s, v1 } = await upToPublished();
    await publishVersion(s.coord, v1.id);
    const results = await Promise.allSettled([
      decideVersion(s.cA, v1.id, { decision: "APPROVED" }),
      decideVersion(s.cA, v1.id, { decision: "CHANGES_REQUESTED" }),
      decideVersion(s.cA, v1.id, { decision: "APPROVED" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.approval.count({ where: { versionId: v1.id } })).toBe(1);
  });

  it("editar deja historial y retirar descarta la corrección", async () => {
    const { s, v1 } = await upToPublished();
    await publishVersion(s.coord, v1.id);
    const c = await addComment(s.cA, v1.id, { body: "original", timeMs: 100 });
    expect(await status(editComment(s.cB, c.id, "hack"))).toBe(404);
    expect(await status(editComment(s.coord, c.id, "hack"))).toBe(403);
    await editComment(s.cA, c.id, "editado");
    const revs = await db.commentRevision.findMany({ where: { commentId: c.id } });
    expect(revs.map((r) => r.body)).toEqual(["original"]);
    await withdrawComment(s.cA, c.id);
    expect((await db.comment.findUniqueOrThrow({ where: { id: c.id } })).deletedAt).not.toBeNull();
    expect((await db.correction.findUniqueOrThrow({ where: { commentId: c.id } })).status).toBe("DISMISSED");
  });
});
