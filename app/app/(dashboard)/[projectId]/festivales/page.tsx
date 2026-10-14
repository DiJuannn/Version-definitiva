import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { listFestivalSubmissionsCore } from "@/lib/festival-submissions-core";
import { FestivalGuide } from "@/components/FestivalGuide";
import { FestivalSubmissionsPanel } from "@/components/FestivalSubmissionsPanel";

export default async function FestivalesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const submissions = await listFestivalSubmissionsCore(projectId);

  return (
    <div className="pb-16">
      <FestivalSubmissionsPanel
        projectId={projectId}
        title="Festivales"
        description={
          <>
            Tus plazos de envío en orden, con los días que quedan, y una guía para descubrir dónde presentar «{project.name}».{" "}
            {!project.type && (
              <>
                Indica el tipo de proyecto en{" "}
                <Link href={`/app/${projectId}`} className="text-fg underline decoration-accent/50 underline-offset-4">
                  Datos del proyecto
                </Link>{" "}
                para filtrar por formato.
              </>
            )}
          </>
        }
        submissions={submissions.map((s) => ({
          id: s.id,
          festivalName: s.festivalName,
          deadline: s.deadline ? s.deadline.toISOString() : null,
          submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
          fee: s.fee !== null ? Number(s.fee) : null,
          status: s.status,
          url: s.url,
          notes: s.notes,
        }))}
      />
      <FestivalGuide projectType={project.type} trackedNames={submissions.map((s) => s.festivalName)} />
    </div>
  );
}
