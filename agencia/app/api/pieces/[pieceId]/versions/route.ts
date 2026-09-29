import { NextResponse, type NextRequest } from "next/server";
import { api, readJson, resolveActor } from "@/lib/http/api";
import { createVersion } from "@/lib/services/versions";

export const POST = api(async (req: NextRequest, ctx: RouteContext<"/api/pieces/[pieceId]/versions">) => {
  const actor = await resolveActor(req);
  const { pieceId } = await ctx.params;
  const v = await createVersion(actor, pieceId, await readJson(req));
  return NextResponse.json({ id: v.id, number: v.number });
});
