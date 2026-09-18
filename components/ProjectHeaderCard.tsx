import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import type { ProjectStatus } from "@/lib/generated/prisma";
import type { NextShoot, RoadmapStep } from "@/lib/project-roadmap";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function relativeDay(date: Date): string {
  const now = new Date();
  const days = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

// Lo primero que se ve al entrar en un proyecto: qué es, en qué estado está,
// cuánto lleva hecho, cuándo es el próximo rodaje y cómo va el dinero.
export function ProjectHeaderCard({
  projectId,
  status,
  steps,
  nextShoot,
  budget,
}: {
  projectId: string;
  status: ProjectStatus;
  steps: RoadmapStep[];
  nextShoot: NextShoot | null;
  budget: { planned: number; actual: number; target: number | null };
}) {
  const required = steps.filter((s) => s.required);
  const requiredDone = required.filter((s) => s.isDone).length;
  const pct = required.length > 0 ? Math.round((requiredDone / required.length) * 100) : 0;
  const hasBudget = budget.planned > 0 || budget.actual > 0;
  const base = budget.target ?? budget.planned;
  const actualPct = base > 0 ? Math.min(100, (budget.actual / base) * 100) : 0;
  const over = budget.target !== null && budget.actual > budget.target;

  return (
    <section
      aria-label="Estado del proyecto"
      className="mt-6 grid gap-px overflow-hidden border border-line bg-line lg:grid-cols-[1.2fr_1fr_1fr]"
    >
      <div className="bg-bg-raised p-5">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">Estado</p>
        <div className="mt-2 flex items-center gap-3">
          <StatusPill status={status} />
        </div>
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">
            {requiredDone}/{required.length} pasos requeridos · {pct}%
          </p>
        </div>
      </div>

      <div className="bg-bg-raised p-5">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">Próximo rodaje</p>
        {nextShoot ? (
          <Link
            href={`/app/${projectId}/plan-de-rodaje/${nextShoot.id}`}
            className="group mt-2 block"
          >
            <p className="font-display text-2xl font-black transition-colors group-hover:text-accent">
              {relativeDay(nextShoot.date)}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {nextShoot.date.toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <p className="mt-1 font-mono text-[11px]">
              {nextShoot.scenesCount} escena{nextShoot.scenesCount === 1 ? "" : "s"} ·{" "}
              <span className={nextShoot.hasCallSheet ? "text-success" : "text-warn"}>
                {nextShoot.hasCallSheet ? "call sheet creado" : "call sheet sin crear"}
              </span>
            </p>
          </Link>
        ) : (
          <div className="mt-2">
            <p className="font-display text-2xl font-black text-muted">—</p>
            <Link
              href={`/app/${projectId}/plan-de-rodaje`}
              className="mt-1 inline-block font-mono text-[11px] text-muted underline decoration-line underline-offset-4 hover:text-fg"
            >
              Sin rodajes planificados · Crear plan
            </Link>
          </div>
        )}
      </div>

      <div className="bg-bg-raised p-5">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">Presupuesto</p>
        {hasBudget ? (
          <Link href={`/app/${projectId}/presupuesto`} className="group mt-2 block">
            <p className="font-display text-2xl font-black transition-colors group-hover:text-accent">
              {currency(budget.actual)}
              <span className="ml-1.5 font-mono text-[11px] font-normal text-muted">gastado</span>
            </p>
            <div className="mt-2 h-1 w-full bg-line">
              <div
                className={`h-full ${over ? "bg-danger" : "bg-accent"}`}
                style={{ width: `${actualPct}%` }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-muted">
              {currency(budget.planned)} previstos
              {budget.target !== null ? ` · objetivo ${currency(budget.target)}` : ""}
            </p>
          </Link>
        ) : (
          <Link
            href={`/app/${projectId}/presupuesto`}
            className="mt-2 inline-block font-mono text-[11px] text-muted underline decoration-line underline-offset-4 hover:text-fg"
          >
            Sin presupuesto · Crear categorías
          </Link>
        )}
      </div>
    </section>
  );
}
