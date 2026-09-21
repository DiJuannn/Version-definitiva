import Link from "next/link";
import type { ReactNode } from "react";
import { LinkPendingHint } from "@/components/LinkPendingHint";

const STAT_TONE = {
  warn: "text-warn",
  success: "text-success",
  none: "text-fg",
} as const;

// Tarjeta de herramienta. Dos variantes:
// - "square" (selector de /app/proyectos): icono + nombre en reposo; con
//   ratón, la descripción aparece al pasar por encima (o con el foco de
//   teclado); en pantallas táctiles, donde no hay hover, la descripción va
//   visible debajo del nombre.
// - "row" (Panel del proyecto): compacta, con la descripción siempre visible
//   y, si existe, un dato real del proyecto en reposo ("3 jornadas · 2 sin
//   día"). El hover sube el borde, el icono y muestra "Abrir →".
export function ToolCard({
  href,
  onClick,
  icon,
  label,
  description,
  badge,
  stat,
  variant = "square",
}: {
  href?: string;
  // Alternativa a `href` para cuando el destino no se sabe hasta hacer
  // clic (ej. el selector de herramientas de /app/proyectos, que primero
  // pregunta el proyecto) — renderiza un <button> en vez de un <Link>.
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  description?: string;
  // Etiqueta corta (ej. "PRO") para herramientas de pago.
  badge?: string;
  stat?: { text: string; tone?: "warn" | "success" };
  variant?: "square" | "row";
}) {
  const badgePill = badge && (
    <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] tracking-widest text-bg uppercase">
      {badge}
    </span>
  );

  if (variant === "row") {
    const inner = (
      <div className="flex h-full items-start gap-3.5 border border-line bg-bg-raised/40 p-4 transition duration-300 group-hover:border-accent/60 group-hover:bg-accent/5 group-active:scale-[0.99] max-sm:p-3">
        <div className="h-7 w-7 shrink-0 text-muted transition duration-300 group-hover:-translate-y-0.5 group-hover:text-accent">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold">{label}</span>
            {badgePill}
            {href && <LinkPendingHint />}
          </div>
          {stat && (
            <p className={`mt-1 font-mono text-[11px] ${STAT_TONE[stat.tone ?? "none"]}`}>
              {stat.text}
            </p>
          )}
          {description && (
            <p className="mt-1 line-clamp-1 font-mono text-[11px] leading-relaxed text-muted sm:line-clamp-none">
              {description}
            </p>
          )}
        </div>
        <span
          aria-hidden
          className="shrink-0 self-center font-mono text-xs text-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          →
        </span>
      </div>
    );
    return onClick ? (
      <button type="button" onClick={onClick} className="group block w-full text-left">
        {inner}
      </button>
    ) : (
      <Link href={href!} className="group block">
        {inner}
      </Link>
    );
  }

  const iconBlock = (
    <div className="h-8 w-8 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110">
      {icon}
    </div>
  );

  const inner = (
    <div className="relative flex aspect-square flex-col items-center justify-center gap-2.5 overflow-hidden border border-line p-4 text-center transition duration-300 group-hover:border-accent group-hover:text-accent group-focus-visible:border-accent group-active:scale-[0.97]">
      {badge && <span className="absolute top-2 right-2">{badgePill}</span>}
      {iconBlock}
      <span className="flex items-center font-display text-sm font-bold">
        {label}
        {href && <LinkPendingHint />}
      </span>
      {description && (
        <>
          {/* Táctil: sin hover, la descripción se lee debajo del nombre. */}
          <p className="line-clamp-3 font-mono text-[10px] leading-relaxed text-muted [@media(hover:hover)]:hidden">
            {description}
          </p>
          {/* Ratón o teclado: capa que aparece al pasar por encima o al enfocar. */}
          <div className="absolute inset-0 hidden items-center justify-center bg-bg/95 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:hover)]:flex">
            <p className="font-mono text-[11px] leading-relaxed text-muted">
              {description}
            </p>
          </div>
        </>
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
