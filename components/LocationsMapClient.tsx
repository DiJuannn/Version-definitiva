"use client";

import dynamic from "next/dynamic";
import type { MapLocation } from "@/components/LocationsMap";

const LocationsMap = dynamic(
  () => import("@/components/LocationsMap").then((m) => m.LocationsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] w-full items-center justify-center bg-fg/[0.04]">
        <p className="font-mono text-[11px] tracking-widest text-muted uppercase">Cargando mapa…</p>
      </div>
    ),
  },
);

export function LocationsMapClient({
  locations,
  className,
}: {
  locations: MapLocation[];
  // Alto del mapa (por defecto 360px).
  className?: string;
}) {
  return <LocationsMap locations={locations} className={className} />;
}
