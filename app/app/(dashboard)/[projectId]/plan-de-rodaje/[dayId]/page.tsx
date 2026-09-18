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
import { DAY_PART_LABELS, INT_EXT_LABELS, INVENTORY_CATEGORY_LABELS } from "@/lib/labels";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { SectionTabs } from "@/components/SectionTabs";

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

  const [summary, allScenes, inventoryItems, vehicles, dayItemReservations, dayVehicleReservations] =
    await Promise.all([
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
        },
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

  const [availabilityWarnings, { itemConflicts, vehicleConflicts }] = await Promise.all([
    getAvailabilityWarnings(summary),
    getReservationConflicts(project.organizationId, summary.shootingDay.date),
  ]);

  const assignedByScene = new Map(
    summary.sceneAssignments.map((a) => [a.sceneId, a]),
  );
  const reservedItemQty = new Map(
    dayItemReservations.map((r) => [r.inventoryItemId, r.quantity]),
  );
  const reservedVehicleIds = new Set(dayVehicleReservations.map((r) => r.vehicleId));

  const updateDayAction = updateShootingDay.bind(null, projectId, dayId);
  const saveDayAction = saveDayPlan.bind(null, projectId, dayId);
  const generateAction = generateCallSheetAndOpen.bind(null, projectId, dayId);

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}/plan-de-rodaje`}
        backLabel="← Plan de rodaje"
        eyebrow="Producción"
        title={`${summary.shootingDay.date.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric", })}`}
        actions={
          summary.shootingDay.callSheet ? (
            <Link href={`/app/${projectId}/call-sheets/${dayId}`} className="btn btn-primary btn-sm">
              Ver call sheet
            </Link>
          ) : (
            <form action={generateAction}>
              <SubmitButton pendingLabel="Generando…" className="btn btn-primary btn-sm">
                Generar call sheet
              </SubmitButton>
            </form>
          )
        }
      />

      {availabilityWarnings.length > 0 && (
        <div className="mt-6 border border-warn/60 p-4">
          <p className="font-mono text-xs tracking-widest text-warn uppercase">
            ⚠ Posible conflicto de disponibilidad
          </p>
          <ul className="mt-2 space-y-1">
            {availabilityWarnings.map((warning) => (
              <li key={warning.id} className="font-mono text-sm">
                {warning.personName} aparece como no disponible este día
                {warning.note ? ` — ${warning.note}` : ""}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {(itemConflicts.length > 0 || vehicleConflicts.length > 0) && (
        <div className="mt-6 border border-warn/60 p-4">
          <p className="font-mono text-xs tracking-widest text-warn uppercase">
            ⚠ Posible conflicto de reserva
          </p>
          <ul className="mt-2 space-y-1">
            {itemConflicts.map((conflict) => (
              <li key={conflict.id} className="font-mono text-sm">
                {conflict.itemName}: se necesitan {conflict.needed} pero solo hay{" "}
                {conflict.available} — coincide en {conflict.projects.join(" y ")}.
              </li>
            ))}
            {vehicleConflicts.map((conflict) => (
              <li key={conflict.id} className="font-mono text-sm">
                {conflict.vehicleName} está reservado el mismo día en{" "}
                {conflict.projects.join(" y ")}.
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        action={updateDayAction}
        className="mt-8 grid gap-4 border border-line p-5 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Fecha
          </span>
          <input
            type="date"
            name="date"
            defaultValue={toDateInputValue(summary.shootingDay.date)}
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Notas
          </span>
          <input
            name="notes"
            defaultValue={summary.shootingDay.notes ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <div>
          <SubmitButton
            pendingLabel="Guardando…"
            savedLabel="✓ Guardado"
            className="btn btn-secondary"
          >
            Guardar
          </SubmitButton>
        </div>
      </form>

      <form action={saveDayAction} className="mt-10">
        <SectionTabs
          ariaLabel="Plan del día"
          initial={tab}
          tabs={[
            {
              id: "escenas",
              label: "Escenas",
              count: summary.sceneAssignments.length,
              content: (
                <div>
                          {allScenes.length === 0 ? (
                            <EmptyState
                              title="No hay escenas creadas todavía"
                              description="Créalas en Guion para poder asignarlas a este día."
                              actionLabel="Ir a Guion"
                              actionHref={`/app/${projectId}/guion`}
                            />
                          ) : (
                            <div className="mt-4">
                              <div className="border-t border-line">
                                <div
                                  aria-hidden
                                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-line py-2 font-mono text-[10px] tracking-widest text-muted uppercase"
                                >
                                  <span className="w-4" />
                                  <span>Escena</span>
                                  <span className="w-24">Hora de llamada</span>
                                  <span className="w-20">Orden</span>
                                </div>
                                {allScenes.map((scene) => {
                                  const assignment = assignedByScene.get(scene.id);
                                  return (
                                    <div
                                      key={scene.id}
                                      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-line py-3"
                                    >
                                      <input
                                        type="checkbox"
                                        name={`assign_${scene.id}`}
                                        aria-label={`Incluir la escena ${scene.number} en este día`}
                                        defaultChecked={Boolean(assignment)}
                                      />
                                      <div>
                                        <span className="font-mono text-sm">
                                          Escena {scene.number}
                                        </span>
                                        <span className="ml-2 font-mono text-xs text-muted">
                                          {INT_EXT_LABELS[scene.intExt]} ·{" "}
                                          {DAY_PART_LABELS[scene.dayPart]}
                                          {scene.location ? ` · ${scene.location.name}` : ""}
                                        </span>
                                      </div>
                                      <input
                                        name={`callTime_${scene.id}`}
                                        aria-label={`Hora de llamada de la escena ${scene.number}`}
                                        placeholder="08:30"
                                        defaultValue={assignment?.callTime ?? ""}
                                        className="w-24 border border-line bg-transparent px-2 py-1 text-xs outline-none transition-colors focus:border-accent"
                                      />
                                      <input
                                        name={`order_${scene.id}`}
                                        type="number"
                                        aria-label={`Orden de la escena ${scene.number}`}
                                        placeholder="1"
                                        defaultValue={assignment?.order ?? ""}
                                        className="w-20 border border-line bg-transparent px-2 py-1 text-xs outline-none transition-colors focus:border-accent"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              </div>
                          )}
                </div>
              ),
            },
            {
              id: "material",
              label: "Material",
              count: reservedItemQty.size,
              content: (
                <div>
                            {inventoryItems.length === 0 ? (
                              <p className="mt-4 font-mono text-sm text-muted">
                                No hay material en{" "}
                                <Link href="/app/inventario" className="text-fg hover:text-accent">
                                  Inventario
                                </Link>
                                .
                              </p>
                            ) : (
                              <div className="mt-4">
                                <div className="border-t border-line">
                                  {inventoryItems.map((item) => (
                                    <div
                                      key={item.id}
                                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line py-3"
                                    >
                                      <input
                                        type="checkbox"
                                        name={`reserve_${item.id}`}
                                        aria-label={`Reservar ${item.name}`}
                                        defaultChecked={reservedItemQty.has(item.id)}
                                      />
                                      <div>
                                        <span className="font-mono text-sm">{item.name}</span>
                                        <span className="ml-2 font-mono text-xs text-muted">
                                          {INVENTORY_CATEGORY_LABELS[item.category]} · disponible{" "}
                                          {item.quantity}
                                        </span>
                                      </div>
                                      <input
                                        name={`qty_${item.id}`}
                                        type="number"
                                        min={1}
                                        aria-label={`Unidades reservadas de ${item.name}`}
                                        placeholder="Uds."
                                        defaultValue={reservedItemQty.get(item.id) ?? 1}
                                        className="w-16 border border-line bg-transparent px-2 py-1 text-xs outline-none transition-colors focus:border-accent"
                                      />
                                    </div>
                                  ))}
                                </div>
                                </div>
                            )}
                </div>
              ),
            },
            {
              id: "vehiculos",
              label: "Vehículos",
              count: reservedVehicleIds.size,
              content: (
                <div>
                            {vehicles.length === 0 ? (
                              <p className="mt-4 font-mono text-sm text-muted">
                                No hay vehículos en{" "}
                                <Link href="/app/vehiculos" className="text-fg hover:text-accent">
                                  Vehículos
                                </Link>
                                .
                              </p>
                            ) : (
                              <div className="mt-4">
                                <div className="border-t border-line">
                                  {vehicles.map((vehicle) => (
                                    <label
                                      key={vehicle.id}
                                      className="flex items-center gap-3 border-b border-line py-3"
                                    >
                                      <input
                                        type="checkbox"
                                        name={`reserve_${vehicle.id}`}
                                        defaultChecked={reservedVehicleIds.has(vehicle.id)}
                                      />
                                      <span className="font-mono text-sm">{vehicle.name}</span>
                                      {vehicle.type && (
                                        <span className="font-mono text-xs text-muted">
                                          {vehicle.type}
                                        </span>
                                      )}
                                    </label>
                                  ))}
                                </div>
                                </div>
                            )}
                </div>
              ),
            },
            {
              id: "resumen",
              label: "Resumen del día",
              content: (
                <div className="grid gap-6 sm:grid-cols-2">
                          <div className="border border-line p-5">
                            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                              Localizaciones ({summary.locations.length})
                            </p>
                            <p className="mt-2 font-mono text-sm">
                              {summary.locations.map((l) => l.name).join(", ") || "—"}
                            </p>
                          </div>
                          <div className="border border-line p-5">
                            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                              Personajes ({summary.characters.length})
                            </p>
                            <p className="mt-2 font-mono text-sm">
                              {summary.characters.map((c) => c.name).join(", ") || "—"}
                            </p>
                          </div>
                          <div className="border border-line p-5">
                            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                              Equipo técnico ({summary.crewMembers.length})
                            </p>
                            <p className="mt-2 font-mono text-sm">
                              {summary.crewMembers.map((c) => c.name).join(", ") || "—"}
                            </p>
                          </div>
                          <div className="border border-line p-5">
                            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                              Desglose ({summary.breakdownElements.length})
                            </p>
                            <p className="mt-2 font-mono text-sm">
                              {summary.breakdownElements.map((b) => b.name).join(", ") || "—"}
                            </p>
                          </div>
                </div>
              ),
            },
          ]}
        />

        {/* Barra de guardado siempre a mano: guarda a la vez escenas, material y
            vehículos, esté la pestaña que esté a la vista. */}
        <div className="sticky bottom-24 z-20 mt-8 flex flex-wrap items-center gap-4 border border-line bg-bg-raised/95 p-3 backdrop-blur-md sm:bottom-4 sm:p-4 print:hidden">
          <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Plan guardado" className="btn btn-primary">
            Guardar plan del día
          </SubmitButton>
          <p className="hidden font-mono text-[11px] text-muted sm:block">
            Guarda a la vez las escenas (con hora y orden), el material y los vehículos.
          </p>
        </div>
      </form>

      <div className="mt-10 border-t border-line pt-6">
        <form action={deleteShootingDay.bind(null, projectId, dayId)}>
          <DeleteButton
            confirmMessage="¿Eliminar este día de rodaje?"
            className="link-action"
          >
            Eliminar día
          </DeleteButton>
        </form>
      </div>
    </div>
  );
}
