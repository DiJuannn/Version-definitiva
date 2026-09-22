import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { getEditSelects } from "@/lib/edit-selects";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/montaje/seleccion — mismas tomas buenas que Montaje →
// Selección en la web, por escena.
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const selects = await getEditSelects(projectId);
  return NextResponse.json(selects, { headers: CORS_HEADERS });
}
