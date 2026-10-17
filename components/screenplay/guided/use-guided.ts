"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { StoryMaps } from "@/lib/screenplay/story-doc";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { guidedAiStatus } from "@/lib/actions/screenplay-guided";
import { SKELETON_KEY, START_KEY, readSkeleton, readStart } from "@/components/screenplay/guided/guided";
import { isGuided } from "@/components/screenplay/guided/guided-doc";

// El modo guiado: lo decide el guion (se creó con «guíame») y cada persona lo
// puede apagar o encender para sí (no se impone a quien escribe a medias con
// otra persona). Se guarda en este navegador.
const overrideKey = (id: string) => `sp-guided:${id}`;
const listeners = new Set<() => void>();

function readOverride(id: string): boolean | null {
  try {
    const v = window.localStorage.getItem(overrideKey(id));
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function useGuidedMode(maps: StoryMaps, screenplayId: string): { on: boolean; set: (on: boolean) => void } {
  const structure = useYMap<unknown>(maps.structure);
  const override = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => e.key === overrideKey(screenplayId) && cb();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => readOverride(screenplayId),
    () => null,
  );
  const set = useCallback(
    (on: boolean) => {
      try {
        window.localStorage.setItem(overrideKey(screenplayId), on ? "1" : "0");
      } catch {
        // sin almacenamiento: no se recuerda
      }
      listeners.forEach((l) => l());
    },
    [screenplayId],
  );
  return { on: override ?? isGuided(structure), set };
}

export function useGuidedData(maps: StoryMaps) {
  const structure = useYMap<unknown>(maps.structure);
  return {
    start: readStart(structure[START_KEY]),
    skeleton: readSkeleton(structure[SKELETON_KEY]),
    structure,
  };
}

// ¿Hay IA en este servidor? Se pregunta una vez por pestaña.
let aiCache: Promise<boolean> | null = null;
export function useAiAvailable(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    aiCache ??= guidedAiStatus()
      .then((r) => r.available)
      .catch(() => false);
    void aiCache.then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, []);
  return on;
}
