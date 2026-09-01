import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { getProjectOverview } from "@/lib/project-roadmap";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/health — los mismos 4 anillos de
// "Salud del proyecto" que ProjectHealthMini.tsx en la web
// (lib/project-roadmap.ts calcula los ratios, no se repite el cálculo).
export async function GET(
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

  const budgetTarget = project.budgetTarget !== null ? Number(project.budgetTarget) : null;
  const { healthMetrics } = await getProjectOverview(projectId, budgetTarget);

  return NextResponse.json({ metrics: healthMetrics }, { headers: CORS_HEADERS });
}
