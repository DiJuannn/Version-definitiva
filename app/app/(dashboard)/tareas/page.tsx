import { getCurrentProfile } from "@/lib/current-user";
import { PageHeader } from "@/components/PageHeader";
import { AgendaTabs } from "@/components/AgendaTabs";
import { ScopeToggle } from "@/components/ScopeToggle";
import { NewTaskButton, TasksView } from "@/components/TasksView";
import { listProjectsForProfile } from "@/lib/project-access";

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ completadas?: string; proyecto?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const { completadas, proyecto } = await searchParams;
  const projects = await listProjectsForProfile(profile);
  // Filtro por proyecto sin salir de la vista de organización.
  const filterProjectId = projects.some((p) => p.id === proyecto) ? proyecto : undefined;

  const href = (params: { completadas?: boolean; proyecto?: string }) => {
    const qs = new URLSearchParams();
    if (params.proyecto) qs.set("proyecto", params.proyecto);
    if (params.completadas) qs.set("completadas", "1");
    const q = qs.toString();
    return q ? `/app/tareas?${q}` : "/app/tareas";
  };
  const showCompleted = completadas === "1";

  return (
    <div className="pb-16">
      <AgendaTabs active="tareas" />
      <PageHeader
        eyebrow="Organización"
        title="Tareas"
        description="Lo que hay que hacer en la productora, ordenado por cuándo toca. Toca el círculo para darla por hecha."
        actions={<NewTaskButton organizationId={profile.organizationId} />}
      />
      <TasksView
        organizationId={profile.organizationId}
        filterProjectId={filterProjectId}
        showCompleted={showCompleted}
        completedHref={href({ completadas: !showCompleted, proyecto: filterProjectId })}
        hideCreate
        filter={
          projects.length > 0 ? (
            <ScopeToggle
              items={[
                { label: "Todos los proyectos", href: href({ completadas: showCompleted }), active: !filterProjectId },
                ...projects.map((p) => ({
                  label: p.name,
                  href: href({ completadas: showCompleted, proyecto: p.id }),
                  active: p.id === filterProjectId,
                })),
              ]}
            />
          ) : undefined
        }
      />
    </div>
  );
}
