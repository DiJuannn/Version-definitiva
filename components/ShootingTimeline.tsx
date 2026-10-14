"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { assignSceneToDay, assignShotToDay } from "@/lib/actions/shooting-days";
import { useToast } from "@/components/Toast";
import { DAY_STRIP, STRIP_LEGEND, stripTone } from "@/lib/stripboard";

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
  intExt: string;
  dayPart: string;
  intExtLabel: string;
  dayPartLabel: string;
  locationName: string | null;
  // Lo que pasa en la escena (encabezado corto de la tira).
  heading: string | null;
  characters: string[];
  // Días en los que la escena consta como asignada (solo para avisar en la
  // tira cuando la escena tiene día pero sus planos aún no).
  sceneDayIds: string[];
  // Día de la escena cuando NO tiene planos. Con planos, cada plano lleva su día.
  dayId: string | null;
  shots: TimelineShot[];
};

export type TimelineDay = {
  id: string;
  label: string;
  longLabel: string;
  callTime: string | null;
  conflicts: { personName: string; reason: string }[];
};

// Lo que se ve en una tira: una escena entera, o el trozo de escena (sus
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

function applyMove(
  scenes: TimelineScene[],
  payload: { sceneId: string; shotIds?: string[]; dayId: string | null },
) {
  return scenes.map((scene) => {
    if (scene.id !== payload.sceneId) return scene;
    if (!payload.shotIds) return { ...scene, dayId: payload.dayId };
    const ids = new Set(payload.shotIds);
    return {
      ...scene,
      shots: scene.shots.map((shot) =>
        ids.has(shot.id)
          ? { ...shot, dayId: payload.dayId, done: false }
          : shot,
      ),
    };
  });
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// Controles dentro de una tira de color: el texto es oscuro sobre fondo claro
// fijo, así que no usan los tokens de la mesa sino el color de la tira.
const STRIP_SELECT =
  "min-w-0 rounded-md border border-black/20 bg-black/[0.06] px-2 py-1 font-sans text-xs text-current outline-none transition-colors hover:border-black/40 focus-visible:border-black/60 focus-visible:ring-2 focus-visible:ring-black/40";

// Una tira del tablero: una escena (o sus planos de ese día) a lo ancho, con
// el color de INT/EXT y DÍA/NOCHE. Se coge y se suelta en otra jornada.
function Strip({
  chunk,
  projectId,
  columns,
  dayNumberById,
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
  dayNumberById: Map<string, number>;
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
  const tone = stripTone(scene.intExt, scene.dayPart);
  const totalShots = scene.shots.length;
  const doneShots = shots.filter((s) => s.done).length;
  const heading = [scene.locationName, scene.heading]
    .filter(Boolean)
    .join(" — ");
  // Escena con día en el plan pero cuyos planos siguen sin repartir.
  const markedDays =
    chunk.columnId === UNASSIGNED && totalShots > 0
      ? scene.sceneDayIds
          .map((id) => dayNumberById.get(id))
          .filter((n): n is number => n !== undefined)
      : [];
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <li>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          touchAction: isDragging ? "none" : "auto",
          backgroundColor: tone.bg,
          color: tone.fg,
        }}
        className={
          "group/strip grid cursor-grab grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-md py-2 pr-2 pl-1 transition-[transform,opacity,box-shadow] duration-150 select-none active:cursor-grabbing motion-reduce:transition-none sm:grid-cols-[1rem_3.5rem_7.5rem_minmax(0,1fr)_5.5rem_minmax(0,11rem)_8.5rem_auto] sm:gap-x-4 sm:py-1.5 sm:pl-2 " +
          (isDragging
            ? "opacity-30"
            : "hover:-translate-y-px hover:shadow-lg") +
          (isPressing ? " scale-[0.98] ring-2 ring-accent" : "")
        }
      >
        {/* Asa: solo decorativa; arrastra la tira entera. */}
        <span
          aria-hidden
          className="hidden font-mono text-xs leading-none opacity-40 group-hover/strip:opacity-80 sm:block"
        >
          ⋮⋮
        </span>
        <p className="col-start-1 row-span-3 row-start-1 text-center font-display text-2xl leading-none font-black tabular-nums sm:col-start-auto sm:row-span-1 sm:row-start-auto sm:text-left">
          <span className="sr-only">Escena </span>
          {scene.number}
        </p>
        <p className="col-start-2 row-start-1 min-w-0 truncate font-mono text-[11px] font-semibold tracking-wider uppercase sm:col-start-auto sm:row-start-auto sm:text-[10px]">
          {scene.intExtLabel} · {scene.dayPartLabel}
        </p>
        <p
          className="col-span-2 col-start-2 row-start-2 min-w-0 truncate font-sans text-sm font-medium sm:col-span-1 sm:col-start-auto sm:row-start-auto"
          title={heading || undefined}
        >
          {heading || <span className="opacity-50">Sin localización</span>}
          {markedDays.length > 0 && (
            <span className="ml-2 font-mono text-[10px] font-normal opacity-70">
              en el día {markedDays.join(" y ")} · planos sin repartir
            </span>
          )}
        </p>

        {/* En el móvil, planos y personajes comparten la segunda línea; en
            escritorio son columnas propias (sm:contents). */}
        <div className="col-start-2 row-start-3 flex min-w-0 items-baseline gap-3 sm:contents">
          {/* Planos: abre la lista para mover planos sueltos. */}
          <div onPointerDown={stop} className="shrink-0">
            {totalShots > 0 ? (
              <button
                type="button"
                onClick={() => setShowShots((v) => !v)}
                aria-expanded={showShots}
                aria-label={`Planos de la escena ${scene.number}`}
                className="inline-flex items-center gap-1 rounded font-mono text-[11px] whitespace-nowrap underline decoration-black/25 underline-offset-2 hover:decoration-black/70 focus-visible:outline-2 focus-visible:outline-black/60"
              >
                {shots.length === totalShots
                  ? plural(totalShots, "plano", "planos")
                  : `${shots.length}/${totalShots} pl.`}
                {doneShots > 0 ? ` · ${doneShots}✓` : ""}
                <span aria-hidden>{showShots ? "▴" : "▾"}</span>
              </button>
            ) : (
              <span className="font-mono text-[11px] opacity-50">
                sin planos
              </span>
            )}
          </div>

          <p
            className="min-w-0 truncate font-sans text-xs"
            title={scene.characters.join(", ") || undefined}
          >
            {scene.characters.length > 0 ? (
              <>
                <span className="sr-only">Personajes: </span>
                {scene.characters.join(", ")}
              </>
            ) : (
              <span className="opacity-50">Sin personajes</span>
            )}
          </p>
        </div>

        {/* Alternativa al arrastre: sirve con teclado y en táctil sin pulsación larga. */}
        <div
          onPointerDown={stop}
          className="col-start-3 row-start-1 flex items-center sm:col-start-auto sm:row-start-auto"
        >
          <label className="sr-only" htmlFor={`move-${chunk.key}`}>
            Mover {totalShots > 0 ? "los planos de " : ""}la escena{" "}
            {scene.number} a otro día
          </label>
          <select
            id={`move-${chunk.key}`}
            value={chunk.columnId}
            onChange={(e) => onMove(e.target.value)}
            className={STRIP_SELECT + " w-[7.5rem] sm:w-full"}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.label}
              </option>
            ))}
          </select>
        </div>
        <Link
          href={`/app/${projectId}/guion/${scene.id}`}
          onPointerDown={stop}
          aria-label={`Abrir la escena ${scene.number}`}
          className="col-start-3 row-start-3 justify-self-end rounded px-1 font-mono text-[10px] tracking-widest uppercase opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-black/60 sm:col-start-auto sm:row-start-auto"
        >
          Abrir →
        </Link>
      </div>

      {showShots && totalShots > 0 && (
        <ul
          className="mt-1 mb-2 ml-4 divide-y divide-line border-l-4 pl-4 sm:ml-8"
          style={{ borderColor: tone.bg }}
        >
          {shots.map((shot) => (
            <li
              key={shot.id}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 py-2 sm:grid-cols-[3.5rem_3rem_minmax(0,1fr)_9rem]"
            >
              <span className="font-mono text-xs text-accent">
                {shot.label}
              </span>
              <span className="font-mono text-[11px] uppercase">
                {shot.size ?? "—"}
                {shot.done && (
                  <span className="ml-1.5 text-success normal-case">
                    ✓ rodado
                  </span>
                )}
              </span>
              <span className="col-span-2 min-w-0 truncate font-sans text-sm text-muted sm:col-span-1">
                {shot.description ?? ""}
              </span>
              <span className="col-span-2 sm:col-span-1">
                <label className="sr-only" htmlFor={`shot-move-${shot.id}`}>
                  Día del plano {shot.label}
                </label>
                <select
                  id={`shot-move-${shot.id}`}
                  value={chunk.columnId}
                  onChange={(e) => onMoveShot(shot.id, e.target.value)}
                  className="field w-full px-2 py-1 text-xs"
                >
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
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
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(
    null,
  );
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
        list.push({
          key: `${scene.id}:${scene.dayId ?? UNASSIGNED}`,
          scene,
          columnId: scene.dayId ?? UNASSIGNED,
          shots: [],
        });
        continue;
      }
      const groups = new Map<string, TimelineShot[]>();
      for (const shot of scene.shots) {
        const column = shot.dayId ?? UNASSIGNED;
        groups.set(column, [...(groups.get(column) ?? []), shot]);
      }
      for (const [column, shots] of groups) {
        list.push({
          key: `${scene.id}:${column}`,
          scene,
          columnId: column,
          shots,
        });
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
    return columnId === UNASSIGNED
      ? "Sin día"
      : (days.find((d) => d.id === columnId)?.label ?? "el día");
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
    const shotIds =
      chunk.scene.shots.length > 0 ? chunk.shots.map((s) => s.id) : undefined;

    setScenes((prev) =>
      applyMove(prev, { sceneId: chunk.scene.id, shotIds, dayId: targetDayId }),
    );
    broadcast({ sceneId: chunk.scene.id, shotIds, dayId: targetDayId });

    startTransition(async () => {
      let ok = false;
      try {
        ok = await assignSceneToDay(
          projectId,
          chunk.scene.id,
          targetDayId,
          fromDayId,
        );
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
        setScenes((prev) =>
          applyMove(prev, {
            sceneId: chunk.scene.id,
            shotIds,
            dayId: fromDayId,
          }),
        );
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

    setScenes((prev) =>
      applyMove(prev, {
        sceneId: chunk.scene.id,
        shotIds: [shotId],
        dayId: targetDayId,
      }),
    );
    broadcast({
      sceneId: chunk.scene.id,
      shotIds: [shotId],
      dayId: targetDayId,
    });

    startTransition(async () => {
      let ok = false;
      try {
        ok = await assignShotToDay(projectId, shotId, targetDayId);
      } catch {
        ok = false;
      }
      if (ok) {
        toast(
          "success",
          `Plano ${shot?.label ?? ""} → ${labelOf(targetColumn)}`,
        );
      } else {
        setScenes((prev) =>
          applyMove(prev, {
            sceneId: chunk.scene.id,
            shotIds: [shotId],
            dayId: fromDayId,
          }),
        );
        broadcast({
          sceneId: chunk.scene.id,
          shotIds: [shotId],
          dayId: fromDayId,
        });
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

  function beginDrag(
    key: string,
    target: HTMLElement,
    clientX: number,
    clientY: number,
  ) {
    const rect = target.getBoundingClientRect();
    setDragState({
      chunkKey: key,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    });
    setGhostPos({ x: clientX, y: clientY });
  }

  function columnIdAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    const column = el?.closest<HTMLElement>("[data-column-id]");
    return column?.dataset.columnId ?? null;
  }

  function handlePointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    key: string,
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

  function handlePointerMove(
    e: React.PointerEvent<HTMLDivElement>,
    key: string,
  ) {
    if (dragState?.chunkKey === key) {
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
      beginDrag(key, e.currentTarget, e.clientX, e.clientY);
    }
  }

  function handlePointerUp(
    e: React.PointerEvent<HTMLDivElement>,
    chunk: Chunk,
  ) {
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

  const draggedChunk = dragState
    ? chunks.find((c) => c.key === dragState.chunkKey)
    : null;

  const dayNumberById = useMemo(
    () => new Map(days.map((day, index) => [day.id, index + 1])),
    [days],
  );

  function renderStrip(chunk: Chunk) {
    return (
      <Strip
        key={chunk.key}
        chunk={chunk}
        isPressing={pressingKey === chunk.key}
        isDragging={dragState?.chunkKey === chunk.key}
        onPointerDown={(e) => handlePointerDown(e, chunk.key)}
        onPointerMove={(e) => handlePointerMove(e, chunk.key)}
        onPointerUp={(e) => handlePointerUp(e, chunk)}
        projectId={projectId}
        columns={columns}
        dayNumberById={dayNumberById}
        onMove={(columnId) => commitMove(chunk, columnId)}
        onMoveShot={(shotId, columnId) =>
          commitShotMove(chunk, shotId, columnId)
        }
      />
    );
  }

  // Totales de una jornada: escenas que se ruedan ese día y, si hay shot list, sus planos.
  function totals(list: Chunk[]) {
    const shotCount = list.reduce((n, c) => n + c.shots.length, 0);
    const doneCount = list.reduce(
      (n, c) => n + c.shots.filter((s) => s.done).length,
      0,
    );
    return [
      plural(list.length, "escena", "escenas"),
      shotCount > 0 ? plural(shotCount, "plano", "planos") : null,
      doneCount > 0 ? `${doneCount} rodado${doneCount === 1 ? "" : "s"}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const unassigned = byColumn.get(UNASSIGNED) ?? [];

  // Cada jornada es una zona donde soltar; al arrastrar encima se tiñe de acento.
  const zoneClass = (id: string) =>
    "-mx-2 rounded-lg px-2 pb-2 transition-colors motion-reduce:transition-none " +
    (dragOverId === id ? "bg-accent/10 ring-1 ring-accent/40" : "");

  return (
    <div className="mt-10">
      {/* Leyenda de colores: la convención de producción, a la vista. */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <ul
          aria-label="Colores de las tiras"
          className="flex flex-wrap gap-x-4 gap-y-2"
        >
          {STRIP_LEGEND.map((tone) => (
            <li
              key={tone.key}
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase"
            >
              <span
                aria-hidden
                className="h-3 w-5 rounded-sm"
                style={{ backgroundColor: tone.bg }}
              />
              {tone.label}
            </li>
          ))}
        </ul>
        {otherViewers.length > 0 && (
          <p className="flex items-center gap-2 font-mono text-[11px] text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
            Viendo ahora: {otherViewers.join(", ")}
          </p>
        )}
      </div>

      {/* Por repartir: arriba, como el montón de tiras que aún no tienen sitio. */}
      <section
        data-column-id={UNASSIGNED}
        aria-labelledby="strip-unassigned"
        className={"mt-6 " + zoneClass(UNASSIGNED)}
      >
        <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
          <h2
            id="strip-unassigned"
            className="font-display text-lg font-bold tracking-tight"
          >
            Por repartir
          </h2>
          <p className="font-mono text-[11px] text-muted">
            {unassigned.length > 0 ? totals(unassigned) : ""}
          </p>
        </div>
        {unassigned.length === 0 ? (
          <p className="py-4 font-sans text-sm text-success">
            ✓ Todas las escenas tienen día.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">{unassigned.map(renderStrip)}</ul>
        )}
      </section>

      <div className="mt-8 space-y-6">
        {days.map((day, index) => {
          const list = byColumn.get(day.id) ?? [];
          return (
            <section
              key={day.id}
              data-column-id={day.id}
              aria-label={`Día ${index + 1}, ${day.longLabel}`}
              className={zoneClass(day.id)}
            >
              {/* La tira de día: negra, con la fecha y los totales de la jornada. */}
              <Link
                href={`/app/${projectId}/plan-de-rodaje/${day.id}`}
                style={{ backgroundColor: DAY_STRIP.bg, color: DAY_STRIP.fg }}
                className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md px-3 py-2.5 ring-1 ring-white/10 transition-shadow hover:ring-accent/60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:px-4"
              >
                <span className="font-mono text-[11px] tracking-widest text-accent uppercase">
                  Día {index + 1}
                </span>
                <span className="font-display text-base font-black tracking-tight uppercase sm:text-lg">
                  {day.longLabel}
                </span>
                {day.callTime && (
                  <span className="font-mono text-[11px] opacity-70">
                    Llamada {day.callTime}
                  </span>
                )}
                <span className="ml-auto flex items-baseline gap-3 font-mono text-[11px] opacity-70">
                  {totals(list)}
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  >
                    →
                  </span>
                </span>
              </Link>

              {day.conflicts.length > 0 && (
                <div className="mt-2 space-y-1 border-l-2 border-warn pl-3">
                  {day.conflicts.map((c, i) => (
                    <p
                      key={i}
                      className="font-sans text-xs leading-snug text-warn"
                    >
                      {c.personName}: {c.reason}
                    </p>
                  ))}
                </div>
              )}

              {list.length === 0 ? (
                <p className="px-1 pt-3 font-sans text-sm text-muted">
                  Jornada vacía: suelta aquí una tira o elige este día en su
                  selector.
                </p>
              ) : (
                <ul className="mt-1 space-y-1">{list.map(renderStrip)}</ul>
              )}
            </section>
          );
        })}
      </div>

      {dragState &&
        ghostPos &&
        draggedChunk &&
        (() => {
          const tone = stripTone(
            draggedChunk.scene.intExt,
            draggedChunk.scene.dayPart,
          );
          return (
            <div
              className="pointer-events-none fixed z-50 flex w-80 rotate-1 items-center gap-3 rounded-md px-3 py-2 shadow-2xl ring-2 ring-accent"
              style={{
                left: ghostPos.x - dragState.offsetX,
                top: ghostPos.y - dragState.offsetY,
                backgroundColor: tone.bg,
                color: tone.fg,
              }}
            >
              <span className="font-display text-2xl leading-none font-black">
                {draggedChunk.scene.number}
              </span>
              <span className="min-w-0 truncate font-mono text-[11px] font-semibold uppercase">
                {draggedChunk.scene.intExtLabel} ·{" "}
                {draggedChunk.scene.dayPartLabel}
                {draggedChunk.scene.locationName
                  ? ` · ${draggedChunk.scene.locationName}`
                  : ""}
              </span>
              {draggedChunk.shots.length > 0 && (
                <span className="ml-auto font-mono text-[11px]">
                  {draggedChunk.shots.length} pl.
                </span>
              )}
            </div>
          );
        })()}
    </div>
  );
}
