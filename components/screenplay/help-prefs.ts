"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isCoachMode, type CoachMode } from "@/lib/screenplay-coach";

// Preferencias de las ayudas del guion. Son de cada persona (no van en el
// documento compartido: no se imponen a quien coescribe) y viven en este
// navegador. Si el almacenamiento no está (modo privado, bloqueado), valen
// para esta visita y todo sigue funcionando.

export type LineGuidePref = "auto" | "always" | "off"; // hasta 3 escenas · siempre · nunca
export type NextStepPref = "on" | "off";

const EVENT = "sp-help-prefs";

export const PREF_KEYS = {
  lineGuide: "sp-help-line-guide",
  nextStep: "sp-help-next-step",
  nextStepFolded: "sp-help-next-step-folded",
  coach: (id: string) => `sp-coach:${id}`,
  coachLast: (id: string) => `sp-coach-last:${id}`,
  coachMuted: (id: string) => `sp-coach-muted:${id}`,
};

// Lo que no se puede guardar se recuerda aquí mientras dure la visita.
const memory = new Map<string, string>();

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readPref(key: string, kind: "local" | "session" = "local"): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = storage(kind)?.getItem(key);
    if (v !== null && v !== undefined) return v;
  } catch {
    // sin almacenamiento: lo de memoria
  }
  return memory.get(`${kind}:${key}`) ?? null;
}

export function writePref(key: string, value: string | null, kind: "local" | "session" = "local") {
  if (value === null) memory.delete(`${kind}:${key}`);
  else memory.set(`${kind}:${key}`, value);
  try {
    const s = storage(kind);
    if (value === null) s?.removeItem(key);
    else s?.setItem(key, value);
  } catch {
    // sin almacenamiento: vale para esta visita
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // otra pestaña
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function usePref(key: string, kind: "local" | "session" = "local"): [string | null, (v: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readPref(key, kind),
    () => null,
  );
  const set = useCallback((v: string | null) => writePref(key, v, kind), [key, kind]);
  return [value, set];
}

export function useLineGuidePref(): [LineGuidePref, (v: LineGuidePref) => void] {
  const [v, set] = usePref(PREF_KEYS.lineGuide);
  const value: LineGuidePref = v === "always" || v === "off" ? v : "auto";
  return [value, set as (v: LineGuidePref) => void];
}

export function useNextStepPref(): [NextStepPref, (v: NextStepPref) => void] {
  const [v, set] = usePref(PREF_KEYS.nextStep);
  return [v === "off" ? "off" : "on", set as (v: NextStepPref) => void];
}

// El Compañero: por guion. Sin elegir, «Me pregunta solo» en guiones que
// empiezan (o en modo guiado) y «Solo cuando lo pida» en los que ya van
// avanzados (quien ya sabe no quiere que le interrumpan).
export function useCoachPref(screenplayId: string, fallback: CoachMode): [CoachMode, (v: CoachMode) => void] {
  const [v, set] = usePref(PREF_KEYS.coach(screenplayId));
  return [isCoachMode(v) ? v : fallback, set as (v: CoachMode) => void];
}

export function useCoachMuted(screenplayId: string): [boolean, (v: boolean) => void] {
  const [v, set] = usePref(PREF_KEYS.coachMuted(screenplayId), "session");
  return [v === "1", useCallback((on: boolean) => set(on ? "1" : null), [set])];
}
