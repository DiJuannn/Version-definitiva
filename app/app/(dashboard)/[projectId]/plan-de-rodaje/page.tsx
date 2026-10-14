import Link from "next/link";
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

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

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
      include: { callSheet: { select: { generalCallTime: true } } },
    }),
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      include: {
        location: true,
        shootingDayScenes: { select: { shootingDayId: true } },
        characters: {
          select: { character: { select: { name: true } } },
          orderBy: { character: { name: "asc" } },
        },
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
    longLabel: day.date.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "long",
    }),
    callTime: day.callSheet?.generalCallTime ?? null,
    conflicts: conflicts.get(day.id) ?? [],
  }));

  const timelineScenes = scenes.map((scene) => ({
    id: scene.id,
    number: scene.number,
    intExt: scene.intExt,
    dayPart: scene.dayPart,
    heading: scene.description,
    characters: scene.characters.map((c) => c.character.name),
    sceneDayIds: scene.shootingDayScenes.map((d) => d.shootingDayId),
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

  const unscheduledScenes = scenes.filter(
    (scene) =>
      scene.shootingDayScenes.length === 0 &&
      !scene.shots.some((sh) => sh.shootingDayId),
  );
  const unscheduled = unscheduledScenes.length;
  const shotsTotal = scenes.reduce((n, scene) => n + scene.shots.length, 0);
  const shotsPlanned = scenes.reduce(
    (n, scene) => n + scene.shots.filter((sh) => sh.shootingDayId).length,
    0,
  );
  const shotsDone = scenes.reduce(
    (n, scene) => n + scene.shots.filter((sh) => sh.done).length,
    0,
  );
  const missingList = unscheduledScenes.map((s) => s.number);
  const listJoin = (items: string[]) =>
    items.length <= 1
      ? items.join("")
      : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
  const missingText =
    missingList.length === 0
      ? null
      : missingList.length <= 4
        ? `${missingList.length === 1 ? "falta" : "faltan"} ${listJoin(missingList.map((n) => `la ${n}`))}`
        : `faltan ${missingList.length}`;
  return (
    <div>
      <PageHeader
        eyebrow="Producción"
        title="Plan de rodaje"
        description="El tablero de tiras: cada escena es una tira con su color de luz, y cada jornada la cabecera negra. Arrástrala al día en que se rueda (o usa su selector); se guarda sola."
        actions={
          <NewShootingDayButton
            action={createAction}
            variant={
              days.length === 0 && unscheduled > 0 ? "outline" : "primary"
            }
          />
        }
      />

      {/* Cómo voy: una línea en lenguaje claro, no un panel de cifras. */}
      {scenes.length > 0 && (
        <p className="mt-8 max-w-3xl font-sans text-[15px] leading-relaxed text-muted">
          {days.length === 0 ? (
            <>
              Aún no hay jornadas. Crea el primer día o deja que te proponga un
              plan.
            </>
          ) : (
            <>
              <strong className="font-semibold text-fg">
                {plural(days.length, "jornada", "jornadas")}
              </strong>
              {" · "}
              <strong
                className={`font-semibold ${unscheduled === 0 ? "text-success" : "text-fg"}`}
              >
                {scenes.length - unscheduled} de {scenes.length} escenas
              </strong>{" "}
              con día
              {missingText ? ` (${missingText})` : ""}
              {shotsTotal > 0 && (
                <>
                  {" · "}
                  <strong className="font-semibold text-fg">
                    {shotsPlanned} de {shotsTotal} planos
                  </strong>{" "}
                  repartidos
                </>
              )}
              {shotsDone > 0 && (
                <>
                  {" · "}
                  <strong className="font-semibold text-success">
                    {plural(shotsDone, "plano rodado", "planos rodados")}
                  </strong>
                </>
              )}
              .
            </>
          )}
        </p>
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

      {days.length > 0 && (
        <p className="mt-16 border-t border-line pt-5 font-sans text-sm text-muted">
          Siguiente:{" "}
          <Link
            href={`/app/${projectId}/call-sheets`}
            className="font-medium text-fg underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
          >
            Hojas de llamada →
          </Link>{" "}
          — se rellenan solas con este plan.
        </p>
      )}
    </div>
  );
}
