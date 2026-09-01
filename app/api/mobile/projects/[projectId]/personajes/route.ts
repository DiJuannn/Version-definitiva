import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/personajes — mismos datos que
// app/app/(dashboard)/[projectId]/personajes/page.tsx, sin la lista de
// Person de la organización (la app no vincula actores a Equipo, ver
// createActorCore en lib/personajes-core.ts).
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

  const [actors, characters] = await Promise.all([
    prisma.actor.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, phone: true, availability: true },
    }),
    prisma.character.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, notes: true, actorId: true },
    }),
  ]);

  return NextResponse.json({ actors, characters }, { headers: CORS_HEADERS });
}
