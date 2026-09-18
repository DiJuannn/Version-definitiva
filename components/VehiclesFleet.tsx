import { prisma } from "@/lib/prisma";
import { createVehicle, deleteVehicle } from "@/lib/actions/vehicles";
import { DeleteButton } from "@/components/DeleteButton";
import { FormField } from "@/components/FormField";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { SubmitButton } from "@/components/SubmitButton";

const FIELD =
  "border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

// Flota de la organización (alta, listado y borrado). La usan /app/vehiculos y
// la pestaña «Toda la flota» de los vehículos de un proyecto.
export async function VehiclesFleet({ organizationId }: { organizationId: string }) {
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { reservations: true } } },
  });

  return (
    <>
      <form
        action={createVehicle}
        className="mt-6 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <FormField label="Nombre">
          <input name="name" required className={FIELD} />
        </FormField>
        <FormField label="Tipo">
          <input name="type" placeholder="Furgoneta, coche..." className={FIELD} />
        </FormField>
        <FormField label="Matrícula">
          <input name="plate" className={FIELD} />
        </FormField>
        <FormField label="Notas">
          <input name="notes" className={FIELD} />
        </FormField>
        <div>
          <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido">
            Añadir vehículo
          </SubmitButton>
        </div>
      </form>

      {vehicles.length === 0 ? (
        <EmptyState
          title="Todavía no hay vehículos en la flota"
          description="Añádelo con el formulario de arriba — luego se reserva por día de rodaje desde cualquier proyecto."
        />
      ) : (
        <div className="mt-8 border-t border-line">
          {vehicles.map((vehicle) => (
            <ListRow
              key={vehicle.id}
              title={<span className="font-display text-lg font-bold">{vehicle.name}</span>}
              meta={
                [vehicle.type, vehicle.plate, vehicle.notes].filter(Boolean).join(" · ") ||
                "Sin datos"
              }
              trailing={
                <>
                  <span className="font-mono text-xs text-muted">
                    {vehicle._count.reservations} reserva
                    {vehicle._count.reservations === 1 ? "" : "s"}
                  </span>
                  <form action={deleteVehicle.bind(null, vehicle.id)}>
                    <DeleteButton confirmMessage="¿Eliminar este vehículo de la flota?" />
                  </form>
                </>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
