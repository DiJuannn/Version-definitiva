import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createVehicle, deleteVehicle } from "@/lib/actions/vehicles";

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
        <input
          name="name"
          placeholder="Nombre"
          required
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="type"
          placeholder="Tipo (furgoneta, coche...)"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="plate"
          placeholder="Matrícula"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="notes"
          placeholder="Notas"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <div>
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Añadir vehículo
          </button>
        </div>
      </form>

      {vehicles.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          Todavía no hay vehículos en la flota.
        </p>
      ) : (
        <div className="mt-10 border-t border-line">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="flex items-center justify-between gap-4 border-b border-line py-4"
            >
              <div>
                <span className="font-display text-lg font-bold uppercase">
                  {vehicle.name}
                </span>
                <p className="font-mono text-xs text-muted">
                  {[vehicle.type, vehicle.plate, vehicle.notes]
                    .filter(Boolean)
                    .join(" · ") || "Sin datos"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-muted">
                  {vehicle._count.reservations} reserva
                  {vehicle._count.reservations === 1 ? "" : "s"}
                </span>
                <form action={deleteVehicle.bind(null, vehicle.id)}>
                  <button
                    type="submit"
                    className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                  >
                    Eliminar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
