import { NextResponse, type NextRequest } from "next/server";
import { api, readJson, resolveActor } from "@/lib/http/api";
import { rateLimit } from "@/lib/auth/rate-limit";
import { AppError } from "@/lib/http/errors";
import { addComment } from "@/lib/services/comments";

export const POST = api(async (req: NextRequest, ctx: RouteContext<"/api/review/[versionId]/comments">) => {
  const actor = await resolveActor(req);
  if (!(await rateLimit(`comment:${actor.kind}:${actor.id}`, 60, 60_000))) {
    throw new AppError(429, "Demasiados comentarios seguidos. Espera un momento.", "rate_limited");
  }
  const { versionId } = await ctx.params;
  const c = await addComment(actor, versionId, await readJson(req));
  return NextResponse.json({ id: c.id });
});
