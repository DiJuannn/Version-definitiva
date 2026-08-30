import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { CalendarEventType, ProjectStatus, TaskStatus } from "@/lib/generated/prisma";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { StatusPill } from "@/components/StatusPill";
import { DashboardReveal, DashboardStagger } from "@/components/DashboardMotion";
import { createProject } from "@/lib/actions/projects";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

const CALENDAR_EVENT_LABELS: Record<CalendarEventType, string> = {
  REHEARSAL: "Ensayo",
  MEETING: "Reunión",
  DEADLINE: "Fecha límite",
  DELIVERY: "Entrega",
  OTHER: "Evento",
};

function relativeDay(date: Date, now: Date): string {
  const days = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const organizationId = profile.organizationId;
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [recentProjects, activeProjectsCount, upcomingShootingDays, pendingTasks, calendarEvents, budgetCategories] =
    await Promise.all([
      prisma.project.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.project.count({
        where: { organizationId, status: { not: ProjectStatus.FINISHED } },
      }),
      prisma.shootingDay.findMany({
        where: { project: { organizationId }, date: { gte: now } },
        orderBy: { date: "asc" },
        take: 5,
        include: { project: true, scenes: { include: { scene: true } } },
      }),
      prisma.task.findMany({
        where: { organizationId, status: { not: TaskStatus.DONE } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 6,
        include: { project: true },
      }),
      prisma.calendarEvent.findMany({
        where: { organizationId, date: { gte: now, lte: twoWeeksOut } },
        orderBy: { date: "asc" },
        include: { project: true },
      }),
      prisma.budgetCategory.findMany({
        where: { project: { organizationId } },
        include: { items: true },
      }),
    ]);

  const budgetTotal = budgetCategories.reduce((sum, category) => {
    const categoryTotal = category.items.reduce((itemSum, item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate);
      return itemSum + quantity * unitPrice * (1 + taxRate / 100);
    }, 0);
    return sum + categoryTotal;
  }, 0);

  const upcomingEvents = [
    ...calendarEvents.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      typeLabel: CALENDAR_EVENT_LABELS[event.type],
      date: event.date,
      projectName: event.project?.name ?? null,
      href: "/app/calendario",
    })),
    ...upcomingShootingDays.map((day) => ({
      id: `day-${day.id}`,
      title: day.project.name,
      typeLabel: "Rodaje",
      date: day.date,
      projectName: null as string | null,
      href: `/app/${day.projectId}/plan-de-rodaje/${day.id}`,
    })),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  const nextShoot = upcomingShootingDays[0];

  return (
    <div>
      <div className="flex items-center gap-4">
        <AjoloteLogo className="h-11 w-auto shrink-0" />
        <div>
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Taller
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold uppercase sm:text-3xl">
            {profile.organization.name}
          </h1>
        </div>
      </div>

      <DashboardStagger className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="border border-line p-5 transition-colors hover:border-accent/50">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Proyectos activos
          </p>
          <p className="mt-2 font-display text-3xl font-bold">
            {activeProjectsCount}
          </p>
        </div>

        <div className="border border-line p-5 transition-colors hover:border-accent/50">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Próximo rodaje
          </p>
          {nextShoot ? (
            <Link href={`/app/${nextShoot.projectId}/plan-de-rodaje/${nextShoot.id}`}>
              <p className="mt-2 font-display text-3xl font-bold text-accent">
                {relativeDay(nextShoot.date, now)}
              </p>
              <p className="mt-1 font-mono text-xs text-muted">
                {nextShoot.project.name} · {nextShoot.scenes.length} escena
                {nextShoot.scenes.length === 1 ? "" : "s"}
              </p>
            </Link>
          ) : (
            <p className="mt-2 font-mono text-sm text-muted">
              Sin rodajes planificados
            </p>
          )}
        </div>

        <div className="border border-line p-5 transition-colors hover:border-accent/50">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Presupuesto general
          </p>
          <p className="mt-2 font-display text-3xl font-bold">
            {currency(budgetTotal)}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">
            Suma de todos los proyectos
          </p>
        </div>
      </DashboardStagger>

      <DashboardReveal className="mt-10" delay={0.1}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
            Proyectos recientes
          </p>
          <div className="flex items-center gap-4">
            <details className="group relative">
              <summary className="cursor-pointer list-none font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent [&::-webkit-details-marker]:hidden">
                + Nuevo proyecto
              </summary>
              <form
                action={createProject}
                className="absolute right-0 z-10 mt-2 flex w-64 gap-2 border border-line bg-bg p-3"
              >
                <input
                  name="name"
                  placeholder="Nombre del proyecto"
                  required
                  autoFocus
                  className="w-full border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-fg px-4 py-1.5 font-mono text-[10px] tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                >
                  Crear
                </button>
              </form>
            </details>
            <Link
              href="/app/proyectos"
              className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
            >
              Ver todos →
            </Link>
          </div>
        </div>
        {recentProjects.length === 0 ? (
          <p className="mt-4 font-mono text-sm text-muted">
            Todavía no hay proyectos. Pulsa &ldquo;+ Nuevo proyecto&rdquo;
            arriba para crear el primero.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/app/${project.id}`}
                className="group border border-line p-4 transition-colors hover:border-accent"
              >
                <p className="font-display text-sm font-bold uppercase transition-colors group-hover:text-accent">
                  {project.name}
                </p>
                <div className="mt-2">
                  <StatusPill status={project.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </DashboardReveal>

      <DashboardReveal className="mt-10 border border-line p-5" delay={0.18}>
        <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
          Agenda
        </p>
        <div className="mt-5 grid gap-8 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                Tareas pendientes
              </p>
              <Link
                href="/app/tareas"
                className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
              >
                Ver todas →
              </Link>
            </div>
            {pendingTasks.length === 0 ? (
              <p className="mt-3 font-mono text-sm text-muted">
                Sin tareas pendientes.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {pendingTasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/app/tareas/${task.id}`}
                      className="group flex items-start gap-2 font-mono text-xs"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full border border-muted" />
                      <span className="group-hover:text-accent">
                        {task.title}
                        {task.project && (
                          <span className="text-muted"> — {task.project.name}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                Próximos eventos
              </p>
              <Link
                href="/app/calendario"
                className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
              >
                Calendario →
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="mt-3 font-mono text-sm text-muted">
                Sin eventos en los próximos 14 días.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {upcomingEvents.map((event) => (
                  <li key={event.id}>
                    <Link
                      href={event.href}
                      className="group flex items-start gap-2 font-mono text-xs"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full border border-muted" />
                      <span className="group-hover:text-accent">
                        <span className="text-muted">
                          {event.date
                            .toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
                            .toUpperCase()}
                        </span>{" "}
                        · {event.typeLabel} — {event.title}
                        {event.projectName && (
                          <span className="text-muted"> ({event.projectName})</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DashboardReveal>
    </div>
  );
}
