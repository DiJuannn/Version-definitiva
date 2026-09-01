import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { createActorCore } from "@/lib/personajes-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

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
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Falta el nombre del actor." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const id = await createActorCore(projectId, project.organizationId, {
    name: body.name,
    email: typeof body.email === "string" ? body.email : null,
    phone: typeof body.phone === "string" ? body.phone : null,
    availability: typeof body.availability === "string" ? body.availability : null,
    notes: typeof body.notes === "string" ? body.notes : null,
  });

  if (!id) {
    return NextResponse.json(
      { error: "No se pudo crear el actor." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id }, { headers: CORS_HEADERS });
}
