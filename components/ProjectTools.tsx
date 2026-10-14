import Link from "next/link";
import { DashboardStagger } from "@/components/DashboardMotion";
import { LinkPendingHint } from "@/components/LinkPendingHint";
import { PdfLink } from "@/components/PdfLink";
import { SummaryIcon } from "@/components/ToolIcons";
import { ToolModeToggle } from "@/components/ToolModeToggle";
import { TOOL_GROUPS, type ToolDefinition } from "@/lib/tool-groups";
import { isUnlocked, type ToolAccess, type ToolMode } from "@/lib/tool-rules";
import type { ToolStat } from "@/lib/project-roadmap";

const STAT_TONE = { warn: "text-warn", success: "text-success", none: "text-fg" } as const;

// Una herramienta como fila sobre el papel (no una tarjeta): icono, nombre, el dato real del
// proyecto si lo hay y una línea de qué es. Las filas se separan con una raya arriba.
function ToolRow({ tool, href, stat }: { tool: ToolDefinition; href: string; stat?: ToolStat }) {
  return (
    <Link href={href} className="group flex items-start gap-4 border-t border-line py-4 pr-1">
      <span className="mt-0.5 h-6 w-6 shrink-0 text-muted transition-colors group-hover:text-accent">{tool.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-[15px] font-bold transition-colors group-hover:text-accent">{tool.label}</span>
          {tool.pro && (
            <span className="rounded-full bg-accent/10 px-1.5 py-px font-mono text-[9px] tracking-widest text-accent uppercase">
              PRO
            </span>
          )}
          <LinkPendingHint />
        </span>
        {stat && <span className={`mt-0.5 block font-sans text-[13px] ${STAT_TONE[stat.tone ?? "none"]}`}>{stat.text}</span>}
        <span className="mt-0.5 block font-sans text-[13px] leading-snug text-muted">{tool.description}</span>
      </span>
      <span
        aria-hidden
        className="mt-1 shrink-0 text-sm text-accent opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        →
      </span>
    </Link>
  );
}

const GRID = "grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3";

// Las herramientas del proyecto. Modo simple: solo las que sirven ahora (con su dato en reposo) y,
// plegadas, las que se activarán con el porqué. Modo completo: todas, agrupadas como siempre.
export function ProjectTools({
  projectId,
  mode,
  access,
  toolStats,
}: {
  projectId: string;
  mode: ToolMode;
  access: Record<string, ToolAccess>;
  toolStats: Record<string, ToolStat>;
}) {
  const hrefOf = (tool: { href: string; absolute?: boolean }) => (tool.absolute ? tool.href : `/app/${projectId}/${tool.href}`);
  const all = TOOL_GROUPS.flatMap((g) => g.tools);
  const unlocked = all.filter((t) => isUnlocked(access, t.href));
  const locked = all.filter((t) => !isUnlocked(access, t.href));

  const row = (tool: ToolDefinition) => (
    <ToolRow key={tool.label} tool={tool} href={hrefOf(tool)} stat={toolStats[tool.href]} />
  );

  return (
    <section aria-labelledby="tools-title" className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="tools-title" className="font-display text-xl font-black tracking-tight">
            {mode === "simple" ? "Tus herramientas ahora" : "Herramientas"}
          </h2>
          <p className="mt-1 font-sans text-sm text-muted">
            {mode === "simple"
              ? "Solo las que te sirven en esta etapa. Las demás se abren cuando hagan falta."
              : "Todas las herramientas del proyecto, por fase."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/app/${projectId}/resumen`} className="link-action gap-1.5">
            <SummaryIcon className="h-4 w-4" />
            Resumen completo
          </Link>
          <PdfLink href={`/api/pdf/dossier/${projectId}`} label="Descargar dossier" />
        </div>
      </div>

      {mode === "full" ? (
        TOOL_GROUPS.map((group) => (
          <div key={group.label} className="mt-8">
            <p className="eyebrow text-accent">{group.label}</p>
            <DashboardStagger className={`mt-2 ${GRID}`}>{group.tools.map(row)}</DashboardStagger>
          </div>
        ))
      ) : (
        <>
          <DashboardStagger className={`mt-5 ${GRID}`}>{unlocked.map(row)}</DashboardStagger>

          {locked.length > 0 && (
            <details className="group mt-6">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full px-1 py-1 font-sans text-sm text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="inline-block text-accent transition-transform group-open:rotate-90">
                  ›
                </span>
                <span>
                  <span className="font-semibold text-fg">{locked.length} herramientas más</span> se irán activando
                  cuando las necesites
                </span>
              </summary>
              <ul className={`mt-3 ${GRID}`}>
                {locked.map((tool) => (
                  <li key={tool.label} className="flex items-start gap-4 border-t border-line py-4">
                    <span className="mt-0.5 h-6 w-6 shrink-0 text-muted/60">{tool.icon}</span>
                    <span className="min-w-0">
                      <span className="font-display text-[15px] font-bold text-muted">{tool.label}</span>
                      <span className="mt-0.5 block font-sans text-[13px] leading-snug text-muted">{tool.description}</span>
                      <span className="mt-1 flex items-start gap-1.5 font-sans text-xs text-accent">
                        <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {access[tool.href]?.reason}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <div className="mt-4">
        <ToolModeToggle mode={mode} />
      </div>
    </section>
  );
}
