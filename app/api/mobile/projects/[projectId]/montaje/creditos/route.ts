import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { formatProjectCreditsText, getProjectCredits } from "@/lib/project-credits";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/montaje/creditos — créditos de cierre (PRO), a partir del
// reparto y el equipo técnico que ya tiene el proyecto.
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const isPro = await isProjectOwnerPro(project.organizationId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Los créditos automáticos son una función PRO.", upgrade: true },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const credits = await getProjectCredits(projectId);
  return NextResponse.json({ credits, text: formatProjectCreditsText(credits) }, { headers: CORS_HEADERS });
}
