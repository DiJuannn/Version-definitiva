import { prisma } from "@/lib/prisma";
import { createVehicle, deleteVehicle } from "@/lib/actions/vehicles";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { DeleteButton } from "@/components/DeleteButton";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";

// Alta de vehículo. En el diálogo, en una columna; en línea (flota vacía), a
// lo ancho.
function NewVehicleForm({ inline }: { inline?: boolean }) {
  return (
    <form action={createVehicle} className={inline ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-4"}>
      <FormField label="Nombre">
        <input name="name" required placeholder="Ej.: furgoneta de cámara" className="field w-full" />
      </FormField>
      <div className={inline ? "contents" : "grid grid-cols-2 gap-4"}>
        <FormField label="Tipo">
          <input name="type" placeholder="Furgoneta, coche…" className="field w-full" />
        </FormField>
        <FormField label="Matrícula">
          <input name="plate" placeholder="0000 ABC" className="field w-full font-mono uppercase" />
        </FormField>
      </div>
      <FormField label="Notas">
        <input name="notes" placeholder="Plazas, carga, de quién es…" className="field w-full" />
      </FormField>
      <div className={`flex items-center gap-4 ${inline ? "sm:col-span-2 lg:col-span-4" : "mt-1"}`}>
        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-primary">
          Añadir a la flota
        </SubmitButton>
        <DialogCancel />
      </div>
    </form>
  );
}

// Flota de la organización (alta, listado y borrado). La usan /app/vehiculos y
// la pestaña «Toda la flota» de los vehículos de un proyecto.
export async function VehiclesFleet({ organizationId }: { organizationId: string }) {
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { reservations: true } } },
  });

  if (vehicles.length === 0) {
    return (
      <section aria-labelledby="primer-vehiculo" className="mt-12 border-t border-line pt-10">
        <h2 id="primer-vehiculo" className="font-display text-xl font-bold">
          Añade el primer vehículo
        </h2>
        <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
          Furgonetas de equipo, coches de producción o el coche que sale en escena. Luego se reservan por día desde el
          Plan de rodaje.
        </p>
        <div className="mt-8 max-w-5xl">
          <NewVehicleForm inline />
        </div>
      </section>
    );
  }

  const reserved = vehicles.filter((v) => v._count.reservations > 0).length;

  return (
    <>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-sans text-sm text-muted">
          <span>
            <span className="font-display text-2xl font-black text-fg tabular-nums">{vehicles.length}</span>{" "}
            {vehicles.length === 1 ? "vehículo" : "vehículos"}
          </span>
          <span>
            <span className="font-display text-2xl font-black text-fg tabular-nums">{reserved}</span> con reservas
          </span>
        </p>
        <CreateDialog label="Añadir vehículo" title="Nuevo vehículo">
          <NewVehicleForm />
        </CreateDialog>
      </div>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {vehicles.map((vehicle) => (
          <li key={vehicle.id} className="flex items-center gap-4 py-4">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fg/[0.06] text-muted">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 15V9.5A1.5 1.5 0 0 1 4.5 8H14l3.5 3.5H20a1 1 0 0 1 1 1V15" strokeLinejoin="round" />
                <path d="M3 15h18" />
                <circle cx="7" cy="16.5" r="1.8" />
                <circle cx="17" cy="16.5" r="1.8" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-sans text-[16px] font-medium">{vehicle.name}</span>
              <span className="block truncate font-sans text-[13px] text-muted">
                {[vehicle.type, vehicle.notes].filter(Boolean).join(" · ") || "Sin tipo ni notas"}
              </span>
            </span>
            {vehicle.plate && (
              // La matrícula como en la placa: es lo que se busca en el aparcamiento.
              <span className="hidden shrink-0 rounded border border-fg/25 px-2 py-0.5 font-mono text-[12px] tracking-[0.12em] text-fg uppercase sm:inline">
                {vehicle.plate}
              </span>
            )}
            <span className="hidden w-24 shrink-0 text-right font-mono text-[11px] tracking-wide text-muted uppercase tabular-nums sm:inline">
              {vehicle._count.reservations > 0
                ? `${vehicle._count.reservations} ${vehicle._count.reservations === 1 ? "reserva" : "reservas"}`
                : "Sin reservas"}
            </span>
            <form action={deleteVehicle.bind(null, vehicle.id)} className="shrink-0">
              <DeleteButton confirmMessage="¿Eliminar este vehículo de la flota?" className="link-action" />
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
