import Link from "next/link";
import type { ReactNode } from "react";
import { LinkPendingHint } from "@/components/LinkPendingHint";

export function ToolCard({
  href,
  onClick,
  icon,
  label,
  description,
  badge,
}: {
  href?: string;
  // Alternativa a `href` para cuando el destino no se sabe hasta hacer
  // clic (ej. el selector de herramientas de /app/proyectos, que primero
  // pregunta el proyecto) — renderiza un <button> en vez de un <Link>.
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  description?: string;
  // Etiqueta corta arriba de la tarjeta (ej. "PRO") para herramientas de
  // pago — independiente de si ya tiene pantalla o no.
  badge?: string;
}) {
  const iconBlock = (
    <div className="h-8 w-8 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110">
      {icon}
    </div>
  );

  const badgePill = badge && (
    <span className="absolute top-2 right-2 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] tracking-widest text-bg uppercase">
      {badge}
    </span>
  );

  if (!href && !onClick) {
    return (
      <div className="relative flex aspect-square flex-col items-center justify-center gap-3 border border-line p-4 text-center opacity-40">
        {badgePill}
        {iconBlock}
        <span className="font-display text-sm font-bold uppercase">
          {label}
        </span>
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Próximamente
        </span>
      </div>
    );
  }

  const inner = (
    <div className="relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden border border-line p-4 text-center transition duration-300 group-hover:border-accent group-hover:text-accent group-active:scale-[0.97]">
      {badgePill}
      {iconBlock}
      <span className="flex items-center font-display text-sm font-bold uppercase">
        {label}
        {href && <LinkPendingHint />}
      </span>
      {description && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/95 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <p className="font-mono text-[11px] leading-relaxed text-muted">
            {description}
          </p>
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="group block w-full">
        {inner}
      </button>
    );
  }

  return (
    <Link href={href!} className="group block">
      {inner}
    </Link>
  );
}
