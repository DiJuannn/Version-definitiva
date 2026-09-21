import Link from "next/link";
import { DashboardStagger } from "@/components/DashboardMotion";
import { PdfLink } from "@/components/PdfLink";
import { SummaryIcon } from "@/components/ToolIcons";
import { ToolCard } from "@/components/ToolCard";
import { ToolModeToggle } from "@/components/ToolModeToggle";
import { TOOL_GROUPS } from "@/lib/tool-groups";
import { isUnlocked, type ToolAccess, type ToolMode } from "@/lib/tool-rules";
import type { ToolStat } from "@/lib/project-roadmap";

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

  const card = (tool: (typeof all)[number]) => (
    <ToolCard
      key={tool.label}
      variant="row"
      icon={tool.icon}
      label={tool.label}
      description={tool.description}
      href={hrefOf(tool)}
      badge={tool.pro ? "PRO" : undefined}
      stat={toolStats[tool.href]}
    />
  );

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          {mode === "simple" ? "Tus herramientas ahora" : "Herramientas"}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/app/${projectId}/resumen`} className="link-action gap-1.5">
            <SummaryIcon className="h-4 w-4" />
            Resumen completo
          </Link>
          <PdfLink href={`/api/pdf/dossier/${projectId}`} label="Descargar dossier" />
        </div>
      </div>

      {mode === "full" ? (
        TOOL_GROUPS.map((group) => (
          <div key={group.label} className="mt-6">
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">{group.label}</p>
            <DashboardStagger className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.tools.map(card)}</DashboardStagger>
          </div>
        ))
      ) : (
        <>
          <DashboardStagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{unlocked.map(card)}</DashboardStagger>

          {locked.length > 0 && (
            <details className="group mt-6 border border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent [&::-webkit-details-marker]:hidden">
                <span>Se irán activando ({locked.length})</span>
                <span aria-hidden className="transition-transform group-open:rotate-90">→</span>
              </summary>
              <ul className="border-t border-line">
                {locked.map((tool) => (
                  <li key={tool.label} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-b-0">
                    <span className="mt-0.5 h-5 w-5 shrink-0 text-muted">{tool.icon}</span>
                    <span className="min-w-0">
                      <span className="font-display text-sm font-bold">{tool.label}</span>
                      <span className="block font-sans text-xs text-muted">{tool.description}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-accent">{access[tool.href]?.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <div className="mt-5">
        <ToolModeToggle mode={mode} />
      </div>
    </section>
  );
}
