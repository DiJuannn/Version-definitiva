import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { aiAvailable, summarizeVersion } from "@/lib/services/ai";
import { assignEditor, changePieceStatus } from "@/lib/services/pieces";
import { createVersion } from "@/lib/services/versions";
import { readyPreview, scenario } from "./fixtures";

describe("IA desactivada por defecto", () => {
  it("sin proveedor ni autorización no se envía nada y el error es claro", async () => {
    const s = await scenario();
    expect(await aiAvailable(s.org.id)).toBe(false);
    await db.organization.update({ where: { id: s.org.id }, data: { aiEnabled: true } });
    // Autorizada por la organización pero sin credenciales en el servidor: sigue desactivada.
    expect(await aiAvailable(s.org.id)).toBe(false);
    await assignEditor(s.coord, s.piece.id, s.editor.id);
    await changePieceStatus(s.editor, s.piece.id, "IN_EDIT");
    const v = await createVersion(s.editor, s.piece.id, { assetId: (await readyPreview(s.org.id, s.piece.id, s.editor.id)).id });
    await db.comment.create({ data: { versionId: v.id, authorUserId: s.coord.id, body: "sube el logo", visibility: "INTERNAL" } });
    const err = await summarizeVersion(s.coord, v.id).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(503);
    const denied = await summarizeVersion(s.cA, v.id).catch((e) => e);
    expect((denied as AppError).status).toBe(403);
  });
});
