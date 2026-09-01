import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/desglose — mismas dos listas que
// app/app/(dashboard)/[projectId]/desglose/page.tsx en la web (elementos
// del desglose + equipo técnico). Sin la lista de Person de la
// organización: la app todavía no tiene la sección "Equipo" propia, así
// que crear un miembro desde el móvil siempre es a mano, sin vincular.
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

  const [elements, crewMembers] = await Promise.all([
    prisma.breakdownElement.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        notes: true,
        _count: { select: { scenes: true } },
      },
    }),
    prisma.crewMember.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        phone: true,
        _count: { select: { scenes: true } },
      },
    }),
  ]);

  return NextResponse.json(
    {
      elements: elements.map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category,
        notes: e.notes,
        scenesCount: e._count.scenes,
      })),
      crewMembers: crewMembers.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        email: c.email,
        phone: c.phone,
        scenesCount: c._count.scenes,
      })),
    },
    { headers: CORS_HEADERS },
  );
}
