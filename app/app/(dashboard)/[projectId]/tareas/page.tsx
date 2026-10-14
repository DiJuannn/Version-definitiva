import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { PageHeader } from "@/components/PageHeader";
import { ScopeToggle } from "@/components/ScopeToggle";
import { NewProjectTaskButton, ProjectTasksBoard } from "@/components/gestion/ProjectTasksBoard";

export default async function ProjectTareasPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ completadas?: string }>;
}) {
  const { projectId } = await params;
  const { completadas } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const base = `/app/${projectId}/tareas`;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Gestión"
        title="Tareas"
        description="Lo que falta por hacer en este proyecto, ordenado por cuándo toca. Márcala con su círculo al terminar."
        actions={
          <>
            <ScopeToggle
              items={[
                { label: "Este proyecto", href: base, active: true },
                { label: "Toda la organización", href: "/app/tareas", active: false },
              ]}
            />
            <NewProjectTaskButton projectId={projectId} />
          </>
        }
      />
      <ProjectTasksBoard
        organizationId={project.organizationId}
        projectId={projectId}
        showCompleted={completadas === "1"}
        completedHref={completadas === "1" ? base : `${base}?completadas=1`}
      />
    </div>
  );
}
