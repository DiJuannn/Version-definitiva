import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
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
    <div className="pb-16">
      <PageHeader
        eyebrow="Gestión"
        title="Vehículos"
        description={
          fleet
            ? "Todos los vehículos de tu organización. Aquí se añaden y se borran, y luego se reservan para cada día desde Plan de rodaje."
            : "Los que ya están reservados en algún día de rodaje de este proyecto. Para añadir o borrar, ve a «Toda la flota»."
        }
        actions={
          <ScopeToggle
            items={[
              { label: "En este proyecto", href: base, active: !fleet },
              { label: "Toda la flota", href: `${base}?ver=flota`, active: fleet },
            ]}
          />
        }
      />

      {fleet ? (
        <VehiclesFleet organizationId={project.organizationId} />
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Ningún vehículo reservado todavía"
          description="Se reservan desde Plan de rodaje, en cada día, eligiendo de la flota de la organización."
          actionLabel="Ir a Plan de rodaje"
          actionHref={`/app/${projectId}/plan-de-rodaje`}
        />
      ) : (
        <section aria-label="Vehículos reservados" className="mt-10">
          <p className="eyebrow">
            {vehicles.length} {vehicles.length === 1 ? "vehículo" : "vehículos"} ·{" "}
            <Link href={`/app/${projectId}/plan-de-rodaje`} className="hover:text-accent">
              se reservan desde Plan de rodaje →
            </Link>
          </p>
          <ul className="sheet mt-3 divide-y divide-line px-5 sm:px-6">
            {vehicles.map((vehicle) => (
              <li key={vehicle.id} className="flex items-center gap-4 py-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-base font-medium">{vehicle.name}</span>
                  <span className="block truncate font-sans text-sm text-muted">
                    {[vehicle.type, vehicle.notes].filter(Boolean).join(" · ") || "Sin datos"}
                  </span>
                </span>
                {vehicle.plate && (
                  <span className="hidden shrink-0 rounded border border-line px-2 py-0.5 font-mono text-xs tracking-wider sm:inline">
                    {vehicle.plate}
                  </span>
                )}
                <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
                  {vehicle._count.reservations} día{vehicle._count.reservations === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
