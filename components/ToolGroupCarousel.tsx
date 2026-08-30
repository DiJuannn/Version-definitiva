"use client";

import { useRef, useState, type ReactNode } from "react";
import { ToolCard } from "@/components/ToolCard";
import { DashboardStagger } from "@/components/DashboardMotion";

type Tool = {
  icon: ReactNode;
  label: string;
  href: string;
  description: string;
};

type Group = { label: string; tools: Tool[] };

// Solo para móvil (el contenedor la oculta en sm+): los grupos de
// herramientas se deslizan horizontalmente, uno por pantalla, con puntos
// indicando en cuál se está — mismo patrón que Linear. Scroll-snap nativo,
// sin librerías nuevas.
//
// `href` debe llegar ya resuelto (URL final) — una función no se puede
// pasar de un Server Component a este Client Component.
export function ToolGroupCarousel({ groups }: { groups: Group[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="sm:hidden">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto"
      >
        {groups.map((group) => (
          <div key={group.label} className="w-full shrink-0 snap-center">
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              {group.label}
            </p>
            <DashboardStagger className="mt-3 grid grid-cols-2 gap-4">
              {group.tools.map((tool) => (
                <ToolCard
                  key={tool.label}
                  icon={tool.icon}
                  label={tool.label}
                  description={tool.description}
                  href={tool.href}
                />
              ))}
            </DashboardStagger>
          </div>
        ))}
      </div>
      {groups.length > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {groups.map((group, i) => (
            <span
              key={group.label}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === active ? "bg-accent" : "bg-line"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
