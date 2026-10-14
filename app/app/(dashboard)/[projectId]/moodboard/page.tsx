import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { getMoodboard } from "@/lib/moodboard-core";
import { getMoodboardLookup } from "@/lib/moodboard-lookup";
import { PageHeader } from "@/components/PageHeader";
import { MoodboardLoader } from "@/components/moodboard/MoodboardLoader";
import { MoodboardAiButton } from "@/components/moodboard/MoodboardAiButton";
import Link from "next/link";
import {
  MOODBOARD_AI_FREE_PER_PROJECT,
  MOODBOARD_AI_PRO_DAILY_LIMIT,
  MOODBOARD_FREE_CARD_LIMIT,
  MOODBOARD_MAX_CARDS,
} from "@/lib/limits";
import { getCurrentProfile } from "@/lib/current-user";

export default async function MoodboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const me = await getCurrentProfile();
  const isPro = await isProjectOwnerPro(project.organizationId);
  const [board, lookup] = await Promise.all([getMoodboard(projectId, isPro), getMoodboardLookup(projectId)]);

  return (
    <div>
      <PageHeader
        eyebrow="Preproducción"
        title="Moodboard"
        description="Un tablero para decidir cómo se ve y cómo suena la película: fotos, paletas, referencias y notas, junto a las escenas del guion."
        actions={<MoodboardAiButton />}
      />
      <div className="mt-10">
        <MoodboardLoader
          projectId={projectId}
          initialCards={board.cards}
          initialUpdatedAt={board.updatedAt}
          isPro={isPro}
          freeLimit={MOODBOARD_FREE_CARD_LIMIT}
          maxCards={MOODBOARD_MAX_CARDS}
          aiLimit={isPro ? MOODBOARD_AI_PRO_DAILY_LIMIT : MOODBOARD_AI_FREE_PER_PROJECT}
          aiUsed={board.aiUsed}
          lookup={lookup}
          userId={me?.id ?? "anon"}
          userName={me?.fullName ?? me?.email?.split("@")[0] ?? "Alguien"}
        />
      </div>
      {/* Siguiente paso del flujo: llevar el tono a cada plano. */}
      <p className="mt-8 font-sans text-sm text-muted">
        Siguiente:{" "}
        <Link href={`/app/${projectId}/storyboard`} className="link-action text-accent">
          lleva este tono a cada plano en el Storyboard →
        </Link>
      </p>
    </div>
  );
}
