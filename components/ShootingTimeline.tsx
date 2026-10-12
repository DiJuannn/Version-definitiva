"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { assignSceneToDay, assignShotToDay } from "@/lib/actions/shooting-days";
import { FeatureIntro } from "@/components/FeatureIntro";
import { useToast } from "@/components/Toast";
import { SceneTag, sceneStripColor } from "@/components/SceneTag";
import { PeopleStack } from "@/components/PersonInitials";
import type { DayPart, IntExt } from "@/lib/generated/prisma";

export type TimelineShot = {
  id: string;
  label: string;
  size: string | null;
  description: string | null;
  dayId: string | null;
  done: boolean;
};

export type TimelineScene = {
  id: string;
  number: string;
  intExt: IntExt;
  dayPart: DayPart;
  intExtLabel: string;
  dayPartLabel: string;
  locationName: string | null;
  description: string | null;
  characters: string[];
  // Día de la escena cuando NO tiene planos. Con planos, cada plano lleva su día.
  dayId: string | null;
  shots: TimelineShot[];
};

export type TimelineDay = {
  id: string;
  // "Día 2 · jue 16 oct" (selectores y avisos); title + dateLabel, la cabecera del día.
  label: string;
  title: string;
  dateLabel: string;
  conflicts: { personName: string; reason: string }[];
};

// Lo que se ve en una columna: una escena entera, o el trozo de escena (sus
// planos) que se rueda ese día.
type Chunk = {
  key: string;
  scene: TimelineScene;
  columnId: string;
  shots: TimelineShot[];
};

const UNASSIGNED = "__unassigned__";
const LONG_PRESS_MS = 380;
const MOVE_CANCEL_PX = 12;
const MOUSE_DRAG_START_PX = 5;

type DragState = {
  chunkKey: string;
  offsetX: number;
  offsetY: number;
};

type MovePayload = {
  sceneId: string;
  // Sin shotIds: se mueve la escena (que no tiene planos). Con shotIds: solo esos planos.
  shotIds?: string[];
  dayId: string | null;
  senderId: string | null;
};

function applyMove(scenes: TimelineScene[], payload: { sceneId: string; shotIds?: string[]; dayId: string | null }) {
  return scenes.map((scene) => {
    if (scene.id !== payload.sceneId) return scene;
    if (!payload.shotIds) return { ...scene, dayId: payload.dayId };
    const ids = new Set(payload.shotIds);
    return {
      ...scene,
      shots: scene.shots.map((shot) => (ids.has(shot.id) ? { ...shot, dayId: payload.dayId, done: false } : shot)),
    };
  });
}

const MOVE_SELECT =
  "h-7 min-w-0 rounded-md border border-line bg-transparent px-1.5 text-xs text-muted outline-none transition-colors hover:border-accent/60 focus:border-accent";

// Una tira del plan de rodaje: la escena (o el trozo de sus planos que se
// rueda en esa columna) con su color, dónde, de qué va y quién sale. En sitio
// ancho va en una línea; en la columna estrecha de "Sin día" se apila.
function StripRow({
  chunk,
  projectId,
  columns,
  onMove,
  onMoveShot,
  isPressing,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  chunk: Chunk;
  projectId: string;
  columns: { id: string; label: string }[];
  onMove: (columnId: string) => void;
  onMoveShot: (shotId: string, columnId: string) => void;
  isPressing: boolean;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const { scene, shots } = chunk;
  const [showShots, setShowShots] = useState(false);
  const totalShots = scene.shots.length;
  const doneShots = shots.filter((s) => s.done).length;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={
        "@container cursor-grab rounded-lg border border-l-4 border-line bg-bg transition-[transform,opacity,border-color] duration-150 select-none hover:border-accent/40 active:cursor-grabbing " +
        (isDragging ? "opacity-30" : "") +
        (isPressing ? " scale-[0.98] border-accent" : "")
      }
      style={{ touchAction: isDragging ? "none" : "auto", borderLeftColor: sceneStripColor(scene.intExt, scene.dayPart) }}
    >
      <div className="flex flex-col gap-2 px-3 py-2.5 @2xl:flex-row @2xl:items-center @2xl:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[0.9375rem] font-semibold">{scene.number}</span>
            <SceneTag intExt={scene.intExt} dayPart={scene.dayPart} />
            {scene.locationName && <span className="min-w-0 truncate text-sm font-semibold">{scene.locationName}</span>}
          </div>
          {scene.description && <p className="mt-0.5 truncate text-[13px] text-muted">{scene.description}</p>}
        </div>

        <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
          {scene.characters.length > 0 && (
            <span className="shrink-0">
              <PeopleStack names={scene.characters} max={3} />
            </span>
          )}
          {totalShots > 0 && (
            <button
              type="button"
              onClick={() => setShowShots((v) => !v)}
              aria-expanded={showShots}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2.5 text-xs whitespace-nowrap text-fg transition-colors hover:bg-accent/25"
            >
              {shots.length === totalShots
                ? `${totalShots} plano${totalShots === 1 ? "" : "s"}`
                : `${shots.length} de ${totalShots} planos`}
              {doneShots > 0 && <span className="text-success">· {doneShots} ✓</span>}
              <span aria-hidden className="text-muted">
                {showShots ? "▴" : "▾"}
              </span>
            </button>
          )}
          {/* Alternativa al arrastre: sirve con teclado y en táctil sin pulsación larga. */}
          <label className="sr-only" htmlFor={`move-${chunk.key}`}>
            Mover {totalShots > 0 ? "los planos de " : ""}la escena {scene.number} a otro día
          </label>
          <select
            id={`move-${chunk.key}`}
            value={chunk.columnId}
            onChange={(e) => onMove(e.target.value)}
            className={`${MOVE_SELECT} flex-1 @2xl:w-40 @2xl:flex-none`}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id} className="bg-bg">
                {column.label}
              </option>
            ))}
          </select>
          <Link
            href={`/app/${projectId}/guion/${scene.id}`}
            aria-label={`Abrir la escena ${scene.number}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:text-accent"
          >
            →
          </Link>
        </div>
      </div>

      {showShots && totalShots > 0 && (
        <ul className="border-t border-line/70 px-3 py-2" onPointerDown={(e) => e.stopPropagation()}>
          {shots.map((shot) => (
            <li key={shot.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-1 text-[13px]">
              <span className="w-10 font-mono">{shot.label}</span>
              <span className="w-8 font-mono text-muted">{shot.size ?? ""}</span>
              <span className={`min-w-0 flex-1 truncate ${shot.done ? "text-muted line-through" : "text-fg/85"}`}>
                {shot.description ?? ""}
              </span>
              {shot.done && <span className="text-xs text-success">✓ rodado</span>}
              <label className="sr-only" htmlFor={`shot-move-${shot.id}`}>
                Día del plano {shot.label}
              </label>
              <select
                id={`shot-move-${shot.id}`}
                value={chunk.columnId}
                onChange={(e) => onMoveShot(shot.id, e.target.value)}
                className={`${MOVE_SELECT} max-w-36`}
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id} className="bg-bg">
                    {column.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ShootingTimeline({
  projectId,
  days,
  initialScenes,
  viewerLabel,
}: {
  projectId: string;
  days: TimelineDay[];
  initialScenes: TimelineScene[];
  viewerLabel: string;
}) {
  const [scenes, setScenes] = useState(initialScenes);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [pressingKey, setPressingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const [otherViewers, setOtherViewers] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const senderIdRef = useRef<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!senderIdRef.current) senderIdRef.current = crypto.randomUUID();
    const supabase = createClient();
    const channel = supabase.channel(`plan-de-rodaje:${projectId}`, {
      config: { presence: { key: senderIdRef.current } },
    });

    channel
      .on("broadcast", { event: "scene-moved" }, ({ payload }) => {
        const data = payload as MovePayload;
        if (data.senderId === senderIdRef.current) return;
        setScenes((prev) => applyMove(prev, data));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ label: string }>();
        const labels = Object.entries(state)
          .filter(([key]) => key !== senderIdRef.current)
          .flatMap(([, entries]) => entries.map((e) => e.label));
        setOtherViewers([...new Set(labels)]);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ label: viewerLabel });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const chunks = useMemo(() => {
    const list: Chunk[] = [];
    for (const scene of scenes) {
      if (scene.shots.length === 0) {
        list.push({ key: `${scene.id}:${scene.dayId ?? UNASSIGNED}`, scene, columnId: scene.dayId ?? UNASSIGNED, shots: [] });
        continue;
      }
      const groups = new Map<string, TimelineShot[]>();
      for (const shot of scene.shots) {
        const column = shot.dayId ?? UNASSIGNED;
        groups.set(column, [...(groups.get(column) ?? []), shot]);
      }
      for (const [column, shots] of groups) {
        list.push({ key: `${scene.id}:${column}`, scene, columnId: column, shots });
      }
    }
    return list;
  }, [scenes]);

  const byColumn = useMemo(() => {
    const map = new Map<string, Chunk[]>();
    map.set(UNASSIGNED, []);
    for (const day of days) map.set(day.id, []);
    for (const chunk of chunks) {
      const list = map.get(chunk.columnId);
      if (list) list.push(chunk);
      else map.get(UNASSIGNED)!.push(chunk);
    }
    return map;
  }, [chunks, days]);

  const columns = useMemo(
    () => [
      { id: UNASSIGNED, label: "Sin día" },
      ...days.map((day) => ({ id: day.id, label: day.label })),
    ],
    [days],
  );

  function labelOf(columnId: string) {
    return columnId === UNASSIGNED ? "Sin día" : (days.find((d) => d.id === columnId)?.label ?? "el día");
  }

  function broadcast(payload: Omit<MovePayload, "senderId">) {
    channelRef.current?.send({
      type: "broadcast",
      event: "scene-moved",
      payload: { ...payload, senderId: senderIdRef.current },
    });
  }

  // Mueve un trozo de escena (todos sus planos de esa columna, o la escena si no tiene planos).
  function commitMove(chunk: Chunk, targetColumn: string) {
    if (chunk.columnId === targetColumn) return;
    const targetDayId = targetColumn === UNASSIGNED ? null : targetColumn;
    const fromDayId = chunk.columnId === UNASSIGNED ? null : chunk.columnId;
    const shotIds = chunk.scene.shots.length > 0 ? chunk.shots.map((s) => s.id) : undefined;

    setScenes((prev) => applyMove(prev, { sceneId: chunk.scene.id, shotIds, dayId: targetDayId }));
    broadcast({ sceneId: chunk.scene.id, shotIds, dayId: targetDayId });

    startTransition(async () => {
      let ok = false;
      try {
        ok = await assignSceneToDay(projectId, chunk.scene.id, targetDayId, fromDayId);
      } catch {
        ok = false;
      }
      if (ok) {
        toast(
          "success",
          shotIds
            ? `${shotIds.length} plano${shotIds.length === 1 ? "" : "s"} de la escena ${chunk.scene.number} → ${labelOf(targetColumn)}`
            : `Escena ${chunk.scene.number} movida a ${labelOf(targetColumn)}`,
        );
      } else {
        // Vuelve a su sitio para que la pantalla no mienta sobre lo guardado.
        setScenes((prev) => applyMove(prev, { sceneId: chunk.scene.id, shotIds, dayId: fromDayId }));
        broadcast({ sceneId: chunk.scene.id, shotIds, dayId: fromDayId });
        toast("error", "No se pudo mover. Se ha dejado donde estaba.");
      }
    });
  }

  // Mueve un plano concreto.
  function commitShotMove(chunk: Chunk, shotId: string, targetColumn: string) {
    if (chunk.columnId === targetColumn) return;
    const targetDayId = targetColumn === UNASSIGNED ? null : targetColumn;
    const fromDayId = chunk.columnId === UNASSIGNED ? null : chunk.columnId;
    const shot = chunk.shots.find((s) => s.id === shotId);

    setScenes((prev) => applyMove(prev, { sceneId: chunk.scene.id, shotIds: [shotId], dayId: targetDayId }));
    broadcast({ sceneId: chunk.scene.id, shotIds: [shotId], dayId: targetDayId });

    startTransition(async () => {
      let ok = false;
      try {
        ok = await assignShotToDay(projectId, shotId, targetDayId);
      } catch {
        ok = false;
      }
      if (ok) {
        toast("success", `Plano ${shot?.label ?? ""} → ${labelOf(targetColumn)}`);
      } else {
        setScenes((prev) => applyMove(prev, { sceneId: chunk.scene.id, shotIds: [shotId], dayId: fromDayId }));
        broadcast({ sceneId: chunk.scene.id, shotIds: [shotId], dayId: fromDayId });
        toast("error", "No se pudo mover el plano. Se ha dejado donde estaba.");
      }
    });
  }

  function clearPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressingKey(null);
  }

  function beginDrag(key: string, target: HTMLElement, clientX: number, clientY: number) {
    const rect = target.getBoundingClientRect();
    setDragState({ chunkKey: key, offsetX: clientX - rect.left, offsetY: clientY - rect.top });
    setGhostPos({ x: clientX, y: clientY });
  }

  function columnIdAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    const column = el?.closest<HTMLElement>("[data-column-id]");
    return column?.dataset.columnId ?? null;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, key: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Algunos navegadores rechazan capturar un puntero ya inválido/soltado
      // — no es crítico, el arrastre sigue funcionando por posición.
    }
    startPosRef.current = { x: e.clientX, y: e.clientY };

    if (e.pointerType === "touch") {
      // En táctil, mantener pulsado activa el arrastre — un gesto rápido de
      // swipe se cancela antes de que pase esto, dejando que el scroll
      // horizontal normal de las columnas funcione sin interferencia.
      setPressingKey(key);
      const target = e.currentTarget;
      const { clientX, clientY } = e;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        setPressingKey(null);
        beginDrag(key, target, clientX, clientY);
      }, LONG_PRESS_MS);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>, key: string) {
    if (dragState?.chunkKey === key) {
      e.preventDefault();
      setGhostPos({ x: e.clientX, y: e.clientY });
      setDragOverId(columnIdAtPoint(e.clientX, e.clientY));
      return;
    }

    if (!startPosRef.current) return;
    const distance = Math.hypot(e.clientX - startPosRef.current.x, e.clientY - startPosRef.current.y);

    if (e.pointerType === "touch") {
      if (distance > MOVE_CANCEL_PX) clearPress();
      return;
    }

    // Ratón: el primer movimiento significativo con el botón pulsado
    // activa el arrastre directamente, sin espera de pulsación larga.
    if (distance > MOUSE_DRAG_START_PX) {
      beginDrag(key, e.currentTarget, e.clientX, e.clientY);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>, chunk: Chunk) {
    clearPress();
    startPosRef.current = null;

    if (dragState?.chunkKey === chunk.key) {
      const rawId = columnIdAtPoint(e.clientX, e.clientY);
      setDragState(null);
      setGhostPos(null);
      setDragOverId(null);
      if (rawId !== null) commitMove(chunk, rawId);
    }
  }

  const draggedChunk = dragState ? chunks.find((c) => c.key === dragState.chunkKey) : null;

  function renderCard(chunk: Chunk) {
    return (
      <StripRow
        key={chunk.key}
        chunk={chunk}
        isPressing={pressingKey === chunk.key}
        isDragging={dragState?.chunkKey === chunk.key}
        onPointerDown={(e) => handlePointerDown(e, chunk.key)}
        onPointerMove={(e) => handlePointerMove(e, chunk.key)}
        onPointerUp={(e) => handlePointerUp(e, chunk)}
        projectId={projectId}
        columns={columns}
        onMove={(columnId) => commitMove(chunk, columnId)}
        onMoveShot={(shotId, columnId) => commitShotMove(chunk, shotId, columnId)}
      />
    );
  }

  const unassigned = byColumn.get(UNASSIGNED) ?? [];

  return (
    <div className="mt-6">
      <FeatureIntro featureId="shooting-timeline">
        Arrastra una escena (en el móvil, mantenla pulsada) de &ldquo;Sin día&rdquo; a un día, o usa su selector. Con
        planos, ábrelos para repartirlos entre varios días. Se guarda solo y quien tenga esta pantalla abierta lo ve al
        instante.
      </FeatureIntro>

      {otherViewers.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Viendo ahora: {otherViewers.join(", ")}
        </div>
      )}

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Días de rodaje: cada uno, una barra de día y sus tiras debajo */}
        <div className="flex flex-col gap-5">
          {days.length === 0 && (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Crea el primer día de rodaje arriba (o deja que el asistente proponga los días) y arrastra aquí las
              escenas.
            </p>
          )}
          {days.map((day) => {
            const list = byColumn.get(day.id) ?? [];
            const shotCount = list.reduce((n, c) => n + c.shots.length, 0);
            const doneCount = list.reduce((n, c) => n + c.shots.filter((s) => s.done).length, 0);
            const locations = [...new Set(list.map((c) => c.scene.locationName).filter(Boolean))];
            return (
              <section
                key={day.id}
                data-column-id={day.id}
                aria-label={day.label}
                className={
                  "rounded-xl border bg-bg-raised/40 transition-colors " +
                  (dragOverId === day.id ? "border-accent bg-accent/5" : "border-line")
                }
              >
                <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-bold">
                      {day.title}
                      <span className="text-sm font-normal text-fg/80">{day.dateLabel}</span>
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {list.length === 0
                        ? "Sin escenas todavía"
                        : `${list.length} escena${list.length === 1 ? "" : "s"}${
                            shotCount > 0 ? ` · ${shotCount} plano${shotCount === 1 ? "" : "s"}` : ""
                          }${locations.length > 0 ? ` · ${locations.join(", ")}` : ""}`}
                    </p>
                  </div>
                  {shotCount > 0 && (
                    <div
                      className="flex items-center gap-2 text-xs text-muted"
                      title={`${doneCount} de ${shotCount} planos rodados`}
                    >
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
                        <span
                          className="block h-full rounded-full bg-success"
                          style={{ width: `${Math.round((doneCount / shotCount) * 100)}%` }}
                        />
                      </span>
                      {doneCount}/{shotCount} rodados
                    </div>
                  )}
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Link href={`/app/${projectId}/call-sheets/${day.id}`} className="btn btn-outline btn-sm">
                      Hoja de llamada
                    </Link>
                    <Link href={`/app/${projectId}/plan-de-rodaje/${day.id}`} className="btn btn-outline btn-sm">
                      Detalle del día →
                    </Link>
                  </div>
                </header>

                {day.conflicts.length > 0 && (
                  <div className="mx-3 mt-3 rounded-lg border border-warn/50 bg-warn/5 px-3 py-2">
                    {day.conflicts.map((c, i) => (
                      <p key={i} className="text-[13px] text-warn">
                        ⚠ {c.personName}: {c.reason}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2 p-3">
                  {list.map(renderCard)}
                  {list.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">
                      Suelta aquí una escena, o elige este día en su selector.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Lo que aún no tiene día: a mano mientras se arrastra hacia los días */}
        <aside
          data-column-id={UNASSIGNED}
          aria-label="Escenas sin día"
          className={
            "order-first rounded-xl border border-dashed p-3 transition-colors lg:sticky lg:top-36 lg:order-none lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto " +
            (dragOverId === UNASSIGNED ? "border-accent bg-accent/5" : "border-line")
          }
        >
          <h2 className="px-1 text-sm font-bold">
            Sin día <span className="font-normal text-muted">· {unassigned.length}</span>
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {unassigned.map(renderCard)}
            {unassigned.length === 0 && <p className="px-1 pb-1 text-[13px] text-success">Todo tiene día de rodaje.</p>}
          </div>
        </aside>
      </div>

      {dragState && ghostPos && draggedChunk && (
        <div
          className="pointer-events-none fixed z-50 w-60 scale-105 rounded-lg border border-accent bg-bg p-2.5 shadow-lg shadow-black/50"
          style={{ left: ghostPos.x - dragState.offsetX, top: ghostPos.y - dragState.offsetY }}
        >
          <p className="text-sm font-bold">Escena {draggedChunk.scene.number}</p>
          <p className="mt-0.5 text-xs text-muted">
            {draggedChunk.scene.intExtLabel} · {draggedChunk.scene.dayPartLabel}
            {draggedChunk.scene.locationName ? ` · ${draggedChunk.scene.locationName}` : ""}
          </p>
          {draggedChunk.shots.length > 0 && (
            <p className="mt-0.5 text-xs text-accent">
              {draggedChunk.shots.length} plano{draggedChunk.shots.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
