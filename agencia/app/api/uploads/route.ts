import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current";
import { api, readJson } from "@/lib/http/api";
import { unauthorized } from "@/lib/http/errors";
import { startUpload } from "@/lib/services/media";

export const POST = api(async (req: NextRequest) => {
  const me = await getCurrentUser();
  if (!me) throw unauthorized();
  return NextResponse.json(await startUpload(me, await readJson(req)));
});
