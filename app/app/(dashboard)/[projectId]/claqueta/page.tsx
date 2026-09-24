import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { PageHeader } from "@/components/PageHeader";
import { ClaquetaBoard } from "@/components/ClaquetaBoard";
import { getLastTakeByKey } from "@/lib/clapboard-core";

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
        />
      </div>
    </div>
  );
}
