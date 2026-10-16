import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ProjectWelcome } from "@/components/ProjectWelcome";
import { FirstSteps } from "@/components/FirstSteps";
import { getFirstSteps } from "@/lib/first-steps";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { ProjectShareButton } from "@/components/ProjectShareButton";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ProjectPoster } from "@/components/ProjectPoster";
import { CoverUpload } from "@/components/CoverUpload";
import { ShootSlate } from "@/components/ShootSlate";
import { ProjectReels } from "@/components/ProjectReels";
import { PHASE_COLORS } from "@/components/FilmStrip";
import { getProjectOverview } from "@/lib/project-roadmap";
import { getProjectProgress } from "@/lib/project-progress";
import { phaseOfSegment } from "@/lib/project-phases";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForCurrentUser, getProjectOwnerLabel } from "@/lib/project-access";
import { updateProjectDetails } from "@/lib/actions/project-details";
import { getProjectFacts, getToolMode, hasSeenWelcome } from "@/lib/tool-access";
import { computeAccess } from "@/lib/tool-rules";

const euros = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";

// La portada de un proyecto es su cartel. Arriba, el cartel, el título en
// grande, de qué va y el próximo rodaje como una claqueta. Debajo, el camino
// en cuatro bobinas (con todas las herramientas de cada fase), lo que se usa
// de la productora, lo que falta por hacer y quién lo hace, como unos créditos.
export default async function ProjectTallerPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ ayuda?: string }>;
}) {
  const { projectId } = await params;
  const { ayuda } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();
  const profile = await getCurrentProfile();
  if (!profile) notFound();
  const isOwnerOrg = project.organizationId === profile.organizationId;
  const budgetTarget = project.budgetTarget !== null ? Number(project.budgetTarget) : null;

  const [ownerLabel, shares, origin, activityLogs, overview, facts, mode, progress, screenplay, cast, crew, extra, firstSteps] = await Promise.all([
    isOwnerOrg ? null : getProjectOwnerLabel(project),
    isOwnerOrg
      ? prisma.projectShare.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          select: { id: true, token: true, acceptedAt: true, user: { select: { email: true } } },
        })
      : Promise.resolve([]),
    headers().then((h) => h.get("origin") ?? ""),
    prisma.activityLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, summary: true, createdAt: true, user: { select: { fullName: true, email: true } } },
    }),
    getProjectOverview(projectId, budgetTarget),
    getProjectFacts(projectId),
    getToolMode(profile.organizationId),
    getProjectProgress(projectId),
    prisma.screenplay.findFirst({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      select: { logline: true, pageCount: true, author: true },
    }),
    prisma.character.findMany({
      where: { projectId, actorId: { not: null } },
      orderBy: { name: "asc" },
      select: { name: true, actor: { select: { name: true } } },
    }),
    prisma.crewMember.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, select: { name: true, role: true } }),
    Promise.all([
      prisma.scene.count({ where: { projectId } }),
      prisma.shot.count({ where: { scene: { projectId } } }),
      prisma.location.count({ where: { scenes: { some: { projectId } } } }),
      prisma.itemReservation.count({ where: { shootingDay: { projectId } } }),
      prisma.vehicleReservation.count({ where: { shootingDay: { projectId } } }),
      prisma.task.count({ where: { projectId, status: { not: "DONE" } } }),
    ]),
    getFirstSteps(projectId),
  ]);
  const [sceneCount, shotCount, locationCount, itemCount, vehicleCount, taskCount] = extra;
  const access = computeAccess(facts);
  const { stage } = progress;
  const { steps, toolStats, nextShoot, budget } = overview;
  const showWelcome = ayuda === "1" || (mode === "simple" && stage === 1 && facts.scenes === 0 && !(await hasSeenWelcome()));

  // Próximo rodaje con su detalle (citación del plan de rodaje, planos del día).
  const shoot = nextShoot
    ? await prisma.shootingDay.findUnique({
        where: { id: nextShoot.id },
        select: {
          date: true,
          callTime: true,
          callSheet: { select: { generalCallTime: true } },
          scenes: { orderBy: { order: "asc" }, select: { scene: { select: { number: true } } } },
          _count: { select: { shots: true } },
        },
      })
    : null;
  const dayIndex = nextShoot
    ? await prisma.shootingDay.count({ where: { projectId, date: { lt: nextShoot.date } } })
    : 0;

  // Quien dirige: el dato del proyecto o, si no, quien del equipo tiene el
  // puesto de dirección (no «de fotografía», «de arte» ni «ayudante de»). Los
  // autores del guion van aparte, como guion.
  const isDirection = (role: string | null) =>
    !!role && /^(director|directora|dirección|direccion|realizador|realizadora)$/i.test(role.trim());
  const director = project.director ?? crew.find((c) => isDirection(c.role))?.name ?? null;
  const writers = screenplay?.author ?? null;
  const billing = [
    director ? `Un proyecto de ${director}` : null,
    cast.length ? `con ${cast.map((c) => c.actor?.name).filter(Boolean).slice(0, 4).join(" · ")}` : null,
    ...crew.slice(0, 3).map((c) => (c.role ? `${c.role.toLowerCase()} ${c.name}` : c.name)),
    project.producer ? `producción ${project.producer}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const pending = steps.filter((s) => !s.isDone).slice(0, 5);
  const credits: [string, string][] = [
    ...(director ? [["Dirigido por", director] as [string, string]] : []),
    ...(writers && writers !== director ? [["Guion", writers] as [string, string]] : []),
    ...crew
      .filter((c) => !isDirection(c.role))
      .slice(0, 5)
      .map((c) => [c.role ?? "Equipo", c.name] as [string, string]),
    ...(project.producer ? [["Producción", project.producer] as [string, string]] : []),
  ];

  return (
    <div className="pb-16">
      {/* ------------------------------------------------ cartel */}
      <section className="taller-ink relative -mt-8 mx-[calc(50%-50vw)] overflow-hidden bg-bg px-[calc(50vw-50%)] text-fg sm:-mt-10">
        {project.coverUrl && (
          <div aria-hidden className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.coverUrl} alt="" className="h-full w-full object-cover opacity-25 grayscale-[30%]" />
            <span className="absolute inset-0 bg-[linear-gradient(90deg,#0a0a0a_15%,rgba(10,10,10,0.55)_55%,#0a0a0a_100%),linear-gradient(0deg,var(--color-bg)_0%,transparent_45%)]" />
          </div>
        )}
        <div className="relative grid gap-10 pt-10 pb-12 lg:grid-cols-[260px_minmax(0,1fr)_330px] lg:items-end lg:gap-12">
          <div className="mx-auto w-48 lg:mx-0 lg:w-auto">
            <ProjectPoster
              name={project.name}
              coverUrl={project.coverUrl}
              billing={billing || undefined}
              accent={PHASE_COLORS[stage - 1]}
              size="lg"
            >
              {isOwnerOrg && <CoverUpload projectId={projectId} hasCover={Boolean(project.coverUrl)} />}
            </ProjectPoster>
          </div>

          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
              {[project.type ?? "Proyecto", screenplay?.pageCount ? `${screenplay.pageCount} páginas` : null, project.durationLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1 className="poster-title mt-3 text-[64px] sm:text-[96px] xl:text-[120px]">{project.name}</h1>
            {screenplay?.logline ? (
              <p className="mt-5 max-w-xl font-sans text-[17px] leading-relaxed text-fg/85">{screenplay.logline}</p>
            ) : (
              isOwnerOrg && (
                <p className="mt-5 max-w-xl font-sans text-[15px] text-muted">
                  ¿De qué va? Escribe la logline en la Idea del guion y saldrá aquí.
                </p>
              )
            )}
            <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 font-sans text-[13.5px] text-muted">
              <span>
                <b className="font-semibold text-fg">{progress.label.split(" · ")[0]}</b>
                {progress.label.includes(" · ") && ` · ${progress.label.split(" · ").slice(1).join(" · ")}`}
              </span>
              {budget.planned > 0 && (
                <span>
                  <b className="font-semibold text-fg">{euros(budget.actual)}</b> de {euros(budget.planned)}
                </span>
              )}
              {sceneCount > 0 && (
                <span>
                  <b className="font-semibold text-fg">{sceneCount}</b> escenas · <b className="font-semibold text-fg">{shotCount}</b> planos
                </span>
              )}
              {!isOwnerOrg && ownerLabel && <span>Propietario: {ownerLabel}</span>}
            </p>
            {isOwnerOrg && (
              <div className="mt-6">
                <ProjectShareButton
                  variant="button"
                  projectId={projectId}
                  origin={origin}
                  shares={shares.map((s) => ({
                    id: s.id,
                    token: s.token,
                    acceptedAt: s.acceptedAt ? s.acceptedAt.toISOString() : null,
                    userEmail: s.user?.email ?? null,
                  }))}
                />
              </div>
            )}
          </div>

          {shoot ? (
            <ShootSlate
              eyebrow={`Próximo rodaje · día ${dayIndex + 1} de ${facts.days}`}
              date={shoot.date}
              callTime={shoot.callTime ?? shoot.callSheet?.generalCallTime ?? null}
              scenes={shoot.scenes.map((s) => s.scene.number).join(" · ")}
              shots={shoot._count.shots}
              warning={shoot.callSheet ? null : "La hoja de llamada aún no está creada"}
              action={
                shoot.callSheet
                  ? { href: `/app/${projectId}/plan-de-rodaje?dia=${nextShoot!.id}`, label: "Ver el orden de rodaje →" }
                  : { href: `/app/${projectId}/call-sheets/${nextShoot!.id}`, label: "Preparar la hoja de llamada →" }
              }
            />
          ) : (
            <aside className="rounded-md border border-dashed border-line p-6">
              <p className="eyebrow">Próximo rodaje</p>
              <p className="poster-title mt-2 text-[34px] text-muted">Sin fecha</p>
              <p className="mt-2 font-sans text-sm text-muted">
                Cuando repartas las escenas en jornadas, aquí verás la claqueta del próximo día.
              </p>
              <Link href={`/app/${projectId}/plan-de-rodaje`} className="btn btn-outline btn-sm mt-4">
                Plan de rodaje →
              </Link>
            </aside>
          )}
        </div>
      </section>

      {showWelcome && (
        <div className="mt-12">
          <ProjectWelcome projectId={projectId} />
        </div>
      )}

      <FirstSteps projectId={projectId} steps={firstSteps} />

      {/* ------------------------------------------------ el camino */}
      <div className="mt-12">
        <ProjectReels
          projectId={projectId}
          stage={stage}
          progress={progress.phases}
          stageLabel={progress.label}
          access={access}
          toolStats={toolStats}
        />
      </div>

      {/* ------------------------------------------------ de la productora */}
      <nav
        aria-label="Recursos de la productora en este proyecto"
        className="tile mt-10 flex flex-wrap items-center gap-x-7 gap-y-2 px-5 py-4 font-sans text-[14px]"
      >
        <span className="eyebrow mr-1">De la productora</span>
        {(
          [
            ["Equipo", crew.length, `/app/${projectId}/equipo`],
            ["Localizaciones", locationCount, `/app/${projectId}/localizaciones`],
            ["Material", itemCount, "/app/inventario"],
            ["Vehículos", vehicleCount, `/app/${projectId}/vehiculos`],
            ["Plantillas", 5, `/app/${projectId}/documentos-legales`],
          ] as const
        ).map(([label, n, href]) => (
          <Link key={label} href={href} className="whitespace-nowrap hover:text-accent">
            <b className="font-bold">{label}</b> <span className="text-muted">{n}</span>
          </Link>
        ))}
        <Link href={`/app/${projectId}/tareas`} className="ml-auto whitespace-nowrap hover:text-accent">
          <b className="font-bold">Tareas</b> <span className="text-muted">{taskCount} pendientes</span>
        </Link>
      </nav>

      {/* ------------------------------------------------ lo que falta · quién lo hace */}
      <div className="mt-16 grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="falta">
          <h2 id="falta" className="poster-sub text-[30px]">
            Lo que falta
          </h2>
          {pending.length === 0 ? (
            <p className="mt-4 font-sans text-[15px] text-success">✓ Todo lo esencial está hecho.</p>
          ) : (
            <ul className="mt-4">
              {pending.map((step) => {
                const segment = step.href.split("/")[3];
                const phase = phaseOfSegment(segment) ?? stage;
                return (
                  <li key={step.key} className="grid grid-cols-[6px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-4">
                    <i aria-hidden className="h-9 w-1.5 rounded-full" style={{ background: PHASE_COLORS[phase - 1] }} />
                    <p className="font-sans text-[15.5px] font-semibold">
                      {step.title}
                      <span className="mt-0.5 block text-[13px] font-normal text-muted">{step.detail || step.instruction}</span>
                    </p>
                    <Link href={step.href} className="link-action text-accent hover:!text-accent">
                      {step.ctaLabel} →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="creditos">
          <h2 id="creditos" className="poster-sub text-[30px]">
            Quién lo hace
          </h2>
          {credits.length === 0 && cast.length === 0 ? (
            <p className="mt-4 font-sans text-[15px] text-muted">
              Añade el{" "}
              <Link href={`/app/${projectId}/equipo`} className="text-accent hover:underline">
                equipo
              </Link>{" "}
              y el{" "}
              <Link href={`/app/${projectId}/personajes`} className="text-accent hover:underline">
                reparto
              </Link>{" "}
              y aquí saldrán sus créditos.
            </p>
          ) : (
            <div className="mt-4 rounded-md bg-[#0d0d10] px-7 py-8 text-center">
              {credits.slice(0, 1).map(([role, who]) => (
                <div key={role}>
                  <p className="eyebrow">{role}</p>
                  <p className="poster-sub mt-1 text-[22px]">{who}</p>
                </div>
              ))}
              {cast.length > 0 && (
                <div className="mt-5">
                  <p className="eyebrow">Reparto</p>
                  <p className="poster-sub mt-1 text-[20px]">
                    {cast.slice(0, 4).map((c, i) => (
                      <span key={c.name}>
                        {i > 0 && " · "}
                        {c.actor?.name} <span className="text-[14px] text-[var(--phase-2)]">{c.name}</span>
                      </span>
                    ))}
                  </p>
                </div>
              )}
              {credits.slice(1).map(([role, who]) => (
                <div key={role + who} className="mt-5">
                  <p className="eyebrow">{role}</p>
                  <p className="poster-sub mt-1 text-[20px]">{who}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className={`mt-16 grid gap-x-16 gap-y-12 border-t border-line pt-10 ${activityLogs.length ? "lg:grid-cols-2" : ""}`}>
        <ProjectSummaryCard project={{ ...project, budgetTarget }} updateAction={updateProjectDetails.bind(null, projectId)} />
        {activityLogs.length > 0 && (
          <ActivityFeed
            entries={activityLogs.map((log) => ({
              id: log.id,
              summary: log.summary,
              createdAt: log.createdAt,
              userName: log.user?.fullName ?? log.user?.email ?? null,
            }))}
          />
        )}
      </div>
    </div>
  );
}
