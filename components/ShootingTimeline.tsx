"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { assignSceneToDay } from "@/lib/actions/shooting-days";
import { FeatureIntro } from "@/components/FeatureIntro";

export type TimelineScene = {
  id: string;
  number: string;
  intExtLabel: string;
  dayPartLabel: string;
  locationName: string | null;
  dayId: string | null;
};

export type TimelineDay = {
  id: string;
  label: string;
  conflicts: { personName: string; reason: string }[];
};

const UNASSIGNED = "__unassigned__";
const LONG_PRESS_MS = 380;
const MOVE_CANCEL_PX = 12;
const MOUSE_DRAG_START_PX = 5;

type DragState = {
  sceneId: string;
  offsetX: number;
  offsetY: number;
};

function SceneCard({
  scene,
  isPressing,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  scene: TimelineScene;
  isPressing: boolean;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: isDragging ? "none" : "auto" }}
      className={
        "cursor-grab border border-line bg-bg p-2.5 transition-[transform,opacity,border-color] duration-150 select-none active:cursor-grabbing " +
        (isDragging ? "opacity-30" : "") +
        (isPressing ? " scale-95 border-accent" : "")
      }
    >
      <p className="font-mono text-xs font-bold">Escena {scene.number}</p>
      <p className="mt-0.5 font-mono text-[10px] text-muted">
        {scene.intExtLabel} · {scene.dayPartLabel}
        {scene.locationName ? ` · ${scene.locationName}` : ""}
      </p>
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
  const [pressingSceneId, setPressingSceneId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
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
        if (payload.senderId === senderIdRef.current) return;
        setScenes((prev) =>
          prev.map((s) =>
            s.id === payload.sceneId ? { ...s, dayId: payload.dayId } : s,
          ),
        );
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

  const byColumn = useMemo(() => {
    const map = new Map<string, TimelineScene[]>();
    map.set(UNASSIGNED, []);
    for (const day of days) map.set(day.id, []);
    for (const scene of scenes) {
      const key = scene.dayId ?? UNASSIGNED;
      const list = map.get(key);
      if (list) list.push(scene);
      else map.get(UNASSIGNED)!.push(scene);
    }
    return map;
  }, [scenes, days]);

  function commitMove(sceneId: string, targetDayId: string | null) {
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, dayId: targetDayId } : s)),
    );
    channelRef.current?.send({
      type: "broadcast",
      event: "scene-moved",
      payload: { sceneId, dayId: targetDayId, senderId: senderIdRef.current },
    });
    startTransition(() => {
      assignSceneToDay(projectId, sceneId, targetDayId);
    });
  }

  function clearPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressingSceneId(null);
  }

  function beginDrag(
    sceneId: string,
    target: HTMLElement,
    clientX: number,
    clientY: number,
  ) {
    const rect = target.getBoundingClientRect();
    setDragState({ sceneId, offsetX: clientX - rect.left, offsetY: clientY - rect.top });
    setGhostPos({ x: clientX, y: clientY });
  }

  function columnIdAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    const column = el?.closest<HTMLElement>("[data-column-id]");
    return column?.dataset.columnId ?? null;
  }

  function handlePointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    sceneId: string,
  ) {
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
      setPressingSceneId(sceneId);
      const target = e.currentTarget;
      const { clientX, clientY } = e;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        setPressingSceneId(null);
        beginDrag(sceneId, target, clientX, clientY);
      }, LONG_PRESS_MS);
    }
  }

  function handlePointerMove(
    e: React.PointerEvent<HTMLDivElement>,
    sceneId: string,
  ) {
    if (dragState?.sceneId === sceneId) {
      e.preventDefault();
      setGhostPos({ x: e.clientX, y: e.clientY });
      setDragOverId(columnIdAtPoint(e.clientX, e.clientY));
      return;
    }

    if (!startPosRef.current) return;
    const distance = Math.hypot(
      e.clientX - startPosRef.current.x,
      e.clientY - startPosRef.current.y,
    );

    if (e.pointerType === "touch") {
      if (distance > MOVE_CANCEL_PX) clearPress();
      return;
    }

    // Ratón: el primer movimiento significativo con el botón pulsado
    // activa el arrastre directamente, sin espera de pulsación larga.
    if (distance > MOUSE_DRAG_START_PX) {
      beginDrag(sceneId, e.currentTarget, e.clientX, e.clientY);
    }
  }

  function handlePointerUp(
    e: React.PointerEvent<HTMLDivElement>,
    sceneId: string,
  ) {
    clearPress();
    startPosRef.current = null;

    if (dragState?.sceneId === sceneId) {
      const rawId = columnIdAtPoint(e.clientX, e.clientY);
      setDragState(null);
      setGhostPos(null);
      setDragOverId(null);
      if (rawId !== null) {
        commitMove(sceneId, rawId === UNASSIGNED ? null : rawId);
      }
    }
  }

  const draggedScene = dragState
    ? scenes.find((s) => s.id === dragState.sceneId)
    : null;

  return (
    <div className="mt-8">
      <FeatureIntro featureId="shooting-timeline">
        Mantén pulsada una escena (o arrástrala con el ratón) para cambiarla
        de día de rodaje — se guarda sola, sin formularios. La columna
        &ldquo;Sin asignar&rdquo; son las escenas que todavía no tienen día.
        Si alguien más tiene esta pantalla abierta a la vez, los cambios se
        ven al instante en las dos pantallas.
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
            "flex w-56 shrink-0 flex-col gap-2 border p-3 transition-colors " +
            (dragOverId === UNASSIGNED ? "border-accent" : "border-line")
          }
        >
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Sin asignar ({byColumn.get(UNASSIGNED)?.length ?? 0})
          </p>
          <div className="flex flex-col gap-2">
            {(byColumn.get(UNASSIGNED) ?? []).map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                isPressing={pressingSceneId === scene.id}
                isDragging={dragState?.sceneId === scene.id}
                onPointerDown={(e) => handlePointerDown(e, scene.id)}
                onPointerMove={(e) => handlePointerMove(e, scene.id)}
                onPointerUp={(e) => handlePointerUp(e, scene.id)}
              />
            ))}
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
              "flex w-56 shrink-0 flex-col gap-2 border p-3 transition-colors " +
              (dragOverId === day.id ? "border-accent" : "border-line")
            }
          >
            <div className="flex items-center justify-between">
              <Link
                href={`/app/${projectId}/plan-de-rodaje/${day.id}`}
                className="font-mono text-[10px] tracking-widest text-fg uppercase hover:text-accent"
              >
                {day.label}
              </Link>
              <span className="font-mono text-[10px] text-muted">
                {byColumn.get(day.id)?.length ?? 0}
              </span>
            </div>

            {day.conflicts.length > 0 && (
              <div className="border border-accent p-2">
                {day.conflicts.map((c, i) => (
                  <p key={i} className="font-mono text-[10px] text-accent">
                    ⚠ {c.personName} — {c.reason}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {(byColumn.get(day.id) ?? []).map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  isPressing={pressingSceneId === scene.id}
                  isDragging={dragState?.sceneId === scene.id}
                  onPointerDown={(e) => handlePointerDown(e, scene.id)}
                  onPointerMove={(e) => handlePointerMove(e, scene.id)}
                  onPointerUp={(e) => handlePointerUp(e, scene.id)}
                />
              ))}
              {(byColumn.get(day.id) ?? []).length === 0 && (
                <p className="font-mono text-[10px] text-muted">
                  Mantén pulsada una escena y suéltala aquí.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {dragState && ghostPos && draggedScene && (
        <div
          className="pointer-events-none fixed z-50 w-52 scale-105 border border-accent bg-bg p-2.5 shadow-lg shadow-black/50"
          style={{ left: ghostPos.x - dragState.offsetX, top: ghostPos.y - dragState.offsetY }}
        >
          <p className="font-mono text-xs font-bold">Escena {draggedScene.number}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted">
            {draggedScene.intExtLabel} · {draggedScene.dayPartLabel}
            {draggedScene.locationName ? ` · ${draggedScene.locationName}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
