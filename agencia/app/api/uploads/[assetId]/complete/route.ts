import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current";
import { api } from "@/lib/http/api";
import { unauthorized } from "@/lib/http/errors";
import { completeUpload } from "@/lib/services/media";

export const POST = api(async (_req: NextRequest, ctx: RouteContext<"/api/uploads/[assetId]/complete">) => {
  const me = await getCurrentUser();
  if (!me) throw unauthorized();
  const { assetId } = await ctx.params;
  return NextResponse.json(await completeUpload(me, assetId));
});
