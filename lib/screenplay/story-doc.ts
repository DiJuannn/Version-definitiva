// Mapas de la historia dentro del documento Yjs del guion. Se usan igual en el
// navegador (lectura en vivo, cambios del equipo) y en el servidor (la IA lee
// las correcciones del equipo y las referencias ya puestas).

import * as Y from "yjs";
import type {
  CharacterMeta,
  Questions,
  Reference,
  SceneMeta,
  StoryReading,
  Suggestion,
} from "@/lib/screenplay/story";

export type StoryMaps = {
  scenes: Y.Map<SceneMeta>; // sid → meta
  acts: Y.Map<string>; // sid de la escena que abre el acto → nombre del acto
  structure: Y.Map<unknown>; // "template", "storyOrder"
  characters: Y.Map<CharacterMeta>; // NOMBRE → ficha
  refs: Y.Map<Reference>; // id → referencia
  ai: Y.Map<unknown>; // "reading", "suggestions", "questions"
};

export function storyMaps(doc: Y.Doc): StoryMaps {
  return {
    scenes: doc.getMap<SceneMeta>("scenes"),
    acts: doc.getMap<string>("acts"),
    structure: doc.getMap<unknown>("structure"),
    characters: doc.getMap<CharacterMeta>("characters"),
    refs: doc.getMap<Reference>("refs"),
    ai: doc.getMap<unknown>("ai"),
  };
}

export function readReading(doc: Y.Doc): StoryReading | null {
  const r = storyMaps(doc).ai.get("reading");
  return r && typeof r === "object" ? (r as StoryReading) : null;
}

export function readSuggestions(doc: Y.Doc): Suggestion[] {
  const s = storyMaps(doc).ai.get("suggestions");
  return Array.isArray(s) ? (s as Suggestion[]) : [];
}

export function readQuestions(doc: Y.Doc): Questions | null {
  const q = storyMaps(doc).ai.get("questions");
  return q && typeof q === "object" ? (q as Questions) : null;
}

export function readReferences(doc: Y.Doc): Reference[] {
  return [...storyMaps(doc).refs.values()].sort((a, b) => a.at - b.at);
}
