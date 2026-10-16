"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { TOOL_GROUPS } from "@/lib/tool-groups";
import { isUnlocked, type ToolAccess, type ToolMode } from "@/lib/tool-rules";
import type { ChainStep, ResourceStatus } from "@/lib/project-readiness";

const TOOLS = new Map(TOOL_GROUPS.flatMap((g) => g.tools).map((t) => [t.href, t]));
const OPEN_EVENT = "project-nav:open";

export type SidebarData = {
  chain: ChainStep[];
  now: string | null;
  resources: Record<string, ResourceStatus>;
  todayDayId: string | null;
  overdueTasks: number;
};

// Lo que no es de la cadena, en el orden en que se usa.
const RESOURCES: { href: string; label: string }[] = [
  { href: "personajes", label: "Personajes" },
  { href: "equipo", label: "Equipo técnico" },
  { href: "localizaciones", label: "Localizaciones" },
  { href: "presupuesto", label: "Presupuesto" },
  { href: "moodboard", label: "Moodboard" },
];
const ON_SET: { href: string; label: string }[] = [
  { href: "claqueta", label: "Claqueta" },
  { href: "script", label: "Parte de script" },
  { href: "vehiculos", label: "Vehículos" },
];
const AFTER: { href: string; label: string }[] = [
  { href: "montaje", label: "Montaje" },
  { href: "festivales", label: "Festivales" },
  { href: "documentos", label: "Archivos" },
  { href: "documentos-legales", label: "Contratos y permisos" },
];

// Etiqueta de la herramienta abierta (para el botón del menú en móvil).
const LABELS: Record<string, string> = {
  "": "Mesa de preparación",
  resumen: "Resumen",
  tareas: "Tareas",
  guion: "Guion",
  desglose: "Desglose",
  "shot-list": "Planos",
  storyboard: "Storyboard",
  "plan-de-rodaje": "Plan de rodaje",
  "call-sheets": "Hojas de llamada",
  ...Object.fromEntries([...RESOURCES, ...ON_SET, ...AFTER].map((t) => [t.href, t.label])),
};

// El menú del proyecto: todas las herramientas a la vista y en orden de
// importancia. Arriba la Mesa de preparación y el Resumen; después la cadena
// que lleva del guion al rodaje (numerada, con su avance y «Ahora» en lo que
// toca); luego quién, dónde y cuánto; y, más pequeño, el rodaje y lo de
// después. En pantallas estrechas es un cajón que abre ProjectNavButton.
export function ProjectSidebar({ projectId, data, access, mode }: { projectId: string; data: SidebarData; access: Record<string, ToolAccess>; mode: ToolMode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prev, setPrev] = useState(pathname);
  if (prev !== pathname) {
    setPrev(pathname);
    setOpen(false);
  }
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const base = `/app/${projectId}`;
  const segment = pathname.split("/")[3] ?? "";
  const done = data.chain.filter((c) => c.state === "done").length;
  const locked = (href: string) => mode === "simple" && !isUnlocked(access, href) && segment !== href;

  const content = (
    <nav aria-label="Herramientas del proyecto" className="flex flex-col gap-0.5 px-3 pt-4 pb-8 font-sans">
      <TopLink href={base} on={segment === ""} label="Mesa de preparación" sub="qué falta para rodar" />
      <TopLink href={`${base}/resumen`} on={segment === "resumen"} label="Resumen" sub="el proyecto en una página" />

      <Section title="De guion a rodaje" extra={`${done} de ${data.chain.length}`} />
      <ol className="relative">
        <span aria-hidden className="absolute top-4 bottom-4 left-[19px] w-[2px] bg-line" />
        {data.chain.map((step, i) => {
          const on = segment === step.key;
          const isNow = data.now === step.key;
          const isLocked = locked(step.key);
          const dot =
            step.state === "done" ? (
              <span className="z-[1] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--phase-4)] text-[11px] font-bold text-ink-0">✓</span>
            ) : (
              <span
                className={`z-[1] grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] bg-bg font-mono text-[11px] font-semibold ${
                  step.state === "partial" || isNow ? "border-[var(--phase-2)] text-[var(--phase-2)]" : "border-ink-3 text-muted"
                }`}
              >
                {i + 1}
              </span>
            );
          const body = (
            <>
              {dot}
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] leading-tight font-semibold">{step.label}</span>
                <span className="mt-0.5 block truncate text-[12px] text-muted">{step.meta}</span>
              </span>
              {isNow && <span className="shrink-0 rounded-[3px] bg-[var(--phase-2)] px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.06em] text-ink-0">AHORA</span>}
            </>
          );
          const cls = `relative flex items-center gap-3 rounded-[var(--r-sm)] px-2.5 py-2 transition-colors`;
          return (
            <li key={step.key}>
              {isLocked ? (
                <span title={access[step.key]?.reason} className={`${cls} cursor-default opacity-45`}>
                  {body}
                </span>
              ) : (
                <Link
                  href={`${base}/${step.key}`}
                  aria-current={on ? "page" : undefined}
                  className={`${cls} ${on ? "bg-ink-2 shadow-[inset_3px_0_0_var(--gel)]" : "hover:bg-ink-2/60"}`}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <Section title="Quién, dónde, cuánto" />
      {RESOURCES.map((t) => {
        const r = data.resources[t.href];
        return (
          <ToolLink key={t.href} href={`${base}/${t.href}`} tool={t.href} label={t.label} on={segment === t.href} locked={locked(t.href)} reason={access[t.href]?.reason}>
            {r?.meta && <span className={`ml-auto shrink-0 font-mono text-[11px] ${r.warn ? "text-warn" : "text-muted"}`}>{r.meta}</span>}
          </ToolLink>
        );
      })}

      <Section title="En el rodaje" />
      {data.todayDayId && (
        <Link
          href={`${base}/plan-de-rodaje/directo?dia=${data.todayDayId}`}
          aria-current={pathname.endsWith("/directo") ? "page" : undefined}
          className="flex items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-1.5 text-[14px] font-semibold text-rec hover:bg-ink-2/60"
        >
          <span aria-hidden className="mx-[3px] h-2.5 w-2.5 rounded-full bg-rec" />
          Hoy se rueda
        </Link>
      )}
      {ON_SET.map((t) => (
        <ToolLink key={t.href} small href={`${base}/${t.href}`} tool={t.href} label={t.label} on={segment === t.href} locked={locked(t.href)} reason={access[t.href]?.reason} />
      ))}

      <Section title="Después" />
      {AFTER.map((t) => (
        <ToolLink key={t.href} small href={`${base}/${t.href}`} tool={t.href} label={t.label} on={segment === t.href} locked={locked(t.href)} reason={access[t.href]?.reason} />
      ))}

      <div className="mt-3 border-t border-line pt-3">
        <ToolLink small href={`${base}/tareas`} tool="tareas" label="Tareas" on={segment === "tareas"}>
          {data.overdueTasks > 0 && <span className="ml-auto font-mono text-[11px] text-warn">{data.overdueTasks} vencidas</span>}
        </ToolLink>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="hidden border-r border-line bg-[color-mix(in_srgb,var(--bg)_70%,black)] lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto print:hidden">
        {content}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Herramientas del proyecto">
          <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60" />
          <div className="taller-ink absolute inset-y-0 left-0 w-[min(300px,86vw)] overflow-y-auto border-r border-line bg-bg text-fg">{content}</div>
        </div>
      )}
    </>
  );
}

// En móvil: el botón que abre el menú, con el nombre de la herramienta abierta.
export function ProjectNavButton() {
  const segment = usePathname().split("/")[3] ?? "";
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="flex min-w-0 items-center gap-1.5 rounded-[var(--r-sm)] border border-line px-2.5 py-1.5 font-sans text-[13.5px] lg:hidden"
    >
      <span className="truncate">{LABELS[segment] ?? "Herramientas"}</span>
      <span aria-hidden className="text-[10px] text-muted">▾</span>
    </button>
  );
}

function TopLink({ href, on, label, sub }: { href: string; on: boolean; label: string; sub: string }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`rounded-[var(--r-sm)] px-2.5 py-2 transition-colors ${on ? "bg-ink-2 shadow-[inset_3px_0_0_var(--gel)]" : "hover:bg-ink-2/60"}`}
    >
      <span className="block text-[15px] leading-tight font-semibold">{label}</span>
      <span className="block text-[12px] text-muted">{sub}</span>
    </Link>
  );
}

function Section({ title, extra }: { title: string; extra?: string }) {
  return (
    <p className="mt-5 mb-1 flex justify-between px-2.5 font-mono text-[10.5px] tracking-[0.16em] text-muted uppercase">
      {title}
      {extra && <span className="text-[var(--phase-2)]">{extra}</span>}
    </p>
  );
}

function ToolLink({
  href,
  tool,
  label,
  on,
  locked,
  reason,
  small,
  children,
}: {
  href: string;
  tool: string;
  label: string;
  on: boolean;
  locked?: boolean;
  reason?: string;
  small?: boolean;
  children?: ReactNode;
}) {
  const icon = TOOLS.get(tool)?.icon;
  const cls = `flex items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 transition-colors ${small ? "py-1.5 text-[13.5px]" : "py-2 text-[14px]"}`;
  const body = (
    <>
      <span className={`h-4 w-4 shrink-0 ${small ? "opacity-60" : "opacity-80"}`}>{icon}</span>
      <span className="truncate">{label}</span>
      {children}
    </>
  );
  if (locked)
    return (
      <span title={reason} className={`${cls} cursor-default text-muted/45`}>
        {body}
      </span>
    );
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`${cls} ${on ? "bg-ink-2 font-semibold text-fg shadow-[inset_3px_0_0_var(--gel)]" : small ? "text-muted hover:bg-ink-2/60 hover:text-fg" : "text-fg/85 hover:bg-ink-2/60 hover:text-fg"}`}
    >
      {body}
    </Link>
  );
}
