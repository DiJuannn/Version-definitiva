"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Anchos por tipo de pantalla: los tableros, la rejilla del calendario y las
// tablas de planos necesitan superficie; las fichas y formularios de una
// sola columna se leen mejor contenidos.
const WIDE = [
  /^\/app\/calendario$/,
  /^\/app\/[^/]+\/plan-de-rodaje$/,
  /^\/app\/[^/]+\/shot-list$/,
  /^\/app\/[^/]+\/storyboard$/,
  /^\/app\/guiones\/[^/]+$/,
];
const NARROW = [
  /^\/app\/[^/]+\/guion\/[^/]+$/,
  /^\/app\/[^/]+\/shot-list\/[^/]+$/,
  /^\/app\/[^/]+\/documentos-legales\/[^/]+$/,
  /^\/app\/tareas\/[^/]+$/,
  /^\/app\/equipo\/[^/]+$/,
  /^\/app\/localizaciones\/[^/]+$/,
  /^\/app\/organizacion$/,
];

export function containerWidth(pathname: string) {
  return WIDE.some((re) => re.test(pathname)) ? "max-w-7xl" : NARROW.some((re) => re.test(pathname)) ? "max-w-4xl" : "max-w-6xl";
}

// Rutas de la organización: cualquier otra /app/<algo> es un proyecto, que
// pone su propio marco (menú lateral) y su propio ancho (ProjectMain).
const GLOBAL = new Set(["proyectos", "calendario", "tareas", "equipo", "localizaciones", "inventario", "vehiculos", "organizacion", "claqueta", "guiones"]);
export function isProjectPath(pathname: string) {
  const [, app, segment] = pathname.split("/");
  return app === "app" && Boolean(segment) && !GLOBAL.has(segment);
}

export function MainContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isProjectPath(pathname)) return <>{children}</>;
  return <div className={`mx-auto ${containerWidth(pathname)}`}>{children}</div>;
}

// El contenido de una herramienta del proyecto, junto al menú lateral.
export function ProjectMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className={`mx-auto w-full ${containerWidth(pathname)}`}>{children}</div>;
}
