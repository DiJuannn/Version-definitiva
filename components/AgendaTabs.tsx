import Link from "next/link";

// Agenda = el calendario y las tareas de la productora, dos vistas de lo mismo:
// qué hay que hacer y cuándo.
export function AgendaTabs({ active }: { active: "calendario" | "tareas" }) {
  const tab = (on: boolean) =>
    `-mb-px border-b-2 px-3.5 py-2.5 font-sans text-[14px] transition-colors ${
      on ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg"
    }`;
  return (
    <nav aria-label="Agenda" className="mb-8 flex gap-1 border-b border-line">
      <Link href="/app/calendario" aria-current={active === "calendario" ? "page" : undefined} className={tab(active === "calendario")}>
        Calendario
      </Link>
      <Link href="/app/tareas" aria-current={active === "tareas" ? "page" : undefined} className={tab(active === "tareas")}>
        Tareas
      </Link>
    </nav>
  );
}
