import Link from "next/link";
import { PdfLink } from "@/components/PdfLink";
import { SubmitButton } from "@/components/SubmitButton";
import { setProjectStatus } from "@/lib/actions/project-details";
import type { ProjectStatus } from "@/lib/generated/prisma";
import type { NextShoot } from "@/lib/project-roadmap";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function dayText(date: Date) {
  const text = date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isToday(date: Date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function StatusButton({
  projectId,
  status,
  label,
  pendingLabel,
  primary,
}: {
  projectId: string;
  status: ProjectStatus;
  label: string;
  pendingLabel: string;
  primary?: boolean;
}) {
  return (
    <form action={setProjectStatus.bind(null, projectId, status)}>
      <SubmitButton pendingLabel={pendingLabel} className={primary ? "btn btn-primary" : "btn btn-outline"}>
        {label}
      </SubmitButton>
    </form>
  );
}

// Lo que toca en las dos últimas etapas: durante el rodaje, el próximo día y las herramientas del set;
// en la entrega, cerrar el dinero, descargar el dossier y dar el proyecto por terminado.
export function StageFocus({
  projectId,
  stage,
  status,
  nextShoot,
  budget,
}: {
  projectId: string;
  stage: 3 | 4;
  status: ProjectStatus;
  nextShoot: NextShoot | null;
  budget: { planned: number; actual: number; target: number | null };
}) {
  if (stage === 3) {
    const today = nextShoot ? isToday(nextShoot.date) : false;
    return (
      <section aria-labelledby="stage-focus-title" className="mt-6 border border-accent/40 bg-bg-raised/40 p-6 sm:p-8">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Estás rodando</p>
        {nextShoot ? (
          <>
            <h2 id="stage-focus-title" className="mt-1.5 font-display text-2xl font-black tracking-tight sm:text-3xl">
              {today ? "Hoy se rueda" : `Próximo día: ${dayText(nextShoot.date)}`}
            </h2>
            <p className="mt-3 font-mono text-xs text-muted">
              {today ? dayText(nextShoot.date) + " · " : ""}
              {nextShoot.scenesCount} escena{nextShoot.scenesCount === 1 ? "" : "s"} ·{" "}
              {nextShoot.hasCallSheet ? "hoja de llamada lista" : "sin hoja de llamada"}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/app/${projectId}/call-sheets/${nextShoot.id}`} className="btn btn-primary">
                {nextShoot.hasCallSheet ? "Abrir la hoja de llamada" : "Preparar la hoja de llamada"} →
              </Link>
              <Link href={`/app/${projectId}/claqueta`} className="btn btn-outline">
                Claqueta
              </Link>
              <Link href={`/app/${projectId}/script`} className="btn btn-outline">
                Parte de script
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 id="stage-focus-title" className="mt-1.5 font-display text-2xl font-black tracking-tight sm:text-3xl">
              Ya han pasado todos tus días de rodaje
            </h2>
            <p className="mt-3 max-w-xl font-sans text-sm text-muted">
              ¿Has terminado de rodar? Pasa a la última etapa y cierra el proyecto. Si te falta algún día, añádelo en el
              plan de rodaje.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <StatusButton
                projectId={projectId}
                status="POST_PRODUCTION"
                label="He terminado de rodar →"
                pendingLabel="Cambiando…"
                primary
              />
              <Link href={`/app/${projectId}/plan-de-rodaje`} className="btn btn-outline">
                Añadir otro día
              </Link>
            </div>
          </>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 font-mono text-[11px] tracking-widest uppercase">
          <Link href={`/app/${projectId}/plan-de-rodaje`} className="text-muted hover:text-accent">
            Marcar planos rodados
          </Link>
          {nextShoot && (
            <form action={setProjectStatus.bind(null, projectId, "POST_PRODUCTION")}>
              <SubmitButton pendingLabel="Cambiando…" className="tracking-widest text-muted uppercase hover:text-accent">
                Ya he terminado de rodar
              </SubmitButton>
            </form>
          )}
        </div>
      </section>
    );
  }

  const finished = status === "FINISHED";
  const spendDone = budget.actual > 0;
  return (
    <section aria-labelledby="stage-focus-title" className="mt-6 border border-accent/40 bg-bg-raised/40 p-6 sm:p-8">
      <p className={`font-mono text-[11px] tracking-widest uppercase ${finished ? "text-success" : "text-accent"}`}>
        {finished ? "Terminado" : "Recta final"}
      </p>
      <h2 id="stage-focus-title" className="mt-1.5 font-display text-2xl font-black tracking-tight sm:text-3xl">
        {finished ? "Proyecto terminado" : "Cierra tu proyecto"}
      </h2>
      <p className="mt-3 max-w-xl font-sans text-sm text-muted">
        {finished
          ? "Todo queda guardado para consultarlo cuando quieras, y puedes descargar el dossier otra vez."
          : "Antes de darlo por terminado: revisa el dinero real, guarda un dossier y elige dónde presentarlo."}
      </p>
      <ul className="mt-5 grid gap-3">
        <li className="flex flex-wrap items-center justify-between gap-3 border border-line p-4">
          <div>
            <p className="font-display text-sm font-bold">
              <span aria-hidden className="text-muted">○ </span>
              Prepara el montaje
            </p>
            <p className="font-mono text-xs text-muted">Selección de tomas, registro de cortes, checklist de entrega y créditos.</p>
          </div>
          <Link href={`/app/${projectId}/montaje`} className="btn btn-outline">
            Ir a Montaje
          </Link>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 border border-line p-4">
          <div>
            <p className="font-display text-sm font-bold">
              <span aria-hidden className={spendDone ? "text-success" : "text-muted"}>{spendDone ? "✓ " : "○ "}</span>
              Anota el gasto real
            </p>
            <p className="font-mono text-xs text-muted">
              {spendDone ? `${currency(budget.actual)} gastados de ${currency(budget.planned)} previstos` : "Aún no has anotado ningún gasto real."}
            </p>
          </div>
          <Link href={`/app/${projectId}/presupuesto`} className="btn btn-outline">
            Ir al presupuesto
          </Link>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 border border-line p-4">
          <div>
            <p className="font-display text-sm font-bold">
              <span aria-hidden className="text-muted">○ </span>
              Descarga el dossier
            </p>
            <p className="font-mono text-xs text-muted">Un PDF con el resumen del proyecto: escenas, días de rodaje, planos y presupuesto.</p>
          </div>
          <PdfLink href={`/api/pdf/dossier/${projectId}`} label="Descargar dossier" />
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 border border-line p-4">
          <div>
            <p className="font-display text-sm font-bold">
              <span aria-hidden className="text-muted">○ </span>
              Elige festivales donde presentarlo
            </p>
            <p className="font-mono text-xs text-muted">Los de tu zona, los online y dónde ver las convocatorias abiertas.</p>
          </div>
          <Link href={`/app/${projectId}/festivales`} className="btn btn-outline">
            Ver festivales
          </Link>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 border border-line p-4">
          <div>
            <p className="font-display text-sm font-bold">
              <span aria-hidden className={finished ? "text-success" : "text-muted"}>{finished ? "✓ " : "○ "}</span>
              Marca el proyecto como terminado
            </p>
            <p className="font-mono text-xs text-muted">Solo cambia el estado; nada se borra.</p>
          </div>
          {!finished && (
            <StatusButton projectId={projectId} status="FINISHED" label="Está terminado" pendingLabel="Cambiando…" primary />
          )}
        </li>
      </ul>
    </section>
  );
}
