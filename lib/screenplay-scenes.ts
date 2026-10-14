// Escenas del guion → escenas de producción. El guion de Guiones manda en lo
// que es del guion (número, INT/EXT, momento del día, qué pasa y quién sale);
// Taller conserva lo que es de producción (localización elegida, desglose,
// planos, días de rodaje, equipo, notas). Cada escena de Taller recuerda de
// qué escena del guion viene (scriptSid), así que insertar o reordenar
// escenas en el guion no mueve planos ni días a otra escena.
//
// Nunca se borra nada: una escena que ya no está en el guion se avisa, porque
// puede tener planos o tomas que no deben perderse sin que alguien lo decida.

import * as Y from "yjs";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import type { DayPart, IntExt } from "@/lib/generated/prisma";
import { parseSceneHeading } from "@/lib/screenplay/blocks";
import { blocksFromYDoc } from "@/lib/screenplay/ydoc";
import { scenesFromBlocks } from "@/lib/screenplay/story";
import { syncScreenplayToProjectCore } from "@/lib/screenplay-taller";

const DESCRIPTION_MAX = 280;

export type ScriptScene = {
  sid: string;
  number: string;
  order: number;
  intExt: IntExt;
  dayPart: DayPart;
  place: string;
  description: string | null;
  present: string[];
};

export type ScenePlan = {
  screenplay: { id: string; title: string; author: string | null; pageCount: number; sceneCount: number; updatedAt: Date };
  scenes: ScriptScene[];
  // Escenas del guion que aún no están en producción.
  added: ScriptScene[];
  // Ya están, pero el guion ha cambiado su número, encabezado o acción.
  changed: ScriptScene[];
  // Escenas de producción que venían del guion y ya no están en él.
  gone: { id: string; number: string }[];
};

function intExtOf(prefix: string): IntExt {
  const p = prefix.replace(/\./g, "").toUpperCase();
  if (p.includes("/") || p === "I/E") return "INT_EXT";
  if (p.startsWith("EXT")) return "EXT";
  return "INT";
}

function dayPartOf(time: string, previous: DayPart): DayPart {
  const t = time.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  if (/NOCHE|NIGHT/.test(t)) return "NIGHT";
  if (/AMANECER|ALBA|MADRUGADA|DAWN|SUNRISE/.test(t)) return "DAWN";
  if (/ATARDECER|ANOCHECER|CREPUSCULO|OCASO|DUSK|SUNSET/.test(t)) return "DUSK";
  if (/DIA|DAY|MANANA|TARDE|MEDIODIA/.test(t)) return "DAY";
  // CONTINUO, MÁS TARDE, MISMO MOMENTO…: sigue la luz de la escena anterior.
  return previous;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

// «BAR DE CARRETERA» → «Bar de carretera»: el encabezado va en mayúsculas,
// la biblioteca de localizaciones no.
function placeName(place: string) {
  const lower = place.toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function scriptScenesFromDoc(doc: Y.Doc): ScriptScene[] {
  let previous: DayPart = "DAY";
  return scenesFromBlocks(blocksFromYDoc(doc)).map((s, i) => {
    const { prefix, place, time } = parseSceneHeading(s.heading);
    const dayPart = dayPartOf(time, previous);
    previous = dayPart;
    const action = s.firstAction.replace(/\s+/g, " ").trim();
    return {
      sid: s.sid,
      number: String(s.number),
      order: i,
      intExt: intExtOf(prefix),
      dayPart,
      place: place.trim(),
      description: action ? action.slice(0, DESCRIPTION_MAX) : null,
      present: s.present,
    };
  });
}

// El guion de Guiones vinculado a este proyecto (el último que se tocó, si
// hubiera varios).
export function linkedScreenplay(projectId: string, organizationId: string) {
  return prisma.screenplay.findFirst({
    where: { projectId, organizationId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, author: true, pageCount: true, sceneCount: true, updatedAt: true, ydoc: true },
  });
}

export async function planScreenplayScenes(projectId: string, organizationId: string): Promise<ScenePlan | null> {
  const screenplay = await linkedScreenplay(projectId, organizationId);
  if (!screenplay) return null;
  const doc = new Y.Doc();
  if (screenplay.ydoc) Y.applyUpdate(doc, new Uint8Array(screenplay.ydoc));
  const scenes = scriptScenesFromDoc(doc);

  const existing = await prisma.scene.findMany({
    where: { projectId },
    select: { id: true, number: true, intExt: true, dayPart: true, description: true, order: true, scriptSid: true },
  });
  const bySid = new Map(existing.filter((s) => s.scriptSid).map((s) => [s.scriptSid as string, s]));
  // Primera vez: una escena hecha a mano o desde el PDF con el mismo número
  // se adopta en vez de duplicarla.
  const unlinkedByNumber = new Map(existing.filter((s) => !s.scriptSid).map((s) => [s.number, s]));

  const added: ScriptScene[] = [];
  const changed: ScriptScene[] = [];
  for (const scene of scenes) {
    const current = bySid.get(scene.sid) ?? unlinkedByNumber.get(scene.number);
    if (!current) added.push(scene);
    else if (
      !current.scriptSid ||
      current.number !== scene.number ||
      current.intExt !== scene.intExt ||
      current.dayPart !== scene.dayPart ||
      (current.description ?? null) !== scene.description ||
      current.order !== scene.order
    )
      changed.push(scene);
  }
  const sids = new Set(scenes.map((s) => s.sid));
  const gone = existing
    .filter((s) => s.scriptSid && !sids.has(s.scriptSid))
    .map((s) => ({ id: s.id, number: s.number }));

  const { ydoc: _ydoc, ...meta } = screenplay;
  void _ydoc;
  return { screenplay: meta, scenes, added, changed, gone };
}

export type SceneSyncResult =
  | { ok: true; added: number; updated: number; gone: number }
  | { ok: false; error: string };

export async function syncScreenplayScenesCore(projectId: string, organizationId: string): Promise<SceneSyncResult> {
  try {
    const screenplay = await linkedScreenplay(projectId, organizationId);
    if (!screenplay) return { ok: false, error: "Este proyecto no tiene un guion de Guiones vinculado." };

    // Primero los personajes (para poder marcar quién sale en cada escena).
    const chars = await syncScreenplayToProjectCore(screenplay.id, organizationId);
    if (!chars.ok) return chars;

    const plan = await planScreenplayScenes(projectId, organizationId);
    if (!plan) return { ok: false, error: "Este proyecto no tiene un guion de Guiones vinculado." };

    const [existing, characters, locations] = await Promise.all([
      prisma.scene.findMany({
        where: { projectId },
        select: { id: true, number: true, scriptSid: true, locationId: true },
      }),
      prisma.character.findMany({
        where: { projectId },
        select: { id: true, name: true, screenplayId: true },
      }),
      prisma.location.findMany({ where: { organizationId }, select: { id: true, name: true } }),
    ]);
    const bySid = new Map(existing.filter((s) => s.scriptSid).map((s) => [s.scriptSid as string, s]));
    const unlinkedByNumber = new Map(existing.filter((s) => !s.scriptSid).map((s) => [s.number, s]));
    const characterId = new Map(characters.map((c) => [c.name.trim().toUpperCase(), c.id]));
    const fromScript = new Set(characters.filter((c) => c.screenplayId === screenplay.id).map((c) => c.id));
    const locationId = new Map(locations.map((l) => [normalize(l.name), l.id]));

    const touched = new Set([...plan.added, ...plan.changed].map((s) => s.sid));
    let added = 0;
    let updated = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const scene of plan.scenes) {
          const current = bySid.get(scene.sid) ?? unlinkedByNumber.get(scene.number);
          if (current && !touched.has(scene.sid)) continue;

          // La localización solo se pone si la escena aún no tiene: la que
          // se elija en producción manda.
          let location: string | undefined;
          if (!current?.locationId && scene.place) {
            const key = normalize(scene.place);
            location = locationId.get(key);
            if (!location) {
              location = (await tx.location.create({ data: { organizationId, name: placeName(scene.place) } })).id;
              locationId.set(key, location);
            }
          }

          const data = {
            number: scene.number,
            order: scene.order,
            intExt: scene.intExt,
            dayPart: scene.dayPart,
            description: scene.description,
            scriptSid: scene.sid,
            ...(location ? { locationId: location } : {}),
          };
          const sceneId = current
            ? (await tx.scene.update({ where: { id: current.id }, data, select: { id: true } })).id
            : (await tx.scene.create({ data: { projectId, ...data }, select: { id: true } })).id;
          if (current) {
            unlinkedByNumber.delete(scene.number);
            updated += 1;
          } else added += 1;

          // Quién sale: se añaden los del guion y se quitan solo los
          // personajes del guion que ya no salen (los marcados a mano en
          // producción, p. ej. un doble, se quedan).
          const wanted = new Set(
            scene.present.map((n) => characterId.get(n.trim().toUpperCase())).filter((id): id is string => Boolean(id)),
          );
          const links = await tx.sceneCharacter.findMany({ where: { sceneId }, select: { characterId: true } });
          const have = new Set(links.map((l) => l.characterId));
          const remove = [...have].filter((id) => fromScript.has(id) && !wanted.has(id));
          if (remove.length) await tx.sceneCharacter.deleteMany({ where: { sceneId, characterId: { in: remove } } });
          const add = [...wanted].filter((id) => !have.has(id));
          if (add.length) await tx.sceneCharacter.createMany({ data: add.map((id) => ({ sceneId, characterId: id })) });
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    return { ok: true, added, updated, gone: plan.gone.length };
  } catch (error) {
    Sentry.captureException(error);
    return { ok: false, error: "No se pudieron pasar las escenas al proyecto. Inténtalo otra vez." };
  }
}
