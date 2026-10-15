import Link from "next/link";
import { FilmStrip, PHASE_COLORS } from "@/components/FilmStrip";
import { PHASES, type PhaseId } from "@/lib/project-phases";
import { isUnlocked, type ToolAccess } from "@/lib/tool-rules";
import type { ToolStat } from "@/lib/project-roadmap";

const TONE = { warn: "text-warn", success: "text-success", none: "text-muted" } as const;

// El camino del proyecto: cuatro bobinas (una por fase) con su tira de
// película y, debajo, todas sus herramientas, también las que aún no tocan
// (en gris y con el porqué), para que ninguna parezca que no existe.
export function ProjectReels({
  projectId,
  stage,
  progress,
  stageLabel,
  access,
  toolStats,
}: {
  projectId: string;
  stage: PhaseId;
  progress: [number, number, number, number];
  stageLabel: string;
  access: Record<string, ToolAccess>;
  toolStats: Record<string, ToolStat>;
}) {
  return (
    <section aria-label="Fases del proyecto" className="grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
      {PHASES.map((phase, i) => {
        const now = phase.id === stage;
        const pct = Math.round(progress[i] * 100);
        return (
          <div key={phase.id} className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-[11px] text-muted">0{phase.id}</span>
              <h3 className="poster-sub text-[26px] leading-none" style={now ? { color: PHASE_COLORS[i] } : undefined}>
                {phase.label}
              </h3>
              {now ? (
                <span
                  className="ml-auto rounded-[3px] px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] whitespace-nowrap text-[#111] uppercase"
                  style={{ background: PHASE_COLORS[i] }}
                  title={stageLabel}
                >
                  Estás aquí
                </span>
              ) : (
                <span className="ml-auto font-mono text-[11px] text-muted">
                  {phase.id < stage ? "hecho" : pct > 0 ? `${pct} %` : "—"}
                </span>
              )}
            </div>
            <FilmStrip
              className="mt-3"
              segments={[{ color: PHASE_COLORS[i], done: progress[i] }]}
              highlight={now ? PHASE_COLORS[i] : undefined}
            />
            {now && <p className="mt-2 font-sans text-[12.5px] text-muted">{stageLabel}</p>}
            <ul className="mt-3">
              {phase.tools.map((tool) => {
                const stat = toolStats[tool.href];
                const locked = !isUnlocked(access, tool.href);
                const inner = (
                  <>
                    <span className={`min-w-0 truncate ${locked ? "" : now ? "font-semibold" : ""}`}>{tool.label}</span>
                    <span className={`shrink-0 text-right text-[12.5px] ${locked ? "" : stat ? TONE[stat.tone ?? "none"] : "text-muted/70"}`}>
                      {locked ? access[tool.href]?.reason?.replace(/^Se activa /, "").replace(/\.$/, "") : (stat?.text ?? "sin empezar")}
                    </span>
                  </>
                );
                const cls = "flex items-baseline justify-between gap-3 border-b border-line py-2.5 font-sans text-[14px]";
                return (
                  <li key={tool.href}>
                    {locked ? (
                      <span className={`${cls} text-muted/45`} title={access[tool.href]?.reason}>
                        {inner}
                      </span>
                    ) : (
                      <Link href={`/app/${projectId}/${tool.href}`} className={`${cls} transition-colors hover:text-accent`}>
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
