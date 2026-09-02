import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/call-sheets — un día de rodaje
// por fila, igual que app/app/(dashboard)/[projectId]/call-sheets/page.tsx.
export async function GET(
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

  const days = await prisma.shootingDay.findMany({
    where: { projectId },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      callSheet: { select: { id: true } },
      _count: { select: { scenes: true } },
    },
  });

  return NextResponse.json(
    {
      days: days.map((d) => ({
        id: d.id,
        date: d.date,
        generated: Boolean(d.callSheet),
        scenesCount: d._count.scenes,
      })),
    },
    { headers: CORS_HEADERS },
  );
}
