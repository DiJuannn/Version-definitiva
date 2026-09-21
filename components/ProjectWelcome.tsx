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
    unlocks: "Desglose, Shot list, Storyboard, Moodboard, Localizaciones y Plan de rodaje.",
  },
  {
    label: "Rodar",
    what: "Preparas la hoja de llamada de cada día, la compartes con el equipo y marcas las tomas en el set.",
    unlocks: "Call sheets, Claqueta digital y Parte de script.",
  },
  {
    label: "Entregar",
    what: "Anotas el gasto real, descargas el dossier del proyecto y lo das por terminado.",
    unlocks: "El presupuesto con el gasto real y el dossier en PDF.",
  },
];

// Se enseña la primera vez que alguien abre un proyecto vacío (o con «¿Cómo funciona?»): el mapa completo
// en 30 segundos y el aviso de que las herramientas se van abriendo solas.
export function ProjectWelcome({ projectId }: { projectId: string }) {
  return (
    <section aria-labelledby="welcome-title" className="mt-6 border border-accent/40 bg-accent/5 p-6 sm:p-8">
      <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Bienvenida · 30 segundos</p>
      <h2 id="welcome-title" className="mt-1.5 font-display text-2xl font-black tracking-tight sm:text-3xl">
        Así se hace un proyecto aquí
      </h2>
      <p className="mt-3 max-w-2xl font-sans text-sm text-muted">
        Un proyecto tiene cuatro etapas. No tienes que aprender todas las herramientas: se van abriendo cuando te
        hacen falta y siempre te digo cuál es el siguiente paso.
      </p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.label} className="border border-line bg-bg/60 p-4">
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              {i + 1} · {step.label}
            </p>
            <p className="mt-2 font-sans text-sm">{step.what}</p>
            <p className="mt-2 font-mono text-[11px] text-muted">{step.unlocks}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5 max-w-2xl font-sans text-xs text-muted">
        ¿Prefieres verlo todo desde el principio? Abajo, en «Mostrar todas las herramientas», tienes el modo completo.
      </p>
      <form action={dismissWelcome.bind(null, projectId)} className="mt-5">
        <SubmitButton pendingLabel="Un momento…" className="btn btn-primary">
          Entendido, empezar →
        </SubmitButton>
      </form>
    </section>
  );
}
