import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile, getProjectOwnerLabel } from "@/lib/project-access";
import { deleteProjectCore } from "@/lib/project-delete-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

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

  const isOwnerOrg = project.organizationId === profile.organizationId;
  const ownerLabel = isOwnerOrg ? null : await getProjectOwnerLabel(project);

  return NextResponse.json(
    {
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
    },
    { headers: CORS_HEADERS },
  );
}

// DELETE /api/mobile/projects/:projectId — misma restricción que la
// web (lib/actions/projects.ts): solo la organización propietaria
// puede borrar, aunque el proyecto esté compartido contigo.
export async function DELETE(
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

  if (project.organizationId !== profile.organizationId) {
    return NextResponse.json(
      { error: "No puedes eliminar un proyecto que no es tuyo." },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  await deleteProjectCore(projectId);

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
