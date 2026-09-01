import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { getProjectSummary } from "@/lib/project-summary";
import {
  DAY_PART_LABELS,
  INT_EXT_LABELS,
  BREAKDOWN_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/labels";
import { BreakdownCategory } from "@/lib/generated/prisma";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

// GET /api/mobile/projects/:projectId/summary — el mismo "Resumen" que
// la web (app/app/(dashboard)/[projectId]/resumen/page.tsx,
// lib/project-summary.ts), con las etiquetas ya traducidas en el
// propio JSON para no duplicar los mapas de lib/labels.ts en la app.
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

  const {
    project: full,
    locations,
    shotsTotal,
    storyboardFramesCount,
    budgetCategoriesWithTotals,
    budgetGrandTotal,
  } = await getProjectSummary(projectId);

  const budgetTarget = project.budgetTarget !== null ? Number(project.budgetTarget) : null;
  const charactersWithActor = full.characters.filter((c) => c.actorId).length;
  const scenesWithLocation = full.scenes.filter((s) => s.locationId).length;

  const breakdown = Object.values(BreakdownCategory)
    .map((category) => ({
      category,
      label: BREAKDOWN_CATEGORY_LABELS[category],
      items: full.breakdownElements.filter((el) => el.category === category).map((el) => el.name),
    }))
    .filter((group) => group.items.length > 0);

  return NextResponse.json(
    {
      project: {
        name: project.name,
        statusLabel: PROJECT_STATUS_LABELS[project.status],
      },
      stats: {
        scenesCount: full.scenes.length,
        shootingDaysCount: full.shootingDays.length,
        budgetSpentLabel: budgetTarget
          ? `${currency(budgetGrandTotal)} / ${currency(budgetTarget)}`
          : currency(budgetGrandTotal),
      },
      scenes: {
        withLocation: scenesWithLocation,
        total: full.scenes.length,
        items: full.scenes.map((scene) => ({
          id: scene.id,
          number: scene.number,
          detail: [
            INT_EXT_LABELS[scene.intExt],
            DAY_PART_LABELS[scene.dayPart],
            scene.location?.name,
          ]
            .filter(Boolean)
            .join(" · "),
          meta: `${scene.characters.length} pj · ${scene._count.shots} planos`,
        })),
      },
      characters: {
        withActor: charactersWithActor,
        total: full.characters.length,
        items: full.characters.map((c) => ({
          id: c.id,
          name: c.name,
          actorName: c.actor?.name ?? "Sin actor asignado",
        })),
      },
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        sceneCount: l.sceneCount,
      })),
      breakdown,
      breakdownTotal: full.breakdownElements.length,
      budget: {
        categories: budgetCategoriesWithTotals.map((c) => ({
          id: c.id,
          name: c.name,
          totalLabel: currency(c.total),
        })),
        grandTotalLabel: currency(budgetGrandTotal),
      },
      shootingDays: full.shootingDays.map((day) => ({
        id: day.id,
        dateLabel: day.date.toLocaleDateString("es-ES"),
        scenesCount: day.scenes.length,
        hasCallSheet: !!day.callSheet,
      })),
      shotsTotal,
      storyboardFramesCount,
    },
    { headers: CORS_HEADERS },
  );
}
