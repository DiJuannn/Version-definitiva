import { SubmitButton } from "@/components/SubmitButton";
import { dismissWelcome } from "@/lib/actions/tool-mode";

const STEPS = [
  {
    label: "Idea",
    what: "Subes tu guion y la IA propone las escenas, los personajes y los sitios.",
    unlocks: "Guion, Personajes, Presupuesto y Tareas desde el primer día.",
  },
  {
    label: "Preparar",
    what: "Decides cuándo y dónde rodar: te propongo un plan de rodaje y las categorías del presupuesto.",
    unlocks: "Desglose, Lista de planos, Storyboard, Moodboard, Localizaciones y Plan de rodaje.",
  },
  {
    label: "Rodar",
    what: "Preparas la hoja de llamada de cada día, la compartes con el equipo y marcas las tomas en el set.",
    unlocks: "Hojas de llamada, Claqueta digital y Parte de script.",
  },
  {
    label: "Entregar",
    what: "Preparas el montaje, anotas el gasto real, descargas el dossier, eliges festivales donde presentarlo y lo das por terminado.",
    unlocks: "Montaje, Festivales de tu zona, el gasto real y el dossier en PDF.",
  },
];

// Se enseña la primera vez que alguien abre un proyecto vacío (o con «¿Cómo funciona?»): el mapa completo
// en 30 segundos y el aviso de que las herramientas se van abriendo solas. Va sobre el papel, sin caja:
// a la izquierda la idea, a la derecha las cuatro etapas como un recorrido vertical.
export function ProjectWelcome({ projectId }: { projectId: string }) {
  return (
    <section
      aria-labelledby="welcome-title"
      className="mt-10 grid gap-x-16 gap-y-8 border-t border-line pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]"
    >
      <div>
        <p className="eyebrow text-accent">Cómo funciona · 30 segundos</p>
        <h2 id="welcome-title" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
          Así se hace un proyecto aquí
        </h2>
        <p className="mt-4 max-w-md font-sans text-[15px] leading-relaxed text-muted">
          Un proyecto pasa por cuatro etapas. No tienes que aprender todas las herramientas: se van abriendo cuando
          te hacen falta y siempre te digo cuál es el siguiente paso.
        </p>
        <form action={dismissWelcome.bind(null, projectId)} className="mt-6">
          <SubmitButton pendingLabel="Un momento…" className="btn btn-primary">
            Entendido, empezar →
          </SubmitButton>
        </form>
        <p className="mt-4 max-w-md font-sans text-xs leading-relaxed text-muted">
          ¿Prefieres verlo todo desde el principio? Más abajo, en «Mostrar todas las herramientas», tienes el modo
          completo.
        </p>
      </div>

      <ol className="relative">
        {STEPS.map((step, i) => (
          <li key={step.label} className="relative grid grid-cols-[2rem_1fr] gap-x-4 pb-7 last:pb-0">
            {/* Hilo que une las etapas. */}
            {i < STEPS.length - 1 && <span aria-hidden className="absolute top-8 bottom-1 left-4 w-px bg-line" />}
            <span
              aria-hidden
              className={`relative flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs ${
                i === 0 ? "bg-accent text-bg" : "bg-bg text-accent ring-1 ring-accent/40"
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className="font-display text-base font-bold">{step.label}</p>
              <p className="mt-1 font-sans text-sm leading-relaxed">{step.what}</p>
              <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted">
                <span className="text-accent">Se abre:</span> {step.unlocks}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
