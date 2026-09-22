import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { PageHeader } from "@/components/PageHeader";
import { ScopeToggle } from "@/components/ScopeToggle";
import { LocationsLibrary } from "@/components/LocationsLibrary";

// Dos vistas de la misma herramienta sin salir del proyecto: las
// localizaciones que ya usan sus escenas, o la biblioteca completa de la
// organización (donde se crean y editan).
export default async function ProjectLocationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const { projectId } = await params;
  const { ver } = await searchParams;
  const library = ver === "biblioteca";

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const base = `/app/${projectId}/localizaciones`;

  const locations = library
    ? []
    : await prisma.location.findMany({
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
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Gestión"
        title="Localizaciones"
      />
      <div className="mt-6">
        <ScopeToggle
          items={[
            { label: "Usadas en este proyecto", href: base, active: !library },
            { label: "Toda la biblioteca", href: `${base}?ver=biblioteca`, active: library },
          ]}
        />
      </div>

      {library ? (
        <LocationsLibrary organizationId={project.organizationId} from={projectId} />
      ) : (
        <>
          <p className="mt-4 max-w-2xl font-sans text-sm text-muted">
            Las que ya usan las escenas de este proyecto. Se asignan desde{" "}
            <Link href={`/app/${projectId}/guion`} className="text-fg hover:text-accent">
              Guion
            </Link>
            ; para crear o editar, usa la pestaña «Toda la biblioteca».
          </p>
          {locations.length === 0 ? (
            <EmptyState
              title="Ninguna escena tiene localización todavía"
              description="Asígnalas desde Guion, eligiendo de la biblioteca o creando una nueva."
            />
          ) : (
            <div className="mt-6 border-t border-line">
              {locations.map((location) => (
                <ListRow
                  key={location.id}
                  href={`/app/localizaciones/${location.id}?from=${projectId}`}
                  title={
                    <span className="font-display text-lg font-bold transition-colors group-hover:text-accent">
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
                        <span className="text-warn">Sin coordenadas</span>
                      )}
                      {location._count.scenes} escena
                      {location._count.scenes === 1 ? "" : "s"}
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
