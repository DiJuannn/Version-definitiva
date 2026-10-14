import type { ReactNode } from "react";
import { BackLink } from "@/components/BackLink";

// Cabecera común de las páginas de herramienta: etiqueta, título grande y una
// línea de contexto, con las acciones a la derecha del título. El «volver»
// solo aparece en fichas de detalle (volver a la lista): en las herramientas
// la cabecera del proyecto ya dice dónde estás.
export function PageHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  actions,
}: {
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header>
      {backHref && (
        <div className="mb-5 print:hidden">
          <BackLink href={backHref}>{backLabel}</BackLink>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow text-accent">{eyebrow}</p>}
          <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight uppercase sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 max-w-2xl font-sans text-[15px] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3 print:hidden">{actions}</div>}
      </div>
    </header>
  );
}
