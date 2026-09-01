import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile, getProjectOwnerLabel } from "@/lib/project-access";

// GET /api/mobile/projects/:projectId — resumen de un proyecto para la
// app móvil. Misma comprobación de acceso que la web
// (getProjectForProfile) y mismo cálculo de "Propietario"
// (getProjectOwnerLabel) — nada de esto se ha vuelto a escribir, solo se
// llama desde aquí además de desde la página de la web.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  const isOwnerOrg = project.organizationId === profile.organizationId;
  const ownerLabel = isOwnerOrg ? null : await getProjectOwnerLabel(project);

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      producer: project.producer,
      budgetTarget: project.budgetTarget !== null ? Number(project.budgetTarget) : null,
      isOwnerOrg,
      ownerLabel,
      createdAt: project.createdAt,
    },
  });
}
