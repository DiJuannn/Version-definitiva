import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { api, readJson, resolveActor } from "@/lib/http/api";
import { requestInternalChanges } from "@/lib/services/versions";

export const POST = api(async (req: NextRequest, ctx: RouteContext<"/api/review/[versionId]/internal-changes">) => {
  const actor = await resolveActor(req);
  const { versionId } = await ctx.params;
  const { note } = z.object({ note: z.string().trim().min(3, "Explica qué hay que cambiar").max(2000) }).parse(await readJson(req));
  await requestInternalChanges(actor, versionId, note);
  return NextResponse.json({ ok: true });
});
