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

// Lo primero que se ve al entrar en un proyecto (cuando ya tiene datos): qué es, en qué estado está,
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

  const LABEL = "eyebrow";
  const VALUE = "mt-2 font-display text-2xl font-black tracking-tight";

  // Tres datos en fila sobre el papel, separados por una línea vertical (sin una caja por dato).
  return (
    <section
      aria-label="Estado del proyecto"
      className="mt-8 grid gap-y-6 border-y border-line py-6 sm:grid-cols-3 sm:divide-x sm:divide-line"
    >
      <div className="sm:pr-8">
        <p className={LABEL}>Estado</p>
        <div className="mt-3">
          <StatusPill status={status} />
        </div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 font-sans text-xs text-muted">
          {requiredDone} de {required.length} pasos esenciales · {pct}%
        </p>
      </div>

      <div className="sm:px-8">
        <p className={LABEL}>Próximo rodaje</p>
        {nextShoot ? (
          <Link href={`/app/${projectId}/plan-de-rodaje/${nextShoot.id}`} className="group block">
            <p className={`${VALUE} transition-colors group-hover:text-accent`}>{relativeDay(nextShoot.date)}</p>
            <p className="mt-1 font-sans text-xs text-muted first-letter:uppercase">
              {nextShoot.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
              {nextShoot.scenesCount} escena{nextShoot.scenesCount === 1 ? "" : "s"}
            </p>
            <p className={`mt-1 font-sans text-xs ${nextShoot.hasCallSheet ? "text-success" : "text-warn"}`}>
              {nextShoot.hasCallSheet ? "Hoja de llamada lista" : "Hoja de llamada sin crear"}
            </p>
          </Link>
        ) : (
          <>
            <p className={`${VALUE} text-muted`}>Sin fecha</p>
            <Link href={`/app/${projectId}/plan-de-rodaje`} className="mt-1 inline-block font-sans text-xs text-accent hover:underline">
              Crear el plan de rodaje →
            </Link>
          </>
        )}
      </div>

      <div className="sm:pl-8">
        <p className={LABEL}>Presupuesto</p>
        {hasBudget ? (
          <Link href={`/app/${projectId}/presupuesto`} className="group block">
            <p className={`${VALUE} transition-colors group-hover:text-accent`}>
              {currency(budget.actual)}
              <span className="ml-1.5 font-sans text-xs font-normal tracking-normal text-muted">gastado</span>
            </p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
              <div className={`h-full rounded-full ${over ? "bg-danger" : "bg-accent"}`} style={{ width: `${actualPct}%` }} />
            </div>
            <p className="mt-2 font-sans text-xs text-muted">
              {currency(budget.planned)} previstos
              {budget.target !== null ? ` · objetivo ${currency(budget.target)}` : ""}
            </p>
          </Link>
        ) : (
          <>
            <p className={`${VALUE} text-muted`}>—</p>
            <Link href={`/app/${projectId}/presupuesto`} className="mt-1 inline-block font-sans text-xs text-accent hover:underline">
              Preparar las categorías →
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
