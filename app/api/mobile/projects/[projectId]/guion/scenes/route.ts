import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { createSceneCore, deleteAllScenesCore } from "@/lib/scenes-core";
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
  const number = typeof body?.number === "string" ? body.number : "";

  const scene = await createSceneCore(projectId, number);
  if (!scene) {
    return NextResponse.json(
      { error: "Falta el número de escena." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id: scene.id, number: scene.number }, { headers: CORS_HEADERS });
}

// DELETE — borra TODAS las escenas del proyecto (reparto, desglose y
// equipo asignados a cada una se van con ellas por cascade). Mismo botón
// "Eliminar todas" que ya tiene la web en Guion.
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

  await deleteAllScenesCore(projectId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
