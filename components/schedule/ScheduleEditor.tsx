"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import type { ScheduleBlockKind } from "@/lib/generated/prisma";
import {
  computeDayTimeline,
  dayWarnings,
  DEFAULT_PREP_MIN,
  formatDuration,
  formatHHMM,
  parseHHMM,
  type PlanBlock,
  type PlanWarning,
} from "@/lib/schedule-plan";
import type { PoolShot, ScheduleData } from "@/lib/schedule-data";
import {
  createBlock,
  deleteBlock,
  markRetake,
  moveBlock,
  placeScene,
  placeShots,
  setDayTimes,
  setShotEstimate,
  updateBlock,
} from "@/lib/actions/schedule";
import { useToast } from "@/components/Toast";
import { SceneTag } from "@/components/SceneTag";
import { BlockView, ShotCard, blockLabel } from "@/components/schedule/BlockView";
import { SchedulePool } from "@/components/schedule/SchedulePool";
import { ScheduleSide } from "@/components/schedule/ScheduleSide";

type DragKind = "shot" | "scene" | "block" | "drop" | "pool" | "newblock";
export function dndId(kind: DragKind, id = "") {
  return `${kind}:${id}`;
}
function parseId(raw: string | number | undefined | null): { kind: DragKind; id: string } | null {
  if (typeof raw !== "string") return null;
  const i = raw.indexOf(":");
  return { kind: raw.slice(0, i) as DragKind, id: raw.slice(i + 1) };
}

export type EditorApi = {
  projectId: string;
  data: ScheduleData;
  dayId: string;
  blocks: PlanBlock[];
  moveShotTo: (shotId: string, target: string) => void;
  nudgeShot: (shotId: string, delta: -1 | 1) => void;
  setEstimate: (shotId: string, minutes: number | null) => void;
  retake: (shotId: string, note: string | null) => void;
  editBlock: (blockId: string, patch: { title?: string | null; durationMin?: number | null; startTime?: string | null }) => void;
  nudgeBlock: (blockId: string, delta: -1 | 1) => void;
  moveBlockToDay: (blockId: string, dayId: string) => void;
  removeBlock: (blockId: string) => void;
  scheduleScene: (sceneId: string) => void;
  unscheduleScene: (sceneId: string) => void;
};

// Editor de una jornada: lo que falta por programar a la izquierda, el orden
// de rodaje con sus horas en el centro y los avisos y la gente a la derecha.
// Todo cambio se ve al instante (y se recalculan las horas) y se guarda
// solo; si el servidor lo rechaza, vuelve a como estaba y avisa.
export function ScheduleEditor({
  projectId,
  data,
  dayId,
  viewerLabel,
}: {
  projectId: string;
  data: ScheduleData;
  dayId: string;
  viewerLabel: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const day = data.days.find((d) => d.id === dayId)!;

  // Estado local que se rehace cuando llegan datos nuevos del servidor.
  const [source, setSource] = useState({ data, dayId });
  const [blocks, setBlocks] = useState<PlanBlock[]>(day.blocks);
  const [pool, setPool] = useState<PoolShot[]>(data.pool.shots);
  const [poolScenes, setPoolScenes] = useState<string[]>(data.pool.scenes);
  if (source.data !== data || source.dayId !== dayId) {
    setSource({ data, dayId });
    setBlocks(day.blocks);
    setPool(data.pool.shots);
    setPoolScenes(data.pool.scenes);
  }
  const [callTime, setCallTime] = useState(day.callTime ?? "");
  const [prepMin, setPrepMin] = useState(String(day.prepMin ?? DEFAULT_PREP_MIN));
  const [timesFor, setTimesFor] = useState(dayId);
  if (timesFor !== dayId) {
    setTimesFor(dayId);
    setCallTime(day.callTime ?? "");
    setPrepMin(String(day.prepMin ?? DEFAULT_PREP_MIN));
  }

  // --- Tiempo real: quién más mira y avisar a los demás de cada cambio ---
  const channelRef = useRef<RealtimeChannel | null>(null);
  const senderRef = useRef<string>("");
  const [viewers, setViewers] = useState<string[]>([]);
  useEffect(() => {
    if (!senderRef.current) senderRef.current = crypto.randomUUID();
    const supabase = createClient();
    const channel = supabase.channel(`plan-de-rodaje:${projectId}`, { config: { presence: { key: senderRef.current } } });
    channel
      .on("broadcast", { event: "plan-changed" }, ({ payload }) => {
        if ((payload as { senderId?: string })?.senderId !== senderRef.current) router.refresh();
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ label: string }>();
        setViewers([
          ...new Set(
            Object.entries(state)
              .filter(([key]) => key !== senderRef.current)
              .flatMap(([, entries]) => entries.map((e) => e.label)),
          ),
        ]);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ label: viewerLabel });
      });
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Aplica un cambio en local, lo guarda y, si falla, lo deshace.
  function run(apply: () => void, save: () => Promise<boolean | string | null>, done: string, failed: string) {
    const snapshot = { blocks, pool, poolScenes };
    apply();
    startTransition(async () => {
      let ok: boolean | string | null = false;
      try {
        ok = await save();
      } catch {
        ok = false;
      }
      if (ok) {
        if (done) toast("success", done);
        channelRef.current?.send({ type: "broadcast", event: "plan-changed", payload: { senderId: senderRef.current } });
        router.refresh();
      } else {
        setBlocks(snapshot.blocks);
        setPool(snapshot.pool);
        setPoolScenes(snapshot.poolScenes);
        toast("error", failed);
      }
    });
  }

  const allShots = useMemo(() => {
    const map = new Map<string, PoolShot>();
    for (const s of pool) map.set(s.id, s);
    for (const b of blocks) for (const s of b.shots) map.set(s.id, s as PoolShot);
    return map;
  }, [blocks, pool]);

  function findShotBlock(shotId: string) {
    return blocks.find((b) => b.shots.some((s) => s.id === shotId)) ?? null;
  }

  // --- Movimientos de planos ---
  function placeShotLocal(shotId: string, to: { blockId: string; index: number } | "pool") {
    const shot = allShots.get(shotId);
    if (!shot) return;
    setBlocks((prev) => {
      const without = prev.map((b) => ({ ...b, shots: b.shots.filter((s) => s.id !== shotId) }));
      if (to === "pool") return without;
      return without.map((b) => {
        if (b.id !== to.blockId) return b;
        const shots = [...b.shots];
        shots.splice(Math.max(0, Math.min(to.index, shots.length)), 0, shot);
        return { ...b, shots };
      });
    });
    setPool((prev) => {
      const without = prev.filter((s) => s.id !== shotId);
      return to === "pool" ? [...without, { ...shot, done: false }] : without;
    });
  }

  function moveShot(shotId: string, to: { blockId: string; index: number } | "pool" | { newBlockDayId: string }) {
    const shot = allShots.get(shotId);
    const label = shot ? `${shot.sceneNumber}.${shot.number}` : "";
    if (to === "pool") {
      run(() => placeShotLocal(shotId, "pool"), () => placeShots(projectId, [shotId], { kind: "pool" }), `Plano ${label} a por programar`, "No se pudo mover el plano.");
      return;
    }
    if ("newBlockDayId" in to) {
      const sameDay = to.newBlockDayId === dayId;
      run(
        () => {
          if (!sameDay) {
            setBlocks((prev) => prev.map((b) => ({ ...b, shots: b.shots.filter((s) => s.id !== shotId) })));
            setPool((prev) => prev.filter((s) => s.id !== shotId));
          } else if (shot) {
            const temp: PlanBlock = { id: `tmp-${Date.now()}`, kind: "SHOTS", title: null, durationMin: null, startTime: null, notes: null, scene: null, shots: [shot] };
            setBlocks((prev) => [...prev.map((b) => ({ ...b, shots: b.shots.filter((s) => s.id !== shotId) })), temp]);
            setPool((prev) => prev.filter((s) => s.id !== shotId));
          }
        },
        () => placeShots(projectId, [shotId], { kind: "newBlock", dayId: to.newBlockDayId }),
        sameDay ? `Plano ${label} en un bloque nuevo` : `Plano ${label} → ${data.days.find((d) => d.id === to.newBlockDayId)?.shortLabel ?? "otra jornada"}`,
        "No se pudo mover el plano.",
      );
      return;
    }
    run(
      () => placeShotLocal(shotId, to),
      () => placeShots(projectId, [shotId], { kind: "block", blockId: to.blockId, index: to.index }),
      "",
      "No se pudo mover el plano.",
    );
  }

  const api: EditorApi = {
    projectId,
    data,
    dayId,
    blocks,
    moveShotTo: (shotId, target) => {
      if (target === "pool") return moveShot(shotId, "pool");
      if (target.startsWith("day:")) return moveShot(shotId, { newBlockDayId: target.slice(4) });
      if (target === "new") return moveShot(shotId, { newBlockDayId: dayId });
      const block = blocks.find((b) => b.id === target);
      if (block) moveShot(shotId, { blockId: block.id, index: block.shots.length });
    },
    nudgeShot: (shotId, delta) => {
      const block = findShotBlock(shotId);
      if (!block) return;
      const i = block.shots.findIndex((s) => s.id === shotId);
      const j = i + delta;
      if (j < 0 || j >= block.shots.length) return;
      moveShot(shotId, { blockId: block.id, index: j });
    },
    setEstimate: (shotId, minutes) => {
      run(
        () =>
          setBlocks((prev) =>
            prev.map((b) => ({ ...b, shots: b.shots.map((s) => (s.id === shotId ? { ...s, estimatedMin: minutes } : s)) })),
          ),
        () => setShotEstimate(projectId, shotId, minutes),
        "",
        "No se pudo guardar el tiempo.",
      );
    },
    retake: (shotId, note) => {
      const shot = allShots.get(shotId);
      run(
        () => {
          setBlocks((prev) => prev.map((b) => ({ ...b, shots: b.shots.filter((s) => s.id !== shotId) })));
          if (shot) setPool((prev) => [...prev, { ...shot, done: false, retake: true, retakeNote: note }]);
        },
        () => markRetake(projectId, shotId, note),
        `Plano ${shot ? `${shot.sceneNumber}.${shot.number}` : ""} a repetir: vuelve a por programar`,
        "No se pudo marcar.",
      );
    },
    editBlock: (blockId, patch) => {
      run(
        () => setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b))),
        () => updateBlock(projectId, blockId, patch),
        "",
        "No se pudo guardar el bloque.",
      );
    },
    nudgeBlock: (blockId, delta) => {
      const i = blocks.findIndex((b) => b.id === blockId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= blocks.length) return;
      run(
        () =>
          setBlocks((prev) => {
            const next = [...prev];
            const [moved] = next.splice(i, 1);
            next.splice(j, 0, moved);
            return next;
          }),
        () => moveBlock(projectId, blockId, dayId, j),
        "",
        "No se pudo mover el bloque.",
      );
    },
    moveBlockToDay: (blockId, toDayId) => {
      const target = data.days.find((d) => d.id === toDayId);
      run(
        () => setBlocks((prev) => prev.filter((b) => b.id !== blockId)),
        () => moveBlock(projectId, blockId, toDayId, 999),
        `Bloque movido a ${target?.shortLabel ?? "otra jornada"}`,
        "No se pudo mover el bloque.",
      );
    },
    removeBlock: (blockId) => {
      const block = blocks.find((b) => b.id === blockId);
      run(
        () => {
          setBlocks((prev) => prev.filter((b) => b.id !== blockId));
          if (block) setPool((prev) => [...prev, ...block.shots.map((s) => ({ ...(s as PoolShot), done: false }))]);
          if (block?.scene) setPoolScenes((prev) => [...prev, block.scene!.id]);
        },
        () => deleteBlock(projectId, blockId),
        block && (block.shots.length > 0 || block.scene) ? "Bloque quitado: lo que tenía vuelve a por programar" : "Bloque quitado",
        "No se pudo quitar el bloque.",
      );
    },
    scheduleScene: (sceneId) => {
      run(
        () => setPoolScenes((prev) => prev.filter((id) => id !== sceneId)),
        () => placeScene(projectId, sceneId, { dayId }),
        `Escena ${data.scenes[sceneId]?.number ?? ""} a esta jornada`,
        "No se pudo programar la escena.",
      );
    },
    unscheduleScene: (sceneId) => {
      run(
        () => {
          setBlocks((prev) => prev.filter((b) => b.scene?.id !== sceneId));
          setPoolScenes((prev) => [...prev, sceneId]);
        },
        () => placeScene(projectId, sceneId, null),
        `Escena ${data.scenes[sceneId]?.number ?? ""} a por programar`,
        "No se pudo mover la escena.",
      );
    },
  };

  function addBlock(kind: ScheduleBlockKind) {
    const defaults: Record<string, { title: string | null; durationMin: number | null }> = {
      SHOTS: { title: null, durationMin: null },
      MEAL: { title: "Comida", durationMin: 60 },
      MOVE: { title: "Cambio de set", durationMin: 30 },
      NOTE: { title: "Nota", durationMin: 0 },
    };
    const d = defaults[kind];
    const temp: PlanBlock = { id: `tmp-${Date.now()}`, kind, title: d.title, durationMin: d.durationMin, startTime: null, notes: null, scene: null, shots: [] };
    run(() => setBlocks((prev) => [...prev, temp]), () => createBlock(projectId, dayId, kind, d.title, d.durationMin), "", "No se pudo añadir.");
  }

  function saveTimes() {
    const t = callTime.trim();
    if (t && parseHHMM(t) === null) {
      toast("error", "Hora de llamada no válida: escribe por ejemplo 07:45");
      return;
    }
    const prep = prepMin.trim() === "" ? null : Number(prepMin);
    if (t === (day.callTime ?? "") && (prep ?? DEFAULT_PREP_MIN) === (day.prepMin ?? DEFAULT_PREP_MIN)) return;
    run(() => {}, () => setDayTimes(projectId, dayId, t || null, prep), "Horario de la jornada guardado", "No se pudo guardar el horario.");
  }

  // --- Cálculo en vivo ---
  const timeline = useMemo(
    () =>
      computeDayTimeline({
        date: new Date(day.dateISO),
        callTime: parseHHMM(callTime) !== null ? callTime : null,
        prepMin: prepMin.trim() === "" ? null : Number(prepMin),
        blocks,
        lat: day.lat,
        lng: day.lng,
      }),
    [blocks, callTime, prepMin, day.dateISO, day.lat, day.lng],
  );
  const hasShots = blocks.some((b) => b.shots.length > 0 || b.scene);
  const warnings: PlanWarning[] = useMemo(() => {
    const list = dayWarnings(timeline, { workdayHours: data.workdayHours, hasShots });
    // Escenas de esta jornada que también se ruedan en otras o tienen planos sin programar.
    const sceneIds = new Set<string>();
    for (const b of blocks) for (const s of b.shots) sceneIds.add(s.sceneId);
    for (const sceneId of sceneIds) {
      const cov = data.coverage.find((c) => c.sceneId === sceneId);
      if (!cov) continue;
      const dayIdsOfScene = new Set(cov.shots.map((s) => s.dayId).filter(Boolean));
      const pending = cov.shots.filter((s) => !s.dayId && !s.done).length;
      const others = [...dayIdsOfScene].filter((id) => id !== dayId).map((id) => data.days.find((d) => d.id === id)?.title ?? "otra");
      if (others.length > 0 || pending > 0) {
        list.push({
          id: `split-${sceneId}`,
          tone: "warn",
          text: `La escena ${data.scenes[sceneId]?.number} ${others.length > 0 ? `también se rueda en ${others.join(", ")}` : "no está completa en esta jornada"}${pending > 0 ? ` y tiene ${pending} plano${pending === 1 ? "" : "s"} sin programar` : ""}`,
          detail: "Atrezzo, vestuario y continuidad de esa escena tienen que estar en todas sus jornadas.",
        });
      }
    }
    for (const c of day.conflicts) list.push({ id: `conf-${c.personName}`, tone: "danger", text: `${c.personName}: ${c.reason}` });
    if (day.sheet.outdated) {
      list.push({
        id: "sheet",
        tone: "warn",
        text: "La hoja de llamada ya se compartió y el plan ha cambiado después",
        detail: "Revísala y vuelve a enviarla al equipo.",
      });
    }
    return list;
  }, [timeline, blocks, data, dayId, day.conflicts, day.sheet.outdated, hasShots]);

  // --- Arrastrar y soltar ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [dragging, setDragging] = useState<{ kind: DragKind; id: string } | null>(null);
  // Id estable: si no, los atributos de accesibilidad de dnd-kit no casan
  // entre el HTML del servidor y el cliente (error de hidratación).
  const dndContextId = useId();

  const collision: CollisionDetection = (args) => {
    const active = parseId(args.active.id);
    const allow: DragKind[] =
      active?.kind === "block" ? ["block", "pool"] : active?.kind === "scene" ? ["block", "drop", "newblock", "pool"] : ["shot", "drop", "newblock", "pool"];
    const containers = args.droppableContainers.filter((c) => allow.includes(parseId(c.id)?.kind as DragKind));
    const within = pointerWithin({ ...args, droppableContainers: containers });
    if (within.length > 0) {
      // Lo más concreto primero: un plano gana a su bloque.
      const rank = (id: string | number) => ({ shot: 0, block: 1, drop: 2, newblock: 3, pool: 4, scene: 5 })[parseId(id)?.kind ?? "pool"] ?? 9;
      return [...within].sort((a, b) => rank(a.id) - rank(b.id));
    }
    return closestCenter({ ...args, droppableContainers: containers });
  };

  function onDragStart(e: DragStartEvent) {
    setDragging(parseId(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const a = parseId(e.active.id);
    const o = parseId(e.over?.id);
    if (!a || !o) return;

    if (a.kind === "shot") {
      const fromBlock = findShotBlock(a.id);
      if (o.kind === "pool") {
        if (fromBlock) moveShot(a.id, "pool");
        return;
      }
      if (o.kind === "newblock") return moveShot(a.id, { newBlockDayId: dayId });
      if (o.kind === "drop") {
        const block = blocks.find((b) => b.id === o.id);
        if (block && block.kind === "SHOTS") moveShot(a.id, { blockId: block.id, index: block.shots.filter((s) => s.id !== a.id).length });
        return;
      }
      if (o.kind === "shot" && o.id !== a.id) {
        const target = findShotBlock(o.id);
        if (!target) {
          if (fromBlock) moveShot(a.id, "pool");
          return;
        }
        const overIndex = target.shots.findIndex((s) => s.id === o.id);
        moveShot(a.id, { blockId: target.id, index: overIndex });
      }
      return;
    }

    if (a.kind === "scene") {
      if (o.kind === "pool") return;
      const index = o.kind === "block" ? blocks.findIndex((b) => b.id === o.id) : blocks.length;
      run(
        () => setPoolScenes((prev) => prev.filter((id) => id !== a.id)),
        () => placeScene(projectId, a.id, { dayId, index: Math.max(0, index) }),
        `Escena ${data.scenes[a.id]?.number ?? ""} a esta jornada`,
        "No se pudo programar la escena.",
      );
      return;
    }

    if (a.kind === "block") {
      const block = blocks.find((b) => b.id === a.id);
      if (!block) return;
      if (o.kind === "pool") {
        if (block.scene) api.unscheduleScene(block.scene.id);
        else if (block.shots.length > 0) api.removeBlock(block.id);
        return;
      }
      if (o.kind === "block" && o.id !== a.id) {
        const to = blocks.findIndex((b) => b.id === o.id);
        const from = blocks.findIndex((b) => b.id === a.id);
        run(
          () =>
            setBlocks((prev) => {
              const next = [...prev];
              const [moved] = next.splice(from, 1);
              next.splice(to, 0, moved);
              return next;
            }),
          () => moveBlock(projectId, a.id, dayId, to),
          "",
          "No se pudo mover el bloque.",
        );
      }
    }
  }

  const draggedShot = dragging?.kind === "shot" ? allShots.get(dragging.id) : null;
  const draggedBlock = dragging?.kind === "block" ? blocks.find((b) => b.id === dragging.id) : null;
  const draggedScene = dragging?.kind === "scene" ? data.scenes[dragging.id] : null;

  const usedMin = timeline.workMinutes;
  const maxMin = data.workdayHours * 60;
  const meterPct = Math.min(100, Math.round((usedMin / Math.max(maxMin, 1)) * 100));

  return (
    <DndContext id={dndContextId} sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      {viewers.length > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          También están aquí: {viewers.join(", ")}
        </p>
      )}
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[19rem_minmax(0,1fr)_16rem]">
        <SchedulePool
          api={api}
          pool={pool}
          poolScenes={poolScenes}
          dayLocations={day.locations}
          isDragging={Boolean(dragging)}
        />

        {/* Orden de rodaje */}
        <section aria-label={`Orden de rodaje del ${day.title}`} className="min-w-0 rounded-xl border border-line bg-bg-raised/30">
          <header className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-line px-4 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">
                {day.title} · <span className="font-semibold">{day.dateLabel}</span>
              </h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {day.locations.length > 0 ? day.locations.join(" · ") : "Sin localización"}
                {timeline.sunset !== null && ` · puesta de sol ${formatHHMM(timeline.sunset)}`}
              </p>
            </div>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-muted">Llamada</span>
              <input
                value={callTime}
                onChange={(e) => setCallTime(e.target.value)}
                onBlur={saveTimes}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                placeholder="07:45"
                inputMode="numeric"
                aria-label="Hora de llamada general"
                className="w-[5.5rem] rounded-md border border-line bg-transparent px-2 py-1 font-mono text-base outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-muted">Preparación</span>
              <span className="flex items-center gap-1">
                <input
                  value={prepMin}
                  onChange={(e) => setPrepMin(e.target.value.replace(/\D/g, ""))}
                  onBlur={saveTimes}
                  onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                  inputMode="numeric"
                  aria-label="Minutos de preparación antes del primer bloque"
                  className="w-14 rounded-md border border-line bg-transparent px-2 py-1 font-mono text-base outline-none focus:border-accent"
                />
                <span className="text-xs text-muted">min</span>
              </span>
            </label>
            <div>
              <p className="text-xs text-muted">Fin previsto</p>
              <p className={`font-mono text-base ${usedMin > maxMin ? "text-warn" : ""}`}>{hasShots ? formatHHMM(timeline.wrap) : "—"}</p>
            </div>
            <div className="min-w-44 flex-1">
              <div className="flex justify-between text-xs text-muted">
                <span>{hasShots ? `${formatDuration(usedMin)} de trabajo` : "Jornada vacía"}</span>
                <span>máx. {data.workdayHours} h + comida</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${usedMin > maxMin ? "bg-warn" : "bg-accent"}`}
                  style={{ width: `${hasShots ? meterPct : 0}%` }}
                />
              </div>
            </div>
          </header>

          <ol className="px-3 py-3 sm:px-4">
            <li className="grid grid-cols-[2.75rem_1fr] gap-2 sm:grid-cols-[3.25rem_1fr] sm:gap-3 py-1.5 text-sm">
              <span className="pt-0.5 font-mono text-[13px] text-fg/80">{timeline.callTime !== null ? formatHHMM(timeline.callTime) : "--:--"}</span>
              <span>
                <b>Llamada general</b>
                <span className="text-muted"> · preparación {formatDuration(Number(prepMin || DEFAULT_PREP_MIN))}</span>
              </span>
            </li>
            <SortableContext items={blocks.map((b) => dndId("block", b.id))} strategy={verticalListSortingStrategy}>
              {timeline.blocks.map((block, i) => (
                <BlockView key={block.id} api={api} block={block} index={i} total={timeline.blocks.length} letter={blockLabel(blocks, block.id)} />
              ))}
            </SortableContext>
            {hasShots && (
              <li className="grid grid-cols-[2.75rem_1fr] gap-2 sm:grid-cols-[3.25rem_1fr] sm:gap-3 py-1.5 text-sm">
                <span className="pt-0.5 font-mono text-[13px] text-fg/80">{formatHHMM(timeline.wrap)}</span>
                <b>Fin de rodaje previsto</b>
              </li>
            )}
          </ol>
          <NewBlockDrop active={dragging?.kind === "shot" || dragging?.kind === "scene"} />
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
            <button type="button" onClick={() => addBlock("SHOTS")} className="btn btn-outline btn-sm">
              + Bloque de planos
            </button>
            <button type="button" onClick={() => addBlock("MEAL")} className="btn btn-outline btn-sm">
              + Comida
            </button>
            <button type="button" onClick={() => addBlock("MOVE")} className="btn btn-outline btn-sm">
              + Cambio de set / traslado
            </button>
            <button type="button" onClick={() => addBlock("NOTE")} className="btn btn-outline btn-sm">
              + Nota
            </button>
          </div>
        </section>

        <ScheduleSide api={api} timeline={timeline} warnings={warnings} prepMin={Number(prepMin || DEFAULT_PREP_MIN)} />
      </div>

      <DragOverlay dropAnimation={null}>
        {draggedShot ? (
          <div className="w-72 rounded-lg border border-accent bg-bg shadow-xl shadow-black/60">
            <ShotCard shot={draggedShot} />
          </div>
        ) : draggedBlock ? (
          <div className="w-72 rounded-lg border border-accent bg-bg px-3 py-2 text-sm font-semibold shadow-xl shadow-black/60">
            {draggedBlock.scene ? `Escena ${draggedBlock.scene.number} entera` : (draggedBlock.title ?? "Bloque")} · {draggedBlock.shots.length} planos
          </div>
        ) : draggedScene ? (
          <div className="flex w-72 items-center gap-2 rounded-lg border border-accent bg-bg px-3 py-2 text-sm shadow-xl shadow-black/60">
            <span className="font-mono font-semibold">{draggedScene.number}</span>
            <SceneTag intExt={draggedScene.intExt} dayPart={draggedScene.dayPart} />
            <span className="truncate">{draggedScene.location}</span>
          </div>
        ) : null}
      </DragOverlay>
      <p className="mt-3 text-xs text-muted">
        Consejo: arrastra planos entre bloques o desde &ldquo;Por programar&rdquo;; con teclado o en el móvil, usa el menú ⋯ de cada plano.{" "}
        <Link href={`/app/${projectId}/plan-de-rodaje/${dayId}`} className="text-accent hover:underline">
          Datos de la jornada (fecha, notas, reservas) →
        </Link>
      </p>
    </DndContext>
  );
}

function NewBlockDrop({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: dndId("newblock") });
  return (
    <div
      ref={setNodeRef}
      className={`mx-4 mb-3 rounded-lg border border-dashed px-3 py-3 text-center text-[13px] transition-colors ${
        isOver ? "border-accent bg-accent/10 text-accent" : active ? "border-accent/50 text-accent" : "border-line text-muted"
      }`}
    >
      Suelta aquí para empezar un bloque nuevo al final
    </div>
  );
}
