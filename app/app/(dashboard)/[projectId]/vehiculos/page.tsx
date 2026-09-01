import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { BackLink } from "@/components/BackLink";

// Vista de solo lectura, filtrada a este proyecto — Vehicle es la flota
// de toda la organización (se reserva por día de rodaje desde cualquier
// proyecto, ver app/app/(dashboard)/vehiculos/page.tsx), así que añadir
// o borrar un vehículo se sigue haciendo desde ahí; esto es solo un
// atajo para ver de un vistazo los que ya están reservados en este.
export default async function ProjectVehiclesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const vehicles = await prisma.vehicle.findMany({
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
      <BackLink href={`/app/${projectId}`}>← {project.name}</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Vehículos
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Los que ya están reservados en algún día de rodaje de este proyecto.
        Se reservan desde{" "}
        <Link href={`/app/${projectId}/plan-de-rodaje`} className="text-fg hover:text-accent">
          Plan de rodaje
        </Link>
        , y se gestiona toda la flota (añadir, borrar) desde{" "}
        <Link href="/app/vehiculos" className="text-fg hover:text-accent">
          Vehículos
        </Link>
        .
      </p>

      {vehicles.length === 0 ? (
        <EmptyState
          title="Ningún vehículo reservado todavía"
          description="Resérvalos desde Plan de rodaje, eligiendo de la flota de la organización."
        />
      ) : (
        <div className="mt-8 border-t border-line">
          {vehicles.map((vehicle) => (
            <ListRow
              key={vehicle.id}
              title={
                <span className="font-display text-lg font-bold uppercase">
                  {vehicle.name}
                </span>
              }
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
    </div>
  );
}
