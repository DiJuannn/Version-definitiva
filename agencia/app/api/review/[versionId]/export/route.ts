import type { NextRequest } from "next/server";
import { api, resolveActor } from "@/lib/http/api";
import { getReviewPayload } from "@/lib/services/review";
import { exportComments } from "@/lib/services/export";

const TYPES = { csv: "text/csv; charset=utf-8", json: "application/json; charset=utf-8", txt: "text/plain; charset=utf-8" } as const;

export const GET = api(async (req: NextRequest, ctx: RouteContext<"/api/review/[versionId]/export">) => {
  const actor = await resolveActor(req);
  const { versionId } = await ctx.params;
  const f = req.nextUrl.searchParams.get("format");
  const format = f === "json" || f === "txt" ? f : "csv";
  const p = await getReviewPayload(actor, versionId);
  const name = `${p.piece.title}-V${p.version.number}-comentarios.${format}`.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, "_");
  return new Response(exportComments(p, format), {
    headers: { "Content-Type": TYPES[format], "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, "Cache-Control": "no-store" },
  });
});
