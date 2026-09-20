import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { CalendarEventType, ProjectStatus, TaskStatus } from "@/lib/generated/prisma";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { ClaquetaIcon } from "@/components/ToolIcons";
import { StatusPill } from "@/components/StatusPill";
import { DashboardReveal, DashboardStagger } from "@/components/DashboardMotion";
import { deleteProject } from "@/lib/actions/projects";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { ProjectShareButton } from "@/components/ProjectShareButton";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { NewProjectPanel } from "@/components/NewProjectPanel";
import { LinkPendingHint } from "@/components/LinkPendingHint";
import { TaskCheck } from "@/components/TaskCheck";
import { getProjectOverview } from "@/lib/project-roadmap";
import { getProjectsProgress } from "@/lib/projects-progress";
import { isPro } from "@/lib/plan";
import { FREE_ACTIVE_PROJECTS_LIMIT } from "@/lib/limits";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
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

function daysUntil(date: Date, now: Date): number {
  return Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

function relativeDay(date: Date, now: Date): string {
  const days = daysUntil(date, now);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

function relativeTime(date: Date): string {
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

type AttentionItem = { id: string; tone: "warn" | "danger"; text: string; href: string };

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const organizationId = profile.organizationId;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inOneWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const activeProject = { organizationId, status: { not: ProjectStatus.FINISHED } };

  const [
    recentProjects,
    lastVisitedProject,
    activeProjectsCount,
    nextShoot,
    upcomingShootingDays,
    shootsWithoutSheet,
    overdueTasks,
    pendingTasks,
    calendarEvents,
    budgetCategories,
    activity,
    origin,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ organizationId }, { shares: { some: { userId: profile.id } } }] },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        status: true,
        budgetTarget: true,
        organizationId: true,
        organization: { select: { name: true } },
        createdBy: { select: { fullName: true, email: true } },
        shares: {
          orderBy: { createdAt: "desc" },
          select: { id: true, token: true, acceptedAt: true, user: { select: { email: true } } },
        },
      },
    }),
    // "Continuar" refleja el último proyecto en el que estuviste de verdad
    // (getProjectForCurrentUser lo apunta al entrar en cualquier página).
    profile.lastVisitedProjectId
      ? prisma.project.findFirst({
          where: {
            id: profile.lastVisitedProjectId,
            OR: [{ organizationId }, { shares: { some: { userId: profile.id } } }],
          },
          select: { id: true, name: true, budgetTarget: true },
        })
      : Promise.resolve(null),
    prisma.project.count({ where: activeProject }),
    prisma.shootingDay.findFirst({
      where: { project: { organizationId }, date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        projectId: true,
        project: { select: { name: true } },
        callSheet: { select: { id: true } },
        _count: { select: { scenes: true } },
      },
    }),
    prisma.shootingDay.findMany({
      where: { project: { organizationId }, date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      take: 5,
      select: { id: true, date: true, projectId: true, project: { select: { name: true } } },
    }),
    prisma.shootingDay.findMany({
      where: {
        project: activeProject,
        date: { gte: startOfToday, lte: inOneWeek },
        callSheet: null,
      },
      orderBy: { date: "asc" },
      take: 3,
      select: { id: true, date: true, projectId: true, project: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { organizationId, status: { not: TaskStatus.DONE }, dueDate: { lt: startOfToday } },
      orderBy: { dueDate: "asc" },
      take: 4,
      select: { id: true, title: true, dueDate: true, project: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { organizationId, status: { not: TaskStatus.DONE } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, title: true, dueDate: true, project: { select: { name: true } } },
    }),
    prisma.calendarEvent.findMany({
      where: { organizationId, date: { gte: now, lte: twoWeeksOut } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        date: true,
        project: { select: { name: true } },
      },
    }),
    // Solo las cifras de los proyectos activos: previsto (cantidad × precio
    // × IVA) y gasto real (lo que se ha marcado como gastado).
    prisma.budgetCategory.findMany({
      where: { project: activeProject },
      select: {
        items: {
          select: { quantity: true, unitPrice: true, taxRate: true, actualAmount: true },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: { project: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        summary: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        user: { select: { fullName: true, email: true } },
      },
    }),
    headers().then((h) => h.get("origin") ?? ""),
  ]);

  let budgetPlanned = 0;
  let budgetActual = 0;
  for (const category of budgetCategories) {
    for (const item of category.items) {
      budgetPlanned +=
        Number(item.quantity) * Number(item.unitPrice) * (1 + Number(item.taxRate) / 100);
      if (item.actualAmount !== null) budgetActual += Number(item.actualAmount);
    }
  }

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

  const attention: AttentionItem[] = [
    ...shootsWithoutSheet.map((day) => {
      const n = daysUntil(day.date, now);
      return {
        id: `sheet-${day.id}`,
        tone: "warn" as const,
        text: `${day.project.name}: rodaje ${n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`} sin call sheet`,
        href: `/app/${day.projectId}/call-sheets/${day.id}`,
      };
    }),
    ...overdueTasks.map((task) => ({
      id: `task-${task.id}`,
      tone: "danger" as const,
      text: `Tarea vencida: ${task.title}${task.project ? ` (${task.project.name})` : ""}`,
      href: `/app/tareas/${task.id}`,
    })),
  ];

  const heroProject = lastVisitedProject ?? recentProjects[0] ?? null;
  const [heroOverview, progress] = await Promise.all([
    heroProject
      ? getProjectOverview(
          heroProject.id,
          heroProject.budgetTarget !== null ? Number(heroProject.budgetTarget) : null,
        )
      : Promise.resolve(null),
    getProjectsProgress(recentProjects.map((p) => p.id)),
  ]);
  const heroRequired = heroOverview?.steps.filter((s) => s.required) ?? [];
  const heroDone = heroRequired.filter((s) => s.isDone).length;
  const heroCurrent = heroRequired.find((s) => !s.isDone) ?? null;
  const heroPct =
    heroRequired.length > 0 ? Math.round((heroDone / heroRequired.length) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-4">
        <AjoloteLogo className="h-12 w-auto shrink-0 sm:h-14" priority />
        <div>
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            {greeting(now.getHours())}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">
            {profile.organization.name}
          </h1>
        </div>
      </div>

      {!heroProject ? (
        <DashboardReveal className="mt-8 border border-accent/50 bg-gradient-to-br from-accent-purple/30 via-bg-raised to-bg p-8 text-center sm:p-12">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">Empieza aquí</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            Crea tu primer proyecto
          </h2>
          <p className="mx-auto mt-3 max-w-sm font-sans text-sm text-muted">
            Todo en Taller —guion, presupuesto, plan de rodaje— cuelga de un proyecto. Te hacemos tres
            preguntas rápidas y entras: te guiaremos paso a paso.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <NewProjectWizard />
          </div>
        </DashboardReveal>
      ) : (
        <>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <DashboardReveal className="border border-line bg-bg-raised/40 p-6">
              <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
                Próximo rodaje
              </p>
              {nextShoot ? (
                <>
                  <p className="mt-3 font-display text-4xl font-black">
                    {relativeDay(nextShoot.date, now)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {nextShoot.date.toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    ·{" "}
                    <Link
                      href={`/app/${nextShoot.projectId}`}
                      className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent"
                    >
                      {nextShoot.project.name}
                    </Link>
                  </p>
                  <p className="mt-2 font-mono text-xs">
                    {nextShoot._count.scenes} escena{nextShoot._count.scenes === 1 ? "" : "s"} ·{" "}
                    <span className={nextShoot.callSheet ? "text-success" : "text-warn"}>
                      {nextShoot.callSheet ? "call sheet creado" : "call sheet sin crear"}
                    </span>
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/app/${nextShoot.projectId}/call-sheets/${nextShoot.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      {nextShoot.callSheet ? "Ver call sheet" : "Crear call sheet"}
                      <LinkPendingHint />
                    </Link>
                    <Link
                      href={`/app/${nextShoot.projectId}/plan-de-rodaje/${nextShoot.id}`}
                      className="btn btn-outline btn-sm"
                    >
                      Ver el día
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 font-display text-2xl font-bold text-muted">
                    Sin rodajes planificados
                  </p>
                  <p className="mt-2 font-sans text-sm text-muted">
                    Cuando repartas las escenas en días de rodaje, aquí verás cuándo es el
                    próximo y si su call sheet está listo.
                  </p>
                  <Link
                    href={`/app/${heroProject.id}/plan-de-rodaje`}
                    className="btn btn-outline btn-sm mt-4"
                  >
                    Planificar un rodaje
                  </Link>
                </>
              )}
            </DashboardReveal>

            <DashboardReveal
              className="border border-line bg-bg-raised/40 p-6"
              delay={0.05}
            >
              <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
                Requiere atención
              </p>
              {attention.length === 0 ? (
                <p className="mt-3 flex items-start gap-2 font-sans text-sm text-muted">
                  <span aria-hidden className="mt-0.5 text-success">
                    ✓
                  </span>
                  Todo en orden: sin tareas vencidas ni rodajes próximos sin call sheet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {attention.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="group flex items-start gap-2.5 py-1 font-mono text-xs"
                      >
                        <span
                          aria-hidden
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                            item.tone === "danger" ? "bg-danger" : "bg-warn"
                          }`}
                        />
                        <span className="transition-colors group-hover:text-accent">
                          {item.text}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardReveal>
          </div>

          <DashboardReveal
            className="mt-4 border border-accent/40 bg-gradient-to-br from-accent-purple/40 via-bg-raised to-bg p-6 sm:p-8"
            delay={0.1}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
                  Continuar
                </p>
                <h2 className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl">
                  {heroProject.name}
                </h2>
                <p className="mt-1 font-mono text-xs text-muted">
                  {heroCurrent
                    ? `Siguiente: ${heroCurrent.title}`
                    : "Listo para rodar: pasos requeridos completados"}
                  {" · "}
                  {heroDone}/{heroRequired.length} requeridos
                </p>
              </div>
              <Link href={`/app/${heroProject.id}`} className="btn btn-primary shrink-0">
                Continuar →
                <LinkPendingHint />
              </Link>
            </div>
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-700"
                style={{ width: `${heroPct}%` }}
              />
            </div>
          </DashboardReveal>
        </>
      )}

      {/* Siempre visible, incluso sin proyectos todavía — quien es nuevo
          también tiene que poder entrar a la Claqueta, y de ahí se le
          ofrece crear su primer proyecto (ver /app/claqueta). */}
      <DashboardReveal delay={0.12}>
        <div className="group relative mt-3 flex items-center gap-3 border border-line bg-bg-raised/40 px-5 py-3.5 transition-colors hover:border-accent/60">
          <Link
            href={heroProject ? `/app/${heroProject.id}/claqueta` : "/app/claqueta"}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <ClaquetaIcon className="h-5 w-5 shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block font-mono text-xs tracking-widest uppercase transition-colors group-hover:text-accent">
                Claqueta digital
              </span>
              <span className="block truncate font-mono text-[10px] text-muted">
                {heroProject ? heroProject.name : "Elige o crea un proyecto"}
              </span>
            </span>
          </Link>
          <Link
            href={heroProject ? `/app/${heroProject.id}/claqueta` : "/app/claqueta"}
            className="link-action shrink-0"
          >
            Abrir →
            <LinkPendingHint />
          </Link>
          {recentProjects.length > 1 && (
            <details className="shrink-0">
              <summary
                aria-label="Abrir la claqueta de otro proyecto"
                className="flex min-h-9 min-w-9 cursor-pointer list-none items-center justify-center text-muted hover:text-accent [&::-webkit-details-marker]:hidden"
              >
                ▾
              </summary>
              <div className="absolute right-0 top-full z-20 mt-1 w-56 border border-line bg-bg-raised py-1 shadow-lg">
                <p className="px-3 py-1.5 font-mono text-[9px] tracking-widest text-muted uppercase">
                  Abrir la claqueta de otro proyecto
                </p>
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/app/${project.id}/claqueta`}
                    className="block px-3 py-2.5 font-mono text-xs text-muted hover:bg-bg hover:text-accent"
                  >
                    {project.name}
                  </Link>
                ))}
              </div>
            </details>
          )}
        </div>
      </DashboardReveal>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-line py-3 sm:mt-8">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold">{activeProjectsCount}</span>
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Proyectos activos
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold">{currency(budgetActual)}</span>
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Gastado de {currency(budgetPlanned)} previstos
          </span>
        </div>
        {!isPro(profile.organization.plan) && (
          <Link
            href="/app/organizacion"
            className="ml-auto flex items-baseline gap-2 transition-colors hover:text-accent"
          >
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Plan gratuito: {activeProjectsCount} de {FREE_ACTIVE_PROJECTS_LIMIT} proyectos ·
              Ver PRO
            </span>
          </Link>
        )}
      </div>

      <DashboardReveal className="mt-8" delay={0.15}>
        <NewProjectPanel hasProjects={recentProjects.length > 0} />
        {recentProjects.length > 0 && (
          <DashboardStagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => {
              const isOwnProject = project.organizationId === organizationId;
              const ownerLabel =
                project.createdBy?.fullName ?? project.createdBy?.email ?? project.organization.name;
              const p = progress[project.id];
              const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div
                  key={project.id}
                  className="group relative border border-line bg-bg-raised/40 p-4 transition-colors hover:border-accent/60"
                >
                  <Link href={`/app/${project.id}`} className="block pr-14">
                    <p className="font-display text-base font-bold transition-colors group-hover:text-accent">
                      {project.name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill status={project.status} />
                      {!isOwnProject && (
                        <span className="font-mono text-[10px] text-muted">
                          Propietario: {ownerLabel}
                        </span>
                      )}
                    </div>
                    {p && (
                      <div className="mt-3">
                        <div className="h-1 w-full bg-line">
                          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-muted">
                          {p.done}/{p.total} pasos requeridos
                        </p>
                      </div>
                    )}
                  </Link>
                  {isOwnProject && (
                    <div className="absolute right-1 top-1 flex items-center">
                      <ProjectShareButton
                        projectId={project.id}
                        origin={origin}
                        shares={project.shares.map((s) => ({
                          id: s.id,
                          token: s.token,
                          acceptedAt: s.acceptedAt ? s.acceptedAt.toISOString() : null,
                          userEmail: s.user?.email ?? null,
                        }))}
                      />
                      <DeleteProjectButton
                        projectName={project.name}
                        action={deleteProject.bind(null, project.id)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </DashboardStagger>
        )}
      </DashboardReveal>

      <div className="mt-8 grid gap-4 sm:mt-10 lg:grid-cols-2">
        <DashboardReveal className="border border-line bg-bg-raised/40 p-5" delay={0.18}>
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Agenda</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  Tareas pendientes
                </p>
                <Link href="/app/tareas" className="link-action">
                  Ver todas →
                </Link>
              </div>
              {pendingTasks.length === 0 ? (
                <p className="mt-3 font-sans text-sm text-muted">Sin tareas pendientes.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {pendingTasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2.5">
                      <TaskCheck taskId={task.id} done={false} title={task.title} />
                      <Link
                        href={`/app/tareas/${task.id}`}
                        className="min-w-0 flex-1 truncate py-1.5 font-mono text-xs hover:text-accent"
                      >
                        {task.title}
                        {task.project && (
                          <span className="text-muted"> — {task.project.name}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  Próximos 14 días
                </p>
                <Link href="/app/calendario" className="link-action">
                  Calendario →
                </Link>
              </div>
              {upcomingEvents.length === 0 ? (
                <p className="mt-3 font-sans text-sm text-muted">
                  Sin eventos ni rodajes en los próximos 14 días.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {upcomingEvents.map((event) => (
                    <li key={event.id}>
                      <Link
                        href={event.href}
                        className="group flex items-start gap-2 py-1.5 font-mono text-xs"
                      >
                        <span className="w-12 shrink-0 text-muted">
                          {event.date
                            .toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
                            .toUpperCase()}
                        </span>
                        <span className="group-hover:text-accent">
                          <span className="text-muted">{event.typeLabel} · </span>
                          {event.title}
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

        <DashboardReveal className="border border-line bg-bg-raised/40 p-5" delay={0.2}>
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            Actividad reciente
          </p>
          {activity.length === 0 ? (
            <p className="mt-4 font-sans text-sm text-muted">
              Aquí verás los cambios de tu equipo en cualquier proyecto.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {activity.map((entry) => (
                <li key={entry.id} className="font-mono text-xs text-muted">
                  <span className="text-fg">
                    {entry.user?.fullName ?? entry.user?.email ?? "Alguien"}
                  </span>{" "}
                  {entry.summary} en{" "}
                  <Link
                    href={`/app/${entry.project.id}`}
                    className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent"
                  >
                    {entry.project.name}
                  </Link>{" "}
                  · {relativeTime(entry.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </DashboardReveal>
      </div>
    </div>
  );
}
