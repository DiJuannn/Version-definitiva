import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { CalendarEventType, ProjectStatus, TaskStatus } from "@/lib/generated/prisma";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { ClaquetaIcon } from "@/components/ToolIcons";
import { StatusPill } from "@/components/StatusPill";
import { DashboardReveal, DashboardStagger } from "@/components/DashboardMotion";
import { createProject, deleteProject } from "@/lib/actions/projects";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { ProjectShareButton } from "@/components/ProjectShareButton";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { NewProjectPanel } from "@/components/NewProjectPanel";
import { LinkPendingHint } from "@/components/LinkPendingHint";
import { getProjectOverview } from "@/lib/project-roadmap";
import { isPro } from "@/lib/plan";
import { FREE_ACTIVE_PROJECTS_LIMIT } from "@/lib/limits";

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

  const [recentProjects, lastVisitedProject, activeProjectsCount, upcomingShootingDays, pendingTasks, calendarEvents, budgetCategories, origin] =
    await Promise.all([
      prisma.project.findMany({
        where: {
          OR: [{ organizationId }, { shares: { some: { userId: profile.id } } }],
        },
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
            select: {
              id: true,
              token: true,
              acceptedAt: true,
              user: { select: { email: true } },
            },
          },
        },
      }),
      // La tarjeta "Continuar" debe reflejar el último proyecto en el
      // que el usuario estuvo de verdad (getProjectForCurrentUser lo
      // apunta al entrar en cualquier página del proyecto), no el más
      // reciente por fecha — si no ha visitado ninguno todavía, o el
      // que visitó ya no es accesible, se cae al de más abajo.
      profile.lastVisitedProjectId
        ? prisma.project.findFirst({
            where: {
              id: profile.lastVisitedProjectId,
              OR: [{ organizationId }, { shares: { some: { userId: profile.id } } }],
            },
            select: { id: true, name: true, budgetTarget: true },
          })
        : Promise.resolve(null),
      prisma.project.count({
        where: { organizationId, status: { not: ProjectStatus.FINISHED } },
      }),
      prisma.shootingDay.findMany({
        where: { project: { organizationId }, date: { gte: now } },
        orderBy: { date: "asc" },
        take: 5,
        select: {
          id: true,
          date: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
      prisma.task.findMany({
        where: { organizationId, status: { not: TaskStatus.DONE } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 6,
        select: {
          id: true,
          title: true,
          project: { select: { name: true } },
        },
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
      // Solo se necesita la suma total, no cada elemento entero —
      // seleccionar únicamente los 3 campos que entran en el cálculo evita
      // traer notas, ids de vínculos y timestamps de cada línea de gasto de
      // toda la organización solo para este número del dashboard.
      prisma.budgetCategory.findMany({
        where: { project: { organizationId } },
        select: {
          items: { select: { quantity: true, unitPrice: true, taxRate: true } },
        },
      }),
      headers().then((h) => h.get("origin") ?? ""),
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
  const heroProject = lastVisitedProject ?? recentProjects[0] ?? null;
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
          <div className="mx-auto mt-6 max-w-sm">
            <CreateProjectForm
              action={createProject}
              formClassName="flex flex-col gap-2 sm:flex-row"
              inputClassName="w-full border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              buttonClassName="shrink-0 rounded-full bg-accent px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-70"
              autoFocus
            />
          </div>
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
              <LinkPendingHint />
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

      {/* Siempre visible, incluso sin proyectos todavía — quien es nuevo
          también tiene que poder entrar a la Claqueta, y de ahí se le
          ofrece crear su primer proyecto (ver /app/claqueta). */}
      <DashboardReveal delay={0.05}>
        <div className="group relative mt-3 flex items-center gap-3 border border-line px-5 py-3.5 transition-colors hover:border-accent">
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
              className="shrink-0 font-mono text-[10px] tracking-widest text-muted uppercase transition-colors group-hover:text-accent"
            >
              Abrir →
              <LinkPendingHint />
            </Link>
            {recentProjects.length > 1 && (
              <details className="shrink-0">
                <summary className="cursor-pointer list-none px-1 py-1 text-muted hover:text-accent [&::-webkit-details-marker]:hidden">
                  ▾
                </summary>
                <div className="absolute right-0 top-full z-20 mt-1 w-56 border border-line bg-bg py-1 shadow-lg">
                  <p className="px-3 py-1.5 font-mono text-[9px] tracking-widest text-muted uppercase">
                    Abrir la claqueta de otro proyecto
                  </p>
                  {recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/app/${project.id}/claqueta`}
                      className="block px-3 py-2 font-mono text-xs text-muted hover:bg-bg-raised hover:text-accent"
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
        {/* Ambientalmente visible, sin ser un banner que interrumpa — solo
            para el plan gratuito, para que la organización sepa dónde está
            sin tener que ir a buscarlo a Organización. En PRO no hace
            falta, la pastilla del nav ya lo deja claro. */}
        {!isPro(profile.organization.plan) && (
          <Link
            href="/app/organizacion"
            className="flex items-baseline gap-2 transition-colors hover:text-accent"
          >
            <span className="font-display text-xl font-bold text-muted">
              {activeProjectsCount}/{FREE_ACTIVE_PROJECTS_LIMIT}
            </span>
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Plan Free · Ver PRO
            </span>
          </Link>
        )}
      </div>

      <DashboardReveal className="mt-8" delay={0.1}>
        <NewProjectPanel hasProjects={recentProjects.length > 0} />
        {recentProjects.length > 0 && (
          <DashboardStagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => {
              const isOwnProject = project.organizationId === organizationId;
              const ownerLabel =
                project.createdBy?.fullName ??
                project.createdBy?.email ??
                project.organization.name;
              return (
                <div
                  key={project.id}
                  className="group relative border border-line p-4 transition-colors hover:border-accent"
                >
                  <Link href={`/app/${project.id}`} className="block pr-12">
                    <p className="font-display text-sm font-bold uppercase transition-colors group-hover:text-accent">
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
                  </Link>
                  {isOwnProject && (
                    <div className="absolute right-2 top-2 flex items-center gap-1">
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
