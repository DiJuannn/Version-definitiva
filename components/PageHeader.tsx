import type { ReactNode } from "react";
import { BackLink } from "@/components/BackLink";

// La etiqueta de fase lleva el color de su fase (el mismo de la tira de
// película y del menú del proyecto).
const PHASE_OF_EYEBROW: Record<string, number> = { Escribir: 1, Preparar: 2, Rodar: 3, Entregar: 4 };

// Cabecera común de las páginas de herramienta: fase, título en letra de
// cartel y una línea de para qué sirve, con las acciones a la derecha. Si la
// herramienta trae `guide`, un «Cómo se usa» desplegable explica los pasos
// (cerrado: no estorba a quien ya la conoce). El «volver» solo aparece en
// fichas de detalle.
export function PageHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  actions,
  guide,
}: {
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  guide?: ReactNode[];
}) {
  const phase = eyebrow ? PHASE_OF_EYEBROW[eyebrow.split(" ")[0]] : undefined;
  return (
    <header>
      {backHref && (
        <div className="mb-4 print:hidden">
          <BackLink href={backHref}>{backLabel}</BackLink>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="eyebrow flex items-center gap-2" style={{ color: phase ? `var(--phase-${phase})` : "var(--accent)" }}>
              {phase && <span aria-hidden className="h-2 w-2 rounded-full bg-current" />}
              {eyebrow}
            </p>
          )}
          <h1 className="poster-title mt-1.5 text-[44px] sm:text-[56px]">{title}</h1>
          {description && <p className="mt-2.5 max-w-3xl font-sans text-[15px] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3 print:hidden">{actions}</div>}
      </div>
      {guide && guide.length > 0 && (
        <details className="group mt-4 max-w-3xl print:hidden">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-line px-3 py-1 font-sans text-[13px] text-muted transition-colors hover:border-accent hover:text-fg [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-fg/10 text-[10px] font-bold">
              ?
            </span>
            Cómo se usa
            <span aria-hidden className="text-[10px] transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {guide.map((step, i) => (
              <li key={i} className="rounded-lg border border-line bg-bg-raised/40 p-3.5 font-sans text-[13.5px] leading-snug">
                <span className="poster-sub block text-[22px] leading-none" style={{ color: phase ? `var(--phase-${phase})` : "var(--accent)" }}>
                  {i + 1}
                </span>
                <span className="mt-1.5 block text-fg/85">{step}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </header>
  );
}
