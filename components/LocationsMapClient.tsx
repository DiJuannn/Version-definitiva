"use client";

import dynamic from "next/dynamic";
import type { MapLocation } from "@/components/LocationsMap";

const LocationsMap = dynamic(
  () => import("@/components/LocationsMap").then((m) => m.LocationsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full items-center justify-center border border-line">
        <p className="font-mono text-xs text-muted">Cargando mapa…</p>
      </div>
    ),
  },
);

export function LocationsMapClient({ locations }: { locations: MapLocation[] }) {
  return <LocationsMap locations={locations} />;
}
