import { NextResponse, type NextRequest } from "next/server";
import { api, readJson, resolveActor } from "@/lib/http/api";
import { decideVersion } from "@/lib/services/approvals";

export const POST = api(async (req: NextRequest, ctx: RouteContext<"/api/review/[versionId]/decision">) => {
  const actor = await resolveActor(req);
  const { versionId } = await ctx.params;
  const a = await decideVersion(actor, versionId, await readJson(req));
  return NextResponse.json({ id: a.id });
});
