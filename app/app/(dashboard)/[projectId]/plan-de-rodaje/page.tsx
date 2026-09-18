import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { createShootingDay } from "@/lib/actions/shooting-days";
import { getProjectScheduleConflicts } from "@/lib/schedule-conflicts";
import { ShootingTimeline } from "@/components/ShootingTimeline";
import { EmptyState } from "@/components/EmptyState";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";

export default async function PlanDeRodajePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [profile, days, scenes, conflicts] = await Promise.all([
    getCurrentProfile(),
    prisma.shootingDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
    }),
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      include: {
        location: true,
        shootingDayScenes: { select: { shootingDayId: true } },
      },
    }),
    getProjectScheduleConflicts(projectId),
  ]);

  const createAction = createShootingDay.bind(null, projectId);

  const timelineDays = days.map((day) => ({
    id: day.id,
    label: day.date.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }),
    conflicts: conflicts.get(day.id) ?? [],
  }));

  const timelineScenes = scenes.map((scene) => ({
    id: scene.id,
    number: scene.number,
    intExtLabel: INT_EXT_LABELS[scene.intExt],
    dayPartLabel: DAY_PART_LABELS[scene.dayPart],
    locationName: scene.location?.name ?? null,
    dayId: scene.shootingDayScenes[0]?.shootingDayId ?? null,
  }));

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Producción"
        title="Plan de rodaje"
        description={
          days.length > 0
            ? `${scenes.length} escena${scenes.length === 1 ? "" : "s"} repartidas en ${days.length} día${
                days.length === 1 ? "" : "s"
              } de rodaje.`
            : undefined
        }
      />

      {scenes.length === 0 ? (
        <EmptyState
          title="Todavía no hay escenas"
          description="Créalas en Guion para poder planificarlas en días de rodaje."
          actionLabel="Ir a Guion"
          actionHref={`/app/${projectId}/guion`}
        />
      ) : (
        <ShootingTimeline
          projectId={projectId}
          days={timelineDays}
          initialScenes={timelineScenes}
          viewerLabel={profile?.fullName || profile?.email || "Alguien"}
        />
      )}

      <form action={createAction} className="mt-8 flex max-w-sm gap-2">
        <input
          type="date"
          name="date"
          required
          className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <SubmitButton
          pendingLabel="Creando…"
          className="shrink-0 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
        >
          Crear día
        </SubmitButton>
      </form>
    </div>
  );
}
