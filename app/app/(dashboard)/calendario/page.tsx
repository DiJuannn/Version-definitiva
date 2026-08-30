import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/actions/calendar-events";
import { CalendarEventType } from "@/lib/generated/prisma";

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  REHEARSAL: "Ensayo",
  MEETING: "Reunión",
  DEADLINE: "Fecha límite",
  DELIVERY: "Entrega",
  OTHER: "Otro",
};

const EVENT_TYPE_ICON: Record<CalendarEventType, string> = {
  REHEARSAL: "🎭",
  MEETING: "👥",
  DEADLINE: "⏰",
  DELIVERY: "📦",
  OTHER: "📅",
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
      label: `${EVENT_TYPE_ICON[event.type]} ${event.title}`,
      href: null as string | null,
      deletableId: event.id,
    })),
    ...shootingDays.map((day) => ({
      id: `day-${day.id}`,
      date: day.date,
      label: `🎬 Rodaje — ${day.project.name}`,
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

  return (
    <div>
      <Link
        href="/app"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Taller
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold uppercase">
          {monthStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
        </h1>
        <div className="flex gap-4 font-mono text-xs tracking-widest uppercase">
          <Link
            href={`/app/calendario?month=${toMonthParam(prevMonth)}`}
            className="text-muted hover:text-accent"
          >
            ← Anterior
          </Link>
          <Link
            href={`/app/calendario?month=${toMonthParam(nextMonth)}`}
            className="text-muted hover:text-accent"
          >
            Siguiente →
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 border-l border-t border-line">
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
              className={`min-h-24 border-b border-r border-line p-1.5 ${
                isCurrentMonth ? "" : "opacity-30"
              }`}
            >
              <p className="font-mono text-[10px] text-muted">{day.getDate()}</p>
              <div className="mt-1 space-y-1">
                {entriesForDay.map((entry) =>
                  entry.href ? (
                    <Link
                      key={entry.id}
                      href={entry.href}
                      className="block truncate font-mono text-[10px] hover:text-accent"
                    >
                      {entry.label}
                    </Link>
                  ) : (
                    <p key={entry.id} className="truncate font-mono text-[10px]">
                      {entry.label}
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
          <input
            name="title"
            placeholder="Título"
            required
            className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent sm:col-span-2"
          />
          <select
            name="type"
            defaultValue="OTHER"
            className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
          >
            {Object.values(CalendarEventType).map((value) => (
              <option key={value} value={value} className="bg-bg">
                {EVENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="date"
            required
            className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
          />
          <select
            name="projectId"
            defaultValue=""
            className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
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
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
            >
              Añadir
            </button>
          </div>
        </form>

        {events.length > 0 && (
          <div className="mt-6 border-t border-line">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-4 border-b border-line py-3"
              >
                <span className="font-mono text-sm">
                  {EVENT_TYPE_ICON[event.type]}{" "}
                  {event.date.toLocaleDateString("es-ES")} — {event.title}
                  {event.project && (
                    <span className="ml-1 text-muted">({event.project.name})</span>
                  )}
                </span>
                <form action={deleteCalendarEvent.bind(null, event.id)}>
                  <button
                    type="submit"
                    className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
                  >
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
