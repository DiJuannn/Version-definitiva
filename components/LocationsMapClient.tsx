"use client";

import dynamic from "next/dynamic";
import type { MapLocation } from "@/components/LocationsMap";

const LocationsMap = dynamic(
  () => import("@/components/LocationsMap").then((m) => m.LocationsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[260px] w-full items-center justify-center bg-bg">
        <p className="font-mono text-[11px] tracking-widest text-muted uppercase">Cargando mapa…</p>
      </div>
    ),
  },
);

export function LocationsMapClient({
  locations,
  className,
  activeId,
  onSelect,
}: {
  locations: MapLocation[];
  // Alto del mapa (por defecto 360px).
  className?: string;
  // Localización resaltada (lista sincronizada con el mapa).
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return <LocationsMap locations={locations} className={className} activeId={activeId} onSelect={onSelect} />;
}
