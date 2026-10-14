"use client";

import { useSyncExternalStore } from "react";
import type * as Y from "yjs";

// Lee un mapa Yjs como objeto de React y se re-pinta cuando cambia (también
// cuando lo cambia otra persona). La instantánea se rehace solo al cambiar.
const cache = new WeakMap<Y.Map<unknown>, Record<string, unknown>>();

export function useYMap<T>(map: Y.Map<T>): Record<string, T> {
  const m = map as unknown as Y.Map<unknown>;
  return useSyncExternalStore(
    (onChange) => {
      const handler = () => {
        cache.delete(m);
        onChange();
      };
      m.observe(handler);
      return () => m.unobserve(handler);
    },
    () => {
      let snap = cache.get(m);
      if (!snap) {
        snap = m.toJSON() as Record<string, unknown>;
        cache.set(m, snap);
      }
      return snap as Record<string, T>;
    },
    () => ({}) as Record<string, T>,
  );
}
