import type { ReactNode } from "react";

// Título de sección del Taller: un h2 legible (no un rótulo diminuto), con
// un dato de contexto al lado y una acción a la derecha.
export function SectionHeading({
  title,
  meta,
  action,
  className = "",
  id,
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${className}`}>
      <h2 id={id} className="text-[1.0625rem] font-bold">
        {title}
      </h2>
      {meta && <span className="text-[13px] text-muted">{meta}</span>}
      {action && <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">{action}</div>}
    </div>
  );
}
