import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/actions/calendar-events";
import { DeleteButton } from "@/components/DeleteButton";
import { ChipOption } from "@/components/ChipOption";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";
import { FormField } from "@/components/FormField";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { CalendarEventType } from "@/lib/generated/prisma";

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  REHEARSAL: "Ensayo",
  MEETING: "Reunión",
  DEADLINE: "Fecha límite",
  DELIVERY: "Entrega",
  OTHER: "Otro",
};

type IconProps = { className?: string };
const iconShared = { viewBox: "0 0 24 24", fill: "none", strokeWidth: 1.8 } as const;

function RehearsalIcon({ className }: IconProps) {
  return (
    <svg {...iconShared} className={className}>
      <path d="M7 5v14l12-7L7 5Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}
function MeetingIcon({ className }: IconProps) {
  return (
    <svg {...iconShared} className={className}>
      <circle cx="9" cy="10" r="3.2" stroke="currentColor" />
      <circle cx="16" cy="10" r="3.2" stroke="currentColor" />
      <path d="M3.5 19c.6-2.8 2.7-4.5 5.5-4.5s4.9 1.7 5.5 4.5M12.5 19c.6-2.8 2.7-4.5 5.5-4.5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
function DeadlineIcon({ className }: IconProps) {
  return (
    <svg {...iconShared} className={className}>
      <circle cx="12" cy="13" r="8" stroke="currentColor" />
      <path d="M12 9v4l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 3h6" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
function DeliveryIcon({ className }: IconProps) {
  return (
    <svg {...iconShared} className={className}>
      <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M3 8.5V16l9 4.5 9-4.5V8.5M12 13v7.5" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}
function OtherEventIcon({ className }: IconProps) {
  return (
    <svg {...iconShared} className={className}>
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function ShootingDayIcon({ className }: IconProps) {
  return (
    <svg {...iconShared} className={className}>
      <path d="M3 10 20 6l1 4-17 4-1-4Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M4 14h16v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

const EVENT_TYPE_ICON: Record<CalendarEventType, (props: IconProps) => React.JSX.Element> = {
  REHEARSAL: RehearsalIcon,
  MEETING: MeetingIcon,
  DEADLINE: DeadlineIcon,
  DELIVERY: DeliveryIcon,
  OTHER: OtherEventIcon,
};

// Color de cada tipo (siempre de los tokens): el rodaje es lo que manda en
// el mes y va relleno; el resto son puntos de color con su icono.
const EVENT_TYPE_TONE: Record<CalendarEventType, string> = {
  REHEARSAL: "text-accent",
  MEETING: "text-fg",
  DEADLINE: "text-danger",
  DELIVERY: "text-success",
  OTHER: "text-muted",
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function parseMonthParam(month: string | undefined): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, m] = month.split("-").map(Number);
    return new Date(year, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toMonthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthStart = parseMonthParam(month);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const prevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const profile = await getCurrentProfile();
  if (!profile) return null;

  const organizationId = profile.organizationId;

  const [events, shootingDays, projects] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { organizationId, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
      include: { project: true },
    }),
    prisma.shootingDay.findMany({
      where: { project: { organizationId }, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
      include: { project: true },
    }),
    prisma.project.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
  ]);

  const dayEntries = [
    ...events.map((event) => ({
      id: `event-${event.id}`,
      date: event.date,
      Icon: EVENT_TYPE_ICON[event.type],
      label: event.title,
      kind: EVENT_TYPE_LABELS[event.type],
      tone: EVENT_TYPE_TONE[event.type],
      project: event.project?.name ?? null,
      href: null as string | null,
      deletableId: event.id,
    })),
    ...shootingDays.map((day) => ({
      id: `day-${day.id}`,
      date: day.date,
      Icon: ShootingDayIcon,
      label: day.project.name,
      kind: "Rodaje",
      tone: "text-accent",
      project: null as string | null,
      href: `/app/${day.projectId}/plan-de-rodaje/${day.id}`,
      deletableId: null as string | null,
    })),
  ];

  // Rejilla de semanas — lunes como primer día, completando la primera y
  // última semana con días del mes anterior/siguiente.
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - firstWeekday);

  const lastWeekday = (monthEnd.getDay() + 6) % 7;
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - lastWeekday));

  const days: Date[] = [];
  for (
    const cursor = new Date(gridStart);
    cursor <= gridEnd;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    days.push(new Date(cursor));
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const today = new Date();
  const agendaDays = weeks
    .flat()
    .filter((day) => day.getMonth() === monthStart.getMonth())
    .map((day) => ({ day, entries: dayEntries.filter((entry) => sameDay(entry.date, day)) }))
    .filter((d) => d.entries.length > 0);

  const monthName = monthStart.toLocaleDateString("es-ES", { month: "long" });
  const sortedAgenda = agendaDays.map(({ day, entries }) => ({
    day,
    // Rodajes primero dentro del día.
    entries: [...entries].sort((a, b) => Number(Boolean(b.href)) - Number(Boolean(a.href))),
  }));

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Calendario"
        title={monthStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
        description="Los días de rodaje de todos tus proyectos y los eventos de la productora: ensayos, reuniones, entregas y fechas límite."
        actions={
          <>
            <nav aria-label="Cambiar de mes" className="inline-flex items-center rounded-full bg-fg/[0.06] p-1">
              <Link
                href={`/app/calendario?month=${toMonthParam(prevMonth)}`}
                aria-label="Mes anterior"
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-bg-raised hover:text-fg"
              >
                ←
              </Link>
              <Link
                href="/app/calendario"
                className="rounded-full px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted uppercase transition-colors hover:bg-bg-raised hover:text-fg"
              >
                Hoy
              </Link>
              <Link
                href={`/app/calendario?month=${toMonthParam(nextMonth)}`}
                aria-label="Mes siguiente"
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-bg-raised hover:text-fg"
              >
                →
              </Link>
            </nav>
            <CreateDialog
              label="Añadir evento"
              title="Nuevo evento"
              description="Los días de rodaje no se añaden aquí: salen solos del Plan de rodaje de cada proyecto."
            >
              <form action={createCalendarEvent} className="grid gap-4">
                <FormField label="Qué es">
                  <input name="title" required placeholder="Ej.: ensayo con el reparto" className="field w-full" />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Fecha">
                    <input type="date" name="date" required className="field w-full" />
                  </FormField>
                  <FormField label="Proyecto">
                    <select name="projectId" defaultValue="" className="field w-full">
                      <option value="">Sin proyecto</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <fieldset>
                  <legend className="font-mono text-[10px] tracking-widest text-muted uppercase">Tipo</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.values(CalendarEventType).map((value) => (
                      <ChipOption
                        key={value}
                        type="radio"
                        name="type"
                        value={value}
                        label={EVENT_TYPE_LABELS[value]}
                        defaultChecked={value === "OTHER"}
                      />
                    ))}
                  </div>
                </fieldset>
                <div className="mt-1 flex items-center gap-4">
                  <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-primary">
                    Añadir al calendario
                  </SubmitButton>
                  <DialogCancel />
                </div>
              </form>
            </CreateDialog>
          </>
        }
      />

      {/* Resumen del mes y leyenda, en una línea. */}
      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-sans text-sm text-muted">
          <span>
            <span className="font-display text-2xl font-black text-fg tabular-nums">{shootingDays.length}</span>{" "}
            {shootingDays.length === 1 ? "día de rodaje" : "días de rodaje"}
          </span>
          <span>
            <span className="font-display text-2xl font-black text-fg tabular-nums">{events.length}</span>{" "}
            {events.length === 1 ? "evento" : "eventos"}
          </span>
        </p>
        <ul aria-label="Leyenda" className="hidden flex-wrap items-center gap-x-5 gap-y-1 font-sans text-[13px] text-muted md:flex">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-4 rounded-sm bg-accent" />
            Rodaje
          </li>
          {Object.values(CalendarEventType).map((value) => {
            const Icon = EVENT_TYPE_ICON[value];
            return (
              <li key={value} className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${EVENT_TYPE_TONE[value]}`} />
                {EVENT_TYPE_LABELS[value]}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Escritorio: el mes en rejilla, solo con líneas. */}
      <div className="mt-4 hidden md:block">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((day) => (
            <p key={day} className="eyebrow px-2 pb-2">
              {day}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7 border-b border-line">
          {weeks.flat().map((day, i) => {
            const isCurrentMonth = day.getMonth() === monthStart.getMonth();
            const isToday = sameDay(day, today);
            const entriesForDay = dayEntries.filter((entry) => sameDay(entry.date, day));
            return (
              <div
                key={day.toISOString()}
                className={`min-h-28 border-t border-line p-1.5 ${i % 7 === 0 ? "" : "border-l"} ${
                  isCurrentMonth ? "" : "bg-fg/[0.025]"
                }`}
              >
                <p
                  className={`grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] tabular-nums ${
                    isToday ? "bg-accent font-bold text-bg" : isCurrentMonth ? "text-fg" : "text-muted/60"
                  }`}
                >
                  {day.getDate()}
                </p>
                <div className="mt-1 space-y-1">
                  {entriesForDay.map((entry) =>
                    entry.href ? (
                      <Link
                        key={entry.id}
                        href={entry.href}
                        title={`Rodaje · ${entry.label}`}
                        className="flex items-center gap-1 truncate rounded bg-accent px-1.5 py-0.5 font-sans text-[11px] font-medium text-bg transition-opacity hover:opacity-85"
                      >
                        <entry.Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{entry.label}</span>
                      </Link>
                    ) : (
                      <p
                        key={entry.id}
                        title={`${entry.kind} · ${entry.label}`}
                        className="flex items-center gap-1 truncate px-0.5 font-sans text-[11px] leading-tight"
                      >
                        <entry.Icon className={`h-3 w-3 shrink-0 ${entry.tone}`} />
                        <span className="truncate">{entry.label}</span>
                      </p>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda del mes: en móvil es la vista principal; en escritorio, el
          detalle de la rejilla (y donde se borran los eventos). */}
      <section aria-labelledby="agenda" className="mt-8 md:mt-16">
        <h2 id="agenda" className="hidden border-b border-line pb-3 font-display text-xl font-black tracking-tight uppercase md:block">
          Agenda de {monthName}
        </h2>
        {sortedAgenda.length === 0 ? (
          <p className="border-t border-line py-10 font-sans text-sm text-muted md:border-t-0">
            Nada en {monthName}. Los días de rodaje aparecen solos al crearlos en el Plan de rodaje de un proyecto; los
            demás eventos se añaden con «Añadir evento».
          </p>
        ) : (
          <ol className="divide-y divide-line border-y border-line md:border-t-0">
            {sortedAgenda.map(({ day, entries }) => {
              const isToday = sameDay(day, today);
              return (
                <li key={day.toISOString()} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
                  <div className={isToday ? "text-accent" : ""}>
                    <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                      {day.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}
                    </p>
                    <p className="font-display text-3xl leading-none font-black tabular-nums">{day.getDate()}</p>
                    {isToday && <p className="mt-1 font-mono text-[10px] tracking-widest uppercase">Hoy</p>}
                  </div>
                  <ul className="min-w-0 space-y-2.5 pt-0.5">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-4">
                        {entry.href ? (
                          <Link href={entry.href} className="group flex min-w-0 items-center gap-3">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-bg">
                              <entry.Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-sans text-[15px] font-medium transition-colors group-hover:text-accent">
                                Rodaje · {entry.label}
                              </span>
                              <span className="block font-sans text-[13px] text-muted">Ver el día en el Plan de rodaje →</span>
                            </span>
                          </Link>
                        ) : (
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fg/[0.06] ${entry.tone}`}>
                              <entry.Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-sans text-[15px]">{entry.label}</span>
                              <span className="block truncate font-sans text-[13px] text-muted">
                                {entry.kind}
                                {entry.project ? ` · ${entry.project}` : ""}
                              </span>
                            </span>
                          </span>
                        )}
                        {entry.deletableId && (
                          <form action={deleteCalendarEvent.bind(null, entry.deletableId)} className="shrink-0">
                            <DeleteButton confirmMessage="¿Eliminar este evento del calendario?" className="link-action" />
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
