import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { createBreakdownElementCore } from "@/lib/breakdown-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/mobile/projects/:projectId/desglose/elements — reutiliza
// createBreakdownElementCore, igual que la Server Action de la web.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = typeof body?.category === "string" ? body.category : "";
  if (!name || !category) {
    return NextResponse.json(
      { error: "Faltan el nombre o la categoría." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const element = await createBreakdownElementCore(projectId, {
    name,
    category,
    notes: typeof body.notes === "string" ? body.notes : null,
  });

  if (!element) {
    return NextResponse.json(
      { error: "No se pudo crear el elemento." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id: element.id }, { headers: CORS_HEADERS });
}
