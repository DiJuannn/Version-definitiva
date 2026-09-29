import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { api, readJson, resolveActor } from "@/lib/http/api";
import { clientIp } from "@/lib/auth/session";
import { requestDownload } from "@/lib/services/media";

export const POST = api(async (req: NextRequest) => {
  const actor = await resolveActor(req);
  const { assetId } = z.object({ assetId: z.string() }).parse(await readJson(req));
  return NextResponse.json(await requestDownload(actor, assetId, clientIp(req.headers)));
});
