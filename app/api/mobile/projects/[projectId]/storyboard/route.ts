import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/storyboard — mismos datos que
// app/app/(dashboard)/[projectId]/storyboard/page.tsx, solo escenas
// que ya tienen planos.
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
      shots: {
        orderBy: [{ order: "asc" }, { number: "asc" }],
        select: {
          id: true,
          number: true,
          description: true,
          storyboard: {
            orderBy: { order: "asc" },
            select: { id: true, imageUrl: true, description: true },
          },
        },
      },
    },
  });

  const scenesWithShots = scenes.filter((scene) => scene.shots.length > 0);

  return NextResponse.json({ scenes: scenesWithShots }, { headers: CORS_HEADERS });
}
