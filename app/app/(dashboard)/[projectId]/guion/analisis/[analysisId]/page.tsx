import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import type { ScriptAnalysisProposal } from "@/lib/mistral";
import { getScriptReplaceImpact } from "@/lib/script-analysis-core";
import { PageHeader } from "@/components/PageHeader";
import { ScriptAnalysisReview } from "@/components/ScriptAnalysisReview";

export default async function ScriptAnalysisReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; analysisId: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { projectId, analysisId } = await params;
  const { modo } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const analysis = await prisma.scriptAnalysis.findFirst({
    where: { id: analysisId, projectId },
  });
  if (!analysis) notFound();

  const proposal = analysis.proposedData as unknown as ScriptAnalysisProposal;

  const impact = await getScriptReplaceImpact(projectId, analysisId);
  // Con contenido previo y un guion que parece nuevo, se propone reemplazar; ?modo= lo cambia.
  const replace = impact.hasContent && (modo === "reemplazar" || (modo !== "anadir" && impact.suggestReplace));

  const [characters, locations, props, scenes] = await Promise.all([
    prisma.character.findMany({ where: { projectId }, select: { name: true } }),
    prisma.location.findMany({
      where: { organizationId: project.organizationId },
      select: { name: true },
    }),
    prisma.breakdownElement.findMany({ where: { projectId }, select: { name: true } }),
    prisma.scene.findMany({ where: { projectId }, select: { number: true } }),
  ]);

  // Lo que ya existe en el proyecto (en minúsculas, para comparar): la pantalla
  // lo usa para avisar de lo que se omitirá y de las escenas que se actualizarán.
  // Al reemplazar, personajes, desglose y escenas actuales se borran: para la revisión es como si no existieran.
  // Las localizaciones son de la organización y se conservan.
  const existing = {
    characters: replace ? [] : characters.map((c) => c.name.trim().toLowerCase()),
    locations: locations.map((l) => l.name.trim().toLowerCase()),
    props: replace ? [] : props.map((p) => p.name.trim().toLowerCase()),
    sceneNumbers: replace ? [] : scenes.map((s) => s.number.trim()),
  };

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}/guion`}
        backLabel="← Guion"
        eyebrow="Análisis de IA"
        title="Revisar propuesta"
        description="La IA ha leído tu guion y propone escenas, personajes, localizaciones y elementos de desglose. Corrígelo a tu gusto antes de importar."
      />

      <ScriptAnalysisReview
        projectId={projectId}
        analysisId={analysisId}
        proposal={proposal}
        existing={existing}
        replace={replace}
        impact={impact.hasContent ? impact : null}
      />
    </div>
  );
}
