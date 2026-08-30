import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import {
  deleteShootingDay,
  updateDaySceneAssignments,
  updateShootingDay,
} from "@/lib/actions/shooting-days";
import { updateDayItemReservations } from "@/lib/actions/inventory";
import { updateDayVehicleReservations } from "@/lib/actions/vehicles";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { getAvailabilityWarnings } from "@/lib/availability-warnings";
import { getReservationConflicts } from "@/lib/reservation-conflicts";
import { DAY_PART_LABELS, INT_EXT_LABELS, INVENTORY_CATEGORY_LABELS } from "@/lib/labels";
import { BackLink } from "@/components/BackLink";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function ShootingDayDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; dayId: string }>;
}) {
  const { projectId, dayId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [summary, allScenes, inventoryItems, vehicles, dayItemReservations, dayVehicleReservations] =
    await Promise.all([
      getShootingDaySummary(dayId),
      prisma.scene.findMany({
        where: { projectId },
        orderBy: [{ order: "asc" }, { number: "asc" }],
        include: { location: true },
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
  const updateAssignmentsAction = updateDaySceneAssignments.bind(
    null,
    projectId,
    dayId,
  );
  const updateItemReservationsAction = updateDayItemReservations.bind(
    null,
    projectId,
    dayId,
  );
  const updateVehicleReservationsAction = updateDayVehicleReservations.bind(
    null,
    projectId,
    dayId,
  );

  return (
    <div>
      <BackLink href={`/app/${projectId}/plan-de-rodaje`}>← Plan de rodaje</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        {summary.shootingDay.date.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </h1>

      {availabilityWarnings.length > 0 && (
        <div className="mt-6 border border-accent p-4">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
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
        <div className="mt-6 border border-accent p-4">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
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
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Guardar
          </button>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Escenas del día
        </h2>
        {allScenes.length === 0 ? (
          <EmptyState
            title="No hay escenas creadas todavía"
            description="Créalas en Guion para poder asignarlas a este día."
            actionLabel="Ir a Guion"
            actionHref={`/app/${projectId}/guion`}
          />
        ) : (
          <form action={updateAssignmentsAction} className="mt-4">
            <div className="border-t border-line">
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
                      placeholder="Hora"
                      defaultValue={assignment?.callTime ?? ""}
                      className="w-24 border border-line bg-transparent px-2 py-1 text-xs outline-none transition-colors focus:border-accent"
                    />
                    <input
                      name={`order_${scene.id}`}
                      type="number"
                      placeholder="Orden"
                      defaultValue={assignment?.order ?? ""}
                      className="w-20 border border-line bg-transparent px-2 py-1 text-xs outline-none transition-colors focus:border-accent"
                    />
                  </div>
                );
              })}
            </div>
            <button
              type="submit"
              className="mt-4 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
            >
              Guardar asignación
            </button>
          </form>
        )}
      </section>

      <section className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
            Material reservado
          </h2>
          {inventoryItems.length === 0 ? (
            <p className="mt-4 font-mono text-sm text-muted">
              No hay material en{" "}
              <Link href="/app/inventario" className="text-fg hover:text-accent">
                Inventario
              </Link>
              .
            </p>
          ) : (
            <form action={updateItemReservationsAction} className="mt-4">
              <div className="border-t border-line">
                {inventoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line py-3"
                  >
                    <input
                      type="checkbox"
                      name={`reserve_${item.id}`}
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
                      placeholder="Uds."
                      defaultValue={reservedItemQty.get(item.id) ?? 1}
                      className="w-16 border border-line bg-transparent px-2 py-1 text-xs outline-none transition-colors focus:border-accent"
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit"
                className="mt-4 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
              >
                Guardar material
              </button>
            </form>
          )}
        </div>

        <div>
          <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
            Vehículos reservados
          </h2>
          {vehicles.length === 0 ? (
            <p className="mt-4 font-mono text-sm text-muted">
              No hay vehículos en{" "}
              <Link href="/app/vehiculos" className="text-fg hover:text-accent">
                Vehículos
              </Link>
              .
            </p>
          ) : (
            <form action={updateVehicleReservationsAction} className="mt-4">
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
              <button
                type="submit"
                className="mt-4 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
              >
                Guardar vehículos
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="mt-14 grid gap-6 sm:grid-cols-2">
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
      </section>

      <div className="mt-10 flex items-center gap-6">
        <Link
          href={`/app/${projectId}/call-sheets/${dayId}`}
          className="rounded-full border border-accent px-5 py-2 font-mono text-xs tracking-widest text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
        >
          {summary.shootingDay.callSheet ? "Ver call sheet" : "Generar call sheet"}
        </Link>
        <form action={deleteShootingDay.bind(null, projectId, dayId)}>
          <DeleteButton
            confirmMessage="¿Eliminar este día de rodaje?"
            className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
          >
            Eliminar día
          </DeleteButton>
        </form>
      </div>
    </div>
  );
}
