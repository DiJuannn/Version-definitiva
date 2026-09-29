"use client";

import { useEffect, useRef, useState } from "react";

/** Estado persistido en localStorage: los borradores sobreviven a recargas y cortes de red. */
export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar desde localStorage solo es posible en el cliente
      if (raw) setValue({ ...initial, ...JSON.parse(raw) });
    } catch {
      /* sin almacenamiento: el borrador vive solo en memoria */
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignorar */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [key, value]);
  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignorar */
    }
    setValue(initial);
  };
  return [value, setValue, clear] as const;
}
