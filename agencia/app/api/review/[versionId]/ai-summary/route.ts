import { NextResponse, type NextRequest } from "next/server";
import { api, resolveActor } from "@/lib/http/api";
import { summarizeVersion } from "@/lib/services/ai";

export const POST = api(async (req: NextRequest, ctx: RouteContext<"/api/review/[versionId]/ai-summary">) => {
  const actor = await resolveActor(req);
  const { versionId } = await ctx.params;
  return NextResponse.json(await summarizeVersion(actor, versionId));
});
