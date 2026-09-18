import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/actions/calendar-events";
import { DeleteButton } from "@/components/DeleteButton";
import { ChipOption } from "@/components/ChipOption";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";
import { FormField } from "@/components/FormField";
import { LinkPendingHint } from "@/components/LinkPendingHint";
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
      href: null as string | null,
      deletableId: event.id,
    })),
    ...shootingDays.map((day) => ({
      id: `day-${day.id}`,
      date: day.date,
      Icon: ShootingDayIcon,
      label: `Rodaje — ${day.project.name}`,
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

  return (
    <div>
      <PageHeader
        backHref="/app"
        backLabel="← Inicio"
        eyebrow="Organización"
        title={monthStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
        description="Rodajes de todos tus proyectos y los eventos de la productora."
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={`/app/calendario?month=${toMonthParam(prevMonth)}`}
              aria-label="Mes anterior"
              className="btn btn-outline btn-sm"
            >
              ←
            </Link>
            <Link href="/app/calendario" className="btn btn-outline btn-sm">
              Hoy
            </Link>
            <Link
              href={`/app/calendario?month=${toMonthParam(nextMonth)}`}
              aria-label="Mes siguiente"
              className="btn btn-outline btn-sm"
            >
              →
            </Link>
          </div>
        }
      />

      {/* Móvil: agenda por días (la rejilla de 7 columnas no cabe). */}
      <div className="mt-6 md:hidden">
        {agendaDays.length === 0 ? (
          <p className="font-sans text-sm text-muted">Nada este mes. Añade un evento abajo.</p>
        ) : (
          <div className="border-t border-line">
            {agendaDays.map(({ day, entries }) => (
              <div key={day.toISOString()} className="flex gap-4 border-b border-line py-3">
                <div className="w-12 shrink-0 text-center">
                  <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                    {day.toLocaleDateString("es-ES", { weekday: "short" })}
                  </p>
                  <p
                    className={`font-display text-2xl leading-none font-black ${
                      sameDay(day, today) ? "text-accent" : ""
                    }`}
                  >
                    {day.getDate()}
                  </p>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {entries.map((entry) =>
                    entry.href ? (
                      <Link
                        key={entry.id}
                        href={entry.href}
                        className="flex items-center gap-2 font-mono text-xs hover:text-accent"
                      >
                        <entry.Icon className="h-3.5 w-3.5 shrink-0 text-accent" />
                        {entry.label}
                      </Link>
                    ) : (
                      <p key={entry.id} className="flex items-center gap-2 font-mono text-xs">
                        <entry.Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
                        {entry.label}
                      </p>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 hidden grid-cols-7 border-l border-t border-line md:grid">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="border-b border-r border-line bg-bg-raised px-2 py-1.5 font-mono text-[10px] tracking-widest text-muted uppercase"
          >
            {day}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const isCurrentMonth = day.getMonth() === monthStart.getMonth();
          const entriesForDay = dayEntries.filter((entry) => sameDay(entry.date, day));
          return (
            <div
              key={day.toISOString()}
              className={`min-h-28 border-b border-r border-line p-1.5 ${
                isCurrentMonth ? "" : "opacity-30"
              } ${sameDay(day, today) ? "bg-accent/10" : ""}`}
            >
              <p className={`font-mono text-[11px] ${sameDay(day, today) ? "font-bold text-accent" : "text-muted"}`}>{day.getDate()}</p>
              <div className="mt-1 space-y-1">
                {entriesForDay.map((entry) =>
                  entry.href ? (
                    <Link
                      key={entry.id}
                      href={entry.href}
                      className="flex items-center gap-1 truncate font-mono text-[10px] hover:text-accent"
                    >
                      <entry.Icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{entry.label}</span>
                    </Link>
                  ) : (
                    <p key={entry.id} className="flex items-center gap-1 truncate font-mono text-[10px]">
                      <entry.Icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{entry.label}</span>
                    </p>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Añadir evento
        </h2>
        <form
          action={createCalendarEvent}
          className="mt-4 grid gap-2 border border-line p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <FormField label="Título" className="sm:col-span-2">
            <input
              name="title"
              required
              className="border border-line bg-transparent px-2 py-1.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </FormField>
          <FormField label="Fecha">
            <input
              type="date"
              name="date"
              required
              className="border border-line bg-transparent px-2 py-1.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </FormField>
          <FormField label="Proyecto">
          <select
            name="projectId"
            defaultValue=""
            className="border border-line bg-transparent px-2 py-1.5 text-sm outline-none transition-colors focus:border-accent"
          >
            <option value="" className="bg-bg">
              Sin proyecto
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id} className="bg-bg">
                {project.name}
              </option>
            ))}
          </select>
          </FormField>

          <div className="sm:col-span-2 lg:col-span-5">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Tipo
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
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
          </div>

          <div className="sm:col-span-2 lg:col-span-5">
            <SubmitButton
              pendingLabel="Añadiendo…"
              className="btn btn-secondary"
            >
              Añadir
            </SubmitButton>
          </div>
        </form>

        {events.length > 0 && (
          <div className="mt-6 border-t border-line">
            {events.map((event) => {
              const Icon = EVENT_TYPE_ICON[event.type];
              return (
              <div
                key={event.id}
                className="flex items-center justify-between gap-4 border-b border-line py-3"
              >
                <span className="flex items-center gap-2 font-mono text-sm">
                  <Icon className="h-4 w-4 shrink-0 text-muted" />
                  {event.date.toLocaleDateString("es-ES")} — {event.title}
                  {event.project && (
                    <span className="text-muted">({event.project.name})</span>
                  )}
                </span>
                <form action={deleteCalendarEvent.bind(null, event.id)}>
                  <DeleteButton
                    confirmMessage="¿Eliminar este evento del calendario?"
                    className="link-action"
                  />
                </form>
              </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
