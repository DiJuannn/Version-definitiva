import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectWelcome } from "@/components/ProjectWelcome";
import { FirstSteps } from "@/components/FirstSteps";
import { PrepTable } from "@/components/PrepTable";
import { EmptyState } from "@/components/EmptyState";
import { getFirstSteps } from "@/lib/first-steps";
import { getProjectProgress } from "@/lib/project-progress";
import { getProjectReadiness } from "@/lib/project-readiness";
import { PHASES } from "@/lib/project-phases";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getProjectFacts, getToolMode, hasSeenWelcome } from "@/lib/tool-access";

const TONE: Record<string, string> = { next: "var(--phase-2)", warn: "var(--warn)", info: "var(--muted)" };

// La portada del proyecto es su Mesa de preparación: cuánto falta para rodar,
// qué tiene cada escena (desglose, planos, storyboard, reparto, lugar y día) y
// lo que falta, por orden y con el porqué. El cartel, los créditos y los datos
// del proyecto están en Resumen.
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

  const [readiness, facts, mode, progress, firstSteps] = await Promise.all([
    getProjectReadiness(projectId),
    getProjectFacts(projectId),
    getToolMode(profile.organizationId),
    getProjectProgress(projectId),
    getFirstSteps(projectId),
  ]);
  const showWelcome = ayuda === "1" || (mode === "simple" && progress.stage === 1 && facts.scenes === 0 && !(await hasSeenWelcome()));

  const next = readiness.nextShoot;
  const wrapped = facts.days > 0 && facts.pastDays >= facts.days && !readiness.todayDayId;
  const headline: [string, string] =
    facts.scenes === 0
      ? ["Empieza", "por el guion"]
      : readiness.todayDayId
        ? ["Hoy", "se rueda"]
        : next
          ? next.daysLeft === 1
            ? ["Rodáis", "mañana"]
            : [`Faltan ${next.daysLeft} días`, "para rodar"]
          : wrapped
            ? ["Rodaje", "terminado"]
            : ["Preparando", "el rodaje"];
  const pct = readiness.cells ? Math.round((readiness.filled / readiness.cells) * 100) : 0;
  const first = readiness.todos[0];
  const phase = PHASES[progress.stage - 1];

  return (
    <div className="pb-16">
      {showWelcome && (
        <div className="mb-10">
          <ProjectWelcome projectId={projectId} />
        </div>
      )}

      <header>
        <p className="eyebrow flex flex-wrap items-center gap-x-2">
          <span>{project.name}</span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1.5" style={{ color: `var(--phase-${phase.id})` }}>
            <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
            {phase.label}
          </span>
          <span aria-hidden>·</span>
          <span>Mesa de preparación</span>
        </p>
        <h1 className="poster-title mt-3 text-[56px] sm:text-[84px]">
          {headline[0]}
          <br />
          <span className="text-gel">{headline[1]}</span>
        </h1>
        <p className="mt-4 max-w-3xl font-sans text-[17px] leading-relaxed text-fg/85">
          {first ? (
            <>
              Lo que más frena ahora: <b className="font-semibold text-fg">{first.title.charAt(0).toLowerCase() + first.title.slice(1)}</b>. {first.why}
            </>
          ) : (
            "Todo lo esencial está listo para rodar."
          )}
        </p>
        {readiness.cells > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="h-2.5 w-full max-w-md overflow-hidden rounded-full bg-ink-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Listo para rodar">
              <div className="h-full rounded-full bg-[var(--phase-4)]" style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono text-[12px] text-muted">
              {pct} % listo para rodar · {readiness.filled} de {readiness.cells} casillas
            </span>
          </div>
        )}
      </header>

      {facts.scenes === 0 && <FirstSteps projectId={projectId} steps={firstSteps} />}

      <div className="mt-9 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-labelledby="escenas" className="min-w-0 overflow-hidden rounded-[var(--r-lg)] border border-line bg-ink-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-2">
            <h2 id="escenas" className="poster-sub text-[21px]">
              Escena a escena
            </h2>
            <p className="font-mono text-[11px] text-muted">toca una casilla para ir allí · el número abre la ficha</p>
          </div>
          {readiness.scenes.length > 0 ? (
            <PrepTable projectId={projectId} scenes={readiness.scenes} />
          ) : (
            <div className="px-5 pb-6">
              <EmptyState
                title="Sin escenas todavía"
                description="Sube el guion (o escríbelo en Guiones) y cada escena aparecerá aquí con lo que le falta."
                actionLabel="Ir al guion"
                actionHref={`/app/${projectId}/guion`}
                preview="escenas"
              />
            </div>
          )}
        </section>

        <aside aria-labelledby="falta" className="rounded-[var(--r-lg)] border border-line bg-ink-1">
          <p id="falta" className="eyebrow px-5 pt-5 pb-2">
            Lo que falta, por orden
          </p>
          {readiness.todos.length === 0 ? (
            <p className="px-5 pb-5 font-sans text-[15px] text-success">✓ Nada pendiente para rodar.</p>
          ) : (
            <ul>
              {readiness.todos.map((t) => (
                <li key={t.key} className="flex gap-3 border-t border-line px-5 py-3.5 font-sans first:border-t-0">
                  <span aria-hidden className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[t.tone] }} />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] leading-snug font-semibold">{t.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{t.why}</span>
                    <Link href={t.href} className="mt-1.5 inline-block text-[13px] font-semibold underline decoration-line underline-offset-4 hover:decoration-fg">
                      {t.cta} →
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <p className="mt-8 font-sans text-[14px] text-muted">
        El cartel, los créditos, el presupuesto y la actividad del proyecto están en el{" "}
        <Link href={`/app/${projectId}/resumen`} className="font-semibold text-fg underline decoration-line underline-offset-4 hover:decoration-fg">
          Resumen
        </Link>
        .
      </p>
    </div>
  );
}
