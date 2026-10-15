import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TOOL_GUIDES } from "@/lib/tool-guides";
import { ScopeToggle } from "@/components/ScopeToggle";
import { VehiclesFleet } from "@/components/VehiclesFleet";
import { NextTool, StatusLine } from "@/components/gestion/ToolStatus";

// Dos vistas de la misma herramienta sin salir del proyecto: los vehículos
// del proyecto ordenados por día de rodaje (qué coche sale cada día, y qué
// día se ha quedado sin ninguno), o la flota completa de la organización
// (donde se añaden y borran).
export default async function ProjectVehiclesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const { projectId } = await params;
  const { ver } = await searchParams;
  const fleet = ver === "flota";

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const base = `/app/${projectId}/vehiculos`;

  const days = fleet
    ? []
    : await prisma.shootingDay.findMany({
        where: { projectId },
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          _count: { select: { scenes: true } },
          vehicleReservations: {
            orderBy: { vehicle: { name: "asc" } },
            select: { vehicle: { select: { id: true, name: true, type: true, plate: true, notes: true } } },
          },
        },
      });

  const vehicleDays = new Map<string, { name: string; count: number }>();
  for (const day of days) {
    for (const r of day.vehicleReservations) {
      const v = vehicleDays.get(r.vehicle.id) ?? { name: r.vehicle.name, count: 0 };
      v.count += 1;
      vehicleDays.set(r.vehicle.id, v);
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysWithout = days.filter((d) => d.vehicleReservations.length === 0);
  const upcomingWithout = daysWithout.filter((d) => d.date >= today);
  const reserved = vehicleDays.size;
  const dayLabel = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="pb-16">
      <PageHeader
        guide={TOOL_GUIDES["vehiculos"]}
        eyebrow="Rodar"
        title="Vehículos"
        description={
          fleet
            ? "Todos los vehículos de tu organización. Aquí se añaden y se borran, y luego se reservan para cada día desde Plan de rodaje."
            : "Qué vehículo sale cada día de rodaje. Se reservan desde Plan de rodaje; para añadir o borrar coches, ve a «Toda la flota»."
        }
        actions={
          <ScopeToggle
            items={[
              { label: "En este proyecto", href: base, active: !fleet },
              { label: "Toda la flota", href: `${base}?ver=flota`, active: fleet },
            ]}
          />
        }
      />

      {fleet ? (
        <VehiclesFleet organizationId={project.organizationId} />
      ) : days.length === 0 ? (
        <EmptyState
          title="Todavía no hay días de rodaje"
          description="Los vehículos se reservan para cada día desde Plan de rodaje. Crea primero los días."
          actionLabel="Ir a Plan de rodaje"
          actionHref={`/app/${projectId}/plan-de-rodaje`}
        />
      ) : (
        <>
          <StatusLine tone={upcomingWithout.length > 0 ? "warn" : reserved === 0 ? "neutral" : "ok"}>
            {reserved === 0 ? (
              <>Ningún vehículo reservado en los {days.length} días de rodaje.</>
            ) : (
              <>
                {reserved} vehículo{reserved === 1 ? "" : "s"} para {days.length} día{days.length === 1 ? "" : "s"} de rodaje
                {daysWithout.length === 0 ? (
                  " · todos los días tienen transporte."
                ) : (
                  <>
                    {" · "}
                    <span className={upcomingWithout.length > 0 ? "text-warn" : ""}>
                      {daysWithout.length === 1 ? "1 día sin vehículo" : `${daysWithout.length} días sin vehículo`}
                    </span>
                    .
                  </>
                )}
              </>
            )}{" "}
            <Link href={`/app/${projectId}/plan-de-rodaje`} className="text-accent underline-offset-4 hover:underline">
              Reservar en Plan de rodaje →
            </Link>
          </StatusLine>

          {/* Por día de rodaje */}
          <section aria-labelledby="por-dia" className="mt-10">
            <h2 id="por-dia" className="sr-only">
              Vehículos por día de rodaje
            </h2>
            <ol className="sheet divide-y divide-line px-5 sm:px-8">
              {days.map((day, i) => {
                const past = day.date < today;
                return (
                  <li
                    key={day.id}
                    className={`grid gap-x-8 gap-y-3 py-5 sm:grid-cols-[14rem_minmax(0,1fr)] ${past ? "opacity-70" : ""}`}
                  >
                    <div>
                      <p className="eyebrow">
                        Día {i + 1}
                        {past ? " · rodado" : ""}
                      </p>
                      <p className="mt-1 font-display text-lg leading-tight font-bold tracking-tight first-letter:uppercase">
                        {dayLabel(day.date)}
                      </p>
                      <p className="mt-0.5 font-sans text-[13px] text-muted">
                        {day._count.scenes} escena{day._count.scenes === 1 ? "" : "s"}
                      </p>
                    </div>
                    {day.vehicleReservations.length === 0 ? (
                      <p className="self-center border-l-2 border-warn pl-3 font-sans text-sm text-fg">
                        Sin vehículo reservado para este día.
                      </p>
                    ) : (
                      <ul className="flex flex-wrap items-center gap-x-8 gap-y-4 self-center">
                        {day.vehicleReservations.map(({ vehicle }) => (
                          <li key={vehicle.id} className="flex items-center gap-3">
                            {/* La matrícula, como una placa: lo que se busca en el aparcamiento. */}
                            <span
                              className={`inline-flex min-w-[6.5rem] items-center justify-center rounded-[4px] px-2 py-1 font-mono text-[13px] font-semibold tracking-[0.12em] ${
                                vehicle.plate ? "bg-fg text-bg" : "text-muted ring-1 ring-line ring-inset"
                              }`}
                            >
                              {vehicle.plate ?? "SIN MATRÍC."}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-sans text-[15px] font-medium">{vehicle.name}</span>
                              {(vehicle.type || vehicle.notes) && (
                                <span className="block font-sans text-[13px] text-muted">
                                  {[vehicle.type, vehicle.notes].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {reserved > 0 && (
            <p className="mt-6 font-sans text-sm text-muted">
              En total:{" "}
              {[...vehicleDays.values()]
                .sort((a, b) => b.count - a.count)
                .map((v) => `${v.name} (${v.count} día${v.count === 1 ? "" : "s"})`)
                .join(" · ")}
              .
            </p>
          )}

          <NextTool href={`/app/${projectId}/call-sheets`} label="Hojas de llamada" note="el transporte de cada día va en su hoja" />
        </>
      )}
    </div>
  );
}
