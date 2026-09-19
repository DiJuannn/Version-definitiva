"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { assignSceneToDay, assignShotToDay } from "@/lib/actions/shooting-days";
import { FeatureIntro } from "@/components/FeatureIntro";
import { useToast } from "@/components/Toast";

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
  intExtLabel: string;
  dayPartLabel: string;
  locationName: string | null;
  // Día de la escena cuando NO tiene planos. Con planos, cada plano lleva su día.
  dayId: string | null;
  shots: TimelineShot[];
};

export type TimelineDay = {
  id: string;
  label: string;
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

function ChunkCard({
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
      style={{ touchAction: isDragging ? "none" : "auto" }}
      className={
        "cursor-grab border border-l-2 border-line border-l-accent/70 bg-bg p-3 transition-[transform,opacity,border-color] duration-150 select-none hover:border-accent/40 hover:border-l-accent active:cursor-grabbing " +
        (isDragging ? "opacity-30" : "") +
        (isPressing ? " scale-95 border-accent" : "")
      }
    >
      <p className="font-display text-sm font-bold">Escena {scene.number}</p>
      <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted">
        {scene.intExtLabel} · {scene.dayPartLabel}
        {scene.locationName ? ` · ${scene.locationName}` : ""}
      </p>

      {totalShots > 0 && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setShowShots((v) => !v)}
            aria-expanded={showShots}
            className="mt-2 flex w-full items-center justify-between gap-2 border border-line px-2 py-1 font-mono text-[10px] text-accent hover:border-accent/60"
          >
            <span>
              {shots.length === totalShots
                ? `${totalShots} plano${totalShots === 1 ? "" : "s"}`
                : `${shots.length} de ${totalShots} planos`}
              {doneShots > 0 ? ` · ${doneShots} rodado${doneShots === 1 ? "" : "s"}` : ""}
            </span>
            <span aria-hidden>{showShots ? "▴" : "▾"}</span>
          </button>

          {showShots && (
            <ul className="mt-2 space-y-1.5">
              {shots.map((shot) => (
                <li key={shot.id} className="border border-line/70 p-1.5">
                  <p className="flex items-baseline gap-1.5 font-mono text-[10px]">
                    <span className="text-accent">{shot.label}</span>
                    <span className="uppercase">{shot.size ?? ""}</span>
                    {shot.done && <span className="text-success">✓ rodado</span>}
                  </p>
                  {shot.description && (
                    <p className="mt-0.5 line-clamp-2 font-mono text-[10px] text-muted">{shot.description}</p>
                  )}
                  <label className="sr-only" htmlFor={`shot-move-${shot.id}`}>
                    Día del plano {shot.label}
                  </label>
                  <select
                    id={`shot-move-${shot.id}`}
                    value={chunk.columnId}
                    onChange={(e) => onMoveShot(shot.id, e.target.value)}
                    className="mt-1 w-full border border-line bg-transparent px-1 py-0.5 font-mono text-[10px] text-muted outline-none focus:border-accent"
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
      )}

      {/* Alternativa al arrastre: sirve con teclado y en táctil sin pulsación larga. */}
      <div className="mt-2 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
        <label className="sr-only" htmlFor={`move-${chunk.key}`}>
          Mover {totalShots > 0 ? "los planos de " : ""}la escena {scene.number} a otro día
        </label>
        <select
          id={`move-${chunk.key}`}
          value={chunk.columnId}
          onChange={(e) => onMove(e.target.value)}
          className="min-w-0 flex-1 border border-line bg-transparent px-1.5 py-1 font-mono text-[10px] text-muted outline-none focus:border-accent"
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
          className="shrink-0 px-1 font-mono text-[11px] text-muted hover:text-accent"
        >
          →
        </Link>
      </div>
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
      { id: UNASSIGNED, label: "Sin asignar" },
      ...days.map((day) => ({ id: day.id, label: day.label })),
    ],
    [days],
  );

  function labelOf(columnId: string) {
    return columnId === UNASSIGNED ? "Sin asignar" : (days.find((d) => d.id === columnId)?.label ?? "el día");
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
      <ChunkCard
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

  // En los contadores de columna: escenas que se ruedan ese día y, si hay shot list, sus planos.
  function counter(list: Chunk[]) {
    const shotCount = list.reduce((n, c) => n + c.shots.length, 0);
    return shotCount > 0 ? `${list.length} · ${shotCount} pl.` : String(list.length);
  }

  return (
    <div className="mt-8">
      <FeatureIntro featureId="shooting-timeline">
        Mantén pulsada una escena (o arrástrala con el ratón) para cambiarla de día de rodaje — se guarda sola, sin
        formularios. Si la escena tiene planos, abre &ldquo;planos&rdquo; en la tarjeta para repartirlos entre días:
        una escena puede rodarse en varios. La columna &ldquo;Sin asignar&rdquo; son las escenas o planos que
        todavía no tienen día. Si alguien más tiene esta pantalla abierta a la vez, los cambios se ven al instante en
        las dos pantallas.
      </FeatureIntro>

      {otherViewers.length > 0 && (
        <div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Viendo ahora: {otherViewers.join(", ")}
        </div>
      )}

      <div className="mt-4 flex gap-4 overflow-x-auto pb-4">
        <div
          data-column-id={UNASSIGNED}
          className={
            "flex w-64 shrink-0 flex-col gap-3 border border-dashed bg-bg-raised/20 p-4 transition-colors " +
            (dragOverId === UNASSIGNED ? "border-accent" : "border-line")
          }
        >
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Sin asignar ({counter(byColumn.get(UNASSIGNED) ?? [])})
          </p>
          <div className="flex flex-col gap-2">
            {(byColumn.get(UNASSIGNED) ?? []).map(renderCard)}
            {(byColumn.get(UNASSIGNED) ?? []).length === 0 && (
              <p className="font-mono text-[10px] text-muted">Todo asignado.</p>
            )}
          </div>
        </div>

        {days.map((day) => (
          <div
            key={day.id}
            data-column-id={day.id}
            className={
              "flex w-64 shrink-0 flex-col gap-3 border bg-bg-raised/50 p-4 transition-colors " +
              (dragOverId === day.id ? "border-accent" : "border-line")
            }
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <Link
                href={`/app/${projectId}/plan-de-rodaje/${day.id}`}
                className="font-display text-sm font-bold transition-colors hover:text-accent"
              >
                {day.label}
              </Link>
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-muted">
                {counter(byColumn.get(day.id) ?? [])}
              </span>
            </div>

            {day.conflicts.length > 0 && (
              <div className="border border-warn/60 p-2">
                {day.conflicts.map((c, i) => (
                  <p key={i} className="font-mono text-[10px] text-warn">
                    ⚠ {c.personName} — {c.reason}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {(byColumn.get(day.id) ?? []).map(renderCard)}
              {(byColumn.get(day.id) ?? []).length === 0 && (
                <p className="font-mono text-[10px] text-muted">Mantén pulsada una escena y suéltala aquí.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {dragState && ghostPos && draggedChunk && (
        <div
          className="pointer-events-none fixed z-50 w-52 scale-105 border border-accent bg-bg p-2.5 shadow-lg shadow-black/50"
          style={{ left: ghostPos.x - dragState.offsetX, top: ghostPos.y - dragState.offsetY }}
        >
          <p className="font-mono text-xs font-bold">Escena {draggedChunk.scene.number}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted">
            {draggedChunk.scene.intExtLabel} · {draggedChunk.scene.dayPartLabel}
            {draggedChunk.scene.locationName ? ` · ${draggedChunk.scene.locationName}` : ""}
          </p>
          {draggedChunk.shots.length > 0 && (
            <p className="mt-0.5 font-mono text-[10px] text-accent">
              {draggedChunk.shots.length} plano{draggedChunk.shots.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
