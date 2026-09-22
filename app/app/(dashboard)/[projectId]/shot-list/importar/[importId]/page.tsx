import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import type { ShotListProposal } from "@/lib/mistral";
import { PageHeader } from "@/components/PageHeader";
import { ShotListImportReview } from "@/components/ShotListImportReview";

export default async function ShotListImportReviewPage({
  params,
}: {
  params: Promise<{ projectId: string; importId: string }>;
}) {
  const { projectId, importId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const importRow = await prisma.shotListImport.findFirst({
    where: { id: importId, projectId },
  });
  if (!importRow) notFound();

  const proposal = importRow.proposedData as unknown as ShotListProposal;

  const existingScenes = await prisma.scene.findMany({
    where: { projectId },
    select: { number: true, shots: { select: { number: true } } },
  });
  const existingShotsByScene: Record<string, string[]> = {};
  for (const scene of existingScenes) {
    existingShotsByScene[scene.number] = scene.shots.map((s) => s.number);
  }

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}/shot-list`}
        backLabel="← Lista de planos"
        eyebrow="Guion técnico"
        title="Revisar planos propuestos"
        description={`La IA ha leído «${importRow.fileName}» y propone estos planos. Corrígelos a tu gusto antes de añadirlos.`}
      />

      <ShotListImportReview
        projectId={projectId}
        importId={importId}
        proposal={proposal}
        existingShotsByScene={existingShotsByScene}
      />
    </div>
  );
}
