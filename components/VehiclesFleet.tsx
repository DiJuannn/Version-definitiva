import Link from "next/link";
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

// Botón «Añadir vehículo» con su diálogo, para las acciones de la cabecera.
export function NewVehicleButton() {
  return (
    <CreateDialog label="Añadir vehículo" title="Nuevo vehículo">
      <NewVehicleForm />
    </CreateDialog>
  );
}

function shortDay(date: Date) {
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
}

// Matrícula como la placa real (blanca, con la franja azul europea): es lo que
// se busca en el aparcamiento. Colores fijos a propósito: imitan el objeto.
function Plate({ plate }: { plate: string }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-stretch overflow-hidden rounded-[5px] bg-[#f3f2ec] shadow-[0_0_0_1px_rgba(0,0,0,0.5)]">
      <span aria-hidden className="flex w-3.5 items-end justify-center bg-[#2a4ea0] pb-0.5 font-sans text-[7px] font-bold text-white">
        E
      </span>
      <span className="flex items-center px-2 font-mono text-[13px] font-bold tracking-[0.14em] text-[#151515] uppercase">
        <span className="sr-only">Matrícula </span>
        {plate}
      </span>
    </span>
  );
}

// Flota de la organización (alta, listado y borrado). La usan /app/vehiculos y
// la pestaña «Toda la flota» de los vehículos de un proyecto. Cada vehículo es
// una ficha compacta: qué es, su matrícula y los días que ya está pedido.
export async function VehiclesFleet({
  organizationId,
  hideCreate,
}: {
  organizationId: string;
  // La página ya pone «Añadir vehículo» en su cabecera.
  hideCreate?: boolean;
}) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [vehicles, nextDay] = await Promise.all([
    prisma.vehicle.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { reservations: true } },
        // Solo lectura: los días que viene reservado.
        reservations: {
          where: { shootingDay: { date: { gte: startOfToday } } },
          select: {
            id: true,
            shootingDay: { select: { id: true, date: true, projectId: true, project: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.shootingDay.findFirst({
      where: { project: { organizationId }, date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      include: { project: { select: { name: true } } },
    }),
  ]);

  if (vehicles.length === 0) {
    return (
      <section aria-labelledby="primer-vehiculo" className="mt-12 pt-4">
        <h2 id="primer-vehiculo" className="font-display text-xl font-bold">
          Añade el primer vehículo
        </h2>
        <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
          Furgonetas de equipo, coches de producción o el coche que sale en escena. Luego se reservan por día desde el
          Plan de rodaje.
        </p>
        <div className="paper mt-8 max-w-5xl p-6">
          <NewVehicleForm inline />
        </div>
      </section>
    );
  }

  const nextKey = nextDay?.date.toISOString().slice(0, 10);
  const onNextDay = nextKey
    ? vehicles.filter((v) => v.reservations.some((r) => r.shootingDay.date.toISOString().slice(0, 10) === nextKey))
    : [];
  const withoutPlate = vehicles.filter((v) => !v.plate);

  return (
    <>
      {/* Cómo voy */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="font-sans text-[15px] leading-relaxed text-muted">
          <span className="font-display text-2xl font-black text-fg tabular-nums">{vehicles.length}</span>{" "}
          {vehicles.length === 1 ? "vehículo" : "vehículos"}
          {nextDay ? (
            <>
              {" "}
              · para el próximo rodaje (<span className="text-fg">{shortDay(nextDay.date)}</span>, {nextDay.project.name}
              ):{" "}
              {onNextDay.length === 0
                ? "ninguno reservado todavía"
                : onNextDay.map((v) => v.name).join(", ")}
            </>
          ) : (
            " · no hay rodajes por delante"
          )}
          .
        </p>
        {!hideCreate && <NewVehicleButton />}
      </div>
      {withoutPlate.length > 0 && (
        <p className="mt-3 border-l-2 border-warn pl-3 font-sans text-sm text-muted">
          Sin matrícula apuntada: {withoutPlate.map((v) => v.name).join(", ")}.
        </p>
      )}

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => {
          const upcoming = [...vehicle.reservations].sort(
            (a, b) => a.shootingDay.date.getTime() - b.shootingDay.date.getTime(),
          );
          const past = vehicle._count.reservations - upcoming.length;
          return (
            <li key={vehicle.id} className="tile flex flex-col p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 15V9.5A1.5 1.5 0 0 1 4.5 8H14l3.5 3.5H20a1 1 0 0 1 1 1V15" strokeLinejoin="round" />
                    <path d="M3 15h18" />
                    <circle cx="7" cy="16.5" r="1.8" />
                    <circle cx="17" cy="16.5" r="1.8" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[17px] leading-snug font-bold">{vehicle.name}</p>
                  <p className="mt-0.5 font-sans text-[13px] text-muted">
                    {[vehicle.type, vehicle.notes].filter(Boolean).join(" · ") || "Sin tipo ni notas"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {vehicle.plate ? (
                  <Plate plate={vehicle.plate} />
                ) : (
                  <span className="inline-flex h-7 items-center gap-1.5 font-sans text-[13px] text-warn">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" />
                    Sin matrícula
                  </span>
                )}
              </div>

              {/* Días reservados: los que vienen, cada uno abre su día del plan. */}
              <div className="mt-4 flex-1 border-t border-line pt-3">
                <p className="eyebrow">Reservado</p>
                {upcoming.length === 0 ? (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 font-sans text-[13px] text-success">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
                    Libre todos los días que vienen
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {upcoming.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/app/${r.shootingDay.projectId}/plan-de-rodaje/${r.shootingDay.id}`}
                          title={r.shootingDay.project.name}
                          className="inline-flex rounded-full bg-accent/15 px-2.5 py-1 font-mono text-[10px] tracking-wide text-fg uppercase tabular-nums transition-colors hover:bg-accent hover:text-bg"
                        >
                          {shortDay(r.shootingDay.date)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {past > 0 && (
                  <p className="mt-2 font-sans text-[12px] text-muted">
                    Y {past} {past === 1 ? "día ya rodado" : "días ya rodados"}.
                  </p>
                )}
              </div>

              <form action={deleteVehicle.bind(null, vehicle.id)} className="mt-3 -mb-1 flex justify-end">
                <DeleteButton confirmMessage="¿Eliminar este vehículo de la flota?" className="link-action" />
              </form>
            </li>
          );
        })}
      </ul>

      {nextDay && (
        <p className="mt-16 border-t border-line pt-4 font-sans text-sm text-muted">
          Siguiente: reservar vehículos para el {shortDay(nextDay.date)} en el{" "}
          <Link
            href={`/app/${nextDay.projectId}/plan-de-rodaje/${nextDay.id}`}
            className="text-fg underline decoration-accent/60 underline-offset-4 hover:text-accent"
          >
            Plan de rodaje de {nextDay.project.name}
          </Link>
          .
        </p>
      )}
    </>
  );
}
