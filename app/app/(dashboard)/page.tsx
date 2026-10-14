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

  const claquetaHref = heroProject ? `/app/${heroProject.id}/claqueta` : "/app/claqueta";
  const H2 = "font-display text-xl font-black tracking-tight";

  // De arriba abajo: saludo y cifras → lo que estabas haciendo (una losa grande con el próximo
  // rodaje al lado) → avisos → tus proyectos (losas) → la semana (tareas, fechas y actividad).
  // Todo sobre la mesa; el papel solo aparece cuando hay un formulario (el primer proyecto).
  return (
    <div className="pb-8">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="flex items-center gap-4">
          <AjoloteLogo className="h-12 w-auto shrink-0 sm:h-14" priority />
          <div>
            <p className="eyebrow text-accent">{greeting(now.getHours())}</p>
            <h1 className="mt-1 font-display text-2xl font-black tracking-tight sm:text-3xl">
              {profile.organization.name}
            </h1>
          </div>
        </div>
        {heroProject && (
          <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <dt className="eyebrow">Proyectos activos</dt>
              <dd className="mt-1 font-display text-2xl font-black tabular-nums">{activeProjectsCount}</dd>
            </div>
            <div className="border-l border-line pl-8">
              <dt className="eyebrow">Gastado</dt>
              <dd className="mt-1 font-display text-2xl font-black tabular-nums">
                {currency(budgetActual)}
                <span className="ml-1.5 font-sans text-xs font-normal text-muted">de {currency(budgetPlanned)}</span>
              </dd>
            </div>
            {!isPro(profile.organization.plan) && (
              <div className="border-l border-line pl-8">
                <dt className="eyebrow">Plan gratuito</dt>
                <dd className="mt-1 font-sans text-sm">
                  {activeProjectsCount} de {FREE_ACTIVE_PROJECTS_LIMIT} proyectos ·{" "}
                  <Link href="/app/organizacion" className="text-accent hover:underline">
                    Ver PRO
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        )}
      </header>

      {!heroProject ? (
        <DashboardReveal className="sheet mx-auto mt-12 max-w-xl p-8 sm:p-10">
          <p className="eyebrow text-center text-accent">Empieza aquí</p>
          <h2 className="mt-2 text-center font-display text-2xl font-black tracking-tight sm:text-3xl">
            Crea tu primer proyecto
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-center font-sans text-sm leading-relaxed text-muted">
            Todo en Taller —guion, presupuesto, plan de rodaje— cuelga de un proyecto. Te hacemos tres
            preguntas rápidas y entras: te guiaremos paso a paso.
          </p>
          <div className="mt-8 border-t border-line pt-8">
            <NewProjectWizard />
          </div>
        </DashboardReveal>
      ) : (
        <>
          <DashboardReveal className="tile mt-10 overflow-hidden">
            <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              {/* Continuar: lo más importante de la pantalla. */}
              <div className="p-6 sm:p-8">
                <p className="eyebrow text-accent">Continuar donde lo dejaste</p>
                <h2 className="mt-2 truncate font-display text-3xl font-black tracking-tight sm:text-4xl">
                  {heroProject.name}
                </h2>
                <p className="mt-3 font-sans text-[15px] text-muted">
                  {heroCurrent ? (
                    <>
                      Siguiente paso: <span className="text-fg">{heroCurrent.title}</span>
                    </>
                  ) : (
                    "Listo para rodar: lo esencial está hecho."
                  )}
                </p>
                <div className="mt-5 flex max-w-md items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-700"
                      style={{ width: `${heroPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {heroDone}/{heroRequired.length} esenciales
                  </span>
                </div>
                <Link href={`/app/${heroProject.id}`} className="btn btn-primary mt-6">
                  Continuar →
                  <LinkPendingHint />
                </Link>
              </div>

              {/* Próximo rodaje, al lado: la otra cosa que hay que saber al entrar. */}
              <div className="border-t border-line p-6 sm:p-8 lg:border-t-0 lg:border-l">
                <p className="eyebrow">Próximo rodaje</p>
                {nextShoot ? (
                  <>
                    <p className="mt-2 font-display text-3xl font-black tracking-tight">
                      {relativeDay(nextShoot.date, now)}
                    </p>
                    <p className="mt-1 font-sans text-sm text-muted first-letter:uppercase">
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
                    <p className="mt-1 font-sans text-sm">
                      {nextShoot._count.scenes} escena{nextShoot._count.scenes === 1 ? "" : "s"} ·{" "}
                      <span className={nextShoot.callSheet ? "text-success" : "text-warn"}>
                        {nextShoot.callSheet ? "hoja de llamada lista" : "sin hoja de llamada"}
                      </span>
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/app/${nextShoot.projectId}/call-sheets/${nextShoot.id}`}
                        className="btn btn-outline btn-sm"
                      >
                        {nextShoot.callSheet ? "Ver la hoja de llamada" : "Crear la hoja de llamada"}
                        <LinkPendingHint />
                      </Link>
                      <Link
                        href={`/app/${nextShoot.projectId}/plan-de-rodaje/${nextShoot.id}`}
                        className="link-action"
                      >
                        Ver el día
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 font-display text-2xl font-black tracking-tight text-muted">Sin fecha</p>
                    <p className="mt-2 max-w-xs font-sans text-sm leading-relaxed text-muted">
                      Cuando repartas las escenas en días de rodaje, aquí verás cuándo es el próximo y si su
                      hoja de llamada está lista.
                    </p>
                    <Link href={`/app/${heroProject.id}/plan-de-rodaje`} className="link-action mt-3 !px-0 !text-accent">
                      Planificar un rodaje →
                    </Link>
                  </>
                )}
              </div>
            </div>
          </DashboardReveal>

          {/* Avisos: una línea con barra de color por cada cosa; si no hay, una sola línea tranquila. */}
          {attention.length === 0 ? (
            <p className="mt-5 flex items-center gap-2 font-sans text-sm text-muted">
              <span aria-hidden className="text-success">
                ✓
              </span>
              Todo en orden: sin tareas vencidas ni rodajes próximos sin hoja de llamada.
            </p>
          ) : (
            <section aria-label="Requiere atención" className="mt-6">
              <p className="eyebrow">Requiere atención</p>
              <ul className="mt-3 space-y-2">
                {attention.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`group flex items-center justify-between gap-3 border-l-2 py-1.5 pl-3 font-sans text-sm ${
                        item.tone === "danger" ? "border-danger" : "border-warn"
                      }`}
                    >
                      <span className="transition-colors group-hover:text-accent">{item.text}</span>
                      <span aria-hidden className="text-muted group-hover:text-accent">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Siempre visible, incluso sin proyectos todavía — quien es nuevo
          también tiene que poder entrar a la Claqueta, y de ahí se le
          ofrece crear su primer proyecto (ver /app/claqueta). */}
      <div className="relative mt-6 flex items-center gap-3 border-y border-line py-3">
        <Link href={claquetaHref} className="group flex min-w-0 flex-1 items-center gap-3">
          <ClaquetaIcon className="h-5 w-5 shrink-0 text-accent" />
          <span className="min-w-0 font-sans text-sm">
            <span className="font-semibold transition-colors group-hover:text-accent">Claqueta digital</span>
            <span className="text-muted"> · {heroProject ? heroProject.name : "elige o crea un proyecto"}</span>
          </span>
        </Link>
        <Link href={claquetaHref} className="link-action shrink-0">
          Abrir →
          <LinkPendingHint />
        </Link>
        {recentProjects.length > 1 && (
          <details className="group/menu shrink-0">
            <summary
              aria-label="Abrir la claqueta de otro proyecto"
              className="flex min-h-9 min-w-9 cursor-pointer list-none items-center justify-center rounded-full text-muted hover:bg-fg/5 hover:text-accent [&::-webkit-details-marker]:hidden"
            >
              ▾
            </summary>
            <div className="sheet absolute top-full right-0 z-20 mt-1 w-64 py-1.5">
              <p className="px-4 py-1.5 font-sans text-xs text-muted">Abrir la claqueta de otro proyecto</p>
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/app/${project.id}/claqueta`}
                  className="block px-4 py-2 font-sans text-sm transition-colors hover:bg-bg hover:text-accent"
                >
                  {project.name}
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>

      {recentProjects.length > 0 && (
        <DashboardReveal className="mt-14" delay={0.1}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className={H2}>Tus proyectos</h2>
            <div className="flex items-center gap-4">
              <Link href="/app/proyectos" className="link-action">
                Ver todos →
              </Link>
              <NewProjectPanel className="btn btn-outline btn-sm" />
            </div>
          </div>
          <DashboardStagger className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => {
              const isOwnProject = project.organizationId === organizationId;
              const ownerLabel =
                project.createdBy?.fullName ?? project.createdBy?.email ?? project.organization.name;
              const p = progress[project.id];
              const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div
                  key={project.id}
                  className="tile group relative transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--accent)]"
                >
                  <Link href={`/app/${project.id}`} className="block p-5 pr-20">
                    <p className="truncate font-display text-lg font-black tracking-tight transition-colors group-hover:text-accent">
                      {project.name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill status={project.status} />
                      {!isOwnProject && (
                        <span className="font-sans text-xs text-muted">· de {ownerLabel}</span>
                      )}
                    </div>
                    {p && (
                      <div className="mt-5 flex items-center gap-3">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-muted">
                          {p.done}/{p.total}
                        </span>
                      </div>
                    )}
                  </Link>
                  {isOwnProject && (
                    <div className="absolute top-3 right-3 flex items-center">
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
        </DashboardReveal>
      )}

      {/* La semana: tres columnas de filas sobre la mesa. */}
      <DashboardReveal
        className="mt-14 grid gap-x-12 gap-y-12 border-t border-line pt-10 md:grid-cols-2 xl:grid-cols-3"
        delay={0.15}
      >
        <section aria-labelledby="home-tasks">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="home-tasks" className={H2}>
              Tareas pendientes
            </h2>
            <Link href="/app/tareas" className="link-action">
              Ver todas →
            </Link>
          </div>
          {pendingTasks.length === 0 ? (
            <p className="mt-4 border-t border-line pt-4 font-sans text-sm text-muted">
              Nada pendiente. Las tareas de todos tus proyectos aparecerán aquí.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {pendingTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-2">
                  <TaskCheck taskId={task.id} done={false} title={task.title} />
                  <Link
                    href={`/app/tareas/${task.id}`}
                    className="min-w-0 flex-1 py-1 font-sans text-sm transition-colors hover:text-accent"
                  >
                    <span className="block truncate">{task.title}</span>
                    {(task.project || task.dueDate) && (
                      <span className="block truncate text-xs text-muted">
                        {[
                          task.project?.name,
                          task.dueDate?.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="home-agenda">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="home-agenda" className={H2}>
              Próximos 14 días
            </h2>
            <Link href="/app/calendario" className="link-action">
              Calendario →
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="mt-4 border-t border-line pt-4 font-sans text-sm text-muted">
              Sin rodajes, ensayos ni entregas en las próximas dos semanas.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <Link href={event.href} className="group flex items-start gap-4 py-3">
                    <span className="w-10 shrink-0 text-center">
                      <span className="block font-display text-lg leading-none font-black">
                        {event.date.getDate()}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] tracking-widest text-muted uppercase">
                        {event.date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}
                      </span>
                    </span>
                    <span className="min-w-0 font-sans text-sm">
                      <span className="block truncate transition-colors group-hover:text-accent">{event.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {event.typeLabel}
                        {event.projectName ? ` · ${event.projectName}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="home-activity">
          <h2 id="home-activity" className={H2}>
            Actividad reciente
          </h2>
          {activity.length === 0 ? (
            <p className="mt-4 border-t border-line pt-4 font-sans text-sm text-muted">
              Aquí verás los cambios de tu equipo en cualquier proyecto.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {activity.map((entry) => (
                <li key={entry.id} className="py-3 font-sans text-sm leading-snug text-muted">
                  <span className="font-semibold text-fg">
                    {entry.user?.fullName ?? entry.user?.email ?? "Alguien"}
                  </span>{" "}
                  {entry.summary} en{" "}
                  <Link
                    href={`/app/${entry.project.id}`}
                    className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent"
                  >
                    {entry.project.name}
                  </Link>
                  <span className="mt-0.5 block font-mono text-[11px]">{relativeTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DashboardReveal>
    </div>
  );
}
