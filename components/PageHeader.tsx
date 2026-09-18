import type { ReactNode } from "react";
import { BackLink } from "@/components/BackLink";

// Cabecera común de las páginas de herramienta: volver + acciones a la
// derecha, y debajo etiqueta, título grande y una línea de contexto.
export function PageHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  actions,
}: {
  backHref: string;
  backLabel: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <BackLink href={backHref}>{backLabel}</BackLink>
        {actions}
      </div>
      <div className="mt-6">
        {eyebrow && (
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight uppercase sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl font-sans text-sm text-muted">{description}</p>
        )}
      </div>
    </header>
  );
}
