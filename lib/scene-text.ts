// El texto de una escena para trabajar sobre él en producción (desglose,
// planos). Si el proyecto tiene su guion en Guiones y la escena viene de ahí
// (scriptSid), es el texto real del guion; si no, lo que dejó el análisis
// del PDF o la ficha (acción, descripción, notas de diálogo).

import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import type { BlockType } from "@/lib/screenplay/blocks";
import { blocksFromYDoc } from "@/lib/screenplay/ydoc";

export type SceneTextBlock = { type: BlockType; text: string };
export type SceneText = { source: "guion" | "ficha"; blocks: SceneTextBlock[] };

type SceneInput = {
  id: string;
  scriptSid: string | null;
  description: string | null;
  action: string | null;
  dialogueNotes: string | null;
};

export async function getScenesText(projectId: string, scenes: SceneInput[]): Promise<Map<string, SceneText>> {
  const out = new Map<string, SceneText>();
  const withSid = scenes.filter((s) => s.scriptSid);

  if (withSid.length) {
    const screenplay = await prisma.screenplay.findFirst({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      select: { ydoc: true },
    });
    if (screenplay?.ydoc) {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(screenplay.ydoc));
      const blocks = blocksFromYDoc(doc);
      const startOf = new Map<string, number>();
      blocks.forEach((b, i) => {
        if (b.type === "sceneHeading" && b.id) startOf.set(b.id, i);
      });
      for (const scene of withSid) {
        const start = startOf.get(scene.scriptSid as string);
        if (start === undefined) continue;
        let end = start + 1;
        while (end < blocks.length && blocks[end].type !== "sceneHeading") end++;
        out.set(scene.id, {
          source: "guion",
          blocks: blocks
            .slice(start + 1, end)
            .filter((b) => b.text.trim())
            .map((b) => ({ type: b.type, text: b.text })),
        });
      }
    }
  }

  for (const scene of scenes) {
    if (out.has(scene.id)) continue;
    const blocks: SceneTextBlock[] = [];
    for (const text of [scene.description, scene.action, scene.dialogueNotes]) {
      for (const para of (text ?? "").split(/\n{2,}/)) if (para.trim()) blocks.push({ type: "action", text: para.trim() });
    }
    out.set(scene.id, { source: "ficha", blocks });
  }
  return out;
}
