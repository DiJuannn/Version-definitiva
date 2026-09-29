import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { api, readJson, resolveActor } from "@/lib/http/api";
import { editComment, withdrawComment } from "@/lib/services/comments";

type Ctx = RouteContext<"/api/review/comments/[commentId]">;

export const PATCH = api(async (req: NextRequest, ctx: Ctx) => {
  const actor = await resolveActor(req);
  const { commentId } = await ctx.params;
  const { body } = z.object({ body: z.string() }).parse(await readJson(req));
  await editComment(actor, commentId, body);
  return NextResponse.json({ ok: true });
});

export const DELETE = api(async (req: NextRequest, ctx: Ctx) => {
  const actor = await resolveActor(req);
  const { commentId } = await ctx.params;
  await withdrawComment(actor, commentId);
  return NextResponse.json({ ok: true });
});
