import { STAGES } from "@/lib/tool-rules";

// Las cuatro etapas de un proyecto (Idea → Preparar → Rodar → Entregar) y en cuál está.
export function StageStepper({ stage }: { stage: 1 | 2 | 3 | 4 }) {
  return (
    <ol aria-label="Etapas del proyecto" className="mt-8 grid grid-cols-4 gap-2">
      {STAGES.map((s) => {
        const done = s.id < stage;
        const current = s.id === stage;
        return (
          <li key={s.id} aria-current={current ? "step" : undefined}>
            <div className={`h-1 ${done ? "bg-accent" : current ? "bg-accent/60" : "bg-line"}`} />
            <p
              className={`mt-2 flex items-center gap-1.5 font-mono text-[11px] tracking-widest uppercase ${
                current ? "text-accent" : done ? "text-fg" : "text-muted"
              }`}
            >
              {done && <span aria-hidden className="text-success">✓</span>}
              {s.label}
            </p>
            <p className="mt-0.5 hidden font-sans text-xs text-muted sm:block">{s.hint}</p>
          </li>
        );
      })}
    </ol>
  );
}
