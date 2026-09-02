import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { updateContinuityIssueStatusCore } from "@/lib/continuity-core";
import { ContinuityIssueStatus } from "@/lib/generated/prisma";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; checkId: string; issueId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, checkId, issueId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!(Object.values(ContinuityIssueStatus) as string[]).includes(status)) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400, headers: CORS_HEADERS });
  }

  await updateContinuityIssueStatusCore(projectId, checkId, issueId, status as ContinuityIssueStatus);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
