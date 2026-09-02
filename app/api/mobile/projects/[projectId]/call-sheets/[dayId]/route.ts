import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { upsertCallSheetCore } from "@/lib/call-sheets-core";
import { INT_EXT_LABELS, DAY_PART_LABELS } from "@/lib/labels";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET — misma información que
// app/app/(dashboard)/[projectId]/call-sheets/[dayId]/page.tsx, sin el
// enlace de exportar a PDF (se queda en la web por ahora).
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

  const summary = await getShootingDaySummary(dayId);
  if (!summary || summary.shootingDay.projectId !== projectId) {
    return NextResponse.json(
      { error: "Día no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const callSheet = summary.shootingDay.callSheet;

  return NextResponse.json(
    {
      date: summary.shootingDay.date,
      callSheet: callSheet
        ? {
            generalCallTime: callSheet.generalCallTime,
            transportNotes: callSheet.transportNotes,
            cateringNotes: callSheet.cateringNotes,
            additionalNotes: callSheet.additionalNotes,
          }
        : null,
      locations: summary.locations.map((l) => l.name),
      scenes: summary.sceneAssignments.map((a) => ({
        callTime: a.callTime,
        number: a.scene.number,
        intExtLabel: INT_EXT_LABELS[a.scene.intExt],
        dayPartLabel: DAY_PART_LABELS[a.scene.dayPart],
        locationName: a.scene.location?.name ?? null,
        characterNames: a.scene.characters.map((c) => c.character.name),
      })),
      cast: summary.characters.map((c) => ({ name: c.name, actorName: c.actor?.name ?? null })),
      crewMembers: summary.crewMembers.map((c) => c.name),
      breakdownElements: summary.breakdownElements.map((b) => b.name),
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
  const ok = await upsertCallSheetCore(projectId, dayId, {
    generalCallTime: typeof body?.generalCallTime === "string" ? body.generalCallTime : null,
    transportNotes: typeof body?.transportNotes === "string" ? body.transportNotes : null,
    cateringNotes: typeof body?.cateringNotes === "string" ? body.cateringNotes : null,
    additionalNotes: typeof body?.additionalNotes === "string" ? body.additionalNotes : null,
  });

  if (!ok) {
    return NextResponse.json(
      { error: "Día no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
