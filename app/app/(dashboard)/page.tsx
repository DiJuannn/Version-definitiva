import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { CalendarEventType, ProjectStatus, TaskStatus } from "@/lib/generated/prisma";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { ClaquetaIcon } from "@/components/ToolIcons";
import { StatusPill } from "@/components/StatusPill";
import { SectionHeading } from "@/components/SectionHeading";
import { SceneTag, sceneStripColor } from "@/components/SceneTag";
import { PersonInitials } from "@/components/PersonInitials";
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
        shareToken: true,
        project: { select: { name: true } },
        callSheet: { select: { id: true, generalCallTime: true } },
        scenes: {
          orderBy: { order: "asc" },
          select: {
            scene: { select: { number: true, intExt: true, dayPart: true, location: { select: { name: true } } } },
          },
        },
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
        text: `${day.project.name}: rodaje ${n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`} sin hoja de llamada`,
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

  const todayLabel = now.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  });
  const shootScenes = nextShoot?.scenes.map((s) => s.scene) ?? [];
  const shootLocations = [...new Set(shootScenes.map((s) => s.location?.name).filter(Boolean))];
  const shootIn = nextShoot ? daysUntil(nextShoot.date, now) : null;
  const budgetPct = budgetPlanned > 0 ? Math.min(100, Math.round((budgetActual / budgetPlanned) * 100)) : 0;

  return (
    <div>
      {/* Saludo y fecha */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <AjoloteLogo className="h-11 w-auto shrink-0" priority />
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            {greeting(now.getHours())} · <span className="first-letter:uppercase">{todayLabel}</span>
          </p>
          <h1 className="mt-0.5 truncate font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
            {profile.organization.name}
          </h1>
        </div>
      </div>

      {!heroProject ? (
        <DashboardReveal className="mt-8 rounded-2xl border border-accent/50 bg-gradient-to-br from-accent-purple/30 via-bg-raised to-bg p-8 text-center sm:p-12">
          <p className="text-[13px] text-accent">Empieza aquí</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Crea tu primer proyecto</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
            Todo en Taller —guion, presupuesto, plan de rodaje— cuelga de un proyecto. Te hacemos tres
            preguntas rápidas y entras: te guiaremos paso a paso.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <NewProjectWizard />
          </div>
        </DashboardReveal>
      ) : (
        <div className="mt-7 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Próximo rodaje */}
          <DashboardReveal className="flex flex-col rounded-2xl border border-line bg-bg-raised p-5 sm:p-6">
            {nextShoot ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[13px] text-muted">
                      {shootIn === 0 ? "Hoy se rueda" : "Próximo rodaje"} ·{" "}
                      <Link href={`/app/${nextShoot.projectId}`} className="text-fg hover:text-accent">
                        {nextShoot.project.name}
                      </Link>
                    </p>
                    <p className="mt-1 text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">
                      {relativeDay(nextShoot.date, now)}
                      <span className="ml-2 text-base font-normal text-fg/75">
                        {nextShoot.date.toLocaleDateString("es-ES", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          timeZone: "Europe/Madrid",
                        })}
                      </span>
                    </p>
                    {shootLocations.length > 0 && (
                      <p className="mt-1 truncate text-sm text-fg/85">{shootLocations.join(" · ")}</p>
                    )}
                  </div>
                  {nextShoot.callSheet?.generalCallTime && (
                    <div className="sm:text-right">
                      <p className="text-xs text-muted">Llamada</p>
                      <p className="font-mono text-[2.25rem] leading-none font-medium text-accent">
                        {nextShoot.callSheet.generalCallTime}
                      </p>
                    </div>
                  )}
                </div>

                {shootScenes.length > 0 && (
                  <div className="mt-4">
                    <div className="flex h-3 gap-0.5 overflow-hidden rounded" aria-hidden>
                      {shootScenes.map((scene, i) => (
                        <span
                          key={i}
                          className="flex-1"
                          style={{ background: sceneStripColor(scene.intExt, scene.dayPart) }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {shootScenes.map((scene, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs text-fg/80">
                          <span className="font-mono">{scene.number}</span>
                          <SceneTag intExt={scene.intExt} dayPart={scene.dayPart} />
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                  <Link
                    href={`/app/${nextShoot.projectId}/call-sheets/${nextShoot.id}`}
                    className="btn btn-primary btn-sm"
                  >
                    {nextShoot.callSheet ? "Hoja de llamada" : "Crear hoja de llamada"}
                    <LinkPendingHint />
                  </Link>
                  <Link
                    href={`/app/${nextShoot.projectId}/plan-de-rodaje/${nextShoot.id}`}
                    className="btn btn-outline btn-sm"
                  >
                    Plan del día
                  </Link>
                  <Link href={`/app/${nextShoot.projectId}/claqueta`} className="btn btn-outline btn-sm">
                    <ClaquetaIcon className="h-4 w-4" /> Claqueta
                  </Link>
                  <span
                    className={`ml-auto inline-flex h-6 items-center rounded-full px-2.5 text-xs ${
                      !nextShoot.callSheet
                        ? "bg-warn/15 text-warn"
                        : nextShoot.shareToken
                          ? "bg-success/15 text-success"
                          : "bg-accent/15 text-fg"
                    }`}
                  >
                    {!nextShoot.callSheet
                      ? "Hoja sin crear"
                      : nextShoot.shareToken
                        ? "Hoja compartida con el equipo"
                        : "Hoja creada, sin compartir"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] text-muted">Próximo rodaje</p>
                <p className="mt-1 text-2xl font-bold text-fg/70">Sin rodajes planificados</p>
                <p className="mt-2 max-w-md text-sm text-muted">
                  Cuando repartas los planos en jornadas de rodaje, aquí verás la próxima, a qué hora se cita
                  y si su hoja de llamada está lista.
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Link href={`/app/${heroProject.id}/plan-de-rodaje`} className="btn btn-outline btn-sm">
                    Planificar un rodaje
                  </Link>
                  <Link href={`/app/${heroProject.id}/claqueta`} className="btn btn-outline btn-sm">
                    <ClaquetaIcon className="h-4 w-4" /> Claqueta
                  </Link>
                </div>
              </>
            )}
          </DashboardReveal>

          {/* Requiere atención */}
          <DashboardReveal className="rounded-2xl border border-line bg-bg-raised/40 p-5 sm:p-6" delay={0.05}>
            <SectionHeading
              title="Requiere atención"
              meta={attention.length > 0 ? `${attention.length}` : undefined}
            />
            {attention.length === 0 ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-fg/80">
                <span aria-hidden className="mt-0.5 text-success">
                  ✓
                </span>
                Todo en orden: sin tareas vencidas ni rodajes próximos sin hoja de llamada.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line/70">
                {attention.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="group flex items-start gap-2.5 py-2.5 text-sm">
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          item.tone === "danger" ? "bg-danger" : "bg-warn"
                        }`}
                      />
                      <span className="transition-colors group-hover:text-accent">{item.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardReveal>

          {/* Continuar */}
          <DashboardReveal
            className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent-purple/40 via-bg-raised to-bg p-5 sm:p-6 lg:col-span-2"
            delay={0.1}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] text-accent">Seguir donde lo dejaste</p>
                <h2 className="mt-0.5 truncate text-2xl font-bold tracking-tight">{heroProject.name}</h2>
                <p className="mt-1 text-sm text-fg/80">
                  {heroCurrent ? (
                    <>
                      Siguiente paso: <span className="font-semibold text-fg">{heroCurrent.title}</span>
                    </>
                  ) : (
                    "Listo para rodar: pasos esenciales completados"
                  )}
                  <span className="text-muted">
                    {" "}
                    · {heroDone} de {heroRequired.length} esenciales
                  </span>
                </p>
              </div>
              <Link href={`/app/${heroProject.id}`} className="btn btn-primary shrink-0">
                Continuar →
                <LinkPendingHint />
              </Link>
            </div>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-700"
                style={{ width: `${heroPct}%` }}
              />
            </div>
          </DashboardReveal>
        </div>
      )}

      {/* Cifras */}
      <DashboardStagger className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link
          href="/app/proyectos"
          className="rounded-xl border border-line p-4 transition-colors hover:border-accent/60"
        >
          <p className="text-xs text-muted">Proyectos activos</p>
          <p className="mt-1 font-mono text-2xl">{activeProjectsCount}</p>
          {!isPro(profile.organization.plan) && (
            <p className="mt-1 text-xs text-muted">
              Plan gratuito: máx. {FREE_ACTIVE_PROJECTS_LIMIT}
            </p>
          )}
        </Link>
        <Link
          href="/app/calendario"
          className="rounded-xl border border-line p-4 transition-colors hover:border-accent/60"
        >
          <p className="text-xs text-muted">Jornadas próximas</p>
          <p className="mt-1 font-mono text-2xl">{upcomingShootingDays.length}</p>
          <p className="mt-1 text-xs text-muted">
            {upcomingShootingDays[0]
              ? `La primera: ${upcomingShootingDays[0].date.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" })}`
              : "Ninguna planificada"}
          </p>
        </Link>
        <Link
          href="/app/tareas"
          className="rounded-xl border border-line p-4 transition-colors hover:border-accent/60"
        >
          <p className="text-xs text-muted">Tareas pendientes</p>
          <p className="mt-1 font-mono text-2xl">{pendingTasks.length}</p>
          <p className={`mt-1 text-xs ${overdueTasks.length > 0 ? "text-danger" : "text-muted"}`}>
            {overdueTasks.length > 0
              ? `${overdueTasks.length} vencida${overdueTasks.length === 1 ? "" : "s"}`
              : "Ninguna vencida"}
          </p>
        </Link>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs text-muted">Gastado</p>
          <p className="mt-1 font-mono text-2xl">{currency(budgetActual)}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${budgetPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">de {currency(budgetPlanned)} previstos</p>
        </div>
      </DashboardStagger>

      {/* Proyectos */}
      <DashboardReveal className="mt-10" delay={0.15}>
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
                  className="group relative rounded-xl border border-line bg-bg-raised/40 p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/60"
                >
                  <Link href={`/app/${project.id}`} className="block pr-16">
                    <p className="text-base font-bold transition-colors group-hover:text-accent">
                      {project.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusPill status={project.status} />
                      {!isOwnProject && <span className="text-xs text-muted">Compartido por {ownerLabel}</span>}
                    </div>
                    {p && (
                      <div className="mt-3">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1.5 text-xs text-muted">
                          {p.done} de {p.total} pasos esenciales
                        </p>
                      </div>
                    )}
                  </Link>
                  {isOwnProject && (
                    <div className="absolute top-2 right-2 flex items-center">
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

      {/* Agenda y actividad */}
      <div className="mt-10 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <DashboardReveal className="rounded-2xl border border-line bg-bg-raised/40 p-5" delay={0.18}>
          <SectionHeading
            title="Próximos 14 días"
            action={
              <Link href="/app/calendario" className="link-action">
                Calendario →
              </Link>
            }
          />
          {upcomingEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Sin eventos ni rodajes en los próximos 14 días.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/70">
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <Link href={event.href} className="group flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-14 shrink-0 text-center">
                      <span className="block font-mono text-lg leading-none">
                        {event.date.toLocaleDateString("es-ES", { day: "numeric", timeZone: "Europe/Madrid" })}
                      </span>
                      <span className="text-xs text-muted">
                        {event.date
                          .toLocaleDateString("es-ES", { month: "short", timeZone: "Europe/Madrid" })
                          .replace(".", "")}
                      </span>
                    </span>
                    <span
                      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs ${
                        event.typeLabel === "Rodaje" ? "bg-accent/20 text-fg" : "bg-line text-fg/80"
                      }`}
                    >
                      {event.typeLabel}
                    </span>
                    <span className="min-w-0 truncate group-hover:text-accent">
                      {event.title}
                      {event.projectName && <span className="text-muted"> · {event.projectName}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <SectionHeading
            className="mt-6"
            title="Tareas pendientes"
            action={
              <Link href="/app/tareas" className="link-action">
                Ver todas →
              </Link>
            }
          />
          {pendingTasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Sin tareas pendientes.</p>
          ) : (
            <ul className="mt-2">
              {pendingTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-2.5">
                  <TaskCheck taskId={task.id} done={false} title={task.title} />
                  <Link
                    href={`/app/tareas/${task.id}`}
                    className="min-w-0 flex-1 truncate py-2 text-sm hover:text-accent"
                  >
                    {task.title}
                    {task.project && <span className="text-muted"> · {task.project.name}</span>}
                  </Link>
                  {task.dueDate && (
                    <span
                      className={`shrink-0 text-xs ${task.dueDate < startOfToday ? "text-danger" : "text-muted"}`}
                    >
                      {task.dueDate.toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/Madrid",
                      })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DashboardReveal>

        <DashboardReveal className="rounded-2xl border border-line bg-bg-raised/40 p-5" delay={0.2}>
          <SectionHeading title="Actividad reciente" />
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Aquí verás los cambios de tu equipo en cualquier proyecto.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {activity.map((entry) => {
                const who = entry.user?.fullName ?? entry.user?.email ?? "Alguien";
                return (
                  <li key={entry.id} className="flex items-start gap-2.5 text-sm">
                    <PersonInitials name={who} />
                    <p className="min-w-0 text-fg/80">
                      <span className="text-fg">{who}</span> {entry.summary} en{" "}
                      <Link href={`/app/${entry.project.id}`} className="text-fg hover:text-accent">
                        {entry.project.name}
                      </Link>
                      <span className="block text-xs text-muted">{relativeTime(entry.createdAt)}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardReveal>
      </div>
    </div>
  );
}
