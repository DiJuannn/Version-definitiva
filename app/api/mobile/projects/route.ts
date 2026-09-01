import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { listProjectsForProfile } from "@/lib/project-access";

// GET /api/mobile/projects — lista de proyectos para la app móvil.
// Misma consulta y misma regla de acceso que /app/proyectos en la web
// (listProjectsForProfile en lib/project-access.ts): organización propia
// + proyectos compartidos directamente. Solo cambia cómo se identifica
// al usuario (token en vez de cookie) y que la respuesta es JSON.
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const projects = await listProjectsForProfile(profile);

  return NextResponse.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      isOwnProject: project.organizationId === profile.organizationId,
      ownerLabel: project.createdBy?.fullName ?? project.createdBy?.email ?? project.organization.name,
      createdAt: project.createdAt,
    })),
  });
}
