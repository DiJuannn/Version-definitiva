import "server-only";
import type { ReviewPayload } from "./review";
import { CATEGORY_LABEL, CORRECTION_STATUS } from "@/lib/domain/labels";
import { formatClock, formatTimecode } from "@/lib/domain/timecode";

function tc(ms: number | null, fps: number | null) {
  if (ms == null) return "";
  return fps ? formatTimecode(ms, fps) : formatClock(ms, true);
}

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  // Evita inyección de fórmulas al abrir en hojas de cálculo.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Exportación de comentarios. No es un formato de marcadores de Premiere. */
export function exportComments(p: ReviewPayload, format: "csv" | "json" | "txt") {
  const fps = p.version.fps;
  const roots = p.comments.filter((c) => !c.parentId && !c.deleted);
  const repliesOf = (id: string) => p.comments.filter((c) => c.parentId === id && !c.deleted);
  if (format === "json") {
    return JSON.stringify(
      {
        piece: p.piece.title,
        project: p.piece.projectName,
        version: `V${p.version.number}`,
        fps,
        fpsVerified: p.version.fpsVerified,
        exportedAt: new Date().toISOString(),
        comments: roots.map((c) => ({
          id: c.id,
          author: c.author.name,
          createdAt: c.createdAt,
          start: c.timeMs,
          end: c.endMs,
          timecode: tc(c.timeMs, fps),
          visibility: c.visibility,
          body: c.body,
          hasDrawing: !!c.annotation,
          correction: c.correction ? { status: c.correction.status, category: c.correction.category } : null,
          replies: repliesOf(c.id).map((r) => ({ author: r.author.name, createdAt: r.createdAt, body: r.body, visibility: r.visibility })),
        })),
      },
      null,
      2,
    );
  }
  if (format === "csv") {
    const rows = [["#", "Inicio", "Fin", "Autor", "Fecha", "Visibilidad", "Categoría", "Estado", "Comentario", "Respuestas"]];
    roots.forEach((c, i) =>
      rows.push([
        String(i + 1),
        tc(c.timeMs, fps),
        tc(c.endMs, fps),
        c.author.name,
        c.createdAt,
        c.visibility === "INTERNAL" ? "Interno" : "Cliente",
        c.correction ? CATEGORY_LABEL[c.correction.category] : "",
        c.correction ? CORRECTION_STATUS[c.correction.status].label : "",
        c.body,
        repliesOf(c.id)
          .map((r) => `${r.author.name}: ${r.body}`)
          .join(" | "),
      ]),
    );
    return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  }
  const lines = [`${p.piece.projectName} — ${p.piece.title} — V${p.version.number}`, ""];
  roots.forEach((c, i) => {
    const t = c.timeMs == null ? "General" : c.endMs != null ? `${tc(c.timeMs, fps)} → ${tc(c.endMs, fps)}` : tc(c.timeMs, fps);
    lines.push(`${i + 1}. [${t}] ${c.author.name}${c.correction ? ` · ${CATEGORY_LABEL[c.correction.category]} · ${CORRECTION_STATUS[c.correction.status].label}` : ""}`);
    lines.push(`   ${c.body}`);
    for (const r of repliesOf(c.id)) lines.push(`   ↳ ${r.author.name}: ${r.body}`);
    lines.push("");
  });
  return lines.join("\n");
}
