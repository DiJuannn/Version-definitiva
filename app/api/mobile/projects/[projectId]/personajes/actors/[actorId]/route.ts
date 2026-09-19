import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { deleteActorCore, updateActorCore } from "@/lib/personajes-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// PATCH body: { name, email?, phone?, rate?, availability?, notes? } — sustituye
// todos los datos del actor (lo que no se manda queda vacío), como el formulario web.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; actorId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });
  }

  const { projectId, actorId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Falta el nombre del actor." }, { status: 400, headers: CORS_HEADERS });
  }

  const ok = await updateActorCore(projectId, actorId, {
    name: body.name,
    email: text(body.email),
    phone: text(body.phone),
    rate: typeof body.rate === "number" && Number.isFinite(body.rate) ? body.rate : null,
    availability: text(body.availability),
    notes: text(body.notes),
  });
  if (!ok) {
    return NextResponse.json({ error: "Actor no encontrado." }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; actorId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, actorId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await deleteActorCore(projectId, actorId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
