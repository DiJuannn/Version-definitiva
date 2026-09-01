import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { INT_EXT_LABELS, DAY_PART_LABELS } from "@/lib/labels";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/guion — lista de escenas, igual
// que app/app/(dashboard)/[projectId]/guion/page.tsx. Sin el archivo del
// guion ni el análisis con IA todavía — la app se queda por ahora en
// crear y editar escenas a mano.
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

  const scenes = await prisma.scene.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      intExt: true,
      dayPart: true,
      location: { select: { name: true } },
      _count: { select: { characters: true } },
    },
  });

  return NextResponse.json(
    {
      scenes: scenes.map((scene) => ({
        id: scene.id,
        number: scene.number,
        intExtLabel: INT_EXT_LABELS[scene.intExt],
        dayPartLabel: DAY_PART_LABELS[scene.dayPart],
        locationName: scene.location?.name ?? null,
        charactersCount: scene._count.characters,
      })),
    },
    { headers: CORS_HEADERS },
  );
}
