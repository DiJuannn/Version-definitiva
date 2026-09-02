import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/guion/continuidad/:checkId — mismas
// alertas que
// app/app/(dashboard)/[projectId]/guion/continuidad/[checkId]/page.tsx.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; checkId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, checkId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const check = await prisma.continuityCheck.findFirst({
    where: { id: checkId, projectId },
    include: { issues: { orderBy: { createdAt: "asc" } } },
  });
  if (!check) {
    return NextResponse.json(
      { error: "Revisión no encontrada." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      status: check.status,
      issues: check.issues.map((issue) => ({
        id: issue.id,
        type: issue.type,
        title: issue.title,
        description: issue.description,
        sceneNumbers: issue.sceneNumbers,
        status: issue.status,
      })),
    },
    { headers: CORS_HEADERS },
  );
}
