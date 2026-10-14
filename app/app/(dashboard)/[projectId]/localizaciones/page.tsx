import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
import { LinkPendingHint } from "@/components/LinkPendingHint";
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
    <div className="pb-16">
      <PageHeader
        eyebrow="Gestión"
        title="Localizaciones"
        description={
          library
            ? "Todas las localizaciones de tu organización. Aquí se crean y se editan, y luego se asignan a las escenas desde Guion."
            : "Las que ya usan las escenas de este proyecto. Para crear o editar una, ve a «Toda la biblioteca»."
        }
        actions={
          <ScopeToggle
            items={[
              { label: "En este proyecto", href: base, active: !library },
              { label: "Toda la biblioteca", href: `${base}?ver=biblioteca`, active: library },
            ]}
          />
        }
      />

      {library ? (
        <LocationsLibrary organizationId={project.organizationId} from={projectId} />
      ) : locations.length === 0 ? (
        <EmptyState
          title="Ninguna escena tiene localización todavía"
          description="Se asignan desde Guion: en cada escena eliges una de la biblioteca o creas una nueva."
          actionLabel="Ir a Guion"
          actionHref={`/app/${projectId}/guion`}
        />
      ) : (
        <section aria-label="Localizaciones del proyecto" className="mt-10">
          <p className="eyebrow">
            {locations.length} {locations.length === 1 ? "localización" : "localizaciones"} ·{" "}
            <Link href={`/app/${projectId}/guion`} className="hover:text-accent">
              se asignan desde Guion →
            </Link>
          </p>
          <ul className="sheet mt-3 divide-y divide-line px-5 sm:px-6">
            {locations.map((location) => (
              <li key={location.id}>
                <Link
                  href={`/app/localizaciones/${location.id}?from=${projectId}`}
                  className="group flex items-center gap-4 py-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-base font-medium transition-colors group-hover:text-accent">
                      {location.name}
                    </span>
                    <span className="block truncate font-sans text-sm text-muted">
                      {[location.address, location.contactName].filter(Boolean).join(" · ") || "Sin dirección ni contacto"}
                    </span>
                  </span>
                  {location.latitude === null && (
                    <span className="hidden border-l-2 border-warn pl-2 font-mono text-[11px] text-warn sm:inline">
                      Sin coordenadas
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
                    {location._count.scenes} escena{location._count.scenes === 1 ? "" : "s"}
                  </span>
                  <span aria-hidden className="text-muted transition-colors group-hover:text-accent">
                    →
                  </span>
                  <LinkPendingHint className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
