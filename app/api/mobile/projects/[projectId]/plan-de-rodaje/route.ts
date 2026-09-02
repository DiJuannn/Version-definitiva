import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { createShootingDayCore } from "@/lib/plan-de-rodaje-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/plan-de-rodaje — lista simple de
// días de rodaje (fecha + nº de escenas asignadas), sin el timeline de
// arrastrar y soltar de la web (app/app/(dashboard)/[projectId]/plan-de-rodaje/page.tsx).
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
    select: { id: true, date: true, notes: true, _count: { select: { scenes: true } } },
  });

  return NextResponse.json(
    {
      days: days.map((d) => ({
        id: d.id,
        date: d.date,
        notes: d.notes,
        scenesCount: d._count.scenes,
      })),
    },
    { headers: CORS_HEADERS },
  );
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
  if (!body || typeof body.date !== "string") {
    return NextResponse.json(
      { error: "Falta la fecha." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const result = await createShootingDayCore(projectId, new Date(body.date));
  if (!result) {
    return NextResponse.json(
      { error: "Fecha inválida." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(result, { headers: CORS_HEADERS });
}
