"use client";

// Lo que la barra «Tu historia» y el panel leen del guion, calculado una vez:
// estructura elegida, duración prevista, la línea y los momentos colocados.

import { useMemo, useSyncExternalStore } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { useWorkspace } from "@/components/screenplay/workspace";
import { referenceId, type LooseIdea } from "@/lib/screenplay/story";
import {
  buildTimeline,
  placeMoments,
  setMoment,
  structureTemplate,
  targetPages,
  type MomentId,
} from "@/lib/screenplay/moments";

// El formato del guion (corto, largo…) da la duración prevista por defecto.
// Lo recibe la barra al montarse; el panel lo lee de aquí (el espacio de
// trabajo todavía no lo lleva).
let format: string | null = null;
const listeners = new Set<() => void>();
export function publishScreenplayFormat(f: string | null) {
  if (f === format) return;
  format = f;
  listeners.forEach((l) => l());
}
export function useScreenplayFormat(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => format,
    () => null,
  );
}

// Una idea suelta ligada a un momento (el panel Ideas sueltas la enseña con
// el nombre del momento).
export type MomentIdea = LooseIdea & { beat?: MomentId };

export function useStoryModel() {
  const ws = useWorkspace();
  const { maps, scenes, currentSid } = ws;
  const beats = useYMap<string>(maps.beats);
  const structure = useYMap<unknown>(maps.structure);
  const loose = useYMap<MomentIdea>(maps.loose);
  const fmt = useScreenplayFormat();
  const template = structureTemplate(structure);
  const target = targetPages(structure, fmt);
  const timeline = useMemo(() => buildTimeline(scenes, target), [scenes, target]);
  const placed = useMemo(() => placeMoments(scenes, beats, timeline), [beats, scenes, timeline]);
  const totalPages = Math.max(1, Math.round(timeline.total / 8));
  const current = scenes.find((s) => s.sid === currentSid) ?? null;
  const ideasByMoment = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of Object.values(loose)) if (l?.beat && !l.sid) m.set(l.beat, (m.get(l.beat) ?? 0) + 1);
    return m;
  }, [loose]);

  return {
    ...ws,
    beats,
    structure,
    template,
    target,
    timeline,
    placed,
    totalPages,
    current,
    ideasByMoment,
    mark: (id: MomentId, sid: string | null) => setMoment(maps, scenes, template, id, sid),
    setTarget: (pages: number | null) =>
      pages && pages >= 1 ? maps.structure.set("targetPages", Math.round(pages)) : maps.structure.delete("targetPages"),
    addIdea: (id: MomentId, text: string) => {
      const t = text.trim();
      if (!t) return;
      const key = referenceId();
      const idea: MomentIdea = { id: key, text: t.slice(0, 1200), kind: "momento", at: Date.now(), by: ws.userName, beat: id };
      maps.loose.set(key, idea);
    },
  };
}

export type StoryModel = ReturnType<typeof useStoryModel>;
