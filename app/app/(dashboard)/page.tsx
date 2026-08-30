import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { CalendarEventType, ProjectStatus, TaskStatus } from "@/lib/generated/prisma";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { StatusPill } from "@/components/StatusPill";
import { DashboardReveal, DashboardStagger } from "@/components/DashboardMotion";
import { createProject, deleteProject } from "@/lib/actions/projects";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { getProjectOverview } from "@/lib/project-roadmap";

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

function greeting(hour: number): string {
  if (hour < 6) return "Buenas noches";
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

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
  const heroProject = recentProjects[0] ?? null;
  const heroOverview = heroProject
    ? await getProjectOverview(
        heroProject.id,
        heroProject.budgetTarget !== null ? Number(heroProject.budgetTarget) : null,
      )
    : null;
  const heroDone = heroOverview?.steps.filter((s) => s.isDone).length ?? 0;
  const heroTotal = heroOverview?.steps.length ?? 0;
  const heroCurrent = heroOverview?.steps.find((s) => !s.isDone) ?? null;
  const heroProgressPct = heroTotal > 0 ? Math.round((heroDone / heroTotal) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-5">
        <AjoloteLogo className="h-16 w-auto shrink-0 sm:h-20" priority />
        <div>
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            {greeting(now.getHours())}
          </p>
          <h1 className="mt-0.5 font-display text-3xl font-bold uppercase sm:text-4xl">
            {profile.organization.name}
          </h1>
        </div>
      </div>

      {!heroProject ? (
        <DashboardReveal className="mt-8 border border-accent p-8 text-center sm:p-12">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Empieza aquí
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold uppercase sm:text-3xl">
            Crea tu primer proyecto
          </h2>
          <p className="mx-auto mt-3 max-w-sm font-sans text-sm text-muted">
            Todo en Taller —guion, presupuesto, plan de rodaje— cuelga de un
            proyecto. Empieza dándole un nombre.
          </p>
          <form
            action={createProject}
            className="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:flex-row"
          >
            <input
              name="name"
              placeholder="Nombre del proyecto"
              required
              autoFocus
              className="w-full border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-accent px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
            >
              Crear
            </button>
          </form>
        </DashboardReveal>
      ) : (
        <DashboardReveal className="mt-8 border border-accent p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs tracking-widest text-accent uppercase">
                Continuar
              </p>
              <h2 className="mt-1 truncate font-display text-2xl font-bold uppercase sm:text-3xl">
                {heroProject.name}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted">
                {heroCurrent
                  ? `Siguiente: ${heroCurrent.title}`
                  : "Todos los pasos clave completados"}
                {" · "}
                {heroDone}/{heroTotal} pasos
              </p>
            </div>
            <Link
              href={`/app/${heroProject.id}`}
              className="shrink-0 rounded-full bg-accent px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
            >
              Continuar →
            </Link>
          </div>
          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700"
              style={{ width: `${heroProgressPct}%` }}
            />
          </div>
        </DashboardReveal>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-line py-3 sm:mt-8">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold">{activeProjectsCount}</span>
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Proyectos activos
          </span>
        </div>
        {nextShoot ? (
          <Link
            href={`/app/${nextShoot.projectId}/plan-de-rodaje/${nextShoot.id}`}
            className="flex items-baseline gap-2 transition-colors hover:text-accent"
          >
            <span className="font-display text-xl font-bold text-accent">
              {relativeDay(nextShoot.date, now)}
            </span>
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Próximo rodaje · {nextShoot.project.name}
            </span>
          </Link>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-muted">—</span>
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Sin rodajes planificados
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold">{currency(budgetTotal)}</span>
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Presupuesto general
          </span>
        </div>
      </div>

      <DashboardReveal className="mt-8" delay={0.1}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
            Proyectos recientes
          </p>
          <div className="flex items-center gap-4">
            {recentProjects.length > 0 && (
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
            )}
            <Link
              href="/app/proyectos"
              className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
            >
              Ver todos →
            </Link>
          </div>
        </div>
        {recentProjects.length > 0 && (
          <DashboardStagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="group relative border border-line p-4 transition-colors hover:border-accent"
              >
                <Link href={`/app/${project.id}`} className="block pr-6">
                  <p className="font-display text-sm font-bold uppercase transition-colors group-hover:text-accent">
                    {project.name}
                  </p>
                  <div className="mt-2">
                    <StatusPill status={project.status} />
                  </div>
                </Link>
                <div className="absolute right-2 top-2">
                  <DeleteProjectButton
                    projectName={project.name}
                    action={deleteProject.bind(null, project.id)}
                  />
                </div>
              </div>
            ))}
          </DashboardStagger>
        )}
      </DashboardReveal>

      <DashboardReveal className="mt-8 border border-line p-4 sm:mt-10 sm:p-5" delay={0.18}>
        <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
          Agenda
        </p>
        <div className="mt-4 grid gap-6 sm:mt-5 sm:grid-cols-2 sm:gap-8">
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
