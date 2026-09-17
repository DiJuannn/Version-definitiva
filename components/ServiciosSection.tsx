"use client";

import { useState } from "react";
import { Reveal } from "@/components/Reveal";
import { MediaFrame } from "@/components/MediaFrame";

export type ServicioView = {
  num: string;
  title: string;
  description: string;
  details: string | null;
  imageUrl?: string | null;
};

// La imagen de la derecha cambia según qué servicio tiene el ratón encima
// (hover no existe en móvil, así que ahí cada fila lleva su propia
// miniatura siempre visible en vez de depender de una interacción que no
// se puede hacer con el dedo).
export function ServiciosSection({ servicios }: { servicios: ServicioView[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
      <div className="border-t border-line">
        {servicios.map((servicio, i) => (
          <Reveal key={servicio.num} delay={i * 0.06}>
            <div onMouseEnter={() => setActive(i)}>
              <div className="mt-6 lg:hidden">
                <MediaFrame
                  src={servicio.imageUrl}
                  alt={servicio.title}
                  label={`${servicio.title} — fotografía`}
                  className="aspect-video"
                />
              </div>
              {servicio.details ? (
                <details className="group/service border-b border-line">
                  <summary className="grid cursor-pointer list-none grid-cols-[3rem_1fr_2fr_auto] items-baseline gap-6 py-6 pl-0 transition-all duration-300 [&::-webkit-details-marker]:hidden hover:pl-4 sm:grid-cols-[4rem_1fr_2fr_auto]">
                    <span className="font-mono text-sm text-muted transition-colors group-hover/service:text-accent">
                      {servicio.num}
                    </span>
                    <h3 className="font-display text-2xl font-bold uppercase transition-colors sm:text-3xl group-hover/service:text-accent">
                      {servicio.title}
                    </h3>
                    <p className="font-mono text-sm text-muted">
                      {servicio.description}
                    </p>
                    <span className="font-mono text-muted transition-transform duration-300 group-open/service:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="-mt-2 max-w-2xl pb-6 font-mono text-sm text-muted sm:pl-[calc(4rem+1.5rem)]">
                    {servicio.details}
                  </p>
                </details>
              ) : (
                <div className="group grid grid-cols-[3rem_1fr_2fr] items-baseline gap-6 border-b border-line py-6 pl-0 transition-all duration-300 hover:pl-4 sm:grid-cols-[4rem_1fr_2fr]">
                  <span className="font-mono text-sm text-muted transition-colors group-hover:text-accent">
                    {servicio.num}
                  </span>
                  <h3 className="font-display text-2xl font-bold uppercase transition-colors sm:text-3xl group-hover:text-accent">
                    {servicio.title}
                  </h3>
                  <p className="font-mono text-sm text-muted">
                    {servicio.description}
                  </p>
                </div>
              )}
            </div>
          </Reveal>
        ))}
      </div>

      <div className="hidden lg:sticky lg:top-28 lg:block">
        <div className="relative aspect-[4/3] overflow-hidden">
          {servicios.map((servicio, i) => (
            <div
              key={servicio.num}
              className={`absolute inset-0 transition-opacity duration-300 ${
                active === i ? "opacity-100" : "opacity-0"
              }`}
            >
              <MediaFrame
                src={servicio.imageUrl}
                alt={servicio.title}
                label={`${servicio.title} — fotografía`}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
