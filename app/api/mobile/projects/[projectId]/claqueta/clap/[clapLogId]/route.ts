import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { deleteClapLogCore, updateClapLogCore } from "@/lib/clapboard-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// DELETE /api/mobile/projects/:projectId/claqueta/clap/:clapLogId —
// misma lógica que deleteClapLog en lib/actions/clapboard.ts.
// PATCH body: { good?, notes?, take?, shotNumber?, sceneNumber? } — parte de script.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; clapLogId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });
  }

  const { projectId, clapLogId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400, headers: CORS_HEADERS });
  }

  const ok = await updateClapLogCore(projectId, clapLogId, {
    ...(typeof body.good === "boolean" ? { good: body.good } : {}),
    ...(body.notes === null || typeof body.notes === "string" ? { notes: body.notes } : {}),
    ...(typeof body.take === "number" ? { take: body.take } : {}),
    ...(body.shotNumber === null || typeof body.shotNumber === "string" ? { shotNumber: body.shotNumber } : {}),
    ...(typeof body.sceneNumber === "string" ? { sceneNumber: body.sceneNumber } : {}),
  });
  if (!ok) {
    return NextResponse.json({ error: "Toma no encontrada o datos no válidos." }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; clapLogId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, clapLogId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await deleteClapLogCore(projectId, clapLogId);

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
