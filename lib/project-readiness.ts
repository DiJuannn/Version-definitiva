// Cuánto le falta a un proyecto para poder rodar: la cadena de herramientas
// que lleva del guion al rodaje (con su avance), los recursos (personajes,
// equipo, lugares, presupuesto, moodboard), la tabla escena a escena de la
// Mesa de preparación y la lista de lo que falta, por orden. Lo usan el menú
// lateral del proyecto y la portada. Una lectura por petición (cache).

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { DayPart, IntExt } from "@/lib/generated/prisma";

export type StepState = "done" | "partial" | "empty";

export type ChainStep = { key: string; label: string; state: StepState; meta: string };
export type ResourceStatus = { key: string; meta: string | null; warn: boolean };

export type ReadinessScene = {
  id: string;
  number: string;
  intExt: IntExt;
  dayPart: DayPart;
  slug: string;
  breakdown: number;
  shots: number;
  boarded: number;
  cast: { total: number; withActor: number };
  location: string | null;
  days: number[]; // índices de jornada (1, 2…)
  scheduled: number; // planos con día
  wholeSceneDay: boolean;
};

export type Todo = { key: string; tone: "next" | "warn" | "info"; title: string; why: string; href: string; cta: string };

export type Readiness = {
  chain: ChainStep[];
  now: string | null; // key del paso que toca
  resources: Record<string, ResourceStatus>;
  scenes: ReadinessScene[];
  filled: number;
  cells: number;
  todos: Todo[];
  nextShoot: { id: string; dateISO: string; daysLeft: number } | null;
  todayDayId: string | null;
  overdueTasks: number;
};

const madridKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Cada escena llena 6 casillas: desglose, planos, storyboard, reparto, lugar y día.
export function sceneCells(s: ReadinessScene) {
  return {
    breakdown: s.breakdown > 0,
    shots: s.shots > 0,
    board: s.shots > 0 && s.boarded >= s.shots,
    cast: s.cast.total === 0 || s.cast.withActor >= s.cast.total,
    location: Boolean(s.location),
    day: s.shots > 0 ? s.scheduled >= s.shots : s.wholeSceneDay,
  };
}

export const getProjectReadiness = cache(async function getProjectReadiness(projectId: string): Promise<Readiness> {
  const [scenes, characters, crew, budgetItems, moodboard, days, overdueTasks] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        location: { select: { name: true } },
        _count: { select: { breakdownElements: true } },
        characters: { select: { character: { select: { actorId: true } } } },
        shootingDayScenes: { select: { shootingDayId: true } },
        shots: { select: { shootingDayId: true, _count: { select: { storyboard: true } } } },
      },
    }),
    prisma.character.findMany({ where: { projectId }, select: { actorId: true } }),
    prisma.crewMember.count({ where: { projectId } }),
    prisma.budgetItem.count({ where: { category: { projectId } } }),
    prisma.moodboard.findUnique({ where: { projectId }, select: { cardCount: true } }),
    prisma.shootingDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      select: { id: true, date: true, shareToken: true, reminderSentAt: true, callSheet: { select: { id: true } } },
    }),
    prisma.task.count({ where: { projectId, status: { not: "DONE" }, dueDate: { lt: new Date() } } }),
  ]);

  const dayIndex = new Map(days.map((d, i) => [d.id, i + 1]));
  const rows: ReadinessScene[] = scenes.map((s) => {
    const dayIds = new Set([...s.shootingDayScenes.map((d) => d.shootingDayId), ...s.shots.map((sh) => sh.shootingDayId).filter((d): d is string => Boolean(d))]);
    return {
      id: s.id,
      number: s.number,
      intExt: s.intExt,
      dayPart: s.dayPart,
      slug: `${INT_EXT_LABELS[s.intExt]} ${s.location?.name ?? ""} — ${DAY_PART_LABELS[s.dayPart]}`.replace(/\s+—/, " —").toUpperCase(),
      breakdown: s._count.breakdownElements,
      shots: s.shots.length,
      boarded: s.shots.filter((sh) => sh._count.storyboard > 0).length,
      cast: { total: s.characters.length, withActor: s.characters.filter((c) => c.character.actorId).length },
      location: s.location?.name ?? null,
      days: [...dayIds].map((id) => dayIndex.get(id)).filter((n): n is number => n !== undefined).sort((a, b) => a - b),
      scheduled: s.shots.filter((sh) => sh.shootingDayId).length,
      wholeSceneDay: s.shootingDayScenes.length > 0,
    };
  });

  const n = rows.length;
  const broken = rows.filter((r) => r.breakdown > 0).length;
  const withShots = rows.filter((r) => r.shots > 0).length;
  const shots = rows.reduce((t, r) => t + r.shots, 0);
  const boarded = rows.reduce((t, r) => t + r.boarded, 0);
  const scheduled = rows.reduce((t, r) => t + r.scheduled, 0);
  const sent = days.filter((d) => d.shareToken || d.reminderSentAt).length;
  const made = days.filter((d) => d.callSheet).length;
  const allScheduled = n > 0 && rows.every((r) => sceneCells(r).day);
  const state = (done: number, total: number): StepState => (total > 0 && done >= total ? "done" : done > 0 ? "partial" : "empty");

  const chain: ChainStep[] = [
    { key: "guion", label: "Guion", state: n > 0 ? "done" : "empty", meta: n > 0 ? plural(n, "escena", "escenas") : "Sin escenas" },
    { key: "desglose", label: "Desglose", state: state(broken, n), meta: n ? `${broken} de ${n} escenas` : "Necesita escenas" },
    { key: "shot-list", label: "Planos", state: state(withShots, n), meta: shots ? `${plural(shots, "plano", "planos")} · ${withShots} de ${n} esc.` : "Sin planos" },
    { key: "storyboard", label: "Storyboard", state: state(boarded, shots), meta: shots ? `${boarded} de ${shots} dibujados` : "Necesita planos" },
    {
      key: "plan-de-rodaje",
      label: "Plan de rodaje",
      state: days.length && allScheduled ? "done" : days.length || scheduled ? "partial" : "empty",
      meta: days.length ? `${plural(days.length, "jornada", "jornadas")}${shots ? ` · ${scheduled} de ${shots}` : ""}` : "Sin jornadas",
    },
    { key: "call-sheets", label: "Hojas de llamada", state: state(sent, days.length), meta: days.length ? `${sent} de ${days.length} enviadas` : "Necesita jornadas" },
  ];
  const now = chain.find((c) => c.state !== "done")?.key ?? null;

  const cast = characters.length;
  const withActor = characters.filter((c) => c.actorId).length;
  const located = rows.filter((r) => r.location).length;
  const resources: Record<string, ResourceStatus> = {
    personajes: { key: "personajes", meta: cast ? `${withActor} de ${cast} con actor` : null, warn: cast > 0 && withActor < cast },
    equipo: { key: "equipo", meta: crew ? `${crew}` : "vacío", warn: crew === 0 },
    localizaciones: { key: "localizaciones", meta: n ? `${located} de ${n} esc.` : null, warn: n > 0 && located < n },
    presupuesto: { key: "presupuesto", meta: budgetItems ? `${budgetItems} partidas` : "sin hacer", warn: budgetItems === 0 },
    moodboard: { key: "moodboard", meta: moodboard?.cardCount ? `${moodboard.cardCount}` : "vacío", warn: false },
  };

  let filled = 0;
  for (const r of rows) filled += Object.values(sceneCells(r)).filter(Boolean).length;

  const base = `/app/${projectId}`;
  const todos: Todo[] = [];
  const firstMissing = (pred: (r: ReadinessScene) => boolean) => rows.find(pred);
  if (n === 0) {
    todos.push({ key: "guion", tone: "next", title: "Añadir el guion", why: "Todo lo demás (desglose, planos, plan) sale de sus escenas.", href: `${base}/guion`, cta: "Subir o escribir el guion" });
  } else {
    if (broken < n) {
      const s = firstMissing((r) => r.breakdown === 0)!;
      todos.push({ key: "desglose", tone: "next", title: `Desglosar ${plural(n - broken, "escena", "escenas")}`, why: "Atrezzo, vestuario, vehículos… de cada una: sin esto no sabes qué conseguir ni cuánto cuesta.", href: `${base}/desglose?escena=${s.id}`, cta: `Seguir por la escena ${s.number}` });
    }
    if (withShots < n) {
      const s = firstMissing((r) => r.shots === 0)!;
      todos.push({ key: "planos", tone: "next", title: `Planificar ${plural(n - withShots, "escena", "escenas")}`, why: "Los planos dicen cómo se rueda y cuánto tiempo lleva cada escena.", href: `${base}/shot-list?escena=${s.id}`, cta: `Planos de la escena ${s.number}` });
    }
    if (cast > 0 && withActor < cast) {
      todos.push({ key: "reparto", tone: "warn", title: withActor === 0 ? "Ningún personaje tiene actor" : `${plural(cast - withActor, "personaje", "personajes")} sin actor`, why: "La hoja de llamada no puede citar a quien no tiene actor.", href: `${base}/personajes`, cta: "Asignar el reparto" });
    }
    if (crew === 0) todos.push({ key: "equipo", tone: "warn", title: "Equipo técnico vacío", why: "Sin equipo no hay a quién mandar la hoja de llamada.", href: `${base}/equipo`, cta: "Añadir el equipo" });
    if (located < n) {
      const missing = rows.filter((r) => !r.location);
      todos.push({ key: "lugares", tone: "warn", title: `${plural(missing.length, "escena", "escenas")} sin localización`, why: `Escenas ${missing.slice(0, 4).map((r) => r.number).join(", ")}${missing.length > 4 ? "…" : ""}: el plan agrupa por lugar.`, href: `${base}/localizaciones`, cta: "Elegir localizaciones" });
    }
    if (!days.length) todos.push({ key: "plan", tone: "next", title: "Crear las jornadas de rodaje", why: "Con fechas, el plan reparte los planos y calcula horas y citaciones.", href: `${base}/plan-de-rodaje`, cta: "Ir al plan de rodaje" });
    else if (!allScheduled) todos.push({ key: "plan", tone: "next", title: "Hay planos sin día", why: "Lo que no tiene jornada no sale en ninguna hoja de llamada.", href: `${base}/plan-de-rodaje`, cta: "Repartirlos" });
    if (days.length && made < days.length) todos.push({ key: "hojas", tone: "info", title: `${plural(days.length - made, "jornada", "jornadas")} sin hoja de llamada`, why: "Se genera sola desde el plan: horas, reparto y lugar.", href: `${base}/call-sheets`, cta: "Preparar las hojas" });
    if (budgetItems === 0) todos.push({ key: "presupuesto", tone: "info", title: "Presupuesto sin hacer", why: "Parte de lo desglosado y del equipo; se puede empezar con una plantilla.", href: `${base}/presupuesto`, cta: "Empezar el presupuesto" });
  }

  const todayKey = madridKey(new Date());
  const upcoming = days.find((d) => madridKey(d.date) >= todayKey);
  const daysLeft = upcoming ? Math.round((Date.parse(madridKey(upcoming.date)) - Date.parse(todayKey)) / 86_400_000) : null;

  return {
    chain,
    now,
    resources,
    scenes: rows,
    filled,
    cells: n * 6,
    todos,
    nextShoot: upcoming && daysLeft !== null ? { id: upcoming.id, dateISO: upcoming.date.toISOString(), daysLeft } : null,
    todayDayId: upcoming && daysLeft === 0 ? upcoming.id : null,
    overdueTasks,
  };
});
