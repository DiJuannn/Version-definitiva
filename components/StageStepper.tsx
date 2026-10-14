import { STAGES } from "@/lib/tool-rules";

// Las cuatro etapas de un proyecto (Idea → Preparar → Rodar → Entregar) como un
// recorrido: círculos unidos por una línea, la etapa actual marcada. Sin cajas.
export function StageStepper({ stage, className = "mt-10" }: { stage: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <ol aria-label="Etapas del proyecto" className={`grid grid-cols-4 ${className}`}>
      {STAGES.map((s, i) => {
        const done = s.id < stage;
        const current = s.id === stage;
        return (
          <li key={s.id} aria-current={current ? "step" : undefined} className="relative min-w-0 pr-2">
            {/* Tramo de línea hasta la siguiente etapa: lleno si ya se ha pasado. */}
            {i < STAGES.length - 1 && (
              <span
                aria-hidden
                className={`absolute top-3 right-0 left-7 h-px ${done ? "bg-accent" : "bg-line"}`}
              />
            )}
            <span
              aria-hidden
              className={`relative flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] ${
                done
                  ? "bg-accent text-bg"
                  : current
                    ? "bg-bg text-accent ring-2 ring-accent"
                    : "bg-bg text-muted ring-1 ring-line"
              }`}
            >
              {done ? "✓" : s.id}
            </span>
            <p
              className={`mt-3 font-display text-sm font-bold sm:text-base ${
                current ? "text-fg" : done ? "text-fg/70" : "text-muted"
              }`}
            >
              {s.label}
              {current && <span className="sr-only"> (etapa actual)</span>}
            </p>
            <p className="mt-0.5 hidden font-sans text-xs text-muted sm:block">{s.hint}</p>
          </li>
        );
      })}
    </ol>
  );
}
