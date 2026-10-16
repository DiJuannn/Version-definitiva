// Escrituras del camino guiado en el documento Yjs del guion. Las
// respuestas del arranque pasan a donde ya las lee el resto de la app: la
// idea al paso Idea, el protagonista a su ficha, el final a Ideas sueltas.

import type { StoryMaps } from "@/lib/screenplay/story-doc";
import type { CharacterMeta, LooseIdea } from "@/lib/screenplay/story";
import { setMoment } from "@/lib/screenplay/moments";
import {
  ENDING_IDEA_ID,
  GUIDED_KEY,
  ROUTES,
  SKELETON_KEY,
  START_KEY,
  readSkeleton,
  readStart,
  scriptName,
  skeletonBeats,
  type Skeleton,
  type StartAnswers,
} from "@/components/screenplay/guided/guided";

// Campos de la ficha que pone el arranque (además de los de CharacterMeta,
// que viajan igual en el mapa Yjs).
// gv2:guiado — `obstacle` y `role` no están en CharacterMeta (story.ts es del
// agente motor): se guardan aquí sin romper nada y la IA ya los lee de la
// lectura de la historia.
export type GuidedCharacter = CharacterMeta & { obstacle?: string; role?: string; trait?: string };

export function isGuided(structure: Record<string, unknown>): boolean {
  return structure[GUIDED_KEY] === true;
}

// Guarda las respuestas y las reparte. `prev` son las que había, para saber
// qué se puso desde aquí (y así cambiarlo sin pisar lo que el equipo haya
// escrito a mano en otros sitios).
export function saveStart(maps: StoryMaps, patch: StartAnswers, by: string) {
  const prev = readStart(maps.structure.get(START_KEY));
  const next: StartAnswers = { ...prev, ...patch };
  maps.structure.doc?.transact(() => {
    maps.structure.set(START_KEY, next);

    // La idea, al paso Idea (si no se había escrito otra a mano).
    const idea = next.idea?.trim() ?? "";
    const devIdea = maps.dev.get("idea") ?? "";
    if (idea && (!devIdea || devIdea === (prev.idea ?? "").trim())) maps.dev.set("idea", idea);
    if (!idea && devIdea && devIdea === (prev.idea ?? "").trim()) maps.dev.delete("idea");

    // El protagonista, a su ficha (y si se ha cambiado el nombre, la ficha
    // que se creó desde aquí se mueve con él).
    const name = scriptName(next.name);
    const oldName = scriptName(prev.name);
    if (oldName && oldName !== name) {
      const old = maps.characters.get(oldName) as GuidedCharacter | undefined;
      if (old?.role === "protagonista" && old.added) {
        maps.characters.delete(oldName);
        if (name && !maps.characters.get(name)) maps.characters.set(name, old);
      }
    }
    if (name) {
      const cur = (maps.characters.get(name) ?? {}) as GuidedCharacter;
      const keep = (field: "want" | "obstacle" | "trait", value: string | undefined) => {
        const v = value?.trim() ?? "";
        const before = (prev[field] ?? "").trim();
        // Solo se toca si estaba vacío o si lo que hay lo puso el arranque.
        if (!cur[field] || cur[field] === before) return v || undefined;
        return cur[field];
      };
      const ficha: GuidedCharacter = {
        ...cur,
        added: cur.added ?? true,
        role: cur.role ?? "protagonista",
        trait: keep("trait", next.trait),
        want: keep("want", next.want),
        obstacle: keep("obstacle", next.obstacle),
      };
      if (!cur.notes && next.trait?.trim()) ficha.notes = next.trait.trim();
      else if (cur.notes && cur.notes === (prev.trait ?? "").trim()) ficha.notes = next.trait?.trim() || undefined;
      for (const k of Object.keys(ficha) as (keyof GuidedCharacter)[]) if (ficha[k] === undefined) delete ficha[k];
      maps.characters.set(name, ficha);
    }

    // El final, como idea suelta de tipo «Final».
    const ending = next.ending?.trim() ?? "";
    const loose = maps.loose.get(ENDING_IDEA_ID);
    if (ending) {
      const idea: LooseIdea = { ...(loose ?? { at: Date.now(), by }), id: ENDING_IDEA_ID, text: ending, kind: "final" };
      maps.loose.set(ENDING_IDEA_ID, idea);
    } else if (loose && !loose.sid) maps.loose.delete(ENDING_IDEA_ID);
  });
}

export function getSkeleton(maps: StoryMaps): Skeleton | null {
  return readSkeleton(maps.structure.get(SKELETON_KEY));
}

export function setSkeleton(maps: StoryMaps, sk: Skeleton) {
  maps.structure.set(SKELETON_KEY, sk);
}

// Las tarjetas ya convertidas en escena: su momento queda marcado en esa
// escena (los momentos los coloca quien escribe, no un porcentaje), y la
// duración prevista pasa a ser la de la ruta.
export function markSkeletonMoments(maps: StoryMaps, sk: Skeleton, sceneOrder: { sid: string }[]) {
  const scenes = sceneOrder.map((s, i) => ({ sid: s.sid, number: i + 1 })) as unknown as Parameters<typeof setMoment>[1];
  maps.structure.doc?.transact(() => {
    for (const { moment, sid } of skeletonBeats(sk)) {
      if (!maps.beats.get(moment)) setMoment(maps, scenes, "three", moment, sid);
    }
    if (maps.structure.get("targetPages") === undefined) maps.structure.set("targetPages", ROUTES[sk.route].pages);
  });
}
