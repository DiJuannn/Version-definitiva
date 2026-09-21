import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { PageHeader } from "@/components/PageHeader";
import { FestivalGuide } from "@/components/FestivalGuide";

export default async function FestivalesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Entrega"
        title="Festivales"
        description={
          <>
            Dónde presentar «{project.name}». Elige tu zona y te enseño primero los festivales de tu zona. Las fechas y los
            plazos cambian cada año: mira siempre la convocatoria oficial.{" "}
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
      />
      <FestivalGuide projectType={project.type} />
    </div>
  );
}
