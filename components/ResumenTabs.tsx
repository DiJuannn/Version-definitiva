import Link from "next/link";

// Dos vistas del mismo Resumen: la lista de apartados y el Mapa del proyecto.
// Son enlaces (?vista=mapa) para que el servidor solo calcule lo que se ve.
export function ResumenTabs({ projectId, active }: { projectId: string; active: "resumen" | "mapa" }) {
  const tab = (isActive: boolean) =>
    `-mb-px border-b-2 px-3.5 py-3 font-mono text-xs tracking-widest uppercase transition-colors ${
      isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
    }`;
  return (
    <nav aria-label="Vistas del resumen" className="mt-8 flex gap-1 border-b border-line">
      <Link href={`/app/${projectId}/resumen`} aria-current={active === "resumen" ? "page" : undefined} className={tab(active === "resumen")}>
        Resumen
      </Link>
      <Link href={`/app/${projectId}/resumen?vista=mapa`} aria-current={active === "mapa" ? "page" : undefined} className={tab(active === "mapa")}>
        Mapa del proyecto
      </Link>
    </nav>
  );
}
