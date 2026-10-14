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
        eyebrow="Producción"
        title="Claqueta digital"
        description={
          scenes.length > 0
            ? "Pon el móvil delante de la cámara y toca el tablero al empezar cada toma: suena el golpe y la toma queda apuntada en el parte de script."
            : "Pon el móvil delante de la cámara y toca el tablero al empezar cada toma. Este proyecto aún no tiene escenas: escribe el número a mano."
        }
      />

      <div className="mt-10">
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
