import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { deleteEditCutCore, updateEditCutCore } from "@/lib/edit-cuts-core";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; cutId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId, cutId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const updated = await updateEditCutCore(projectId, cutId, {
    ...(typeof body?.status === "string" ? { status: body.status } : {}),
    ...(typeof body?.notes === "string" ? { notes: body.notes } : {}),
    ...(typeof body?.durationLabel === "string" ? { durationLabel: body.durationLabel } : {}),
    ...(typeof body?.date === "string" ? { date: body.date ? new Date(body.date) : null } : {}),
  });
  if (!updated) return NextResponse.json({ error: "Corte no encontrado." }, { status: 404, headers: CORS_HEADERS });
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; cutId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId, cutId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  await deleteEditCutCore(projectId, cutId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
