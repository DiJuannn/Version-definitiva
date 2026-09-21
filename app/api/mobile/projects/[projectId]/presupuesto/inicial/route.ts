import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { createStarterBudgetCore } from "@/lib/budget-core";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/mobile/projects/:projectId/presupuesto/inicial — crea las categorías típicas según el tipo de
// proyecto (solo títulos) cuando el presupuesto está vacío.
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const created = await createStarterBudgetCore(projectId, project.type);
  if (created === 0) {
    return NextResponse.json({ error: "Este presupuesto ya tiene categorías." }, { status: 400, headers: CORS_HEADERS });
  }
  return NextResponse.json({ created }, { headers: CORS_HEADERS });
}
