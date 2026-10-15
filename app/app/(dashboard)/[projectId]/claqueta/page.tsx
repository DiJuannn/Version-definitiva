import Link from "next/link";
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [scenes, recentLog, lastTakeByKey, todayTakes, todayGood] =
    await Promise.all([
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
      prisma.clapLog.count({
        where: { projectId, createdAt: { gte: todayStart } },
      }),
      prisma.clapLog.count({
        where: { projectId, good: true, createdAt: { gte: todayStart } },
      }),
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
        eyebrow="Rodar"
        title="Claqueta digital"
        description={
          scenes.length > 0
            ? "Pon el móvil delante de la cámara y toca el tablero al empezar cada toma: suena el golpe y la toma queda apuntada en el parte de script."
            : "Pon el móvil delante de la cámara y toca el tablero al empezar cada toma. Este proyecto aún no tiene escenas: escribe el número a mano."
        }
      />

      {/* Cómo voy: lo de hoy en una línea. */}
      <p className="mt-6 font-sans text-[15px] text-muted">
        {todayTakes === 0 ? (
          "Hoy aún no se ha marcado ninguna toma."
        ) : (
          <>
            Hoy:{" "}
            <strong className="font-semibold text-fg">
              {todayTakes} {todayTakes === 1 ? "toma" : "tomas"}
            </strong>
            {" · "}
            <strong className="font-semibold text-success">
              {todayGood} {todayGood === 1 ? "buena" : "buenas"}
            </strong>
            .
          </>
        )}
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

      <p className="mt-16 border-t border-line pt-5 font-sans text-sm text-muted">
        Siguiente:{" "}
        <Link
          href={`/app/${projectId}/script`}
          className="font-medium text-fg underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
        >
          Parte de script →
        </Link>{" "}
        — revisa las tomas del día y rodea las buenas.
      </p>
    </div>
  );
}
