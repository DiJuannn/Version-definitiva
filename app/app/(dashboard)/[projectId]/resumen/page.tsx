import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getProjectProgress } from "@/lib/project-progress";
import { buildProjectHighlights, getProjectSummary } from "@/lib/project-summary";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PdfLink } from "@/components/PdfLink";
import { DossierEmailButton } from "@/components/DossierEmailButton";
import { DAY_PART_LABELS, INT_EXT_LABELS, BREAKDOWN_CATEGORY_LABELS } from "@/lib/labels";
import { BreakdownCategory } from "@/lib/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { ProjectPoster } from "@/components/ProjectPoster";
import { CoverUpload } from "@/components/CoverUpload";
import { ProjectShareButton } from "@/components/ProjectShareButton";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PHASE_COLORS } from "@/components/FilmStrip";
import { updateProjectDetails } from "@/lib/actions/project-details";
import { ResumenTabs } from "@/components/ResumenTabs";
import { ProjectMapLoader } from "@/components/project-map/ProjectMapLoader";
import { buildMapCards, getMapBoard, getMapEntities, getMapProjectImages, listMapBoards } from "@/lib/project-map";
import { MapBoardTabs } from "@/components/project-map/MapBoardTabs";
import { getSiteOrigin } from "@/lib/site-origin";
import { getCurrentProfile } from "@/lib/current-user";
import { MAP_FREE_ITEM_LIMIT, MAP_MAX_ITEMS } from "@/lib/limits";

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const isDirection = (role: string | null) => !!role && /^(director|directora|dirección|direccion|realizador|realizadora)$/i.test(role.trim());

// Un bloque de la hoja: qué es, un enlace a su herramienta y el contenido a
// la vista (nada plegado).
function Block({ title, href, cta, children, className = "" }: { title: string; href: string; cta: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--r-lg)] border border-line bg-ink-1 p-5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="poster-sub text-[19px]">{title}</h2>
        <Link href={href} className="shrink-0 font-sans text-[13px] text-muted underline decoration-line underline-offset-4 hover:text-fg">
          {cta} →
        </Link>
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[14px] text-muted">{children}</p>;
}

export default async function ProjectSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ vista?: string; pizarra?: string }>;
}) {
  const { projectId } = await params;
  const { vista, pizarra } = await searchParams;

  const access = await getProjectForCurrentUser(projectId);
  if (!access) notFound();

  // Mapa del proyecto: una tarjeta-resumen por herramienta, en un tablero editable.
  if (vista === "mapa") {
    const me = await getCurrentProfile();
    const boards = await listMapBoards(projectId);
    const activeId = boards.find((b) => b.id === pizarra)?.id ?? boards[0].id;
    const [cards, board, mapIsPro, images, entities, origin] = await Promise.all([
      buildMapCards(projectId),
      getMapBoard(projectId, activeId),
      isProjectOwnerPro(access.organizationId),
      getMapProjectImages(projectId),
      getMapEntities(projectId),
      getSiteOrigin(),
    ]);
    if (!board) notFound();
    return (
      <div>
        <PageHeader
          eyebrow="Proyecto"
          title="Resumen"
          description="La pizarra de tu proyecto: una tarjeta por herramienta con lo importante, y todo lo que quieras añadir (notas, textos, imágenes, formas, secciones y flechas). Las tarjetas se actualizan solas con tus datos."
        />
        <ResumenTabs projectId={projectId} active="mapa" />
        <div className="mt-6">
          <MapBoardTabs
            projectId={projectId}
            boards={boards}
            activeId={board.id}
            shareUrl={board.shareToken ? `${origin}/pizarra/${board.shareToken}` : null}
          />
          <ProjectMapLoader
            key={board.id}
            projectId={projectId}
            boardId={board.id}
            boardName={board.name}
            userId={me?.id ?? "anon"}
            userName={me?.fullName ?? me?.email?.split("@")[0] ?? "Alguien"}
            entities={entities}
            tools={cards}
            layout={board.layout}
            updatedAt={board.updatedAt}
            isPro={mapIsPro}
            freeLimit={MAP_FREE_ITEM_LIMIT}
            maxItems={MAP_MAX_ITEMS}
            images={images}
          />
        </div>
      </div>
    );
  }

  const me = await getCurrentProfile();
  const isOwnerOrg = me?.organizationId === access.organizationId;
  const [isPro, data, phase, screenplay, activity, shares, origin] = await Promise.all([
    isProjectOwnerPro(access.organizationId),
    getProjectSummary(projectId),
    getProjectProgress(projectId),
    prisma.screenplay.findFirst({ where: { projectId }, orderBy: { updatedAt: "desc" }, select: { logline: true, pageCount: true, author: true } }),
    prisma.activityLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, summary: true, createdAt: true, user: { select: { fullName: true, email: true } } },
    }),
    isOwnerOrg
      ? prisma.projectShare.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, select: { id: true, token: true, acceptedAt: true, user: { select: { email: true } } } })
      : Promise.resolve([]),
    getSiteOrigin(),
  ]);
  const { project, locations, shotsTotal, budgetCategoriesWithTotals, budgetGrandTotal, budgetGrandActual, hasBudgetActual, shootingDaysWithNeeds } = data;
  const { budget } = buildProjectHighlights(data);
  const base = `/app/${projectId}`;
  const budgetTarget = budget.target;

  const scenes = project.scenes;
  const ext = scenes.filter((s) => s.intExt !== "INT").length;
  const night = scenes.filter((s) => s.dayPart === "NIGHT" || s.dayPart === "DUSK").length;
  const withActor = project.characters.filter((c) => c.actorId).length;
  const director = project.director ?? project.crewMembers.find((c) => isDirection(c.role))?.name ?? null;
  const writer = screenplay?.author ?? null;
  const credits: [string, string][] = [
    ...(director ? [["Dirección", director] as [string, string]] : []),
    ...(writer && writer !== director ? [["Guion", writer] as [string, string]] : []),
    ...(project.producer ? [["Producción", project.producer] as [string, string]] : []),
    ...project.crewMembers.filter((c) => !isDirection(c.role)).map((c) => [c.role ?? "Equipo", c.name] as [string, string]),
  ];
  const billing = [director ? `Un proyecto de ${director}` : null, withActor ? `con ${project.characters.filter((c) => c.actor).slice(0, 3).map((c) => c.actor!.name).join(" · ")}` : null]
    .filter(Boolean)
    .join(" · ");
  const days = shootingDaysWithNeeds;
  const fmtDay = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid" }).replace(/\./g, "");
  const breakdown = Object.values(BreakdownCategory)
    .map((category) => ({ category, items: project.breakdownElements.filter((el) => el.category === category) }))
    .filter((g) => g.items.length > 0);
  const maxCat = Math.max(1, ...budgetCategoriesWithTotals.map((c) => c.total));
  const over = budgetTarget !== null && budgetGrandTotal > budgetTarget;

  const figures: { label: string; value: string; sub?: string; warn?: boolean; href: string }[] = [
    { label: "Escenas", value: String(scenes.length), sub: screenplay?.pageCount ? `${screenplay.pageCount} páginas` : undefined, href: `${base}/guion` },
    { label: "Planos", value: String(shotsTotal), sub: data.storyboardFramesCount ? `${data.storyboardFramesCount} viñetas` : "sin storyboard", href: `${base}/shot-list` },
    {
      label: "Jornadas",
      value: String(days.length),
      sub: days.length ? `${fmtDay(days[0].date)}${days.length > 1 ? ` – ${fmtDay(days[days.length - 1].date)}` : ""}` : "sin fechas",
      href: `${base}/plan-de-rodaje`,
    },
    {
      label: "Reparto",
      value: `${withActor}/${project.characters.length}`,
      sub: "con actor",
      warn: project.characters.length > 0 && withActor < project.characters.length,
      href: `${base}/personajes`,
    },
    { label: "Equipo", value: String(project.crewMembers.length), sub: "personas", warn: project.crewMembers.length === 0, href: `${base}/equipo` },
    {
      label: "Presupuesto",
      value: euros(budgetGrandTotal),
      sub: budgetTarget ? `objetivo ${euros(budgetTarget)}` : hasBudgetActual ? `gastado ${euros(budgetGrandActual)}` : undefined,
      warn: over,
      href: `${base}/presupuesto`,
    },
  ];

  return (
    <div className="pb-16">
      {/* El cartel: qué es el proyecto, en una mirada. */}
      <header className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-end">
        <div className="mx-auto w-40 lg:mx-0 lg:w-auto">
          <ProjectPoster name={project.name} coverUrl={project.coverUrl} billing={billing || undefined} accent={PHASE_COLORS[phase.stage - 1]} size="lg">
            {isOwnerOrg && <CoverUpload projectId={projectId} hasCover={Boolean(project.coverUrl)} />}
          </ProjectPoster>
        </div>
        <div className="min-w-0">
          <p className="eyebrow">
            Resumen · {[project.type ?? "Proyecto", project.durationLabel, phase.label.split(" · ")[0]].filter(Boolean).join(" · ")}
          </p>
          <h1 className="poster-title mt-2 text-[56px] sm:text-[80px]">{project.name}</h1>
          {screenplay?.logline ? (
            <p className="mt-3 max-w-2xl font-sans text-[17px] leading-relaxed text-fg/85">{screenplay.logline}</p>
          ) : (
            <p className="mt-3 max-w-2xl font-sans text-[15px] text-muted">Sin logline: escríbela en la Idea del guion y saldrá aquí y en el dossier.</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {isPro ? (
              <>
                <PdfLink href={`/api/pdf/dossier/${projectId}`} label="Descargar dossier" />
                <DossierEmailButton projectId={projectId} />
              </>
            ) : (
              <Link href="/app/organizacion" className="btn btn-outline">
                Dossier en PDF — PRO
              </Link>
            )}
            {isOwnerOrg && (
              <ProjectShareButton
                variant="button"
                projectId={projectId}
                origin={origin}
                shares={shares.map((s) => ({ id: s.id, token: s.token, acceptedAt: s.acceptedAt ? s.acceptedAt.toISOString() : null, userEmail: s.user?.email ?? null }))}
              />
            )}
          </div>
        </div>
      </header>

      <ResumenTabs projectId={projectId} active="resumen" />

      {/* Las cifras del proyecto, cada una lleva a su herramienta. */}
      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-[var(--r-lg)] border border-line sm:grid-cols-3 xl:grid-cols-6">
        {figures.map((f) => (
          <Link key={f.label} href={f.href} className="group border-line p-4 transition-colors hover:bg-ink-2 [&:not(:last-child)]:border-r max-xl:[&:nth-child(n+3)]:border-t">
            <dt className="eyebrow">{f.label}</dt>
            <dd className={`poster-sub mt-1.5 text-[28px] leading-none ${f.warn ? "text-warn" : ""}`}>{f.value}</dd>
            {f.sub && <dd className="mt-1 font-sans text-[12.5px] text-muted">{f.sub}</dd>}
          </Link>
        ))}
      </dl>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Block title="La historia" href={`${base}/guion`} cta="Abrir el guion">
          {scenes.length === 0 ? (
            <Missing>Sin escenas todavía.</Missing>
          ) : (
            <>
              <p className="font-sans text-[14px] text-muted">
                {plural(scenes.length, "escena", "escenas")} · {scenes.length - ext} interior · {ext} exterior · {scenes.length - night} de día · {night} de noche
              </p>
              <ol className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {scenes.slice(0, 14).map((s) => (
                  <li key={s.id} className="flex gap-2 truncate font-sans text-[13.5px]">
                    <span className="w-6 shrink-0 text-right font-mono text-[12.5px] font-semibold">{s.number}</span>
                    <span className="truncate">
                      {INT_EXT_LABELS[s.intExt]} {s.location?.name ?? s.description ?? ""} <span className="text-muted">· {DAY_PART_LABELS[s.dayPart].toLowerCase()}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {scenes.length > 14 && <p className="mt-2 font-sans text-[13px] text-muted">y {scenes.length - 14} más</p>}
            </>
          )}
        </Block>

        <Block title="Quién lo hace" href={`${base}/personajes`} cta="Personajes">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="eyebrow">Reparto</p>
              {project.characters.length === 0 ? (
                <Missing>Sin personajes.</Missing>
              ) : (
                <ul className="mt-2 space-y-1.5 font-sans text-[14px]">
                  {project.characters.slice(0, 8).map((c) => (
                    <li key={c.id} className="flex justify-between gap-3">
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className={`truncate ${c.actor ? "text-fg/80" : "text-warn"}`}>{c.actor?.name ?? "sin actor"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="eyebrow">Equipo</p>
              {credits.length === 0 ? (
                <Missing>
                  Sin equipo.{" "}
                  <Link href={`${base}/equipo`} className="text-fg underline decoration-line underline-offset-4">
                    Añadirlo
                  </Link>
                </Missing>
              ) : (
                <ul className="mt-2 space-y-1.5 font-sans text-[14px]">
                  {credits.slice(0, 8).map(([role, who]) => (
                    <li key={role + who} className="leading-snug">
                      <span className="block text-[12px] text-muted">{role}</span>
                      <span className="font-semibold">{who}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Block>

        <Block title="Cuándo se rueda" href={`${base}/plan-de-rodaje`} cta="Plan de rodaje">
          {days.length === 0 ? (
            <Missing>Sin jornadas todavía.</Missing>
          ) : (
            <ul className="divide-y divide-line">
              {days.map((d, i) => {
                const done = d.shots.filter((sh) => sh.done).length;
                return (
                  <li key={d.id}>
                    <Link href={`${base}/plan-de-rodaje?dia=${d.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 font-sans text-[14px] hover:text-fg">
                      <span className="w-12 font-mono text-[12px] text-muted">Día {i + 1}</span>
                      <span className="font-semibold first-letter:uppercase">{fmtDay(d.date)}</span>
                      <span className="text-muted">
                        {plural(d.scenes.length, "escena", "escenas")}
                        {d.shots.length ? ` · ${done}/${d.shots.length} planos rodados` : ""}
                      </span>
                      <span className={`ml-auto text-[12.5px] ${d.callSheet ? "text-success" : "text-warn"}`}>{d.callSheet ? "✓ hoja de llamada" : "sin hoja"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Block>

        <Block title="Dónde" href={`${base}/localizaciones`} cta="Localizaciones">
          {locations.length === 0 ? (
            <Missing>Ninguna escena tiene localización todavía.</Missing>
          ) : (
            <ul className="divide-y divide-line">
              {locations.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 py-2 font-sans text-[14px]">
                  <span className="truncate font-semibold">{l.name}</span>
                  <span className="shrink-0 text-muted">{plural(l.sceneCount, "escena", "escenas")}</span>
                </li>
              ))}
            </ul>
          )}
          {scenes.some((s) => !s.locationId) && (
            <p className="mt-2 font-sans text-[13px] text-warn">{plural(scenes.filter((s) => !s.locationId).length, "escena", "escenas")} sin localización</p>
          )}
        </Block>

        <Block title="Qué hace falta" href={`${base}/desglose`} cta="Desglose">
          {breakdown.length === 0 ? (
            <Missing>Sin desglose todavía: marca en cada escena el atrezzo, vestuario, vehículos…</Missing>
          ) : (
            <div className="space-y-3">
              {breakdown.map((g) => (
                <div key={g.category}>
                  <p className="eyebrow">
                    {BREAKDOWN_CATEGORY_LABELS[g.category]} · {g.items.length}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {g.items.map((it) => (
                      <span key={it.id} className="rounded-[var(--r-xs)] border border-line px-2 py-0.5 font-sans text-[13px]">
                        {it.name}
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block title="Cuánto cuesta" href={`${base}/presupuesto`} cta="Presupuesto">
          {budgetCategoriesWithTotals.length === 0 ? (
            <Missing>Presupuesto sin hacer.</Missing>
          ) : (
            <>
              <ul className="space-y-2.5">
                {budgetCategoriesWithTotals.map((c) => (
                  <li key={c.id} className="font-sans text-[14px]">
                    <span className="flex justify-between gap-3">
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 tabular-nums">{euros(c.total)}</span>
                    </span>
                    <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-ink-3">
                      <span className="block h-full rounded-full bg-fg/60" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 font-sans text-[14px]">
                <b className="font-semibold">Total {euros(budgetGrandTotal)}</b>
                <span className={over ? "text-danger" : "text-muted"}>
                  {[budgetTarget ? `objetivo ${euros(budgetTarget)}` : null, hasBudgetActual ? `gastado ${euros(budgetGrandActual)}` : null].filter(Boolean).join(" · ")}
                </span>
              </p>
            </>
          )}
        </Block>
      </div>

      <div className={`mt-10 grid gap-x-12 gap-y-10 border-t border-line pt-8 ${activity.length ? "lg:grid-cols-2" : ""}`}>
        <ProjectSummaryCard project={{ ...project, budgetTarget }} updateAction={updateProjectDetails.bind(null, projectId)} />
        {activity.length > 0 && (
          <ActivityFeed
            entries={activity.map((log) => ({ id: log.id, summary: log.summary, createdAt: log.createdAt, userName: log.user?.fullName ?? log.user?.email ?? null }))}
          />
        )}
      </div>
    </div>
  );
}
