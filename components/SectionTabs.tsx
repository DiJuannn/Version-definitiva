"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type SectionTab = {
  id: string;
  label: string;
  // Número de elementos de la pestaña; se muestra aunque sea 0 para que se
  // vea que existe y se puede rellenar.
  count?: number;
  // Punto de aviso (algo pendiente de revisar dentro de la pestaña).
  alert?: boolean;
  // Solo con layout="side": título del grupo, en pantallas anchas.
  group?: string;
  content: ReactNode;
};

// Navegación por pestañas para pantallas con varias secciones del mismo peso:
// en vez de apilarlas y obligar a hacer scroll hasta la tercera, se ve una a la
// vez y todas quedan a un toque, con su contador. El contenido de cada pestaña
// llega ya renderizado desde el servidor; aquí solo se decide cuál se ve.
//
// - layout="top": fila de pestañas encima del contenido (2-4 pestañas).
// - layout="side": lista vertical a la izquierda en pantallas anchas (muchas
//   pestañas, todas visibles sin desplazarse) y fila con scroll en móvil.
//
// La pestaña activa se guarda en ?tab= (replaceState, sin recargar) para que
// al recargar o compartir el enlace se vea la misma.
export function SectionTabs({
  tabs,
  initial,
  layout = "top",
  ariaLabel,
}: {
  tabs: SectionTab[];
  initial?: string;
  layout?: "top" | "side";
  ariaLabel: string;
}) {
  const [active, setActive] = useState(
    tabs.some((t) => t.id === initial) ? (initial as string) : tabs[0].id,
  );
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const side = layout === "side";

  function select(id: string, focus = false) {
    setActive(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // Sin history (vista previa aislada): la pestaña sigue funcionando.
    }
    const button = buttons.current[id];
    if (button) {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (focus) button.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const prev = side ? ["ArrowLeft", "ArrowUp"] : ["ArrowLeft"];
    const next = side ? ["ArrowRight", "ArrowDown"] : ["ArrowRight"];
    let target: number | null = null;
    if (next.includes(event.key)) target = (index + 1) % tabs.length;
    else if (prev.includes(event.key)) target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = tabs.length - 1;
    if (target === null) return;
    event.preventDefault();
    select(tabs[target].id, true);
  }

  return (
    <div className={side ? "lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10" : undefined}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={side ? "vertical" : "horizontal"}
        className={
          side
            ? "-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:sticky lg:top-28 lg:mx-0 lg:h-fit lg:flex-col lg:gap-0 lg:overflow-visible lg:border-b-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
            : "-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        }
      >
        {tabs.map((tab, i) => {
          const isActive = tab.id === active;
          const showGroup = side && tab.group && tab.group !== tabs[i - 1]?.group;
          return (
            <div key={tab.id} className="contents">
              {showGroup && (
                <p
                  className={`hidden pb-2 font-mono text-[10px] tracking-widest text-muted uppercase lg:block ${
                    i > 0 ? "pt-6" : ""
                  }`}
                >
                  {tab.group}
                </p>
              )}
              <button
                ref={(el) => {
                  buttons.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => select(tab.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-3 font-mono text-xs tracking-widest uppercase transition-colors ${
                  side
                    ? `-mb-px border-b-2 lg:mb-0 lg:justify-between lg:border-b-0 lg:border-l-2 lg:py-2.5 ${
                        isActive
                          ? "border-accent text-fg lg:bg-bg-raised"
                          : "border-transparent text-muted hover:text-fg"
                      }`
                    : `-mb-px border-b-2 ${
                        isActive
                          ? "border-accent text-fg"
                          : "border-transparent text-muted hover:text-fg"
                      }`
                }`}
              >
                <span>{tab.label}</span>
                {tab.alert && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-warn"
                    role="img"
                    aria-label="Pendiente de revisar"
                  />
                )}
                {typeof tab.count === "number" && (
                  <span
                    className={`rounded-full border px-1.5 py-px text-[10px] tracking-normal ${
                      isActive
                        ? "border-accent text-accent"
                        : tab.count === 0
                          ? "border-line text-muted/60"
                          : "border-line text-muted"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 min-w-0 lg:mt-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            hidden={tab.id !== active}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
