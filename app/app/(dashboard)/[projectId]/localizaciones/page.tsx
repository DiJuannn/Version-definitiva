import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
import { LinkPendingHint } from "@/components/LinkPendingHint";
import { PageHeader } from "@/components/PageHeader";
import { TOOL_GUIDES } from "@/lib/tool-guides";
import { ScopeToggle } from "@/components/ScopeToggle";
import { LocationsLibrary } from "@/components/LocationsLibrary";
import { LocationsMapClient } from "@/components/LocationsMapClient";
import { NextTool, Notice, Notices, StatusLine } from "@/components/gestion/ToolStatus";
import { SceneChip } from "@/components/ScenePeek";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";

// Dos vistas de la misma herramienta sin salir del proyecto: las
// localizaciones del proyecto (un mapa numerado y, al lado, cada sitio con
// las escenas que se ruedan en él; las escenas sin sitio, aparte, como
// aviso), o la biblioteca completa de la organización (donde se crean y
// editan).
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

  const scenes = library
    ? []
    : await prisma.scene.findMany({
        where: { projectId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          number: true,
          intExt: true,
          dayPart: true,
          description: true,
          location: {
            select: {
              id: true,
              name: true,
              address: true,
              contactName: true,
              contactPhone: true,
              latitude: true,
              longitude: true,
              // Solo lectura: papeles (permisos…) de este proyecto vinculados al sitio.
              _count: { select: { documents: { where: { projectId } } } },
            },
          },
        },
      });

  type Loc = NonNullable<(typeof scenes)[number]["location"]>;
  const byLocation = new Map<string, { location: Loc; scenes: typeof scenes }>();
  for (const scene of scenes) {
    if (!scene.location) continue;
    const entry = byLocation.get(scene.location.id) ?? { location: scene.location, scenes: [] };
    entry.scenes.push(scene);
    byLocation.set(scene.location.id, entry);
  }
  const groups = [...byLocation.values()].map((g, i) => ({ ...g, label: String(i + 1) }));
  const unassigned = scenes.filter((s) => !s.location);
  const noCoords = groups.filter((g) => g.location.latitude === null || g.location.longitude === null);
  const noPapers = groups.filter((g) => g.location._count.documents === 0);
  const mapLocations = groups
    .filter((g) => g.location.latitude !== null && g.location.longitude !== null)
    .map((g) => ({
      id: g.location.id,
      name: g.location.name,
      address: g.location.address,
      latitude: g.location.latitude as number,
      longitude: g.location.longitude as number,
      sceneCount: g.scenes.length,
      label: g.label,
    }));

  const sceneLine = (scene: (typeof scenes)[number]) => (
    <li key={scene.id} className="flex items-baseline gap-3 py-1.5">
      <SceneChip sceneId={scene.id} number={scene.number} className="w-8 shrink-0 justify-end">
        <span className="font-display text-sm font-black tabular-nums">{scene.number}</span>
      </SceneChip>
      <span className="w-[6.5rem] shrink-0 font-mono text-[10px] tracking-wider text-muted uppercase">
        {INT_EXT_LABELS[scene.intExt]} · {DAY_PART_LABELS[scene.dayPart]}
      </span>
      <span className="min-w-0 truncate font-sans text-sm text-fg/90">{scene.description || "Sin descripción"}</span>
    </li>
  );

  return (
    <div className="pb-16">
      <PageHeader
        guide={TOOL_GUIDES["localizaciones"]}
        eyebrow="Preparar"
        title="Localizaciones"
        description={
          library
            ? "Todas las localizaciones de tu organización. Aquí se crean y se editan, y luego se asignan a las escenas desde Guion."
            : "Dónde se rueda cada escena, en un mapa. Se asignan desde Guion; para crear o editar sitios, ve a «Toda la biblioteca»."
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
      ) : scenes.length === 0 ? (
        <EmptyState
          title="Todavía no hay escenas"
          preview="escenas"
          description="Las localizaciones se asignan a cada escena desde Guion. Empieza por el guion."
          actionLabel="Ir a Guion"
          actionHref={`/app/${projectId}/guion`}
        />
      ) : (
        <>
          <StatusLine tone={unassigned.length > 0 ? "warn" : noPapers.length > 0 ? "warn" : "ok"}>
            {scenes.length - unassigned.length} de {scenes.length} escenas tienen localización
            {groups.length > 0 && (
              <>
                {" "}
                · {groups.length} {groups.length === 1 ? "sitio" : "sitios"} de rodaje
              </>
            )}
            {unassigned.length > 0 ? (
              <>
                {" · "}falta{unassigned.length === 1 ? " la" : "n las"} {unassigned.map((s) => s.number).join(", ")}.
              </>
            ) : (
              "."
            )}
          </StatusLine>
          <Notices>
            {unassigned.length > 0 && (
              <Notice action={{ label: "Asignar en Guion", href: `/app/${projectId}/guion` }}>
                {unassigned.length === scenes.length
                  ? "Ninguna escena tiene sitio todavía: sin localización no se pueden agrupar los días de rodaje."
                  : `${unassigned.length} escena${unassigned.length === 1 ? "" : "s"} sin sitio.`}
              </Notice>
            )}
            {noCoords.length > 0 && (
              <Notice>
                Sin dirección en el mapa: {noCoords.map((g) => g.location.name).join(", ")}. Añádela en su ficha.
              </Notice>
            )}
            {noPapers.length > 0 && (
              <Notice action={{ label: "Ver papeles", href: `/app/${projectId}/documentos` }}>
                Sin permiso ni papeles subidos: {noPapers.map((g) => g.location.name).join(", ")}.
              </Notice>
            )}
          </Notices>

          {groups.length > 0 && (
            <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              {mapLocations.length > 0 ? (
                <div className="overflow-hidden rounded-xl lg:sticky lg:top-24">
                  <LocationsMapClient locations={mapLocations} className="h-[320px] lg:h-[520px]" />
                </div>
              ) : (
                <p className="font-sans text-sm text-muted">
                  Ninguno de los sitios tiene coordenadas todavía: añade la dirección en su ficha y aparecerán en el mapa.
                </p>
              )}

              <ol className="sheet divide-y divide-line px-5 sm:px-6">
                {groups.map((g) => (
                  <li key={g.location.id} className="py-5">
                    <div className="flex items-start gap-4">
                      <span
                        aria-hidden
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-accent font-mono text-xs font-bold"
                      >
                        {g.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/app/localizaciones/${g.location.id}?from=${projectId}`}
                          className="group inline-flex items-baseline gap-2"
                        >
                          <span className="font-display text-lg leading-tight font-bold tracking-tight transition-colors group-hover:text-accent">
                            {g.location.name}
                          </span>
                          <span aria-hidden className="text-muted transition-colors group-hover:text-accent">
                            →
                          </span>
                          <LinkPendingHint className="shrink-0" />
                        </Link>
                        <p className="mt-0.5 font-sans text-[13px] text-muted">
                          {[g.location.address, g.location.contactName, g.location.contactPhone].filter(Boolean).join(" · ") ||
                            "Sin dirección ni contacto"}
                        </p>
                        <p className="mt-1 flex flex-wrap gap-x-4 font-mono text-[11px]">
                          <span className="text-muted">
                            {g.scenes.length} escena{g.scenes.length === 1 ? "" : "s"}
                          </span>
                          {g.location._count.documents > 0 ? (
                            <span className="text-success">✓ {g.location._count.documents} papel{g.location._count.documents === 1 ? "" : "es"}</span>
                          ) : (
                            <span className="text-warn">Sin permiso subido</span>
                          )}
                        </p>
                        <ul className="mt-3 border-t border-line/60 pt-2">{g.scenes.map(sceneLine)}</ul>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {unassigned.length > 0 && (
            <section aria-labelledby="sin-sitio" className="mt-12">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 id="sin-sitio" className="font-display text-xl font-black tracking-tight">
                  Escenas sin localización
                </h2>
                <Link href={`/app/${projectId}/localizaciones?ver=biblioteca`} className="font-sans text-sm text-accent underline-offset-4 hover:underline">
                  Ver los sitios de tu biblioteca →
                </Link>
              </div>
              <ul className="mt-4 border-l-2 border-warn pl-4">{unassigned.map(sceneLine)}</ul>
            </section>
          )}

          <NextTool href={`/app/${projectId}/plan-de-rodaje`} label="Plan de rodaje" note="agrupa los días por sitio" />
        </>
      )}
    </div>
  );
}
