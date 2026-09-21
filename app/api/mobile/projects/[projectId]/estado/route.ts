import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { logActivity } from "@/lib/activity-log";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";
import { ProjectStatus } from "@/lib/generated/prisma";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/mobile/projects/:projectId/estado { status } — cambia solo el estado del proyecto (los botones
// «Empezar el rodaje», «He terminado de rodar», «Está terminado»). Lo demás del proyecto no se toca.
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = typeof body?.status === "string" ? body.status : "";
  if (!(Object.values(ProjectStatus) as string[]).includes(status)) {
    return NextResponse.json({ error: "Estado no válido." }, { status: 400, headers: CORS_HEADERS });
  }
  if (project.status !== status) {
    await prisma.project.update({ where: { id: projectId }, data: { status: status as ProjectStatus } });
    await logActivity(projectId, profile.id, `cambió el estado a «${PROJECT_STATUS_LABELS[status as ProjectStatus]}»`);
  }
  return NextResponse.json({ status }, { headers: CORS_HEADERS });
}
