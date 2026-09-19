import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { getScriptReport } from "@/lib/script-report";
import { addManualTakeCore } from "@/lib/clapboard-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/script — el parte de script: todas las
// tomas (de la claqueta o a mano) por día → escena → plano.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });
  }

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json(await getScriptReport(projectId), { headers: CORS_HEADERS });
}

// POST body: { sceneNumber, shotNumber?, take, good?, notes?, date? } — toma apuntada a mano.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });
  }

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.sceneNumber !== "string" || typeof body.take !== "number") {
    return NextResponse.json({ error: "Faltan la escena o la toma." }, { status: 400, headers: CORS_HEADERS });
  }

  const result = await addManualTakeCore(projectId, {
    sceneNumber: body.sceneNumber,
    shotNumber: typeof body.shotNumber === "string" ? body.shotNumber : null,
    take: body.take,
    good: body.good === true,
    notes: typeof body.notes === "string" ? body.notes : null,
    date: typeof body.date === "string" ? body.date : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400, headers: CORS_HEADERS });
  }
  return NextResponse.json({ id: result.id }, { status: 201, headers: CORS_HEADERS });
}
