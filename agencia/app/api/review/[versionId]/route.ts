import { NextResponse, type NextRequest } from "next/server";
import { api, resolveActor } from "@/lib/http/api";
import { getReviewPayload } from "@/lib/services/review";

export const GET = api(async (req: NextRequest, ctx: RouteContext<"/api/review/[versionId]">) => {
  const actor = await resolveActor(req);
  const { versionId } = await ctx.params;
  return NextResponse.json(await getReviewPayload(actor, versionId), { headers: { "Cache-Control": "no-store" } });
});
