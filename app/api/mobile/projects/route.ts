import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { listProjectsForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects — lista de proyectos para la app móvil.
// Misma consulta y misma regla de acceso que /app/proyectos en la web
// (listProjectsForProfile en lib/project-access.ts): organización propia
// + proyectos compartidos directamente. Solo cambia cómo se identifica
// al usuario (token en vez de cookie) y que la respuesta es JSON.
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const projects = await listProjectsForProfile(profile);

  return NextResponse.json(
    {
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        isOwnProject: project.organizationId === profile.organizationId,
        ownerLabel: project.createdBy?.fullName ?? project.createdBy?.email ?? project.organization.name,
        createdAt: project.createdAt,
      })),
    },
    { headers: CORS_HEADERS },
  );
}

// POST /api/mobile/projects — crear un proyecto desde la app. Misma
// creación mínima que createProject en lib/actions/projects.ts (solo
// nombre; el resto de campos se rellenan después desde "Resumen").
export async function POST(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Ponle un nombre al proyecto." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const project = await prisma.project.create({
    data: { name, organizationId: profile.organizationId, createdById: profile.id },
  });

  return NextResponse.json(
    { project: { id: project.id, name: project.name } },
    { status: 201, headers: CORS_HEADERS },
  );
}
