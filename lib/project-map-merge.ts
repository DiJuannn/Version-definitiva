import {
  MAP_TOOL_KEYS,
  type MapEdge,
  type MapItem,
  type MapLayout,
  type MapRect,
  type MapToolKey,
} from "@/lib/project-map-types";

// Trabajo en equipo en la pizarra sin pisarse: en vez de guardar la pizarra entera, cada persona
// manda solo LO QUE HA CAMBIADO (operaciones por elemento). El servidor las aplica sobre la versión
// más reciente y devuelve el resultado; cada navegador junta lo suyo con lo de los demás. Si dos
// personas cambian la misma cosa a la vez, gana la última en guardar. Sin dependencias de servidor:
// lo usan el editor (navegador) y lib/project-map.ts (servidor).

export type MapOps = {
  items?: { upsert?: MapItem[]; remove?: string[] };
  tools?: Partial<Record<MapToolKey, MapRect>>;
  hidden?: { add?: MapToolKey[]; remove?: MapToolKey[] };
  edges?: { upsert?: MapEdge[]; remove?: string[] };
};

// Texto canónico (claves ordenadas, sin `undefined`): dos elementos iguales dan el mismo texto
// aunque sus claves estén en distinto orden (lo que tengo yo frente a lo que devuelve el servidor).
export function canonical(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => x !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => [k, sort(x)]),
      );
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

export function isEmptyOps(ops: MapOps): boolean {
  return (
    !ops.items?.upsert?.length &&
    !ops.items?.remove?.length &&
    !Object.keys(ops.tools ?? {}).length &&
    !ops.hidden?.add?.length &&
    !ops.hidden?.remove?.length &&
    !ops.edges?.upsert?.length &&
    !ops.edges?.remove?.length
  );
}

function diffList<T extends { id: string }>(base: T[], next: T[]) {
  const b = byId(base);
  const n = byId(next);
  return {
    upsert: next.filter((x) => !same(b.get(x.id), x)),
    remove: base.filter((x) => !n.has(x.id)).map((x) => x.id),
  };
}

// Qué hay que hacer a `base` para llegar a `next`.
export function diffLayouts(base: MapLayout, next: MapLayout): MapOps {
  const items = diffList(base.items, next.items);
  const edges = diffList(base.edges, next.edges);
  const tools: MapOps["tools"] = {};
  for (const k of MAP_TOOL_KEYS) {
    if (next.tools[k] && !same(base.tools[k], next.tools[k])) tools[k] = next.tools[k];
  }
  const ops: MapOps = {};
  if (items.upsert.length || items.remove.length) ops.items = { upsert: items.upsert, remove: items.remove };
  if (edges.upsert.length || edges.remove.length) ops.edges = { upsert: edges.upsert, remove: edges.remove };
  if (Object.keys(tools).length) ops.tools = tools;
  const add = next.hidden.filter((k) => !base.hidden.includes(k));
  const remove = base.hidden.filter((k) => !next.hidden.includes(k));
  if (add.length || remove.length) ops.hidden = { add, remove };
  return ops;
}

function applyList<T extends { id: string }>(list: T[], upsert: unknown, remove: unknown): T[] {
  const gone = new Set(Array.isArray(remove) ? remove.filter((x): x is string => typeof x === "string") : []);
  const up = new Map<string, T>();
  for (const x of Array.isArray(upsert) ? upsert : []) {
    if (x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string") up.set((x as T).id, x as T);
  }
  const out = list.filter((x) => !gone.has(x.id)).map((x) => up.get(x.id) ?? x);
  const have = new Set(out.map((x) => x.id));
  for (const [id, x] of up) if (!have.has(id) && !gone.has(id)) out.push(x);
  return out;
}

// Aplica cambios a una pizarra. Tolera basura (lo llama también el servidor con datos del navegador;
// después pasa por sanitizeMapLayout, que descarta lo inválido).
export function applyOps(layout: MapLayout, ops: MapOps): MapLayout {
  const items = applyList(layout.items, ops.items?.upsert, ops.items?.remove);
  const valid = new Set<string>([...MAP_TOOL_KEYS.map((k) => `tool-${k}`), ...items.map((i) => i.id)]);
  const edges = applyList(layout.edges, ops.edges?.upsert, ops.edges?.remove).filter((e) => valid.has(e.source) && valid.has(e.target));

  const tools = { ...layout.tools };
  for (const k of MAP_TOOL_KEYS) {
    const r = ops.tools?.[k];
    if (r && typeof r === "object") tools[k] = r;
  }
  let hidden = layout.hidden;
  const drop = new Set(Array.isArray(ops.hidden?.remove) ? ops.hidden.remove : []);
  hidden = hidden.filter((k) => !drop.has(k));
  for (const k of Array.isArray(ops.hidden?.add) ? ops.hidden.add : []) if (!hidden.includes(k)) hidden = [...hidden, k];

  return { v: 2, tools, hidden, items, edges };
}

// Junta lo de los demás (`remote`, que viene de `base`) con lo mío (`local`, que también viene de
// `base`): se aplican los cambios ajenos salvo en lo que yo también he tocado (ahí gano yo hasta guardar).
export function rebase(local: MapLayout, base: MapLayout, remote: MapLayout): MapLayout {
  const theirs = diffLayouts(base, remote);
  const mine = diffLayouts(base, local);
  const touched = (up: { id: string }[] | undefined, rm: string[] | undefined) =>
    new Set([...(up ?? []).map((x) => x.id), ...(rm ?? [])]);
  const myItems = touched(mine.items?.upsert, mine.items?.remove);
  const myEdges = touched(mine.edges?.upsert, mine.edges?.remove);
  const myHidden = new Set([...(mine.hidden?.add ?? []), ...(mine.hidden?.remove ?? [])]);

  const filtered: MapOps = {
    items: {
      upsert: theirs.items?.upsert?.filter((x) => !myItems.has(x.id)),
      remove: theirs.items?.remove?.filter((id) => !myItems.has(id)),
    },
    edges: {
      upsert: theirs.edges?.upsert?.filter((x) => !myEdges.has(x.id)),
      remove: theirs.edges?.remove?.filter((id) => !myEdges.has(id)),
    },
    tools: Object.fromEntries(Object.entries(theirs.tools ?? {}).filter(([k]) => !(k in (mine.tools ?? {})))) as MapOps["tools"],
    hidden: {
      add: theirs.hidden?.add?.filter((k) => !myHidden.has(k)),
      remove: theirs.hidden?.remove?.filter((k) => !myHidden.has(k)),
    },
  };
  return applyOps(local, filtered);
}

// Quita de `a` lo que `b` también toca (mismos ids o claves).
export function subtractOps(a: MapOps, b: MapOps): MapOps {
  const ids = (up?: { id: string }[], rm?: string[]) => new Set([...(up ?? []).map((x) => x.id), ...(rm ?? [])]);
  const bi = ids(b.items?.upsert, b.items?.remove);
  const be = ids(b.edges?.upsert, b.edges?.remove);
  const bh = new Set([...(b.hidden?.add ?? []), ...(b.hidden?.remove ?? [])]);
  const out: MapOps = {};
  const iu = a.items?.upsert?.filter((x) => !bi.has(x.id)) ?? [];
  const ir = a.items?.remove?.filter((x) => !bi.has(x)) ?? [];
  if (iu.length || ir.length) out.items = { upsert: iu, remove: ir };
  const eu = a.edges?.upsert?.filter((x) => !be.has(x.id)) ?? [];
  const er = a.edges?.remove?.filter((x) => !be.has(x)) ?? [];
  if (eu.length || er.length) out.edges = { upsert: eu, remove: er };
  const tools = Object.fromEntries(Object.entries(a.tools ?? {}).filter(([k]) => !(k in (b.tools ?? {}))));
  if (Object.keys(tools).length) out.tools = tools as MapOps["tools"];
  const ha = a.hidden?.add?.filter((k) => !bh.has(k)) ?? [];
  const hr = a.hidden?.remove?.filter((k) => !bh.has(k)) ?? [];
  if (ha.length || hr.length) out.hidden = { add: ha, remove: hr };
  return out;
}
