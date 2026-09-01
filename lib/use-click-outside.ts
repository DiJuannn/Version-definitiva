"use client";

import { useEffect, type RefObject } from "react";

// Cierra un desplegable al hacer clic fuera de él o al pulsar Escape. Un
// clic que abre OTRO menú también cuenta como "fuera" de este, así que
// basta con esto en cada menú para que abrir uno cierre los demás, sin
// coordinarlos entre sí.
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!active) return;

    function handlePointer(e: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [active, ref, onClose]);
}
