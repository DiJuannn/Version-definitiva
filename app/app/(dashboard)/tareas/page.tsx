import { getCurrentProfile } from "@/lib/current-user";
import { PageHeader } from "@/components/PageHeader";
import { ScopeToggle } from "@/components/ScopeToggle";
import { TasksView } from "@/components/TasksView";
import { listProjectsForProfile } from "@/lib/project-access";

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ completadas?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const { completadas } = await searchParams;
  const projects = await listProjectsForProfile(profile);

  return (
    <div>
      <PageHeader
        backHref="/app"
        backLabel="← Inicio"
        eyebrow="Organización"
        title="Tareas"
        description="Pendientes de toda la productora, con o sin proyecto. Marca una como hecha con la casilla."
      />
      <div className="mt-6">
        <ScopeToggle
          items={[
            { label: "Toda la organización", href: "/app/tareas", active: true },
            ...projects.slice(0, 3).map((p) => ({
              label: p.name,
              href: `/app/${p.id}/tareas`,
              active: false,
            })),
          ]}
        />
      </div>
      <TasksView
        organizationId={profile.organizationId}
        showCompleted={completadas === "1"}
        completedHref={completadas === "1" ? "/app/tareas" : "/app/tareas?completadas=1"}
      />
    </div>
  );
}
