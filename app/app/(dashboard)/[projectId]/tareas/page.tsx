import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { PageHeader } from "@/components/PageHeader";
import { ScopeToggle } from "@/components/ScopeToggle";
import { TasksView } from "@/components/TasksView";

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
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Gestión"
        title="Tareas"
        description="Los pendientes de este proyecto. Marca una como hecha con la casilla."
      />
      <div className="mt-6">
        <ScopeToggle
          items={[
            { label: "Este proyecto", href: base, active: true },
            { label: "Toda la organización", href: "/app/tareas", active: false },
          ]}
        />
      </div>
      <TasksView
        organizationId={project.organizationId}
        projectId={projectId}
        showCompleted={completadas === "1"}
        completedHref={completadas === "1" ? base : `${base}?completadas=1`}
      />
    </div>
  );
}
