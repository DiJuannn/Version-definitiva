"use client";

import { createContext, useContext } from "react";
import type { MapEntities, MapToolCard, MapToolKey } from "@/lib/project-map-types";

// Lo que comparten las tarjetas de la pizarra: los datos vivos del proyecto (tarjetas de
// herramienta y cosas sueltas como escenas o tareas) y las acciones rápidas. `readOnly` es la
// vista pública: nada se edita ni enlaza a la app.
export type MapContextValue = {
  projectId: string;
  tools: Record<string, MapToolCard>;
  entities: MapEntities;
  hide: (key: MapToolKey) => void;
  completeTask: (taskId: string) => void;
  changeStatus: (status: string) => void;
  busy: boolean;
  readOnly: boolean;
};

const MapCtx = createContext<MapContextValue | null>(null);
export const MapProvider = MapCtx.Provider;

export function useMap(): MapContextValue {
  const ctx = useContext(MapCtx);
  if (!ctx) throw new Error("MapProvider ausente");
  return ctx;
}
