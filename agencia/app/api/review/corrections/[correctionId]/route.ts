import { NextResponse, type NextRequest } from "next/server";
import { api, readJson, resolveActor } from "@/lib/http/api";
import { updateCorrection } from "@/lib/services/corrections";

export const PATCH = api(async (req: NextRequest, ctx: RouteContext<"/api/review/corrections/[correctionId]">) => {
  const actor = await resolveActor(req);
  const { correctionId } = await ctx.params;
  await updateCorrection(actor, correctionId, await readJson(req));
  return NextResponse.json({ ok: true });
});
