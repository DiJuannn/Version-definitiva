"use client";

import { useEffect, useRef, useState } from "react";
import { MediaFrame } from "@/components/MediaFrame";

// Las 5 etapas y sus herramientas están sacadas directamente de
// lib/tool-groups.tsx (la fuente única que usa la propia app de Taller) —
// nada aquí es una función inventada para la demo.
const STAGES = [
  {
    num: "01",
    title: "Organiza",
    tools: ["Tareas", "Calendario", "Localizaciones", "Vehículos"],
    image: null as string | null,
    imageLabel: "Captura — organización del proyecto",
  },
  {
    num: "02",
    title: "Prepara",
    tools: ["Guion", "Desglose", "Personajes", "Shot list", "Storyboard"],
    image: null as string | null,
    imageLabel: "Captura — guion, desglose y shot list",
  },
  {
    num: "03",
    title: "Planifica",
    tools: ["Plan de rodaje"],
    image: null as string | null,
    imageLabel: "Captura — plan de rodaje",
  },
  {
    num: "04",
    title: "Controla",
    tools: ["Presupuesto", "Biblioteca de archivos", "Plantilla de documentos"],
    image: null as string | null,
    imageLabel: "Captura — presupuesto y documentación",
  },
  {
    num: "05",
    title: "Rueda",
    tools: ["Call sheets", "Claqueta"],
    image: null as string | null,
    imageLabel: "Captura — call sheet y claqueta",
  },
];

export function TallerShowcase() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = refs.current.findIndex((el) => el === entry.target);
          if (idx !== -1) setActive(idx);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
      <div>
        {STAGES.map((stage, i) => (
          <div
            key={stage.num}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="flex min-h-[60vh] flex-col justify-center border-t border-line py-10 first:border-t-0 lg:min-h-[85vh] lg:border-t-0 lg:py-0"
          >
            <span
              className={`font-mono text-xs tracking-widest uppercase transition-colors duration-300 ${
                active === i ? "text-accent" : "text-muted"
              }`}
            >
              {stage.num}
            </span>
            <h3 className="mt-2 font-display text-3xl font-black uppercase sm:text-4xl">
              {stage.title}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {stage.tools.map((tool) => (
                <span
                  key={tool}
                  className="border border-line px-3 py-1.5 font-mono text-xs tracking-widest uppercase"
                >
                  {tool}
                </span>
              ))}
            </div>
            <div className="mt-6 lg:hidden">
              <MediaFrame
                src={stage.image}
                alt={stage.title}
                label={stage.imageLabel}
                className="aspect-video"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden lg:sticky lg:top-24 lg:block lg:h-[80vh]">
        <div className="relative h-full w-full overflow-hidden">
          {STAGES.map((stage, i) => (
            <div
              key={stage.num}
              className={`absolute inset-0 transition-opacity duration-500 ${
                active === i ? "opacity-100" : "opacity-0"
              }`}
            >
              <MediaFrame
                src={stage.image}
                alt={stage.title}
                label={stage.imageLabel}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
