import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { getMoodboard } from "@/lib/moodboard-core";
import { getMoodboardLookup } from "@/lib/moodboard-lookup";
import { PageHeader } from "@/components/PageHeader";
import { TOOL_GUIDES } from "@/lib/tool-guides";
import { MoodboardLoader } from "@/components/moodboard/MoodboardLoader";
import { MoodboardAiButton } from "@/components/moodboard/MoodboardAiButton";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { VisualBible } from "@/components/moodboard/VisualBible";
import { getVisualRefs } from "@/lib/visual-refs";
import {
  MOODBOARD_AI_FREE_PER_PROJECT,
  MOODBOARD_AI_PRO_DAILY_LIMIT,
  MOODBOARD_FREE_CARD_LIMIT,
  MOODBOARD_MAX_CARDS,
} from "@/lib/limits";
import { getCurrentProfile } from "@/lib/current-user";

export default async function MoodboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { projectId } = await params;
  const bible = (await searchParams).vista === "biblia";

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const me = await getCurrentProfile();
  const isPro = await isProjectOwnerPro(project.organizationId);
  const [board, lookup] = await Promise.all([getMoodboard(projectId, isPro), getMoodboardLookup(projectId)]);
  const tab = (on: boolean, href: string, label: string) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`-mb-px border-b-2 px-3.5 py-2.5 font-sans text-[14px] transition-colors ${on ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg"}`}
    >
      {label}
    </Link>
  );
  const tabs = (
    <nav aria-label="Vistas del moodboard" className="mt-8 flex items-center gap-1 border-b border-line print:hidden">
      {tab(!bible, `/app/${projectId}/moodboard`, "Tablero")}
      {tab(bible, `/app/${projectId}/moodboard?vista=biblia`, "Biblia visual")}
      {bible && (
        <span className="ml-auto pb-1.5">
          <PrintButton label="Imprimir o guardar PDF" />
        </span>
      )}
    </nav>
  );

  if (bible) {
    const refs = await getVisualRefs(projectId);
    return (
      <div>
        <div className="print:hidden">
          <PageHeader
            eyebrow="Escribir"
            title="Moodboard"
            description="La base creativa de la película: lo que se recoge en el tablero, ordenado para enseñarlo al equipo."
          />
        </div>
        {tabs}
        <VisualBible projectId={projectId} projectName={project.name} refs={refs} lookup={lookup} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        guide={TOOL_GUIDES["moodboard"]}
        eyebrow="Escribir"
        title="Moodboard"
        description="La base creativa de la película: fotos, paletas, referencias y notas. Marca en cada una qué define y para qué escena es, y llegará a Planos, al Desglose y a Personajes."
        actions={<MoodboardAiButton />}
      />
      {tabs}
      <div className="mt-8">
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
