import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { createShootingDay } from "@/lib/actions/shooting-days";
import { getProjectScheduleConflicts } from "@/lib/schedule-conflicts";
import { ShootingTimeline } from "@/components/ShootingTimeline";
import { ScheduleAssistant } from "@/components/ScheduleAssistant";
import { EmptyState } from "@/components/EmptyState";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/PageHeader";
import { NewShootingDayButton } from "@/components/NewShootingDayButton";

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
        shots: {
          orderBy: [{ order: "asc" }, { number: "asc" }],
          select: {
            id: true,
            number: true,
            shotSize: true,
            description: true,
            shootingDayId: true,
            done: true,
          },
        },
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
    shots: scene.shots.map((shot) => ({
      id: shot.id,
      label: `${scene.number}.${shot.number}`,
      size: shot.shotSize,
      description: shot.description,
      dayId: shot.shootingDayId,
      done: shot.done,
    })),
  }));

  const unscheduled = scenes.filter(
    (scene) =>
      scene.shootingDayScenes.length === 0 &&
      !scene.shots.some((sh) => sh.shootingDayId),
  ).length;
  const shotsTotal = scenes.reduce((n, scene) => n + scene.shots.length, 0);
  const shotsPlanned = scenes.reduce(
    (n, scene) => n + scene.shots.filter((sh) => sh.shootingDayId).length,
    0,
  );
  const shotsDone = scenes.reduce(
    (n, scene) => n + scene.shots.filter((sh) => sh.done).length,
    0,
  );

  const stats = [
    {
      value: days.length,
      label: days.length === 1 ? "día de rodaje" : "días de rodaje",
    },
    {
      value: scenes.length - unscheduled,
      of: scenes.length,
      label: "escenas con día",
    },
    ...(shotsTotal > 0
      ? [{ value: shotsPlanned, of: shotsTotal, label: "planos con día" }]
      : []),
    ...(shotsDone > 0
      ? [
          {
            value: shotsDone,
            label: shotsDone === 1 ? "plano rodado" : "planos rodados",
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Producción"
        title="Plan de rodaje"
        description={
          days.length === 0
            ? "Qué se rueda cada día. Reparte las escenas (o sus planos) entre los días de rodaje; con eso se hacen solas las hojas de llamada."
            : "Arrastra una escena a otro día para cambiarla (en el móvil, mantenla pulsada). Se guarda sola. Pulsa la fecha de un día para ver su ficha."
        }
        actions={
          <NewShootingDayButton
            action={createAction}
            variant={
              days.length === 0 && unscheduled > 0 ? "outline" : "primary"
            }
          />
        }
      />

      {/* Cifras sueltas sobre la página, sin caja por número. */}
      {days.length > 0 && (
        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-3xl leading-none font-black tabular-nums">
                {s.value}
                {s.of !== undefined && (
                  <span className="text-muted">/{s.of}</span>
                )}
              </dd>
              <dd aria-hidden className="eyebrow mt-1.5">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {unscheduled > 0 && (
        <ScheduleAssistant
          projectId={projectId}
          unscheduled={unscheduled}
          hasDays={days.length > 0}
        />
      )}

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
    </div>
  );
}
