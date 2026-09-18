import Link from "next/link";

// Conmutador de ámbito: la misma herramienta vista para "este proyecto" o
// para "toda la organización", sin salir del contexto del proyecto.
export function ScopeToggle({
  items,
}: {
  items: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div role="group" aria-label="Ámbito" className="inline-flex flex-wrap border border-line">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={`px-4 py-2 font-mono text-[11px] tracking-widest uppercase transition-colors ${
            item.active ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
