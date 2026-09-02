import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { updateDaySceneAssignmentsCore } from "@/lib/plan-de-rodaje-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// PATCH body: { sceneIds: string[] } — reemplaza por completo qué
// escenas están asignadas a este día (mismo enfoque "todo o nada" que
// updateDaySceneAssignments en la web); el orden es el de llegada del
// array y no se manda hora de citación desde el móvil por ahora.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dayId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, dayId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.sceneIds)) {
    return NextResponse.json(
      { error: "Faltan las escenas." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const assignments = body.sceneIds
    .filter((id: unknown): id is string => typeof id === "string")
    .map((sceneId: string, index: number) => ({
      sceneId,
      callTime: typeof body.callTimes?.[sceneId] === "string" ? body.callTimes[sceneId] : null,
      order: index,
    }));

  const ok = await updateDaySceneAssignmentsCore(projectId, dayId, assignments);
  if (!ok) {
    return NextResponse.json(
      { error: "Día no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
