import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { createCrewMemberCore } from "@/lib/breakdown-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/mobile/projects/:projectId/desglose/crew — siempre a mano
// (personId null): la app todavía no tiene la sección "Equipo" de la
// organización para poder vincular una persona ya existente, a
// diferencia del formulario de la web.
export async function POST(
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
      { error: "Falta el nombre." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const crewMember = await createCrewMemberCore(projectId, project.organizationId, {
    personId: null,
    name,
    role: typeof body.role === "string" ? body.role : null,
    email: typeof body.email === "string" ? body.email : null,
    phone: typeof body.phone === "string" ? body.phone : null,
    notes: null,
  });

  if (!crewMember) {
    return NextResponse.json(
      { error: "No se pudo añadir." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id: crewMember.id }, { headers: CORS_HEADERS });
}
