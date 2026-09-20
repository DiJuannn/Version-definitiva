import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { getMoodboard } from "@/lib/moodboard-core";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/PageHeader";
import { MoodboardLoader } from "@/components/moodboard/MoodboardLoader";
import {
  MOODBOARD_AI_PRO_DAILY_LIMIT,
  MOODBOARD_FREE_CARD_LIMIT,
  MOODBOARD_MAX_CARDS,
} from "@/lib/limits";
import type { MoodboardLookup } from "@/lib/moodboard-types";

export default async function MoodboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [isPro, board, scenes, characters] = await Promise.all([
    isProjectOwnerPro(project.organizationId),
    getMoodboard(projectId),
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        description: true,
        location: { select: { id: true, name: true, address: true } },
      },
    }),
    prisma.character.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, actor: { select: { name: true } } },
    }),
  ]);

  const locations = new Map<string, { id: string; name: string; address: string | null }>();
  for (const s of scenes) if (s.location) locations.set(s.location.id, s.location);

  const lookup: MoodboardLookup = {
    scenes: scenes.map((s) => ({
      id: s.id,
      number: s.number,
      heading: `${INT_EXT_LABELS[s.intExt]} · ${DAY_PART_LABELS[s.dayPart]}`,
      location: s.location?.name ?? null,
      description: s.description ? s.description.slice(0, 160) : null,
    })),
    characters: characters.map((c) => ({ id: c.id, name: c.name, actor: c.actor?.name ?? null })),
    locations: [...locations.values()].sort((a, b) => a.name.localeCompare(b.name, "es")),
  };

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Preproducción"
        title="Moodboard"
        description="Un tablero libre para reunir referencias: notas, imágenes, paletas y tarjetas de tu proyecto (escenas, personajes y localizaciones) que se actualizan solas."
      />
      <div className="mt-8">
        <MoodboardLoader
          projectId={projectId}
          initialCards={board.cards}
          initialUpdatedAt={board.updatedAt}
          isPro={isPro}
          freeLimit={MOODBOARD_FREE_CARD_LIMIT}
          maxCards={MOODBOARD_MAX_CARDS}
          aiLimit={MOODBOARD_AI_PRO_DAILY_LIMIT}
          aiUsedToday={board.aiUsedToday}
          lookup={lookup}
        />
      </div>
    </div>
  );
}
