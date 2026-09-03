import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getDashboardHero } from "@/lib/dashboard-data";
import { isPro } from "@/lib/plan";
import { FREE_ACTIVE_PROJECTS_LIMIT } from "@/lib/limits";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/dashboard — todo lo que pinta la pantalla "Inicio" de
// la app: proyecto activo con su progreso, proyectos recientes,
// contador de proyectos activos, próximo rodaje y presupuesto general.
// Misma fórmula que la web (lib/dashboard-data.ts, compartido con
// app/app/(dashboard)/page.tsx), solo como JSON.
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const data = await getDashboardHero(profile);

  return NextResponse.json(
    {
      activeProjectsCount: data.activeProjectsCount,
      budgetTotal: data.budgetTotal,
      isPro: isPro(profile.organization.plan),
      freeActiveProjectsLimit: FREE_ACTIVE_PROJECTS_LIMIT,
      nextShootingDay: data.nextShootingDay
        ? {
            id: data.nextShootingDay.id,
            date: data.nextShootingDay.date,
            projectId: data.nextShootingDay.projectId,
            projectName: data.nextShootingDay.project.name,
          }
        : null,
      hero: data.heroProject
        ? {
            id: data.heroProject.id,
            name: data.heroProject.name,
            currentStepTitle: data.heroCurrentTitle,
            stepsDone: data.heroDone,
            stepsTotal: data.heroTotal,
          }
        : null,
      recentProjects: data.recentProjects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        isOwnProject: project.organizationId === profile.organizationId,
        ownerLabel:
          project.createdBy?.fullName ?? project.createdBy?.email ?? project.organization.name,
      })),
    },
    { headers: CORS_HEADERS },
  );
}
