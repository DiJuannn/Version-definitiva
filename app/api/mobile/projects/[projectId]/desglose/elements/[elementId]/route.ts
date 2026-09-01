import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import {
  deleteBreakdownElementCore,
  updateBreakdownElementCategoryCore,
} from "@/lib/breakdown-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; elementId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, elementId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await deleteBreakdownElementCore(projectId, elementId);

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

// PATCH /api/mobile/projects/:projectId/desglose/elements/:elementId —
// solo cambia la categoría, para corregir elementos mal clasificados
// (por ejemplo por el análisis de IA) sin perder sus escenas vinculadas.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; elementId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, elementId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category : "";

  await updateBreakdownElementCategoryCore(projectId, elementId, category);

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
