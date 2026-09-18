import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { PageHeader } from "@/components/PageHeader";
import { ClaquetaBoard } from "@/components/ClaquetaBoard";

export default async function ClaquetaPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [scenes, recentLog, takeAggregates] = await Promise.all([
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
        createdAt: true,
      },
    }),
    prisma.clapLog.groupBy({
      by: ["sceneNumber"],
      where: { projectId },
      _max: { take: true },
    }),
  ]);

  const lastTakeBySceneNumber = Object.fromEntries(
    takeAggregates.map((row) => [row.sceneNumber, row._max.take ?? 0]),
  );

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
          lastTakeBySceneNumber={lastTakeBySceneNumber}
          initialLog={initialLog}
        />
      </div>
    </div>
  );
}
