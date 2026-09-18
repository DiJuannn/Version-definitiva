import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { PageHeader } from "@/components/PageHeader";
import { ScopeToggle } from "@/components/ScopeToggle";
import { VehiclesFleet } from "@/components/VehiclesFleet";

// Dos vistas de la misma herramienta sin salir del proyecto: los vehículos
// reservados en alguno de sus días de rodaje, o la flota completa de la
// organización (donde se añaden y borran).
export default async function ProjectVehiclesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const { projectId } = await params;
  const { ver } = await searchParams;
  const fleet = ver === "flota";

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const base = `/app/${projectId}/vehiculos`;

  const vehicles = fleet
    ? []
    : await prisma.vehicle.findMany({
        where: { reservations: { some: { shootingDay: { projectId } } } },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          plate: true,
          notes: true,
          _count: { select: { reservations: { where: { shootingDay: { projectId } } } } },
        },
      });

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Gestión"
        title="Vehículos"
      />
      <div className="mt-6">
        <ScopeToggle
          items={[
            { label: "Reservados en este proyecto", href: base, active: !fleet },
            { label: "Toda la flota", href: `${base}?ver=flota`, active: fleet },
          ]}
        />
      </div>

      {fleet ? (
        <VehiclesFleet organizationId={project.organizationId} />
      ) : (
        <>
          <p className="mt-4 max-w-2xl font-sans text-sm text-muted">
            Los que ya están reservados en algún día de rodaje de este proyecto. Se reservan desde{" "}
            <Link href={`/app/${projectId}/plan-de-rodaje`} className="text-fg hover:text-accent">
              Plan de rodaje
            </Link>
            ; para añadir o borrar, usa la pestaña «Toda la flota».
          </p>
          {vehicles.length === 0 ? (
            <EmptyState
              title="Ningún vehículo reservado todavía"
              description="Resérvalos desde Plan de rodaje, eligiendo de la flota de la organización."
            />
          ) : (
            <div className="mt-6 border-t border-line">
              {vehicles.map((vehicle) => (
                <ListRow
                  key={vehicle.id}
                  title={<span className="font-display text-lg font-bold">{vehicle.name}</span>}
                  meta={
                    [vehicle.type, vehicle.plate, vehicle.notes].filter(Boolean).join(" · ") ||
                    "Sin datos"
                  }
                  trailing={
                    <span className="font-mono text-xs text-muted">
                      {vehicle._count.reservations} día
                      {vehicle._count.reservations === 1 ? "" : "s"} en este proyecto
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
