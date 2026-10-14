import { STAGES } from "@/lib/tool-rules";

// Las cuatro etapas de un proyecto como una vía corta: lo hecho en acento
// apagado, la etapa actual encendida y con nombre, lo que queda en gris.
// Se lee de un vistazo en qué punto está cada proyecto de una lista.
export function ProjectStageTrack({ stage, className = "" }: { stage: 1 | 2 | 3 | 4; className?: string }) {
  const current = STAGES[stage - 1];
  return (
    <span className={`block ${className}`}>
      <span className="sr-only">
        Etapa {stage} de 4: {current.label}
      </span>
      <span aria-hidden className="flex gap-1">
        {STAGES.map((s) => (
          <span
            key={s.id}
            className={`h-1.5 flex-1 rounded-full ${
              s.id < stage ? "bg-accent/45" : s.id === stage ? "bg-accent" : "bg-fg/10"
            }`}
          />
        ))}
      </span>
      <span aria-hidden className="mt-2 flex gap-1 font-mono text-[10px] tracking-wide uppercase">
        {STAGES.map((s) => (
          <span key={s.id} className={`flex-1 truncate ${s.id === stage ? "text-fg" : "text-muted/60"}`}>
            {s.label}
          </span>
        ))}
      </span>
    </span>
  );
}
