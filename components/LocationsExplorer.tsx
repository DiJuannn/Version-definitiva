"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MapLocation } from "@/components/LocationsMap";
import { LocationsMapClient } from "@/components/LocationsMapClient";
import { LinkPendingHint } from "@/components/LinkPendingHint";

export type ExplorerLocation = {
  id: string;
  href: string;
  name: string;
  address: string | null;
  contactName: string | null;
  characteristics: string[];
  sceneCount: number;
  // Número en el mapa; null si no está situada.
  label: string | null;
};

// Biblioteca de localizaciones como mapa + lista sincronizados: cada fila
// lleva el número de su chincheta; al pasar por una fila (o enfocarla) se
// resalta en el mapa, y al tocar una chincheta se resalta su fila.
export function LocationsExplorer({
  locations,
  mapLocations,
}: {
  locations: ExplorerLocation[];
  mapLocations: MapLocation[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  // Chincheta tocada → que su fila se vea.
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  useEffect(() => {
    if (!scrollTo) return;
    rowRefs.current.get(scrollTo)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [scrollTo]);

  const hasMap = mapLocations.length > 0;

  return (
    <div className={`mt-8 grid gap-6 ${hasMap ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]" : ""}`}>
      {hasMap && (
        <div className="lg:order-2">
          <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_color-mix(in_srgb,var(--fg)_8%,transparent)] lg:sticky lg:top-6">
            <LocationsMapClient
              locations={mapLocations}
              className="h-[300px] sm:h-[380px] lg:h-[min(640px,calc(100vh-7rem))]"
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setScrollTo(id);
              }}
            />
          </div>
        </div>
      )}

      <ul className="sheet divide-y divide-line self-start overflow-hidden lg:order-1" onMouseLeave={() => setActiveId(null)}>
        {locations.map((location) => {
          const active = location.id === activeId;
          return (
            <li
              key={location.id}
              ref={(el) => {
                if (el) rowRefs.current.set(location.id, el);
                else rowRefs.current.delete(location.id);
              }}
              className={`relative transition-colors ${active ? "bg-accent/[0.08]" : ""}`}
            >
              {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
              <Link
                href={location.href}
                onMouseEnter={() => setActiveId(location.id)}
                onFocus={() => setActiveId(location.id)}
                className="group flex gap-4 px-4 py-4 sm:px-5"
              >
                {location.label ? (
                  <span
                    aria-label={`Número ${location.label} en el mapa`}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-accent font-mono text-[11px] font-bold tabular-nums transition-colors ${
                      active ? "bg-accent text-bg" : "text-fg"
                    }`}
                  >
                    {location.label}
                  </span>
                ) : (
                  <span
                    title="No sale en el mapa"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-dashed border-warn/70 font-mono text-[11px] text-warn"
                  >
                    ?
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-display text-[17px] leading-snug font-bold transition-colors group-hover:text-accent">
                      {location.name}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[10px] tracking-widest uppercase tabular-nums ${
                        location.sceneCount > 0 ? "text-accent" : "text-muted"
                      }`}
                    >
                      {location.sceneCount > 0
                        ? `${location.sceneCount} ${location.sceneCount === 1 ? "escena" : "escenas"}`
                        : "Sin usar"}
                      <LinkPendingHint />
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate font-sans text-[13px] text-muted">
                    {location.address ?? "Sin dirección"}
                    {location.contactName ? ` · ${location.contactName}` : ""}
                  </span>
                  {!location.label && (
                    <span className="mt-1 block font-sans text-[12px] text-warn">
                      Sin situar en el mapa
                    </span>
                  )}
                  {location.characteristics.length > 0 && (
                    <span className="mt-2.5 flex flex-wrap gap-1.5">
                      {location.characteristics.map((c) => (
                        <span key={c} className="rounded-full bg-fg/[0.07] px-2 py-0.5 font-sans text-[11px] text-fg/80">
                          {c}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
