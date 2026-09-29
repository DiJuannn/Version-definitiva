import { NextResponse, type NextRequest } from "next/server";
import { api, resolveActor } from "@/lib/http/api";
import { suggestCorrectionCategory } from "@/lib/services/ai";

export const POST = api(async (req: NextRequest, ctx: RouteContext<"/api/review/corrections/[correctionId]/ai-category">) => {
  const actor = await resolveActor(req);
  const { correctionId } = await ctx.params;
  return NextResponse.json(await suggestCorrectionCategory(actor, correctionId));
});
