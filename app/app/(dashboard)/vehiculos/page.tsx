import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createVehicle, deleteVehicle } from "@/lib/actions/vehicles";
import { DeleteButton } from "@/components/DeleteButton";
import { FormField } from "@/components/FormField";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { SubmitButton } from "@/components/SubmitButton";

export default async function VehiculosPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { reservations: true } } },
  });

  return (
    <div>
      <Link
        href="/app"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Taller
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Vehículos
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Flota de la organización — se reserva por día de rodaje desde
        cualquier proyecto, sin recrearla.
      </p>

      <form
        action={createVehicle}
        className="mt-8 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <FormField label="Nombre">
          <input
            name="name"
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </FormField>
        <FormField label="Tipo">
          <input
            name="type"
            placeholder="Furgoneta, coche..."
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </FormField>
        <FormField label="Matrícula">
          <input
            name="plate"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </FormField>
        <FormField label="Notas">
          <input
            name="notes"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
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
        <div className="mt-10 border-t border-line">
          {vehicles.map((vehicle) => (
            <ListRow
              key={vehicle.id}
              title={
                <span className="font-display text-lg font-bold uppercase">
                  {vehicle.name}
                </span>
              }
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
    </div>
  );
}
