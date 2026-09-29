import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { api, readJson, resolveActor } from "@/lib/http/api";
import { publishVersion } from "@/lib/services/versions";

export const POST = api(async (req: NextRequest, ctx: RouteContext<"/api/review/[versionId]/publish">) => {
  const actor = await resolveActor(req);
  const { versionId } = await ctx.params;
  const { note } = z.object({ note: z.string().max(2000).optional() }).parse(await readJson(req));
  await publishVersion(actor, versionId, note);
  return NextResponse.json({ ok: true });
});
