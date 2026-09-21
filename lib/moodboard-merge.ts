import { canonical } from "@/lib/project-map-merge";
import type { MoodboardCard } from "@/lib/moodboard-types";

// Trabajo en equipo en el Moodboard (misma idea que la pizarra del Mapa, ver lib/project-map-merge.ts):
// cada persona manda solo las tarjetas que ha cambiado o quitado, el servidor las junta con las de los
// demás y cada navegador fusiona lo suyo con lo ajeno. Sin dependencias de servidor.

export type CardOps = { upsert?: MoodboardCard[]; remove?: string[] };

const byId = (list: MoodboardCard[]) => new Map(list.map((c) => [c.id, c]));

export function isEmptyCardOps(ops: CardOps): boolean {
  return !ops.upsert?.length && !ops.remove?.length;
}

// Qué hay que hacer a `base` para llegar a `next`.
export function diffCards(base: MoodboardCard[], next: MoodboardCard[]): CardOps {
  const b = byId(base);
  const n = byId(next);
  const ops: CardOps = {};
  const upsert = next.filter((c) => canonical(b.get(c.id)) !== canonical(c));
  const remove = base.filter((c) => !n.has(c.id)).map((c) => c.id);
  if (upsert.length) ops.upsert = upsert;
  if (remove.length) ops.remove = remove;
  return ops;
}

// Aplica cambios. Tolera basura (el servidor lo llama con datos del navegador y luego sanea).
export function applyCardOps(cards: MoodboardCard[], ops: CardOps): MoodboardCard[] {
  const gone = new Set(Array.isArray(ops.remove) ? ops.remove.filter((x): x is string => typeof x === "string") : []);
  const up = new Map<string, MoodboardCard>();
  for (const c of Array.isArray(ops.upsert) ? ops.upsert : []) {
    if (c && typeof c === "object" && typeof (c as { id?: unknown }).id === "string") up.set(c.id, c);
  }
  const out = cards.filter((c) => !gone.has(c.id)).map((c) => up.get(c.id) ?? c);
  const have = new Set(out.map((c) => c.id));
  for (const [id, c] of up) if (!have.has(id) && !gone.has(id)) out.push(c);
  return out;
}

// Junta lo de los demás (`remote`) con lo mío (`local`), ambos a partir de `base`: se aplican los
// cambios ajenos salvo en las tarjetas que yo también he tocado (ahí gano yo hasta guardar).
export function rebaseCards(local: MoodboardCard[], base: MoodboardCard[], remote: MoodboardCard[]): MoodboardCard[] {
  const theirs = diffCards(base, remote);
  const mine = diffCards(base, local);
  const touched = new Set([...(mine.upsert ?? []).map((c) => c.id), ...(mine.remove ?? [])]);
  return applyCardOps(local, {
    upsert: theirs.upsert?.filter((c) => !touched.has(c.id)),
    remove: theirs.remove?.filter((id) => !touched.has(id)),
  });
}
