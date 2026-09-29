import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/auth/crypto";
import { processOutbox } from "@/lib/notifications/outbox";

/** Procesa emails pendientes. Protegido con CRON_SECRET (cabecera Authorization: Bearer …). */
export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await processOutbox(50));
}
