import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/actions/calendar-events";
import { DeleteButton } from "@/components/DeleteButton";
import { ChipOption } from "@/components/ChipOption";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";
import { AgendaTabs } from "@/components/AgendaTabs";
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

// Color de cada tipo, para leer el mes de un vistazo. Son colores de
// categoría (como las tiras del stripboard), elegidos para contrastar en la
// mesa oscura; el rodaje no tiene color propio: va relleno con el acento,
// porque es lo que manda en el mes.
const EVENT_TYPE_COLOR: Record<CalendarEventType, string> = {
  REHEARSAL: "#7fb8e0",
  MEETING: "#e3a3c8",
  DEADLINE: "#ef7b72",
  DELIVERY: "#7cc79a",
  OTHER: "#9a99a0",
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_MS = 24 * 60 * 60 * 1000;

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

function weekdayShort(date: Date) {
  return date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
}

// «hoy», «mañana», «en 3 días» o «sáb 17 oct»: lo que se entiende sin contar.
function relativeDay(date: Date, today: Date) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - start.getTime()) / DAY_MS);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff > 1 && diff < 7) return `el ${weekdayShort(date)} ${date.getDate()} (en ${diff} días)`;
  return `el ${weekdayShort(date)} ${date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "")}`;
}

function colorVar(color: string) {
  return { "--c": color } as React.CSSProperties;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthStart = parseMonthParam(month);
  // Último día del mes (para la rejilla). Para las consultas se usa «antes del día 1
  // del mes siguiente»: con «hasta el último día a las 00:00» se perdía ese día.
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const prevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const profile = await getCurrentProfile();
  if (!profile) return null;

  const organizationId = profile.organizationId;
  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const inTwoWeeks = new Date(startOfToday.getTime() + 14 * DAY_MS);

  const [events, shootingDays, projects, nextShootingDay, upcomingDeadlines] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { organizationId, date: { gte: monthStart, lt: nextMonth } },
      orderBy: { date: "asc" },
      include: { project: true },
    }),
    prisma.shootingDay.findMany({
      where: { project: { organizationId }, date: { gte: monthStart, lt: nextMonth } },
      orderBy: { date: "asc" },
      include: { project: true },
    }),
    prisma.project.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    // Solo lectura, para la línea de estado: lo próximo que importa, aunque
    // caiga fuera del mes que se está mirando.
    prisma.shootingDay.findFirst({
      where: { project: { organizationId }, date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      include: { project: { select: { name: true } } },
    }),
    prisma.calendarEvent.findMany({
      where: {
        organizationId,
        type: { in: ["DEADLINE", "DELIVERY"] },
        date: { gte: startOfToday, lt: inTwoWeeks },
      },
      orderBy: { date: "asc" },
      select: { id: true, title: true, date: true, type: true },
    }),
  ]);

  const dayEntries = [
    ...events.map((event) => ({
      id: `event-${event.id}`,
      date: event.date,
      Icon: EVENT_TYPE_ICON[event.type],
      label: event.title,
      kind: EVENT_TYPE_LABELS[event.type],
      color: EVENT_TYPE_COLOR[event.type],
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
      color: null as string | null,
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

  const monthName = monthStart.toLocaleDateString("es-ES", { month: "long" });
  const monthTitle = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${monthStart.getFullYear()}`;
  const isCurrentMonthView = sameDay(monthStart, new Date(today.getFullYear(), today.getMonth(), 1));
  const agenda = days
    .filter((day) => day.getMonth() === monthStart.getMonth())
    .map((day) => ({
      day,
      // Rodajes primero dentro del día.
      entries: dayEntries
        .filter((entry) => sameDay(entry.date, day))
        .sort((a, b) => Number(Boolean(b.href)) - Number(Boolean(a.href))),
    }))
    .filter((d) => d.entries.length > 0);

  const shootingProjects = [...new Set(shootingDays.map((d) => d.project.name))];

  const newEventDialog = (
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
  );

  return (
    <div className="pb-16">
      <AgendaTabs active="calendario" />
      <PageHeader
        eyebrow="Organización"
        title="Calendario"
        description="Qué pasa cada día en la productora: los rodajes de todos los proyectos y los ensayos, reuniones, entregas y fechas límite."
        actions={newEventDialog}
      />

      {/* Cómo voy: lo próximo que importa, en frases. */}
      <div className="mt-8 space-y-2 font-sans text-[15px] leading-relaxed">
        <p className="text-muted">
          {nextShootingDay ? (
            <>
              Próximo rodaje{" "}
              <Link
                href={`/app/${nextShootingDay.projectId}/plan-de-rodaje/${nextShootingDay.id}`}
                className="font-medium text-fg underline decoration-accent/60 underline-offset-4 hover:text-accent"
              >
                {relativeDay(nextShootingDay.date, today)} · {nextShootingDay.project.name}
              </Link>
            </>
          ) : (
            "No hay rodajes por delante"
          )}
          <span aria-hidden> · </span>
          En {monthName}:{" "}
          <span className="text-fg">
            {shootingDays.length} {shootingDays.length === 1 ? "día de rodaje" : "días de rodaje"}
          </span>
          {shootingProjects.length > 0 && ` (${shootingProjects.join(", ")})`} y{" "}
          <span className="text-fg">
            {events.length} {events.length === 1 ? "evento" : "eventos"}
          </span>
          .
        </p>
        {upcomingDeadlines.map((deadline) => (
          <p key={deadline.id} className="border-l-2 border-warn pl-3 text-muted">
            <span className="text-fg">{deadline.title}</span> — {EVENT_TYPE_LABELS[deadline.type].toLowerCase()}{" "}
            {relativeDay(deadline.date, today)}.
          </p>
        ))}
      </div>

      <div className="mt-10 grid gap-x-10 gap-y-12 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ------------------------------------------------ mes */}
        <section aria-labelledby="mes">
          {/* Navegación del mes: el nombre manda y las flechas dicen a dónde van. */}
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/app/calendario?month=${toMonthParam(prevMonth)}`}
              className="group inline-flex min-h-10 items-center gap-2 rounded-full px-3 font-mono text-[11px] tracking-widest text-muted uppercase transition-colors hover:bg-fg/[0.06] hover:text-fg"
            >
              <span aria-hidden className="text-base leading-none">‹</span>
              <span className="hidden sm:inline">{prevMonth.toLocaleDateString("es-ES", { month: "long" })}</span>
              <span className="sr-only sm:hidden">Mes anterior</span>
            </Link>
            <div className="flex min-w-0 items-baseline gap-3">
              <h2 id="mes" className="truncate font-display text-2xl font-black tracking-tight sm:text-3xl">
                {monthTitle}
              </h2>
              {!isCurrentMonthView && (
                <Link href="/app/calendario" className="link-action shrink-0 text-accent">
                  Ir a hoy
                </Link>
              )}
            </div>
            <Link
              href={`/app/calendario?month=${toMonthParam(nextMonth)}`}
              className="group inline-flex min-h-10 items-center gap-2 rounded-full px-3 font-mono text-[11px] tracking-widest text-muted uppercase transition-colors hover:bg-fg/[0.06] hover:text-fg"
            >
              <span className="hidden sm:inline">{nextMonth.toLocaleDateString("es-ES", { month: "long" })}</span>
              <span className="sr-only sm:hidden">Mes siguiente</span>
              <span aria-hidden className="text-base leading-none">›</span>
            </Link>
          </div>

          <div className="sheet mt-4 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line">
              {WEEKDAYS.map((day, i) => (
                <p key={day} className={`eyebrow px-2 py-2 text-center sm:text-left ${i >= 5 ? "!text-fg/70" : ""}`}>
                  {day}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const isCurrentMonth = day.getMonth() === monthStart.getMonth();
                const isToday = sameDay(day, today);
                const isPast = day < startOfToday;
                const weekend = i % 7 >= 5;
                const entriesForDay = dayEntries
                  .filter((entry) => sameDay(entry.date, day))
                  .sort((a, b) => Number(Boolean(b.href)) - Number(Boolean(a.href)));
                const shooting = entriesForDay.some((e) => e.href);
                return (
                  <div
                    key={day.toISOString()}
                    className={`relative min-h-14 p-1 sm:min-h-[7.5rem] sm:p-1.5 ${i % 7 === 0 ? "" : "border-l"} ${
                      i >= 7 ? "border-t" : ""
                    } border-line ${
                      isToday
                        ? "bg-accent/[0.09]"
                        : !isCurrentMonth
                          ? "bg-bg/40"
                          : weekend
                            ? "bg-fg/[0.02]"
                            : ""
                    }`}
                  >
                    {isToday && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
                    <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                      <span
                        className={`grid h-6 min-w-6 place-items-center rounded-full px-1 font-mono text-[11px] tabular-nums ${
                          isToday
                            ? "bg-accent font-bold text-bg"
                            : shooting && isCurrentMonth
                              ? "font-bold text-accent"
                              : isCurrentMonth
                                ? isPast
                                  ? "text-muted"
                                  : "text-fg"
                                : "text-muted/40"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {isToday && (
                        <span className="hidden font-mono text-[10px] tracking-widest text-accent uppercase lg:inline">Hoy</span>
                      )}
                    </p>

                    {/* Móvil: puntos de color; el detalle está en la agenda. */}
                    {entriesForDay.length > 0 && (
                      <p className="mt-1 flex flex-wrap justify-center gap-1 sm:hidden" aria-label={entriesForDay.map((e) => `${e.kind}: ${e.label}`).join(", ")}>
                        {entriesForDay.map((entry) =>
                          entry.href ? (
                            <span key={entry.id} className="h-1.5 w-3 rounded-full bg-gel-3" />
                          ) : (
                            <span key={entry.id} style={colorVar(entry.color!)} className="h-1.5 w-1.5 rounded-full bg-[var(--c)]" />
                          ),
                        )}
                      </p>
                    )}

                    <div className={`mt-1 hidden space-y-1 sm:block ${isPast && !isToday ? "opacity-60" : ""}`}>
                      {entriesForDay.map((entry) =>
                        entry.href ? (
                          <Link
                            key={entry.id}
                            href={entry.href}
                            title={`Rodaje · ${entry.label}`}
                            className="flex items-start gap-1.5 rounded-md bg-gel-3 px-1.5 py-1 font-sans text-[11px] leading-tight font-semibold text-ink-0 transition-opacity hover:opacity-85"
                          >
                            <entry.Icon className="mt-px h-3 w-3 shrink-0" />
                            <span className="line-clamp-2">{entry.label}</span>
                          </Link>
                        ) : (
                          <p
                            key={entry.id}
                            title={`${entry.kind} · ${entry.label}`}
                            style={colorVar(entry.color!)}
                            className="flex items-start gap-1.5 rounded-md border-l-2 border-[var(--c)] bg-[color-mix(in_srgb,var(--c)_14%,transparent)] px-1.5 py-1 font-sans text-[11px] leading-tight text-fg"
                          >
                            <entry.Icon className="mt-px h-3 w-3 shrink-0 text-[var(--c)]" />
                            <span className="line-clamp-2">{entry.label}</span>
                          </p>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <ul aria-label="Leyenda" className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-sans text-[13px] text-muted">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-4 rounded-sm bg-gel-3" />
              Rodaje
            </li>
            {Object.values(CalendarEventType).map((value) => (
              <li key={value} className="flex items-center gap-1.5">
                <span aria-hidden style={colorVar(EVENT_TYPE_COLOR[value])} className="h-2.5 w-2.5 rounded-full bg-[var(--c)]" />
                {EVENT_TYPE_LABELS[value]}
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ agenda */}
        <section aria-labelledby="agenda" className="min-w-0">
          <h2 id="agenda" className="flex min-h-10 items-center font-display text-lg font-black tracking-tight uppercase">
            Agenda de {monthName}
          </h2>
          {agenda.length === 0 ? (
            <p className="mt-4 font-sans text-sm leading-relaxed text-muted">
              Nada en {monthName}. Los días de rodaje aparecen solos al crearlos en el Plan de rodaje de un proyecto;
              lo demás se añade con «Añadir evento».
            </p>
          ) : (
            <ol className="mt-4 space-y-5">
              {agenda.map(({ day, entries }) => {
                const isToday = sameDay(day, today);
                const past = day < startOfToday;
                return (
                  <li key={day.toISOString()} className={`grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 ${past ? "opacity-55" : ""}`}>
                    <div className={`pt-0.5 text-center ${isToday ? "text-accent" : ""}`}>
                      <p className="font-mono text-[10px] tracking-widest text-muted uppercase">{weekdayShort(day)}</p>
                      <p className="font-display text-2xl leading-none font-black tabular-nums">{day.getDate()}</p>
                      {isToday && <p className="mt-1 font-mono text-[10px] tracking-widest uppercase">Hoy</p>}
                    </div>
                    <ul className="min-w-0 space-y-2">
                      {entries.map((entry) =>
                        entry.href ? (
                          <li key={entry.id}>
                            <Link
                              href={entry.href}
                              className="group block rounded-lg bg-gel-3 px-3 py-2 text-ink-0 transition-opacity hover:opacity-90"
                            >
                              <span className="flex items-center gap-2 font-sans text-[14px] font-semibold">
                                <entry.Icon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">Rodaje · {entry.label}</span>
                              </span>
                              <span className="mt-0.5 block font-sans text-[12px] opacity-80">
                                Abrir el día en el Plan de rodaje →
                              </span>
                            </Link>
                          </li>
                        ) : (
                          <li
                            key={entry.id}
                            style={colorVar(entry.color!)}
                            className="flex items-start justify-between gap-2 border-l-2 border-[var(--c)] py-0.5 pl-3"
                          >
                            <span className="min-w-0">
                              <span className="block font-sans text-[14px] leading-snug">{entry.label}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 font-sans text-[12px] text-muted">
                                <entry.Icon className="h-3 w-3 shrink-0 text-[var(--c)]" />
                                <span className="truncate">
                                  {entry.kind}
                                  {entry.project ? ` · ${entry.project}` : ""}
                                </span>
                              </span>
                            </span>
                            {entry.deletableId && (
                              <form action={deleteCalendarEvent.bind(null, entry.deletableId)} className="-mt-1 shrink-0">
                                <DeleteButton
                                  confirmMessage="¿Eliminar este evento del calendario?"
                                  className="link-action !text-[10px] opacity-70 hover:opacity-100"
                                >
                                  Quitar
                                </DeleteButton>
                              </form>
                            )}
                          </li>
                        ),
                      )}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
