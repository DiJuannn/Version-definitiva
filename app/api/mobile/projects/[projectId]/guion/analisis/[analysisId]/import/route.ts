import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { importScriptAnalysisCore } from "@/lib/script-analysis-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST — cuerpo { characterIndices, locationIndices, props: [{index,
// category}], sceneIndices } — misma importación que
// app/app/(dashboard)/[projectId]/guion/analisis/[analysisId]/page.tsx,
// pero con índices seleccionados explícitos en vez de un FormData con
// checkboxes.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; analysisId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, analysisId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400, headers: CORS_HEADERS });
  }

  const ok = await importScriptAnalysisCore(projectId, project.organizationId, analysisId, {
    characterIndices: Array.isArray(body.characterIndices) ? body.characterIndices : [],
    locationIndices: Array.isArray(body.locationIndices) ? body.locationIndices : [],
    props: Array.isArray(body.props) ? body.props : [],
    sceneIndices: Array.isArray(body.sceneIndices) ? body.sceneIndices : [],
  });
  if (!ok) {
    return NextResponse.json(
      { error: "No se encontró el análisis." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
