import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { deleteShootingDayCore, updateShootingDayCore } from "@/lib/plan-de-rodaje-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET — ficha del día: fecha/notas, todas las escenas del proyecto
// (para elegir cuáles asignar) con su hora de citación si ya lo están,
// y el resumen (localizaciones/personajes/equipo/desglose) derivado de
// esas escenas. Sin reservas de material/vehículos ni avisos de
// conflicto — se quedan en la web por ahora.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dayId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, dayId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const [summary, allScenes] = await Promise.all([
    getShootingDaySummary(dayId),
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: { id: true, number: true, location: { select: { name: true } } },
    }),
  ]);

  if (!summary || summary.shootingDay.projectId !== projectId) {
    return NextResponse.json(
      { error: "Día no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const assignedByScene = new Map(summary.sceneAssignments.map((a) => [a.sceneId, a]));

  return NextResponse.json(
    {
      day: {
        id: summary.shootingDay.id,
        date: summary.shootingDay.date,
        notes: summary.shootingDay.notes,
      },
      scenes: allScenes.map((scene) => ({
        id: scene.id,
        number: scene.number,
        locationName: scene.location?.name ?? null,
        assigned: assignedByScene.has(scene.id),
        callTime: assignedByScene.get(scene.id)?.callTime ?? null,
      })),
      summary: {
        locations: summary.locations.map((l) => l.name),
        characters: summary.characters.map((c) => c.name),
        crewMembers: summary.crewMembers.map((c) => c.name),
        breakdownElements: summary.breakdownElements.map((b) => b.name),
      },
    },
    { headers: CORS_HEADERS },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dayId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, dayId } = await params;
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

  const ok = await updateShootingDayCore(projectId, dayId, {
    date: new Date(body.date),
    notes: typeof body.notes === "string" ? body.notes : null,
  });

  if (!ok) {
    return NextResponse.json(
      { error: "Fecha inválida." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dayId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, dayId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await deleteShootingDayCore(projectId, dayId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
