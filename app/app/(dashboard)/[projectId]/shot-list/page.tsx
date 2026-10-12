import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createShot } from "@/lib/actions/shots";
import { analyzeShotList } from "@/lib/actions/shot-list-import";
import { EmptyState } from "@/components/EmptyState";
import { PdfLink } from "@/components/PdfLink";
import { PageHeader } from "@/components/PageHeader";
import { HelpTip } from "@/components/HelpTip";
import { ShotListUploadForm } from "@/components/ShotListUploadForm";
import { ShotListTable, type ShotListScene } from "@/components/ShotListTable";

// El análisis del guion técnico llama a Mistral y puede tardar más de
// los 10s que Vercel da por defecto a una función.
export const maxDuration = 60;

export default async function ShotListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [scenes, shootingDays] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      include: {
        location: { select: { name: true } },
        shootingDayScenes: { select: { shootingDayId: true } },
        shots: {
          orderBy: [{ order: "asc" }, { number: "asc" }],
          include: { characters: { select: { character: { select: { name: true } } } } },
        },
      },
    }),
    prisma.shootingDay.findMany({ where: { projectId }, orderBy: { date: "asc" }, select: { id: true, date: true } }),
  ]);
  const shotCount = scenes.reduce((n, s) => n + s.shots.length, 0);
  const doneCount = scenes.reduce((n, s) => n + s.shots.filter((sh) => sh.done).length, 0);
  const uploadAction = analyzeShotList.bind(null, projectId);

  // "Día 2 · 16 oct": número de jornada (por orden de fecha) y fecha corta.
  const days = shootingDays.map((d, i) => ({
    id: d.id,
    label: `Día ${i + 1} · ${d.date.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).replace(".", "")}`,
  }));
  const rows: ShotListScene[] = scenes.map((scene) => ({
    id: scene.id,
    number: scene.number,
    intExt: scene.intExt,
    dayPart: scene.dayPart,
    location: scene.location?.name ?? null,
    description: scene.description,
    dayIds: scene.shootingDayScenes.map((d) => d.shootingDayId),
    addAction: createShot.bind(null, projectId, scene.id),
    shots: scene.shots.map((shot) => ({
      id: shot.id,
      number: shot.number,
      shotSize: shot.shotSize,
      angle: shot.angle,
      movement: shot.movement,
      lens: shot.lens,
      description: shot.description,
      done: shot.done,
      dayId: shot.shootingDayId,
      characters: shot.characters.map((c) => c.character.name),
    })),
  }));

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Preproducción"
        title="Lista de planos"
        description={
          scenes.length > 0
            ? `${shotCount} plano${shotCount === 1 ? "" : "s"} en ${scenes.length} escena${scenes.length === 1 ? "" : "s"} · ${doneCount} rodado${doneCount === 1 ? "" : "s"}`
            : undefined
        }
        actions={<PdfLink href={`/api/pdf/shot-list/${projectId}`} />}
      />

      <div className="mt-5 flex flex-wrap items-center gap-2 print:hidden">
        <ShotListUploadForm action={uploadAction} />
        <HelpTip text="¿Ya tienes un guion técnico (PDF o Word)? Súbelo y la IA propone los planos de cada escena para que los revises antes de añadirlos. Las escenas deben ir numeradas igual que en el guion; si no coinciden, lo corriges en la revisión." />
      </div>

      {scenes.length === 0 ? (
        <EmptyState
          title="No hay escenas creadas todavía"
          description="Crea las escenas del proyecto en Guion, o sube tu guion técnico arriba para crearlas junto con sus planos."
          actionLabel="Ir a Guion"
          actionHref={`/app/${projectId}/guion`}
        />
      ) : (
        <ShotListTable projectId={projectId} scenes={rows} days={days} />
      )}
    </div>
  );
}
