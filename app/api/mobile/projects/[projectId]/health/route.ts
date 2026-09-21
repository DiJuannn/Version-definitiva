import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { getProjectOverview } from "@/lib/project-roadmap";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { getProjectFacts } from "@/lib/tool-access";
import { computeAccess, computeStage } from "@/lib/tool-rules";

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
  const [{ healthMetrics, steps, toolStats, nextShoot, budget }, facts] = await Promise.all([
    getProjectOverview(projectId, budgetTarget),
    getProjectFacts(projectId),
  ]);

  // `steps` es la misma Hoja de ruta que ProjectRoadmap.tsx en la web — se
  // añade aquí en vez de crear una ruta nueva porque ya se calcula junto
  // con `healthMetrics` en la misma consulta a getProjectOverview.
  return NextResponse.json(
    // `access`: qué herramientas se enseñan ya (mismas reglas que la portada guiada de la web).
    {
      metrics: healthMetrics,
      roadmap: steps,
      toolStats,
      access: computeAccess(facts),
      stage: computeStage(facts),
      // Para la portada guiada de la app (etapas Rodar y Entregar).
      status: project.status,
      scenes: facts.scenes,
      nextShoot,
      budget,
    },
    { headers: CORS_HEADERS },
  );
}
