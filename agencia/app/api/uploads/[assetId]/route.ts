import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current";
import { api } from "@/lib/http/api";
import { badRequest, unauthorized } from "@/lib/http/errors";
import { appendChunk, cancelUpload, CHUNK_MAX, uploadStatus } from "@/lib/services/media";

type Ctx = RouteContext<"/api/uploads/[assetId]">;

export const GET = api(async (_req: NextRequest, ctx: Ctx) => {
  const me = await getCurrentUser();
  if (!me) throw unauthorized();
  const { assetId } = await ctx.params;
  return NextResponse.json(await uploadStatus(me, assetId));
});

/** Recibe un trozo en bruto. ?offset=N indica dónde empieza. */
export const PUT = api(async (req: NextRequest, ctx: Ctx) => {
  const me = await getCurrentUser();
  if (!me) throw unauthorized();
  const { assetId } = await ctx.params;
  const offset = Number(req.nextUrl.searchParams.get("offset"));
  if (!Number.isSafeInteger(offset) || offset < 0) throw badRequest("offset no válido");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > CHUNK_MAX) throw badRequest("Trozo demasiado grande");
  const data = new Uint8Array(await req.arrayBuffer());
  return NextResponse.json(await appendChunk(me, assetId, offset, data, req.headers.get("x-chunk-sha256")));
});

export const DELETE = api(async (_req: NextRequest, ctx: Ctx) => {
  const me = await getCurrentUser();
  if (!me) throw unauthorized();
  const { assetId } = await ctx.params;
  await cancelUpload(me, assetId);
  return NextResponse.json({ ok: true });
});
