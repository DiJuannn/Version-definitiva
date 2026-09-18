import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import type { ScriptAnalysisProposal } from "@/lib/mistral";
import { PageHeader } from "@/components/PageHeader";
import { ScriptAnalysisReview } from "@/components/ScriptAnalysisReview";

export default async function ScriptAnalysisReviewPage({
  params,
}: {
  params: Promise<{ projectId: string; analysisId: string }>;
}) {
  const { projectId, analysisId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const analysis = await prisma.scriptAnalysis.findFirst({
    where: { id: analysisId, projectId },
  });
  if (!analysis) notFound();

  const proposal = analysis.proposedData as unknown as ScriptAnalysisProposal;

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
  const existing = {
    characters: characters.map((c) => c.name.trim().toLowerCase()),
    locations: locations.map((l) => l.name.trim().toLowerCase()),
    props: props.map((p) => p.name.trim().toLowerCase()),
    sceneNumbers: scenes.map((s) => s.number.trim()),
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
      />
    </div>
  );
}
