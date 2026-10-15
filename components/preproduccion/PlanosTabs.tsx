import Link from "next/link";

// Planos es una herramienta con dos vistas: la lista (cómo se rueda cada
// escena) y el storyboard (cómo se ve cada plano).
export function PlanosTabs({ projectId, active }: { projectId: string; active: "lista" | "storyboard" }) {
  const tab = (on: boolean) =>
    `-mb-px border-b-2 px-3.5 py-2.5 font-sans text-[14px] transition-colors ${
      on ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg"
    }`;
  return (
    <nav aria-label="Vistas de Planos" className="mt-8 flex gap-1 border-b border-line">
      <Link href={`/app/${projectId}/shot-list`} aria-current={active === "lista" ? "page" : undefined} className={tab(active === "lista")}>
        Lista de planos
      </Link>
      <Link href={`/app/${projectId}/storyboard`} aria-current={active === "storyboard" ? "page" : undefined} className={tab(active === "storyboard")}>
        Storyboard
      </Link>
    </nav>
  );
}
