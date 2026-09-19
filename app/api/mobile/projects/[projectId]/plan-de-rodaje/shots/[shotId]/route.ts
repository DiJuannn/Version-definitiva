import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { assignShotToDayCore, setShotDoneCore } from "@/lib/plan-de-rodaje-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// PATCH body: { done?: boolean, dayId?: string | null }
// — marca un plano como rodado y/o lo pasa a otro día (null = sin planificar).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; shotId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });
  }

  const { projectId, shotId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  if (!body || (typeof body.done !== "boolean" && !("dayId" in body))) {
    return NextResponse.json({ error: "Nada que cambiar." }, { status: 400, headers: CORS_HEADERS });
  }

  if ("dayId" in body) {
    const dayId = typeof body.dayId === "string" ? body.dayId : null;
    const result = await assignShotToDayCore(projectId, shotId, dayId);
    if (!result) {
      return NextResponse.json({ error: "Plano o día no encontrado." }, { status: 404, headers: CORS_HEADERS });
    }
  }
  if (typeof body.done === "boolean") {
    const ok = await setShotDoneCore(projectId, shotId, body.done);
    if (!ok) {
      return NextResponse.json(
        { error: "Ese plano no tiene día asignado o no existe." },
        { status: 400, headers: CORS_HEADERS },
      );
    }
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
