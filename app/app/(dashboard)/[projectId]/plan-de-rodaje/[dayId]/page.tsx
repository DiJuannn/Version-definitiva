import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import {
  deleteShootingDay,
  saveDayPlan,
  updateShootingDay,
} from "@/lib/actions/shooting-days";
import { generateCallSheetAndOpen } from "@/lib/actions/call-sheets";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { getAvailabilityWarnings } from "@/lib/availability-warnings";
import { getReservationConflicts } from "@/lib/reservation-conflicts";
import {
  DAY_PART_LABELS,
  INT_EXT_LABELS,
  INVENTORY_CATEGORY_LABELS,
} from "@/lib/labels";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { SectionTabs } from "@/components/SectionTabs";
import { DayPlanner, type PlannerScene } from "@/components/DayPlanner";
import { FormField } from "@/components/FormField";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function ShootingDayDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; dayId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId, dayId } = await params;
  const { tab } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [
    summary,
    allScenes,
    projectDays,
    inventoryItems,
    vehicles,
    dayItemReservations,
    dayVehicleReservations,
  ] = await Promise.all([
    getShootingDaySummary(dayId),
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        location: { select: { name: true } },
        shots: {
          orderBy: [{ order: "asc" }, { number: "asc" }],
          select: {
            id: true,
            number: true,
            shotSize: true,
            description: true,
            shootingDayId: true,
            done: true,
          },
        },
      },
    }),
    prisma.shootingDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      select: { id: true, date: true },
    }),
    prisma.inventoryItem.findMany({
      where: { organizationId: project.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.vehicle.findMany({
      where: { organizationId: project.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.itemReservation.findMany({ where: { shootingDayId: dayId } }),
    prisma.vehicleReservation.findMany({ where: { shootingDayId: dayId } }),
  ]);

  if (!summary || summary.shootingDay.projectId !== projectId) notFound();

  const [availabilityWarnings, { itemConflicts, vehicleConflicts }] =
    await Promise.all([
      getAvailabilityWarnings(summary),
      getReservationConflicts(project.organizationId, summary.shootingDay.date),
    ]);

  const assignedByScene = new Map(
    summary.sceneAssignments.map((a) => [a.sceneId, a]),
  );
  const reservedItemQty = new Map(
    dayItemReservations.map((r) => [r.inventoryItemId, r.quantity]),
  );
  const reservedVehicleIds = new Set(
    dayVehicleReservations.map((r) => r.vehicleId),
  );

  const dayLabels = new Map(
    projectDays.map((d) => [
      d.id,
      d.date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
    ]),
  );
  const plannerScenes: PlannerScene[] = allScenes.map((scene) => {
    const assignment = assignedByScene.get(scene.id);
    return {
      id: scene.id,
      number: scene.number,
      context: `${INT_EXT_LABELS[scene.intExt]} · ${DAY_PART_LABELS[scene.dayPart]}${
        scene.location ? ` · ${scene.location.name}` : ""
      }`,
      callTime: assignment?.callTime ?? "",
      order: assignment ? String(assignment.order) : "",
      assigned: Boolean(assignment),
      shots: scene.shots.map((shot) => ({
        id: shot.id,
        label: `${scene.number}.${shot.number}`,
        size: shot.shotSize,
        description: shot.description,
        currentDayId: shot.shootingDayId,
        otherDayLabel:
          shot.shootingDayId && shot.shootingDayId !== dayId
            ? (dayLabels.get(shot.shootingDayId) ?? "otro día")
            : null,
        done: shot.done,
      })),
    };
  });
  const dayShotCount = allScenes.reduce(
    (n, scene) =>
      n + scene.shots.filter((shot) => shot.shootingDayId === dayId).length,
    0,
  );

  const updateDayAction = updateShootingDay.bind(null, projectId, dayId);
  const saveDayAction = saveDayPlan.bind(null, projectId, dayId);
  const generateAction = generateCallSheetAndOpen.bind(null, projectId, dayId);
  const dayNumber = projectDays.findIndex((d) => d.id === dayId) + 1;
  const hasWarnings =
    availabilityWarnings.length > 0 ||
    itemConflicts.length > 0 ||
    vehicleConflicts.length > 0;
  const summaryRows = [
    ["Localizaciones", summary.locations.map((l) => l.name)],
    ["Personajes", summary.characters.map((c) => c.name)],
    ["Equipo técnico", summary.crewMembers.map((c) => c.name)],
    ["Desglose", summary.breakdownElements.map((b) => b.name)],
  ] as const;

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}/plan-de-rodaje`}
        backLabel="← Plan de rodaje"
        eyebrow={
          dayNumber > 0
            ? `Día ${dayNumber} de ${projectDays.length} · Plan de rodaje`
            : "Plan de rodaje"
        }
        title={summary.shootingDay.date.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        description={summary.shootingDay.notes ?? undefined}
        actions={
          summary.shootingDay.callSheet ? (
            <Link
              href={`/app/${projectId}/call-sheets/${dayId}`}
              className="btn btn-outline"
            >
              Ver hoja de llamada
            </Link>
          ) : (
            <form action={generateAction}>
              <SubmitButton
                pendingLabel="Generando…"
                className="btn btn-outline"
              >
                Generar hoja de llamada
              </SubmitButton>
            </form>
          )
        }
      />

      {/* Fecha y notas: se cambian poco, así que van plegadas tras un enlace. */}
      <details className="group mt-4">
        <summary className="link-action list-none hover:text-accent [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Cambiar fecha o notas</span>
          <span className="hidden group-open:inline">Cerrar</span>
        </summary>
        <form
          action={updateDayAction}
          className="mt-3 flex max-w-3xl flex-wrap items-end gap-x-5 gap-y-3"
        >
          <FormField label="Fecha">
            <input
              type="date"
              name="date"
              defaultValue={toDateInputValue(summary.shootingDay.date)}
              required
              className="field"
            />
          </FormField>
          <FormField label="Notas del día" className="min-w-[16rem] flex-1">
            <input
              name="notes"
              defaultValue={summary.shootingDay.notes ?? ""}
              placeholder="Dónde, a qué hora sale el sol, avisos…"
              className="field w-full"
            />
          </FormField>
          <SubmitButton
            pendingLabel="Guardando…"
            savedLabel="✓ Guardado"
            className="btn btn-secondary"
          >
            Guardar
          </SubmitButton>
        </form>
      </details>

      {/* Avisos: una línea con barra de color, no un recuadro. */}
      {hasWarnings && (
        <div className="mt-8 space-y-5">
          {availabilityWarnings.length > 0 && (
            <div className="border-l-2 border-warn pl-4">
              <p className="font-sans text-[15px] font-semibold text-warn">
                Puede faltar gente este día
              </p>
              <ul className="mt-1 space-y-0.5 font-sans text-sm">
                {availabilityWarnings.map((warning) => (
                  <li key={warning.id}>
                    {warning.personName} figura como no disponible
                    {warning.note ? ` (${warning.note})` : ""}.
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(itemConflicts.length > 0 || vehicleConflicts.length > 0) && (
            <div className="border-l-2 border-warn pl-4">
              <p className="font-sans text-[15px] font-semibold text-warn">
                Material o vehículos ya reservados
              </p>
              <ul className="mt-1 space-y-0.5 font-sans text-sm">
                {itemConflicts.map((conflict) => (
                  <li key={conflict.id}>
                    {conflict.itemName}: se necesitan {conflict.needed} y solo
                    hay {conflict.available}; coincide con{" "}
                    {conflict.projects.join(" y ")}.
                  </li>
                ))}
                {vehicleConflicts.map((conflict) => (
                  <li key={conflict.id}>
                    {conflict.vehicleName} está reservado el mismo día en{" "}
                    {conflict.projects.join(" y ")}.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <form action={saveDayAction} className="mt-12 lg:[&_[role=tabpanel]]:pt-6">
        <SectionTabs
          ariaLabel="Plan del día"
          initial={tab}
          tabs={[
            {
              id: "escenas",
              label: "Escenas y planos",
              count:
                dayShotCount > 0
                  ? `${summary.sceneAssignments.length} · ${dayShotCount} pl.`
                  : summary.sceneAssignments.length,
              content:
                allScenes.length === 0 ? (
                  <EmptyState
                    title="No hay escenas creadas todavía"
                    description="Créalas en Guion para poder asignarlas a este día."
                    actionLabel="Ir a Guion"
                    actionHref={`/app/${projectId}/guion`}
                  />
                ) : (
                  <div className="sheet px-5 py-5 sm:px-8 sm:py-7">
                    <DayPlanner dayId={dayId} scenes={plannerScenes} />
                  </div>
                ),
            },
            {
              id: "material",
              label: "Material",
              count: reservedItemQty.size,
              content:
                inventoryItems.length === 0 ? (
                  <p className="py-10 text-center font-sans text-sm text-muted">
                    No hay material en{" "}
                    <Link
                      href="/app/inventario"
                      className="text-accent hover:underline"
                    >
                      Inventario
                    </Link>
                    . Cuando lo añadas, lo reservas aquí para este día.
                  </p>
                ) : (
                  <div className="sheet px-5 py-2 sm:px-8">
                    <p className="eyebrow pt-4 pb-2">
                      Marca lo que se lleva este día y cuántas unidades
                    </p>
                    <div className="divide-y divide-line">
                      {inventoryItems.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3"
                        >
                          <input
                            type="checkbox"
                            name={`reserve_${item.id}`}
                            aria-label={`Reservar ${item.name}`}
                            defaultChecked={reservedItemQty.has(item.id)}
                            className="h-4 w-4"
                          />
                          <div className="min-w-0">
                            <p className="font-sans text-[15px]">{item.name}</p>
                            <p className="font-mono text-[11px] text-muted">
                              {INVENTORY_CATEGORY_LABELS[item.category]} ·{" "}
                              {item.quantity} en inventario
                            </p>
                          </div>
                          <input
                            name={`qty_${item.id}`}
                            type="number"
                            min={1}
                            aria-label={`Unidades reservadas de ${item.name}`}
                            placeholder="Uds."
                            defaultValue={reservedItemQty.get(item.id) ?? 1}
                            className="field w-20 px-2 py-1.5 text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ),
            },
            {
              id: "vehiculos",
              label: "Vehículos",
              count: reservedVehicleIds.size,
              content:
                vehicles.length === 0 ? (
                  <p className="py-10 text-center font-sans text-sm text-muted">
                    No hay vehículos en{" "}
                    <Link
                      href="/app/vehiculos"
                      className="text-accent hover:underline"
                    >
                      Vehículos
                    </Link>
                    . Cuando los añadas, los reservas aquí para este día.
                  </p>
                ) : (
                  <div className="sheet px-5 py-2 sm:px-8">
                    <p className="eyebrow pt-4 pb-2">
                      Marca los vehículos que se usan este día
                    </p>
                    <div className="divide-y divide-line">
                      {vehicles.map((vehicle) => (
                        <label
                          key={vehicle.id}
                          className="flex cursor-pointer items-center gap-4 py-3"
                        >
                          <input
                            type="checkbox"
                            name={`reserve_${vehicle.id}`}
                            defaultChecked={reservedVehicleIds.has(vehicle.id)}
                            className="h-4 w-4"
                          />
                          <span className="font-sans text-[15px]">
                            {vehicle.name}
                          </span>
                          {vehicle.type && (
                            <span className="font-mono text-[11px] text-muted">
                              {vehicle.type}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ),
            },
            {
              id: "resumen",
              label: "Resumen del día",
              content: (
                <dl className="sheet divide-y divide-line px-5 sm:px-8">
                  {summaryRows.map(([label, names]) => (
                    <div
                      key={label}
                      className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6"
                    >
                      <dt className="eyebrow pt-0.5">
                        {label} <span className="text-fg">{names.length}</span>
                      </dt>
                      <dd className="font-sans text-[15px] leading-relaxed">
                        {names.length > 0 ? (
                          names.join(", ")
                        ) : (
                          <span className="text-muted">Nadie todavía</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              ),
            },
          ]}
        />

        {/* Barra de guardado siempre a mano: guarda a la vez escenas, material y
            vehículos, esté la pestaña que esté a la vista. */}
        <div className="sheet sticky bottom-24 z-20 mt-8 flex flex-wrap items-center gap-4 px-4 py-3 shadow-xl sm:bottom-4 sm:px-5 print:hidden">
          <SubmitButton
            pendingLabel="Guardando…"
            savedLabel="✓ Plan guardado"
            className="btn btn-primary"
          >
            Guardar plan del día
          </SubmitButton>
          <p className="hidden font-sans text-sm text-muted sm:block">
            Guarda a la vez escenas, planos (con hora y orden), material y
            vehículos.
          </p>
        </div>
      </form>

      <form
        action={deleteShootingDay.bind(null, projectId, dayId)}
        className="mt-16 border-t border-line pt-4"
      >
        <DeleteButton
          confirmMessage="¿Eliminar este día de rodaje?"
          className="link-action hover:!text-danger"
        >
          Eliminar este día
        </DeleteButton>
      </form>
    </div>
  );
}
