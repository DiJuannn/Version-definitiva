import Link from "next/link";

// Conmutador de ámbito: la misma herramienta vista para "este proyecto" o
// para "toda la organización", sin salir del contexto del proyecto.
export function ScopeToggle({
  items,
}: {
  items: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div role="group" aria-label="Ámbito" className="inline-flex flex-wrap rounded-full bg-fg/[0.06] p-1">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={`rounded-full px-4 py-1.5 font-mono text-[11px] tracking-widest uppercase transition-colors ${
            item.active ? "bg-bg-raised text-fg shadow-sm" : "text-muted hover:text-fg"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
