import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getProjectProgress } from "@/lib/project-progress";
import { buildProjectHighlights, getProjectSummary, type SummaryTool } from "@/lib/project-summary";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PdfLink } from "@/components/PdfLink";
import { DossierEmailButton } from "@/components/DossierEmailButton";
import {
  DAY_PART_LABELS,
  INT_EXT_LABELS,
  BREAKDOWN_CATEGORY_LABELS,
  INVENTORY_CATEGORY_LABELS,
} from "@/lib/labels";
import { BreakdownCategory } from "@/lib/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ResumenTabs } from "@/components/ResumenTabs";
import { ProjectMapLoader } from "@/components/project-map/ProjectMapLoader";
import { buildMapCards, getMapBoard, getMapEntities, getMapProjectImages, listMapBoards } from "@/lib/project-map";
import { MapBoardTabs } from "@/components/project-map/MapBoardTabs";
import { getSiteOrigin } from "@/lib/site-origin";
import { getCurrentProfile } from "@/lib/current-user";
import { MAP_FREE_ITEM_LIMIT, MAP_MAX_ITEMS } from "@/lib/limits";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Semanas de un mes completo (lunes primero), rellenando la primera y
// última semana con días del mes vecino — mismo cálculo que
// app/app/(dashboard)/calendario/page.tsx, aquí solo para marcar los
// días de rodaje de este proyecto, sin eventos ni formulario.
function buildMonthWeeks(monthStart: Date): Date[][] {
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - firstWeekday);
  const lastWeekday = (monthEnd.getDay() + 6) % 7;
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - lastWeekday));

  const days: Date[] = [];
  for (const cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

const LABEL = "eyebrow";

function Bar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="h-1 w-full bg-line" role="presentation">
      <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Apartado desplegable, cerrado por defecto: una fila de la hoja de su grupo (no una caja suelta).
// Título, una frase de resumen a la derecha y, si aplica, una marca (✓ completo / punto pendiente).
function Section({
  title,
  teaser,
  href,
  status,
  children,
}: {
  title: string;
  teaser: string;
  href: string;
  status?: "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-bg/60 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
            ›
          </span>
          <span className="font-display text-[15px] font-bold">{title}</span>
          {status === "ok" && (
            <span className="font-sans text-xs text-success" title="Completo" aria-label="Completo">
              ✓
            </span>
          )}
          {status === "warn" && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" title="Tiene pendientes" aria-label="Tiene pendientes" />
          )}
        </span>
        <span className="text-right font-sans text-[13px] text-muted">{teaser}</span>
      </summary>
      <div className="px-5 pb-5 pl-11 sm:px-6 sm:pl-12">
        <div className="border-t border-line pt-3">{children}</div>
        <Link href={href} className="link-action mt-3 !px-0 !text-accent">
          Abrir {title} →
        </Link>
      </div>
    </details>
  );
}

// Un grupo (Preproducción, Producción…): título sobre la mesa y sus apartados como filas de una hoja.
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-xl font-black tracking-tight">{title}</h2>
      <div className="sheet mt-4 divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1 font-sans text-sm text-muted">{children}</p>;
}

export default async function ProjectSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ vista?: string; pizarra?: string }>;
}) {
  const { projectId } = await params;
  const { vista, pizarra } = await searchParams;

  const access = await getProjectForCurrentUser(projectId);
  if (!access) notFound();

  // Mapa del proyecto: una tarjeta-resumen por herramienta, en un tablero editable.
  if (vista === "mapa") {
    const me = await getCurrentProfile();
    const boards = await listMapBoards(projectId);
    const activeId = boards.find((b) => b.id === pizarra)?.id ?? boards[0].id;
    const [cards, board, mapIsPro, images, entities, origin] = await Promise.all([
      buildMapCards(projectId),
      getMapBoard(projectId, activeId),
      isProjectOwnerPro(access.organizationId),
      getMapProjectImages(projectId),
      getMapEntities(projectId),
      getSiteOrigin(),
    ]);
    if (!board) notFound();
    return (
      <div>
        <PageHeader
          eyebrow="Proyecto"
          title="Resumen"
          description="La pizarra de tu proyecto: una tarjeta por herramienta con lo importante, y todo lo que quieras añadir (notas, textos, imágenes, formas, secciones y flechas). Las tarjetas se actualizan solas con tus datos."
        />
        <ResumenTabs projectId={projectId} active="mapa" />
        <div className="mt-6">
          <MapBoardTabs
            projectId={projectId}
            boards={boards}
            activeId={board.id}
            shareUrl={board.shareToken ? `${origin}/pizarra/${board.shareToken}` : null}
          />
          <ProjectMapLoader
            key={board.id}
            projectId={projectId}
            boardId={board.id}
            boardName={board.name}
            userId={me?.id ?? "anon"}
            userName={me?.fullName ?? me?.email?.split("@")[0] ?? "Alguien"}
            entities={entities}
            tools={cards}
            layout={board.layout}
            updatedAt={board.updatedAt}
            isPro={mapIsPro}
            freeLimit={MAP_FREE_ITEM_LIMIT}
            maxItems={MAP_MAX_ITEMS}
            images={images}
          />
        </div>
      </div>
    );
  }

  const isPro = await isProjectOwnerPro(access.organizationId);

  const [data, phase] = await Promise.all([getProjectSummary(projectId), getProjectProgress(projectId)]);
  const {
    project,
    locations,
    shotsTotal,
    storyboardFramesCount,
    budgetCategoriesWithTotals,
    budgetGrandTotal,
    budgetGrandActual,
    hasBudgetActual,
    inventoryItems,
    vehicles,
    shootingDaysWithNeeds,
  } = data;
  const { headline, nextShoot, pending, progress, script, budget } = buildProjectHighlights(data);

  const toolHref = (tool: SummaryTool) => `/app/${projectId}/${tool}`;
  const charactersWithActor = project.characters.filter((c) => c.actorId).length;
  const scenesWithLocation = project.scenes.filter((s) => s.locationId).length;
  const budgetTarget = budget.target;

  // Marca de cada apartado según su barra de progreso (✓ completo, punto si falta algo).
  const statusOf = (...keys: string[]): "ok" | "warn" | undefined => {
    const items = progress.filter((p) => keys.includes(p.key) && p.total > 0);
    if (items.length === 0) return undefined;
    return items.every((p) => p.done === p.total) ? "ok" : "warn";
  };

  // Un mini-calendario por cada mes que tenga algún día de rodaje.
  const monthKeys = [
    ...new Set(shootingDaysWithNeeds.map((d) => `${d.date.getFullYear()}-${d.date.getMonth()}`)),
  ].sort();
  const calendarMonths = monthKeys.map((key) => {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month, 1);
  });

  const breakdownByCategory = Object.values(BreakdownCategory).map((category) => ({
    category,
    items: project.breakdownElements.filter((el) => el.category === category),
  }));

  const budgetOver = budgetTarget !== null && budgetGrandTotal > budgetTarget;

  return (
    <div>
      <PageHeader
        eyebrow="Proyecto"
        title="Resumen"
        description="Todo el proyecto de un vistazo. Pulsa cada apartado para desplegarlo y usa su enlace para ir a la herramienta."
        actions={
          isPro ? (
            <div className="flex items-center gap-3">
              <PdfLink href={`/api/pdf/dossier/${projectId}`} label="Descargar dossier" />
              <DossierEmailButton projectId={projectId} />
            </div>
          ) : (
            <Link
              href="/app/organizacion"
              className="btn btn-outline inline-flex items-center gap-1.5 print:hidden"
            >
              Dossier en PDF — solo PRO
            </Link>
          )
        }
      />

      <ResumenTabs projectId={projectId} active="resumen" />

      {/* Dónde está el proyecto: el porcentaje grande y la frase que dice qué falta. */}
      <section aria-label="Avance" className="mt-10 flex items-center gap-6">
        <p className="shrink-0 font-display text-5xl font-black tabular-nums tracking-tight sm:text-6xl">
          {headline.percent}
          <span className="text-2xl text-muted">%</span>
        </p>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[15px] leading-relaxed">{headline.sentence}</p>
          <div className="mt-3 max-w-xl">
            <Bar value={headline.percent / 100} />
          </div>
        </div>
      </section>

      {/* Cuatro datos clave en fila, separados por una raya (sin una caja por dato). */}
      <dl className="mt-8 grid grid-cols-2 gap-y-6 border-y border-line py-6 lg:grid-cols-4 lg:divide-x lg:divide-line">
        <div className="pr-6">
          <dt className={LABEL}>Estado</dt>
          {/* La misma fase que dice la portada (no el campo de estado, que puede quedarse atrás). */}
          <dd className="mt-2 font-display text-xl font-black tracking-tight">{phase.label.split(" · ")[0]}</dd>
        </div>
        <div className="pr-6 lg:pl-6">
          <dt className={LABEL}>Escenas</dt>
          <dd className="mt-2 font-display text-xl font-black tabular-nums">{project.scenes.length}</dd>
        </div>
        <div className="pr-6 lg:pl-6">
          <dt className={LABEL}>Días de rodaje</dt>
          <dd className="mt-2 font-display text-xl font-black tabular-nums">{project.shootingDays.length}</dd>
          {nextShoot && (
            <dd className="mt-1 font-sans text-xs text-muted">
              Próximo: {nextShoot.date.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" })}
              {nextShoot.daysUntil === 0 ? " (hoy)" : nextShoot.daysUntil === 1 ? " (mañana)" : ` (en ${nextShoot.daysUntil} días)`}
            </dd>
          )}
        </div>
        <div className="lg:pl-6">
          <dt className={LABEL}>Presupuesto</dt>
          <dd className={`mt-2 font-display text-xl font-black tabular-nums ${budgetOver ? "text-danger" : ""}`}>
            {currency(budgetGrandTotal)}
          </dd>
          {(budgetTarget || hasBudgetActual) && (
            <dd className="mt-1 font-sans text-xs text-muted">
              {[
                budgetTarget ? `objetivo ${currency(budgetTarget)}` : null,
                hasBudgetActual ? `gastado ${currency(budgetGrandActual)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          )}
        </div>
      </dl>

      {/* Lo que falta: cada cosa es un aviso con barra ámbar, a la vista (no plegado). */}
      <section aria-labelledby="pending-title" className="mt-10">
        {pending.length === 0 ? (
          <p className="flex items-center gap-2 font-sans text-sm text-success">
            <span aria-hidden>✓</span> Todo al día: no hay nada pendiente.
          </p>
        ) : (
          <>
            <h2 id="pending-title" className="font-display text-xl font-black tracking-tight">
              Por resolver <span className="font-sans text-sm font-normal text-muted">· {plural(pending.length, "cosa", "cosas")}</span>
            </h2>
            <ul className="mt-4 space-y-2">
              {pending.map((item) => (
                <li key={item.text}>
                  <Link
                    href={toolHref(item.tool)}
                    className="group flex items-center justify-between gap-3 border-l-2 border-warn py-1.5 pl-3 font-sans text-sm"
                  >
                    <span className="transition-colors group-hover:text-accent">{item.text}</span>
                    <span aria-hidden className="text-muted group-hover:text-accent">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Group title="Preproducción">
        <Section
          href={`/app/${projectId}/guion`}
          title="Escenas"
          status={statusOf("guion")}
          teaser={`${scenesWithLocation}/${project.scenes.length} con localización`}
        >
          {project.scenes.length === 0 ? (
            <Empty>Sin escenas todavía.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {project.scenes.map((scene) => (
                <div key={scene.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div>
                    <span className="font-sans text-sm">Escena {scene.number}</span>
                    <span className="ml-2 font-sans text-xs text-muted">
                      {INT_EXT_LABELS[scene.intExt]} · {DAY_PART_LABELS[scene.dayPart]}
                      {scene.location ? ` · ${scene.location.name}` : ""}
                    </span>
                  </div>
                  <span className="shrink-0 font-sans text-xs text-muted">
                    {scene.characters.length} pj · {scene._count.shots} planos
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          href={`/app/${projectId}/personajes`}
          title="Reparto"
          status={statusOf("reparto")}
          teaser={`${charactersWithActor}/${project.characters.length} con actor`}
        >
          {project.characters.length === 0 ? (
            <Empty>Sin personajes todavía.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {project.characters.map((character) => (
                <div key={character.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-sans text-sm">{character.name}</span>
                  <span className={`font-sans text-xs ${character.actor ? "text-muted" : "text-warn"}`}>
                    {character.actor?.name ?? "Sin actor asignado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section href={`/app/${projectId}/desglose`} title="Desglose" teaser={`${project.breakdownElements.length} elementos`}>
          {project.breakdownElements.length === 0 ? (
            <Empty>Sin elementos todavía.</Empty>
          ) : (
            <div className="space-y-4 py-2">
              {breakdownByCategory
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.category}>
                    <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                      {BREAKDOWN_CATEGORY_LABELS[group.category]} ({group.items.length})
                    </p>
                    <p className="mt-1 font-sans text-sm text-muted">{group.items.map((item) => item.name).join(", ")}</p>
                  </div>
                ))}
            </div>
          )}
        </Section>

        <Section
          href={`/app/${projectId}/shot-list`}
          title="Shot list y storyboard"
          status={statusOf("shot-list", "storyboard")}
          teaser={`${shotsTotal} planos · ${storyboardFramesCount} viñetas`}
        >
          <p className="font-sans text-sm">
            {plural(shotsTotal, "plano definido", "planos definidos")} en total ·{" "}
            {plural(storyboardFramesCount, "viñeta", "viñetas")} de storyboard.
          </p>
        </Section>
      </Group>

      <Group title="Producción">
        <Section
          href={`/app/${projectId}/plan-de-rodaje`}
          title="Plan de rodaje"
          status={statusOf("plan", "call-sheets")}
          teaser={`${plural(project.shootingDays.length, "día", "días")}`}
        >
          {shootingDaysWithNeeds.length === 0 ? (
            <Empty>Sin días de rodaje todavía.</Empty>
          ) : (
            <>
              <div className="divide-y divide-line">
                {shootingDaysWithNeeds.map((day) => {
                  const doneShots = day.shots.filter((sh) => sh.done).length;
                  return (
                    <Link
                      key={day.id}
                      href={`/app/${projectId}/plan-de-rodaje/${day.id}`}
                      className="block py-2.5 transition-colors hover:text-accent"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <span className="font-sans text-sm">
                          {day.date.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })}
                        </span>
                        <span className="font-sans text-xs text-muted">
                          {plural(day.scenes.length, "escena", "escenas")}
                          {day.shots.length > 0
                            ? ` · ${plural(day.shots.length, "plano", "planos")}${doneShots > 0 ? ` (${doneShots} rodados)` : ""}`
                            : ""}{" "}
                          · {day.callSheet ? "con hoja de llamada" : "sin hoja de llamada"}
                        </span>
                      </div>
                      <p className="mt-1 font-sans text-xs text-muted">
                        {[
                          day.crewNames.length > 0 ? `Equipo: ${day.crewNames.join(", ")}` : null,
                          day.itemNames.length > 0 ? `Material: ${day.itemNames.join(", ")}` : null,
                          day.vehicleNames.length > 0 ? `Vehículos: ${day.vehicleNames.join(", ")}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Nada asignado todavía para este día."}
                      </p>
                    </Link>
                  );
                })}
              </div>

              {calendarMonths.length > 0 && (
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  {calendarMonths.map((monthStart) => (
                    <div key={monthStart.toISOString()}>
                      <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                        {monthStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                      </p>
                      <div className="mt-2 grid grid-cols-7 border-t border-l border-line">
                        {WEEKDAYS.map((label) => (
                          <div
                            key={label}
                            className="border-r border-b border-line bg-bg px-1 py-1 font-mono text-[10px] tracking-widest text-muted uppercase"
                          >
                            {label}
                          </div>
                        ))}
                        {buildMonthWeeks(monthStart)
                          .flat()
                          .map((day) => {
                            const isCurrentMonth = day.getMonth() === monthStart.getMonth();
                            const shootingDay = shootingDaysWithNeeds.find((d) => sameDay(d.date, day));
                            const cellContent = (
                              <>
                                <p className={`font-mono text-[10px] ${shootingDay ? "text-accent" : "text-muted"}`}>
                                  {day.getDate()}
                                </p>
                                {shootingDay && (
                                  <p className="mt-0.5 truncate font-mono text-[10px] text-fg">
                                    {shootingDay.shots.length > 0
                                      ? `${shootingDay.shots.length} pl.`
                                      : `${shootingDay.scenes.length} esc.`}
                                  </p>
                                )}
                              </>
                            );
                            return (
                              <div
                                key={day.toISOString()}
                                className={`min-h-12 border-r border-b border-line p-1 ${
                                  isCurrentMonth ? "" : "opacity-30"
                                } ${shootingDay ? "bg-accent/10" : ""}`}
                              >
                                {shootingDay ? (
                                  <Link
                                    href={`/app/${projectId}/plan-de-rodaje/${shootingDay.id}`}
                                    className="block hover:opacity-80"
                                  >
                                    {cellContent}
                                  </Link>
                                ) : (
                                  cellContent
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Section>

        <Section
          href={`/app/${projectId}/presupuesto`}
          title="Presupuesto"
          status={budgetOver || budgetCategoriesWithTotals.length === 0 ? "warn" : undefined}
          teaser={
            (budgetTarget ? `${currency(budgetGrandTotal)} / ${currency(budgetTarget)}` : currency(budgetGrandTotal)) +
            (hasBudgetActual ? ` · gastado ${currency(budgetGrandActual)}` : "")
          }
        >
          {budgetCategoriesWithTotals.length === 0 ? (
            <Empty>Sin categorías todavía.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {budgetCategoriesWithTotals.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-sans text-sm">{category.name}</span>
                  <span className="font-sans text-xs text-muted">
                    {currency(category.total)}
                    {hasBudgetActual && category.actual > 0 ? ` · gastado ${currency(category.actual)}` : ""}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="font-display text-sm font-bold">Total</span>
                <span className="font-display text-sm font-bold text-accent">{currency(budgetGrandTotal)}</span>
              </div>
            </div>
          )}
        </Section>

        {script.takes > 0 && (
          <Section
            href={`/app/${projectId}/script`}
            title="Parte de script"
            teaser={`${script.takes} tomas · ${script.good} buenas`}
          >
            <p className="font-sans text-sm">
              {plural(script.takes, "toma apuntada", "tomas apuntadas")}, {plural(script.good, "buena", "buenas")}
              {shotsTotal > 0 ? ` · ${script.shotsWithGood} de ${shotsTotal} planos con toma buena` : ""}.
            </p>
          </Section>
        )}
      </Group>

      <Group title="Equipo y recursos">
        <Section
          href={`/app/${projectId}/equipo`}
          title="Equipo técnico"
          teaser={`${project.crewMembers.length} personas`}
        >
          {project.crewMembers.length === 0 ? (
            <Empty>Sin equipo técnico todavía.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {project.crewMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-sans text-sm">{member.name}</span>
                  <span className="font-sans text-xs text-muted">
                    {[member.role, member.phone].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section href={`/app/${projectId}/localizaciones`} title="Localizaciones" teaser={`${locations.length} usadas`}>
          {locations.length === 0 ? (
            <Empty>Ninguna escena tiene localización todavía.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {locations.map((location) => (
                <div key={location.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-sans text-sm">{location.name}</span>
                  <span className="font-sans text-xs text-muted">{plural(location.sceneCount, "escena", "escenas")}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section href="/app/inventario" title="Inventario" teaser={`${inventoryItems.length} elementos`}>
          {inventoryItems.length === 0 ? (
            <Empty>Sin equipo reservado todavía — se reserva por día de rodaje.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {inventoryItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-sans text-sm">{item.name}</span>
                  <span className="font-sans text-xs text-muted">
                    {INVENTORY_CATEGORY_LABELS[item.category as keyof typeof INVENTORY_CATEGORY_LABELS] ?? item.category} ·{" "}
                    {plural(item.daysCount, "día", "días")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section href={`/app/${projectId}/vehiculos`} title="Vehículos" teaser={`${vehicles.length} usados`}>
          {vehicles.length === 0 ? (
            <Empty>Sin vehículos reservados todavía — se reservan por día de rodaje.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-sans text-sm">{vehicle.name}</span>
                  <span className="font-sans text-xs text-muted">
                    {[vehicle.type, vehicle.plate].filter(Boolean).join(" · ")}
                    {vehicle.type || vehicle.plate ? " · " : ""}
                    {plural(vehicle.daysCount, "día", "días")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </Group>
    </div>
  );
}
