import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import {
  deleteCharacterCore,
  updateCharacterActorCore,
  updateCharacterCore,
} from "@/lib/personajes-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; characterId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, characterId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  // Con "name" se edita el personaje (nombre y notas); si no, solo cambia de actor.
  if (typeof body?.name === "string") {
    const ok = await updateCharacterCore(projectId, characterId, {
      name: body.name,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Nombre no válido." },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  }

  const actorId = typeof body?.actorId === "string" ? body.actorId : null;

  await updateCharacterActorCore(projectId, characterId, actorId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; characterId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, characterId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await deleteCharacterCore(projectId, characterId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
