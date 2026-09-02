import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile, getProjectOwnerLabel } from "@/lib/project-access";
import { deleteProjectCore } from "@/lib/project-delete-core";
import { updateProjectDetailsCore } from "@/lib/project-details-core";
import { isProjectOwnerPro } from "@/lib/project-plan";
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
  const [ownerLabel, isOwnerOrgPro] = await Promise.all([
    isOwnerOrg ? null : getProjectOwnerLabel(project),
    isProjectOwnerPro(project.organizationId),
  ]);

  return NextResponse.json(
    {
      project: {
        id: project.id,
        name: project.name,
        type: project.type,
        status: project.status,
        director: project.director,
        producer: project.producer,
        durationLabel: project.durationLabel,
        startDate: project.startDate ? project.startDate.toISOString() : null,
        endDate: project.endDate ? project.endDate.toISOString() : null,
        budgetTarget: project.budgetTarget !== null ? Number(project.budgetTarget) : null,
        notes: project.notes,
        isOwnerOrg,
        ownerLabel,
        // Función de PRO — la de la organización DUEÑA del proyecto, no
        // la del usuario que mira (puede ser un proyecto compartido).
        isOwnerOrgPro,
        createdAt: project.createdAt,
      },
    },
    { headers: CORS_HEADERS },
  );
}

// PATCH /api/mobile/projects/:projectId — mismos campos que
// ProjectSummaryCard.tsx en la web (lib/project-details-core.ts hace la
// validación y el guardado real, no se repite aquí). Igual que en la
// web, cualquiera con acceso al proyecto (dueño o compartido) puede
// editar estos datos — no hace falta ser el propietario, a diferencia
// de borrar el proyecto entero.
export async function PATCH(
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
  if (!name) {
    return NextResponse.json(
      { error: "El nombre es obligatorio." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  await updateProjectDetailsCore(projectId, project.status, {
    name,
    type: typeof body.type === "string" ? body.type : null,
    status: typeof body.status === "string" ? body.status : null,
    director: typeof body.director === "string" ? body.director : null,
    producer: typeof body.producer === "string" ? body.producer : null,
    durationLabel: typeof body.durationLabel === "string" ? body.durationLabel : null,
    startDate: typeof body.startDate === "string" ? body.startDate : null,
    endDate: typeof body.endDate === "string" ? body.endDate : null,
    budgetTarget: typeof body.budgetTarget === "number" ? body.budgetTarget : null,
    notes: typeof body.notes === "string" ? body.notes : null,
  });

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
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
