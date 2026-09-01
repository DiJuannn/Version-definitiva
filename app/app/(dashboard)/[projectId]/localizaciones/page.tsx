import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { BackLink } from "@/components/BackLink";

// Vista de solo lectura, filtrada a este proyecto — Location es una
// biblioteca de toda la organización (se reutiliza entre proyectos, ver
// app/app/(dashboard)/localizaciones/page.tsx), así que crear o editar
// una localización se sigue haciendo desde ahí o desde Guion; esto es
// solo un atajo para ver de un vistazo las que ya usa este proyecto.
export default async function ProjectLocationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const locations = await prisma.location.findMany({
    where: { scenes: { some: { projectId } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      contactName: true,
      latitude: true,
      _count: { select: { scenes: { where: { projectId } } } },
    },
  });

  return (
    <div>
      <BackLink href={`/app/${projectId}`}>← {project.name}</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Localizaciones
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Las que ya usan las escenas de este proyecto. Se asignan desde{" "}
        <Link href={`/app/${projectId}/guion`} className="text-fg hover:text-accent">
          Guion
        </Link>
        , y se gestionan todas (crear, editar, borrar) desde la{" "}
        <Link href="/app/localizaciones" className="text-fg hover:text-accent">
          biblioteca completa
        </Link>
        .
      </p>

      {locations.length === 0 ? (
        <EmptyState
          title="Ninguna escena tiene localización todavía"
          description="Asígnalas desde Guion, eligiendo de la biblioteca o creando una nueva."
        />
      ) : (
        <div className="mt-8 border-t border-line">
          {locations.map((location) => (
            <ListRow
              key={location.id}
              href={`/app/localizaciones/${location.id}`}
              title={
                <span className="font-display text-lg font-bold uppercase transition-colors group-hover:text-accent">
                  {location.name}
                </span>
              }
              meta={
                [location.address, location.contactName].filter(Boolean).join(" · ") ||
                "Sin datos"
              }
              trailing={
                <span className="flex items-center gap-3 font-mono text-xs text-muted">
                  {location.latitude === null && (
                    <span className="text-accent">Sin coordenadas</span>
                  )}
                  {location._count.scenes} escena
                  {location._count.scenes === 1 ? "" : "s"}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
