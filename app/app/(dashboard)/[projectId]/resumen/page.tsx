import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getProjectSummary } from "@/lib/project-summary";
import { PdfLink } from "@/components/PdfLink";
import {
  DAY_PART_LABELS,
  INT_EXT_LABELS,
  BREAKDOWN_CATEGORY_LABELS,
  INVENTORY_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/labels";
import { BreakdownCategory } from "@/lib/generated/prisma";
import { BackLink } from "@/components/BackLink";

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

function Section({
  title,
  teaser,
  children,
}: {
  title: string;
  teaser: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-display text-sm font-bold uppercase">
          <span className="text-muted transition-transform group-open:rotate-90">
            →
          </span>
          {title}
        </span>
        <span className="font-mono text-xs text-muted">{teaser}</span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export default async function ProjectSummaryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const access = await getProjectForCurrentUser(projectId);
  if (!access) notFound();

  const {
    project,
    locations,
    shotsTotal,
    storyboardFramesCount,
    budgetCategoriesWithTotals,
    budgetGrandTotal,
    inventoryItems,
    vehicles,
    shootingDaysWithNeeds,
  } = await getProjectSummary(projectId);

  const charactersWithActor = project.characters.filter((c) => c.actorId).length;
  const scenesWithLocation = project.scenes.filter((s) => s.locationId).length;
  const budgetTarget =
    project.budgetTarget !== null ? Number(project.budgetTarget) : null;

  // Un mini-calendario por cada mes que tenga algún día de rodaje — sin
  // paginación ni formulario, solo para ver de un vistazo en qué fechas
  // caen (el detalle de qué llevar cada día ya está en "Plan de rodaje"
  // justo debajo).
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <BackLink href={`/app/${projectId}`}>← {project.name}</BackLink>
        <PdfLink href={`/api/pdf/dossier/${projectId}`} label="Descargar dossier" />
      </div>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">Resumen</h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Todo el proyecto de un vistazo. Pulsa cada apartado para desplegarlo —
        nada se abre a la vez para que no se sienta pesado.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-line p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Estado
          </p>
          <p className="mt-1 font-mono text-sm">{PROJECT_STATUS_LABELS[project.status]}</p>
        </div>
        <div className="border border-line p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Escenas
          </p>
          <p className="mt-1 font-mono text-sm">{project.scenes.length}</p>
        </div>
        <div className="border border-line p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Días de rodaje
          </p>
          <p className="mt-1 font-mono text-sm">{project.shootingDays.length}</p>
        </div>
        <div className="border border-line p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Presupuesto
          </p>
          <p className="mt-1 font-mono text-sm">
            {budgetTarget
              ? `${currency(budgetGrandTotal)} / ${currency(budgetTarget)}`
              : currency(budgetGrandTotal)}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <Section
          title="Escenas"
          teaser={`${scenesWithLocation}/${project.scenes.length} con localización`}
        >
          {project.scenes.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin escenas todavía.</p>
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
                  <span className="font-mono text-xs text-muted">
                    {scene.characters.length} pj · {scene._count.shots} planos
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Reparto"
          teaser={`${charactersWithActor}/${project.characters.length} con actor`}
        >
          {project.characters.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin personajes todavía.</p>
          ) : (
            <div className="divide-y divide-line">
              {project.characters.map((character) => (
                <div key={character.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-mono text-sm">{character.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {character.actor?.name ?? "Sin actor asignado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Equipo técnico"
          teaser={`${project.crewMembers.length} personas`}
        >
          {project.crewMembers.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin equipo técnico todavía.</p>
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
        </Section>

        <Section title="Localizaciones" teaser={`${locations.length} usadas`}>
          {locations.length === 0 ? (
            <p className="font-mono text-sm text-muted">
              Ninguna escena tiene localización todavía.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {locations.map((location) => (
                <div key={location.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-mono text-sm">{location.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {location.sceneCount} escena{location.sceneCount === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Desglose"
          teaser={`${project.breakdownElements.length} elementos`}
        >
          {project.breakdownElements.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin elementos todavía.</p>
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
        </Section>

        <Section title="Inventario" teaser={`${inventoryItems.length} elementos`}>
          {inventoryItems.length === 0 ? (
            <p className="font-mono text-sm text-muted">
              Sin equipo reservado todavía — se reserva por día de rodaje.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {inventoryItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-mono text-sm">{item.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {INVENTORY_CATEGORY_LABELS[item.category as keyof typeof INVENTORY_CATEGORY_LABELS] ??
                      item.category}{" "}
                    · {item.daysCount} día{item.daysCount === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Vehículos" teaser={`${vehicles.length} usados`}>
          {vehicles.length === 0 ? (
            <p className="font-mono text-sm text-muted">
              Sin vehículos reservados todavía — se reservan por día de rodaje.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-mono text-sm">{vehicle.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {[vehicle.type, vehicle.plate].filter(Boolean).join(" · ")}
                    {vehicle.type || vehicle.plate ? " · " : ""}
                    {vehicle.daysCount} día{vehicle.daysCount === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Presupuesto"
          teaser={
            budgetTarget
              ? `${currency(budgetGrandTotal)} / ${currency(budgetTarget)}`
              : currency(budgetGrandTotal)
          }
        >
          {budgetCategoriesWithTotals.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin categorías todavía.</p>
          ) : (
            <div className="divide-y divide-line">
              {budgetCategoriesWithTotals.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-mono text-sm">{category.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {currency(category.total)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="font-mono text-sm font-bold uppercase">Total</span>
                <span className="font-mono text-sm text-accent">
                  {currency(budgetGrandTotal)}
                </span>
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Calendario de rodaje"
          teaser={`${shootingDaysWithNeeds.length} días marcados`}
        >
          {calendarMonths.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin días de rodaje todavía.</p>
          ) : (
            <div className="space-y-6">
              {calendarMonths.map((monthStart) => (
                <div key={monthStart.toISOString()}>
                  <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                    {monthStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                  </p>
                  <div className="mt-2 grid grid-cols-7 border-l border-t border-line">
                    {WEEKDAYS.map((label) => (
                      <div
                        key={label}
                        className="border-b border-r border-line bg-bg-raised px-1 py-1 font-mono text-[9px] tracking-widest text-muted uppercase"
                      >
                        {label}
                      </div>
                    ))}
                    {buildMonthWeeks(monthStart)
                      .flat()
                      .map((day) => {
                        const isCurrentMonth = day.getMonth() === monthStart.getMonth();
                        const shootingDay = shootingDaysWithNeeds.find((d) =>
                          sameDay(d.date, day),
                        );
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
                                {shootingDay.scenes.length} esc.
                              </p>
                            )}
                          </>
                        );
                        return (
                          <div
                            key={day.toISOString()}
                            className={`min-h-12 border-b border-r border-line p-1 ${
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
        </Section>

        <Section
          title="Plan de rodaje"
          teaser={`${project.shootingDays.length} días`}
        >
          {shootingDaysWithNeeds.length === 0 ? (
            <p className="font-mono text-sm text-muted">
              Sin días de rodaje todavía.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {shootingDaysWithNeeds.map((day) => (
                <Link
                  key={day.id}
                  href={`/app/${projectId}/plan-de-rodaje/${day.id}`}
                  className="block py-2.5 transition-colors hover:text-accent"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-sm">
                      {day.date.toLocaleDateString("es-ES", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {day.scenes.length} escena{day.scenes.length === 1 ? "" : "s"} ·{" "}
                      {day.callSheet ? "con call sheet" : "sin call sheet"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    {[
                      day.crewNames.length > 0 ? `Equipo: ${day.crewNames.join(", ")}` : null,
                      day.itemNames.length > 0 ? `Material: ${day.itemNames.join(", ")}` : null,
                      day.vehicleNames.length > 0
                        ? `Vehículos: ${day.vehicleNames.join(", ")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Nada asignado todavía para este día."}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Shot list y storyboard"
          teaser={`${shotsTotal} planos · ${storyboardFramesCount} viñetas`}
        >
          <p className="font-mono text-sm">
            {shotsTotal} plano{shotsTotal === 1 ? "" : "s"} definido
            {shotsTotal === 1 ? "" : "s"} en total.
          </p>
          <p className="mt-1 font-mono text-sm">
            {storyboardFramesCount} viñeta{storyboardFramesCount === 1 ? "" : "s"} de
            storyboard.
          </p>
        </Section>
      </div>
    </div>
  );
}
