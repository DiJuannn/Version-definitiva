"use client";

import { useSyncExternalStore } from "react";

// ¿Se cumple esta media query? En el servidor (y en el primer pintado) vale
// `fallback`, para que la hidratación no se descuadre.
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}
