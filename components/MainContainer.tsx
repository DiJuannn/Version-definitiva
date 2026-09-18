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

export function MainContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const width = WIDE.some((re) => re.test(pathname))
    ? "max-w-7xl"
    : NARROW.some((re) => re.test(pathname))
      ? "max-w-4xl"
      : "max-w-6xl";

  return <div className={`mx-auto ${width}`}>{children}</div>;
}
