import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { PageHeader } from "@/components/PageHeader";
import { ClaquetaBoard } from "@/components/ClaquetaBoard";
import { getLastTakeByKey } from "@/lib/clapboard-core";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { formatHHMM } from "@/lib/schedule-plan";

export default async function ClaquetaPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [scenes, recentLog, lastTakeByKey] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        location: { select: { name: true } },
      },
    }),
    prisma.clapLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        sceneNumber: true,
        shotNumber: true,
        take: true,
        director: true,
        camera: true,
        clip: true,
        good: true,
        notes: true,
        createdAt: true,
      },
    }),
    getLastTakeByKey(projectId),
  ]);

  // El plan de hoy (o de la próxima jornada): la claqueta sigue su orden de rodaje.
  const tz = "Europe/Madrid";
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const days = await prisma.shootingDay.findMany({ where: { projectId }, orderBy: { date: "asc" }, select: { id: true, date: true } });
  const planDay =
    days.find((d) => d.date.toLocaleDateString("en-CA", { timeZone: tz }) === todayKey) ??
    days.find((d) => d.date.toLocaleDateString("en-CA", { timeZone: tz }) > todayKey) ??
    null;
  const planSummary = planDay ? await getShootingDaySummary(planDay.id) : null;
  const dayPlan =
    planDay && planSummary && planSummary.runOrder.blocks.length > 0
      ? {
          isToday: planDay.date.toLocaleDateString("en-CA", { timeZone: tz }) === todayKey,
          title: `Día ${planSummary.dayNumber} · ${planDay.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: tz })}`,
          href: `/app/${projectId}/plan-de-rodaje?dia=${planDay.id}`,
          shots: planSummary.runOrder.blocks.flatMap((b) =>
            b.shots.map((s) => ({
              id: s.id,
              sceneId: s.sceneId,
              sceneNumber: s.sceneNumber,
              shotNumber: s.number,
              size: s.shotSize,
              description: s.description,
              time: formatHHMM(s.start),
              done: s.done,
            })),
          ),
        }
      : null;

  const sceneOptions = scenes.map((scene) => ({
    id: scene.id,
    number: scene.number,
    intExt: scene.intExt,
    dayPart: scene.dayPart,
    locationName: scene.location?.name ?? null,
  }));

  const initialLog = recentLog.map((entry) => ({
    ...entry,
    createdAt: entry.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        title="Claqueta digital"
      />
      <p className="mt-3 max-w-2xl font-sans text-sm text-muted">
        {scenes.length > 0
          ? "Elige la escena de la lista o escríbela a mano, ajusta la toma y toca el tablero para marcar."
          : "Este proyecto todavía no tiene escenas — escribe el número a mano."}
      </p>

      <div className="mt-8">
        <ClaquetaBoard
          projectId={projectId}
          projectName={project.name}
          scenes={sceneOptions}
          lastTakeByKey={lastTakeByKey}
          initialLog={initialLog}
          dayPlan={dayPlan}
        />
      </div>
    </div>
  );
}
