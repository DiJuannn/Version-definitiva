import Link from "next/link";
import type { ReactNode } from "react";

// Piezas comunes de las herramientas de gestión y entrega (presupuesto,
// biblioteca, plantillas, festivales, tareas, equipo, localizaciones,
// vehículos): la línea de «cómo voy» bajo la cabecera, los avisos
// accionables y el «Siguiente: …» del final.

export type StatusTone = "ok" | "warn" | "danger" | "neutral";

const DOT: Record<StatusTone, string> = {
  ok: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
  neutral: "bg-muted",
};

const BAR: Record<Exclude<StatusTone, "neutral">, string> = {
  ok: "border-success",
  warn: "border-warn",
  danger: "border-danger",
};

// «Cómo voy»: una frase clara en lenguaje llano, con un punto de color que
// dice si va bien o hay algo pendiente. Va justo debajo de la cabecera.
export function StatusLine({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <p role="status" className="mt-8 flex items-start gap-3 font-sans text-[15px] leading-relaxed text-fg">
      <span aria-hidden className={`mt-[0.55rem] h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

// Aviso accionable: barra de color a la izquierda, qué pasa y qué hacer.
export function Notice({
  tone = "warn",
  children,
  action,
}: {
  tone?: Exclude<StatusTone, "neutral">;
  children: ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <p className={`border-l-2 ${BAR[tone]} pl-3 font-sans text-sm leading-relaxed text-fg`}>
      {children}
      {action && (
        <>
          {" "}
          <Link href={action.href} className="whitespace-nowrap text-accent underline-offset-4 hover:underline">
            {action.label} →
          </Link>
        </>
      )}
    </p>
  );
}

export function Notices({ children }: { children: ReactNode }) {
  return <div className="mt-4 space-y-2">{children}</div>;
}

// «Siguiente: …» al final de la página, la herramienta que toca después.
export function NextTool({ href, label, note }: { href: string; label: string; note?: string }) {
  return (
    <nav aria-label="Siguiente paso" className="mt-16 border-t border-line pt-5 print:hidden">
      <Link href={href} className="group inline-flex flex-wrap items-baseline gap-x-2 font-sans text-sm text-muted">
        <span className="eyebrow">Siguiente</span>
        <span className="font-medium text-fg transition-colors group-hover:text-accent">{label} →</span>
        {note && <span className="text-muted">{note}</span>}
      </Link>
    </nav>
  );
}

// Título de sección sobre la mesa.
export function SectionTitle({
  id,
  children,
  aside,
}: {
  id: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 id={id} className="font-display text-xl font-black tracking-tight sm:text-2xl">
        {children}
      </h2>
      {aside && <div className="font-sans text-sm text-muted">{aside}</div>}
    </div>
  );
}
