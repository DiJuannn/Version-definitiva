import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/claqueta — mismas 3 consultas que
// app/app/(dashboard)/[projectId]/claqueta/page.tsx en la web: escenas,
// últimas 20 tomas, y la toma máxima ya usada por número de escena.
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

  const [scenes, recentLog, takeAggregates] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        location: { select: { name: true } },
      },
    }),
    prisma.clapLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        sceneNumber: true,
        shotNumber: true,
        take: true,
        director: true,
        camera: true,
        createdAt: true,
      },
    }),
    prisma.clapLog.groupBy({
      by: ["sceneNumber"],
      where: { projectId },
      _max: { take: true },
    }),
  ]);

  const lastTakeBySceneNumber = Object.fromEntries(
    takeAggregates.map((row) => [row.sceneNumber, row._max.take ?? 0]),
  );

  return NextResponse.json(
    {
      scenes: scenes.map((scene) => ({
        id: scene.id,
        number: scene.number,
        intExt: scene.intExt,
        dayPart: scene.dayPart,
        locationName: scene.location?.name ?? null,
      })),
      log: recentLog.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
      lastTakeBySceneNumber,
    },
    { headers: CORS_HEADERS },
  );
}
