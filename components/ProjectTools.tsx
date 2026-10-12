import Link from "next/link";
import { DashboardStagger } from "@/components/DashboardMotion";
import { PdfLink } from "@/components/PdfLink";
import { SummaryIcon } from "@/components/ToolIcons";
import { ToolCard } from "@/components/ToolCard";
import { ToolModeToggle } from "@/components/ToolModeToggle";
import { SectionHeading } from "@/components/SectionHeading";
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

  // Siempre agrupadas por fase (Preproducción, Producción, Gestión): veinte
  // tarjetas iguales seguidas no se escanean; en modo simple, solo las que ya sirven.
  const groups = TOOL_GROUPS.map((group) => ({
    label: group.label,
    tools: mode === "full" ? group.tools : group.tools.filter((t) => isUnlocked(access, t.href)),
  })).filter((group) => group.tools.length > 0);

  return (
    <section className="mt-10">
      <SectionHeading
        title={mode === "simple" ? "Tus herramientas ahora" : "Herramientas"}
        meta={`${mode === "simple" ? unlocked.length : all.length}`}
        action={
          <>
            <Link href={`/app/${projectId}/resumen`} className="link-action gap-1.5">
              <SummaryIcon className="h-4 w-4" />
              Resumen completo
            </Link>
            <PdfLink href={`/api/pdf/dossier/${projectId}`} label="Descargar dossier" />
          </>
        }
      />

      {groups.map((group) => (
        <div key={group.label} className="mt-6">
          <h3 className="text-sm font-semibold text-fg/80">
            {group.label} <span className="font-normal text-muted">· {group.tools.length}</span>
          </h3>
          <DashboardStagger className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.tools.map(card)}</DashboardStagger>
        </div>
      ))}

      {mode === "simple" && (
        <>

          {locked.length > 0 && (
            <details className="group mt-6 border rounded-lg border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm text-muted hover:text-accent [&::-webkit-details-marker]:hidden">
                <span>Se irán activando ({locked.length})</span>
                <span aria-hidden className="transition-transform group-open:rotate-90">→</span>
              </summary>
              <ul className="border-t border-line">
                {locked.map((tool) => (
                  <li key={tool.label} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-b-0">
                    <span className="mt-0.5 h-5 w-5 shrink-0 text-muted">{tool.icon}</span>
                    <span className="min-w-0">
                      <span className="text-sm font-semibold">{tool.label}</span>
                      <span className="block text-[13px] text-muted">{tool.description}</span>
                      <span className="mt-0.5 block text-[13px] text-accent">{access[tool.href]?.reason}</span>
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
