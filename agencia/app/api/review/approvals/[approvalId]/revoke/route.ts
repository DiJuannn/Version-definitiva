import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { api, readJson, resolveActor } from "@/lib/http/api";
import { revokeApproval } from "@/lib/services/approvals";

export const POST = api(async (req: NextRequest, ctx: RouteContext<"/api/review/approvals/[approvalId]/revoke">) => {
  const actor = await resolveActor(req);
  const { approvalId } = await ctx.params;
  const { reason } = z.object({ reason: z.string() }).parse(await readJson(req));
  await revokeApproval(actor, approvalId, reason);
  return NextResponse.json({ ok: true });
});
