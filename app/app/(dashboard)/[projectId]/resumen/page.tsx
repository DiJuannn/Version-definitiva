import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { buildProjectHighlights, getProjectSummary, type SummaryTool } from "@/lib/project-summary";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PdfLink } from "@/components/PdfLink";
import { DossierEmailButton } from "@/components/DossierEmailButton";
import {
  DAY_PART_LABELS,
  INT_EXT_LABELS,
  BREAKDOWN_CATEGORY_LABELS,
  INVENTORY_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/labels";
import { BreakdownCategory } from "@/lib/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs } from "@/components/SectionTabs";

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

function untilLabel(daysUntil: number) {
  if (daysUntil === 0) return "Hoy";
  if (daysUntil === 1) return "Mañana";
  return `En ${daysUntil} días`;
}

const LABEL = "font-mono text-[10px] tracking-widest text-muted uppercase";
const CARD = "border border-line bg-bg-raised/40 p-5";

function Bar({ value, tone = "accent" }: { value: number; tone?: "accent" | "success" | "danger" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const color = tone === "danger" ? "bg-danger" : tone === "success" ? "bg-success" : "bg-accent";
  return (
    <div className="h-1 w-full bg-line" role="presentation">
      <div className={`h-full ${color} transition-[width]`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DetailBlock({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <p className="font-mono text-xs tracking-widest text-accent uppercase">{title}</p>
        <Link href={href} className="link-action !text-muted hover:!text-accent">
          {linkLabel} →
        </Link>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-sm text-muted">{children}</p>;
}

export default async function ProjectSummaryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const access = await getProjectForCurrentUser(projectId);
  if (!access) notFound();

  const isPro = await isProjectOwnerPro(access.organizationId);

  const data = await getProjectSummary(projectId);
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
  const highlights = buildProjectHighlights(data);
  const { nextShoot, span, budget, progress, pending, headline, timeline, script } = highlights;

  const toolHref = (tool: SummaryTool) => `/app/${projectId}/${tool}`;
  const dateLong = (date: Date) =>
    date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dateShort = (date: Date) =>
    date.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

  const charactersWithActor = project.characters.filter((c) => c.actorId).length;
  const budgetTarget = budget.target;
  const budgetBase = budgetTarget ?? budgetGrandTotal;
  const overTarget = budgetTarget !== null && budgetGrandTotal > budgetTarget;

  // Un mini-calendario por cada mes que tenga algún día de rodaje — sin
  // paginación ni formulario, solo para ver de un vistazo en qué fechas
  // caen (el detalle de qué llevar cada día ya está en "Plan de rodaje").
  const monthKeys = [
    ...new Set(
      shootingDaysWithNeeds.map((d) => `${d.date.getFullYear()}-${d.date.getMonth()}`),
    ),
  ].sort();
  const calendarMonths = monthKeys.map((key) => {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month, 1);
  });

  const breakdownByCategory = Object.values(BreakdownCategory).map((category) => ({
    category,
    items: project.breakdownElements.filter((el) => el.category === category),
  }));

  const stats: { label: string; value: string | number; href: string }[] = [
    { label: "Escenas", value: project.scenes.length, href: `/app/${projectId}/guion` },
    { label: "Planos", value: shotsTotal, href: `/app/${projectId}/shot-list` },
    { label: "Personajes", value: project.characters.length, href: `/app/${projectId}/personajes` },
    { label: "Localizaciones", value: locations.length, href: `/app/${projectId}/localizaciones` },
    { label: "Equipo", value: project.crewMembers.length, href: `/app/${projectId}/desglose?tab=equipo` },
    { label: "Días de rodaje", value: project.shootingDays.length, href: `/app/${projectId}/plan-de-rodaje` },
  ];

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow={`Proyecto · ${PROJECT_STATUS_LABELS[project.status]}`}
        title="Resumen"
        description="Lo próximo, cómo vas y qué te falta por resolver. El detalle de cada apartado está más abajo."
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

      {/* Dónde está el proyecto, en una frase */}
      <section
        aria-label="Estado del proyecto"
        className="mt-8 flex flex-col gap-4 border border-accent/40 bg-accent/5 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6"
      >
        <div className="shrink-0">
          <p className="font-display text-5xl leading-none font-black tabular-nums">
            {headline.percent}
            <span className="text-2xl text-muted">%</span>
          </p>
          <p className={`${LABEL} mt-1`}>Preparación</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-snug font-bold sm:text-xl">{headline.sentence}</p>
          <div className="mt-3">
            <Bar value={headline.percent / 100} tone={headline.percent >= 100 ? "success" : "accent"} />
          </div>
        </div>
      </section>

      {/* Lo más importante, de un vistazo */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <section className={CARD} aria-label="Próximo rodaje">
          <p className={LABEL}>Próximo rodaje</p>
          {nextShoot ? (
            <>
              <p className="mt-3 font-display text-2xl leading-tight font-black tracking-tight uppercase">
                {dateLong(nextShoot.date)}
              </p>
              <p className="mt-1 font-mono text-xs text-accent">{untilLabel(nextShoot.daysUntil)}</p>
              <p className="mt-4 font-mono text-sm">
                {plural(nextShoot.scenes, "escena", "escenas")}
                {nextShoot.shots > 0 ? ` · ${plural(nextShoot.shots, "plano", "planos")}` : ""}
              </p>
              {nextShoot.locationNames.length > 0 && (
                <p className="mt-1 font-mono text-xs text-muted">{nextShoot.locationNames.join(", ")}</p>
              )}
              {nextShoot.callTime && (
                <p className="mt-1 font-mono text-xs text-muted">Llamada {nextShoot.callTime}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                <Link href={`/app/${projectId}/plan-de-rodaje/${nextShoot.dayId}`} className="link-action !text-accent">
                  Abrir el día →
                </Link>
                <Link
                  href={
                    nextShoot.hasCallSheet
                      ? `/app/${projectId}/call-sheets/${nextShoot.dayId}`
                      : `/app/${projectId}/plan-de-rodaje/${nextShoot.dayId}`
                  }
                  className="link-action"
                >
                  {nextShoot.hasCallSheet ? "Ver call sheet →" : "Generar call sheet →"}
                </Link>
              </div>
            </>
          ) : span ? (
            <>
              <p className="mt-3 font-display text-2xl leading-tight font-black tracking-tight uppercase">
                Rodaje terminado
              </p>
              <p className="mt-1 font-mono text-xs text-muted">Último día: {dateLong(span.last)}</p>
            </>
          ) : (
            <>
              <p className="mt-3 font-display text-2xl leading-tight font-black tracking-tight uppercase">
                Sin fecha de rodaje
              </p>
              <p className="mt-1 font-mono text-xs text-muted">Aún no has planificado ningún día.</p>
              <Link href={`/app/${projectId}/plan-de-rodaje`} className="link-action mt-4 !text-accent">
                Planificar el rodaje →
              </Link>
            </>
          )}
        </section>

        <section className={CARD} aria-label="Avance del rodaje">
          <p className={LABEL}>Avance del rodaje</p>
          {span ? (
            <>
              <p className="mt-3 font-display text-4xl font-black tabular-nums">
                {highlights.shots.total > 0
                  ? `${highlights.shots.done}/${highlights.shots.total}`
                  : `${span.past}/${span.total}`}
              </p>
              <p className="mt-1 font-mono text-xs text-muted">
                {highlights.shots.total > 0 ? "planos rodados" : "días de rodaje ya pasados"}
              </p>
              <div className="mt-4">
                <Bar
                  value={
                    highlights.shots.total > 0
                      ? highlights.shots.done / highlights.shots.total
                      : span.past / span.total
                  }
                  tone="success"
                />
              </div>
              <p className="mt-3 font-mono text-[11px] text-muted">
                {plural(span.total, "día", "días")} · del {dateShort(span.first)} al {dateShort(span.last)}
              </p>
              {script.takes > 0 && (
                <Link
                  href={`/app/${projectId}/script`}
                  className="mt-1 block font-mono text-[11px] text-muted transition-colors hover:text-accent"
                >
                  Script: {plural(script.takes, "toma", "tomas")} · {script.good} buena{script.good === 1 ? "" : "s"} →
                </Link>
              )}
            </>
          ) : (
            <>
              <p className="mt-3 font-display text-4xl font-black text-muted">—</p>
              <p className="mt-1 font-mono text-xs text-muted">Aparecerá al crear los días de rodaje.</p>
            </>
          )}
        </section>

        <section className={CARD} aria-label="Presupuesto">
          <p className={LABEL}>Presupuesto</p>
          <p className="mt-3 font-display text-4xl font-black tabular-nums">{currency(budget.total)}</p>
          <p className="mt-1 font-mono text-xs text-muted">
            previsto con IVA
            {budgetTarget !== null ? ` · objetivo ${currency(budgetTarget)}` : ""}
          </p>
          {budgetBase > 0 && (
            <div className="mt-4">
              <Bar value={budget.total / budgetBase} tone={overTarget ? "danger" : "accent"} />
            </div>
          )}
          <p className={`mt-3 font-mono text-[11px] ${overTarget ? "text-danger" : "text-muted"}`}>
            {overTarget
              ? `${currency(budget.total - (budgetTarget ?? 0))} por encima del objetivo`
              : budgetTarget !== null
                ? `Quedan ${currency(budgetTarget - budget.total)} sobre el objetivo`
                : "Sin objetivo de presupuesto fijado"}
          </p>
          {budget.hasActual && (
            <p className="mt-1 font-mono text-[11px] text-muted">
              Gastado {currency(budget.actual)}
              {budgetBase > 0 ? ` (${Math.round((budget.actual / budgetBase) * 100)}%)` : ""}
            </p>
          )}
        </section>
      </div>

      {/* Días de rodaje de un vistazo */}
      {timeline.length > 0 && (
        <section aria-label="Días de rodaje" className="mt-3 border border-line p-4">
          <p className={LABEL}>Días de rodaje</p>
          <ol className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {timeline.map((day) => {
              const done = day.shots > 0 && day.shotsDone === day.shots;
              return (
                <li key={day.dayId} className="shrink-0">
                  <Link
                    href={`/app/${projectId}/plan-de-rodaje/${day.dayId}`}
                    className={`block w-32 border p-3 transition-colors hover:border-accent ${
                      day.when === "today"
                        ? "border-accent bg-accent/10"
                        : day.when === "past"
                          ? "border-line opacity-80"
                          : "border-line"
                    }`}
                  >
                    <p className="flex items-center justify-between font-mono text-[10px] tracking-widest uppercase">
                      <span className={day.when === "today" ? "text-accent" : "text-muted"}>
                        {day.when === "today" ? "Hoy" : day.when === "past" ? "Hecho" : "Próximo"}
                      </span>
                      {done && <span className="text-success">✓</span>}
                    </p>
                    <p className="mt-1 font-display text-sm font-bold">
                      {day.date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted">
                      {plural(day.scenes, "escena", "escenas")}
                      {day.shots > 0 ? ` · ${day.shotsDone}/${day.shots} pl.` : ""}
                    </p>
                    <p className={`mt-0.5 font-mono text-[10px] ${day.hasCallSheet ? "text-success" : "text-warn"}`}>
                      {day.hasCallSheet ? "call sheet ✓" : "sin call sheet"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Números clave */}
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-bg px-4 py-3 transition-colors hover:bg-bg-raised"
          >
            <p className="font-display text-2xl font-black tabular-nums">{stat.value}</p>
            <p className={`${LABEL} mt-0.5`}>{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Qué tienes hecho y qué falta */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[3fr_2fr]">
        <section className={CARD} aria-label="Preparación">
          <p className={LABEL}>Preparación</p>
          <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {progress.map((item) => {
              const ratio = item.total > 0 ? item.done / item.total : 0;
              const complete = item.total > 0 && item.done === item.total;
              return (
                <Link key={item.key} href={toolHref(item.tool)} className="group block">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-sm font-bold transition-colors group-hover:text-accent">
                      {item.label}
                    </span>
                    <span className={`font-mono text-xs tabular-nums ${complete ? "text-success" : "text-muted"}`}>
                      {complete ? "✓ " : ""}
                      {item.done}/{item.total}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={ratio} tone={complete ? "success" : "accent"} />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted">{item.hint}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className={CARD} aria-label="Por resolver">
          <p className={LABEL}>Por resolver</p>
          {pending.length === 0 ? (
            <p className="mt-4 font-mono text-sm text-success">✓ Todo al día. No hay nada pendiente.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {pending.map((item) => (
                <li key={item.text}>
                  <Link
                    href={toolHref(item.tool)}
                    className="flex items-center justify-between gap-3 py-2.5 font-mono text-xs transition-colors hover:text-accent"
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                      {item.text}
                    </span>
                    <span aria-hidden className="text-muted">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Detalle, en pestañas */}
      <div className="mt-10">
        <p className={`${LABEL} mb-3`}>Detalle</p>
        <SectionTabs
          ariaLabel="Detalle del proyecto"
          tabs={[
            {
              id: "rodaje",
              label: "Rodaje",
              count: shootingDaysWithNeeds.length,
              content: (
                <div className="space-y-10">
                  <DetailBlock title="Plan de rodaje" href={`/app/${projectId}/plan-de-rodaje`} linkLabel="Abrir el plan">
                    {shootingDaysWithNeeds.length === 0 ? (
                      <Empty>Sin días de rodaje todavía.</Empty>
                    ) : (
                      <div className="divide-y divide-line">
                        {shootingDaysWithNeeds.map((day) => {
                          const doneShots = day.shots.filter((sh) => sh.done).length;
                          return (
                            <Link
                              key={day.id}
                              href={`/app/${projectId}/plan-de-rodaje/${day.id}`}
                              className="block py-3 transition-colors hover:text-accent"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                                <span className="font-mono text-sm">
                                  {day.date.toLocaleDateString("es-ES", {
                                    weekday: "short",
                                    day: "2-digit",
                                    month: "short",
                                  })}
                                </span>
                                <span className="font-mono text-xs text-muted">
                                  {plural(day.scenes.length, "escena", "escenas")}
                                  {day.shots.length > 0
                                    ? ` · ${plural(day.shots.length, "plano", "planos")}${doneShots > 0 ? ` (${doneShots} rodados)` : ""}`
                                    : ""}{" "}
                                  · {day.callSheet ? "con call sheet" : "sin call sheet"}
                                </span>
                              </div>
                              <p className="mt-1 font-mono text-[11px] text-muted">
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
                    )}
                  </DetailBlock>

                  {calendarMonths.length > 0 && (
                    <DetailBlock title="Calendario" href={`/app/${projectId}/plan-de-rodaje`} linkLabel="Abrir el plan">
                      <div className="grid gap-6 lg:grid-cols-2">
                        {calendarMonths.map((monthStart) => (
                          <div key={monthStart.toISOString()}>
                            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                              {monthStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                            </p>
                            <div className="mt-2 grid grid-cols-7 border-t border-l border-line">
                              {WEEKDAYS.map((label) => (
                                <div
                                  key={label}
                                  className="border-r border-b border-line bg-bg-raised px-1 py-1 font-mono text-[9px] tracking-widest text-muted uppercase"
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
                                      <p
                                        className={`font-mono text-[10px] ${
                                          shootingDay ? "text-accent" : "text-muted"
                                        }`}
                                      >
                                        {day.getDate()}
                                      </p>
                                      {shootingDay && (
                                        <p className="mt-0.5 truncate font-mono text-[9px] text-fg">
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
                    </DetailBlock>
                  )}
                </div>
              ),
            },
            {
              id: "guion",
              label: "Guion y planos",
              count: project.scenes.length,
              content: (
                <div className="space-y-10">
                  <DetailBlock title="Escenas" href={`/app/${projectId}/guion`} linkLabel="Abrir Guion">
                    {project.scenes.length === 0 ? (
                      <Empty>Sin escenas todavía.</Empty>
                    ) : (
                      <div className="divide-y divide-line">
                        {project.scenes.map((scene) => (
                          <div key={scene.id} className="flex items-center justify-between gap-4 py-2.5">
                            <div>
                              <span className="font-mono text-sm">Escena {scene.number}</span>
                              <span className="ml-2 font-mono text-xs text-muted">
                                {INT_EXT_LABELS[scene.intExt]} · {DAY_PART_LABELS[scene.dayPart]}
                                {scene.location ? ` · ${scene.location.name}` : ""}
                              </span>
                            </div>
                            <span className="shrink-0 font-mono text-xs text-muted">
                              {scene.characters.length} pj · {scene._count.shots} planos
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailBlock>

                  <DetailBlock title="Shot list y storyboard" href={`/app/${projectId}/shot-list`} linkLabel="Abrir Shot list">
                    <p className="font-mono text-sm">
                      {plural(shotsTotal, "plano definido", "planos definidos")} en total ·{" "}
                      {plural(storyboardFramesCount, "viñeta", "viñetas")} de storyboard.
                    </p>
                  </DetailBlock>
                </div>
              ),
            },
            {
              id: "reparto",
              label: "Reparto y equipo",
              count: project.characters.length + project.crewMembers.length,
              content: (
                <div className="grid gap-10 lg:grid-cols-2">
                  <DetailBlock
                    title={`Reparto (${charactersWithActor}/${project.characters.length} con actor)`}
                    href={`/app/${projectId}/personajes`}
                    linkLabel="Abrir Personajes"
                  >
                    {project.characters.length === 0 ? (
                      <Empty>Sin personajes todavía.</Empty>
                    ) : (
                      <div className="divide-y divide-line">
                        {project.characters.map((character) => (
                          <div key={character.id} className="flex items-center justify-between gap-4 py-2.5">
                            <span className="font-mono text-sm">{character.name}</span>
                            <span
                              className={`font-mono text-xs ${character.actor ? "text-muted" : "text-warn"}`}
                            >
                              {character.actor?.name ?? "Sin actor asignado"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailBlock>

                  <DetailBlock
                    title={`Equipo técnico (${project.crewMembers.length})`}
                    href={`/app/${projectId}/desglose?tab=equipo`}
                    linkLabel="Abrir Desglose"
                  >
                    {project.crewMembers.length === 0 ? (
                      <Empty>Sin equipo técnico todavía.</Empty>
                    ) : (
                      <div className="divide-y divide-line">
                        {project.crewMembers.map((member) => (
                          <div key={member.id} className="flex items-center justify-between gap-4 py-2.5">
                            <span className="font-mono text-sm">{member.name}</span>
                            <span className="font-mono text-xs text-muted">
                              {[member.role, member.phone].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailBlock>
                </div>
              ),
            },
            {
              id: "recursos",
              label: "Recursos",
              count: locations.length + project.breakdownElements.length,
              content: (
                <div className="grid gap-10 lg:grid-cols-2">
                  <DetailBlock title={`Localizaciones (${locations.length})`} href={`/app/${projectId}/localizaciones`} linkLabel="Abrir">
                    {locations.length === 0 ? (
                      <Empty>Ninguna escena tiene localización todavía.</Empty>
                    ) : (
                      <div className="divide-y divide-line">
                        {locations.map((location) => (
                          <div key={location.id} className="flex items-center justify-between gap-4 py-2.5">
                            <span className="font-mono text-sm">{location.name}</span>
                            <span className="font-mono text-xs text-muted">
                              {plural(location.sceneCount, "escena", "escenas")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailBlock>

                  <DetailBlock
                    title={`Desglose (${project.breakdownElements.length})`}
                    href={`/app/${projectId}/desglose`}
                    linkLabel="Abrir"
                  >
                    {project.breakdownElements.length === 0 ? (
                      <Empty>Sin elementos todavía.</Empty>
                    ) : (
                      <div className="space-y-4">
                        {breakdownByCategory
                          .filter((group) => group.items.length > 0)
                          .map((group) => (
                            <div key={group.category}>
                              <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                                {BREAKDOWN_CATEGORY_LABELS[group.category]} ({group.items.length})
                              </p>
                              <p className="mt-1 font-mono text-xs text-muted">
                                {group.items.map((item) => item.name).join(", ")}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </DetailBlock>

                  <DetailBlock title={`Inventario (${inventoryItems.length})`} href="/app/inventario" linkLabel="Abrir">
                    {inventoryItems.length === 0 ? (
                      <Empty>Sin equipo reservado todavía — se reserva por día de rodaje.</Empty>
                    ) : (
                      <div className="divide-y divide-line">
                        {inventoryItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                            <span className="font-mono text-sm">{item.name}</span>
                            <span className="font-mono text-xs text-muted">
                              {INVENTORY_CATEGORY_LABELS[item.category as keyof typeof INVENTORY_CATEGORY_LABELS] ??
                                item.category}{" "}
                              · {plural(item.daysCount, "día", "días")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailBlock>

                  <DetailBlock title={`Vehículos (${vehicles.length})`} href={`/app/${projectId}/vehiculos`} linkLabel="Abrir">
                    {vehicles.length === 0 ? (
                      <Empty>Sin vehículos reservados todavía — se reservan por día de rodaje.</Empty>
                    ) : (
                      <div className="divide-y divide-line">
                        {vehicles.map((vehicle) => (
                          <div key={vehicle.id} className="flex items-center justify-between gap-4 py-2.5">
                            <span className="font-mono text-sm">{vehicle.name}</span>
                            <span className="font-mono text-xs text-muted">
                              {[vehicle.type, vehicle.plate].filter(Boolean).join(" · ")}
                              {vehicle.type || vehicle.plate ? " · " : ""}
                              {plural(vehicle.daysCount, "día", "días")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailBlock>
                </div>
              ),
            },
            {
              id: "presupuesto",
              label: "Presupuesto",
              count: budgetCategoriesWithTotals.length,
              content: (
                <DetailBlock title="Por categorías" href={`/app/${projectId}/presupuesto`} linkLabel="Abrir Presupuesto">
                  {budgetCategoriesWithTotals.length === 0 ? (
                    <Empty>Sin categorías todavía.</Empty>
                  ) : (
                    <div className="divide-y divide-line">
                      {budgetCategoriesWithTotals.map((category) => (
                        <div key={category.id} className="py-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-mono text-sm">{category.name}</span>
                            <span className="font-mono text-xs text-muted">
                              {currency(category.total)}
                              {hasBudgetActual && category.actual > 0
                                ? ` · gastado ${currency(category.actual)}`
                                : ""}
                            </span>
                          </div>
                          {budgetGrandTotal > 0 && (
                            <div className="mt-2">
                              <Bar value={category.total / budgetGrandTotal} />
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-4 py-3">
                        <span className="font-mono text-sm font-bold uppercase">Total</span>
                        <span className="font-mono text-sm text-accent">
                          {currency(budgetGrandTotal)}
                          {hasBudgetActual ? ` · gastado ${currency(budgetGrandActual)}` : ""}
                        </span>
                      </div>
                    </div>
                  )}
                </DetailBlock>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
