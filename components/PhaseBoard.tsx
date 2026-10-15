import Link from "next/link";
import { PHASES, type PhaseId } from "@/lib/project-phases";
import { isUnlocked, type ToolAccess, type ToolMode } from "@/lib/tool-rules";
import type { ToolStat } from "@/lib/project-roadmap";

const STAT_TONE = { warn: "text-warn", success: "text-success", none: "text-muted" } as const;

// El proyecto entero de un vistazo: cuatro columnas, una por fase, con sus
// herramientas y lo que hay en cada una. La fase en la que está el proyecto
// se destaca; las anteriores se ven hechas y las siguientes, en reposo.
export function PhaseBoard({
  projectId,
  stage,
  access,
  mode,
  toolStats,
}: {
  projectId: string;
  stage: PhaseId;
  access: Record<string, ToolAccess>;
  mode: ToolMode;
  toolStats: Record<string, ToolStat>;
}) {
  return (
    <section aria-labelledby="fases" className="mt-16">
      <h2 id="fases" className="font-display text-xl font-bold">
        El proyecto, fase a fase
      </h2>
      <ol className="mt-5 grid gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-2 xl:grid-cols-4">
        {PHASES.map((phase) => {
          const now = phase.id === stage;
          const done = phase.id < stage;
          return (
            <li key={phase.id} className={`flex flex-col p-5 ${now ? "bg-bg-raised" : "bg-bg"}`}>
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] ${
                    done ? "bg-accent/25 text-accent" : now ? "bg-accent text-bg" : "border border-line text-muted"
                  }`}
                >
                  {done ? "✓" : phase.id}
                </span>
                <h3 className={`font-display text-lg font-bold ${now ? "" : "text-fg/80"}`}>{phase.label}</h3>
                {now && <span className="eyebrow ml-auto text-accent">Ahora</span>}
              </div>
              <p className="mt-1.5 font-sans text-[13px] leading-snug text-muted">{phase.hint}</p>
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {phase.tools.map((tool) => {
                  const stat = toolStats[tool.href];
                  const locked = mode === "simple" && !isUnlocked(access, tool.href);
                  const body = (
                    <>
                      <span className={`mt-0.5 h-4 w-4 shrink-0 ${locked ? "opacity-40" : "text-muted group-hover:text-accent"}`}>
                        {tool.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block font-sans text-[14px] font-semibold ${locked ? "text-muted/60" : "group-hover:text-accent"}`}>
                          {tool.label}
                        </span>
                        <span
                          className={`block font-sans text-[12px] leading-snug ${
                            locked ? "text-muted/50" : stat ? STAT_TONE[stat.tone ?? "none"] : "text-muted/70"
                          }`}
                        >
                          {locked ? access[tool.href]?.reason : (stat?.text ?? "Sin empezar")}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={tool.href}>
                      {locked ? (
                        <span className="flex items-start gap-3 py-2.5">{body}</span>
                      ) : (
                        <Link
                          href={tool.absolute ? tool.href : `/app/${projectId}/${tool.href}`}
                          className="group flex items-start gap-3 py-2.5"
                        >
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
