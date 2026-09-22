import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { deleteFestivalSubmissionCore, updateFestivalSubmissionCore } from "@/lib/festival-submissions-core";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; submissionId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId, submissionId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const updated = await updateFestivalSubmissionCore(projectId, submissionId, {
    ...(typeof body?.status === "string" ? { status: body.status } : {}),
    ...(typeof body?.notes === "string" ? { notes: body.notes } : {}),
    ...(typeof body?.submittedAt === "string" ? { submittedAt: body.submittedAt ? new Date(body.submittedAt) : null } : {}),
  });
  if (!updated) return NextResponse.json({ error: "Envío no encontrado." }, { status: 404, headers: CORS_HEADERS });
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; submissionId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId, submissionId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  await deleteFestivalSubmissionCore(projectId, submissionId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
