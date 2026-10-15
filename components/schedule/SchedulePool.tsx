"use client";

import { useMemo, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { PoolShot } from "@/lib/schedule-data";
import { SceneTag, sceneStripColor } from "@/components/SceneTag";
import { RowMenu, ShotCard } from "@/components/schedule/BlockView";
import { SceneChip } from "@/components/ScenePeek";
import type { EditorApi } from "@/components/schedule/ScheduleEditor";

type Filter = "all" | "here" | "retake";

function PoolShotItem({ api, shot, suggested }: { api: EditorApi; shot: PoolShot; suggested: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `shot:${shot.id}` });
  const shotBlocks = api.blocks.filter((b) => b.kind === "SHOTS");
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center rounded-md bg-[#17131f] ${isDragging ? "opacity-30" : ""} ${
        shot.retake ? "ring-1 ring-danger/60" : suggested ? "ring-1 ring-accent/40" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar el plano ${shot.sceneNumber}.${shot.number} a la jornada`}
        className="min-w-0 flex-1 cursor-grab touch-none text-left active:cursor-grabbing"
      >
        <ShotCard
          stacked
          shot={shot}
          note={
            shot.retake ? (
              <span className="mt-1 inline-block rounded bg-danger/15 px-1.5 py-px text-xs text-danger">
                A repetir{shot.retakeNote ? `: ${shot.retakeNote}` : ""}
              </span>
            ) : null
          }
        />
      </button>
      <RowMenu label={`Programar el plano ${shot.sceneNumber}.${shot.number}`}>
        <p className="px-2.5 pt-1 pb-2 text-xs text-muted">Poner el plano {shot.sceneNumber}.{shot.number} en…</p>
        {shotBlocks.map((b, i) => (
          <button key={b.id} type="button" data-close className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-line/60" onClick={() => api.moveShotTo(shot.id, b.id)}>
            {b.title || `Bloque ${String.fromCharCode(65 + i)}`} <span className="text-muted">(esta jornada)</span>
          </button>
        ))}
        <button type="button" data-close className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-line/60" onClick={() => api.moveShotTo(shot.id, "new")}>
          Bloque nuevo en esta jornada
        </button>
        {api.data.days
          .filter((d) => d.id !== api.dayId)
          .map((d) => (
            <button key={d.id} type="button" data-close className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-line/60" onClick={() => api.moveShotTo(shot.id, `day:${d.id}`)}>
              {d.shortLabel}
            </button>
          ))}
      </RowMenu>
    </div>
  );
}

function PoolSceneItem({ api, sceneId }: { api: EditorApi; sceneId: string }) {
  const scene = api.data.scenes[sceneId];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `scene:${sceneId}` });
  if (!scene) return null;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-l-4 border-line bg-bg px-2 py-2 ${isDragging ? "opacity-30" : ""}`}
      style={{ borderLeftColor: sceneStripColor(scene.intExt, scene.dayPart) }}
    >
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar la escena ${scene.number} entera`}
        className="min-w-0 flex-1 cursor-grab touch-none text-left active:cursor-grabbing"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono font-semibold">{scene.number}</span>
          <SceneTag intExt={scene.intExt} dayPart={scene.dayPart} />
          <span className="truncate text-[13px] font-semibold">{scene.location}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">Escena entera (sin lista de planos)</span>
      </button>
      <button type="button" onClick={() => api.scheduleScene(sceneId)} className="btn btn-outline btn-sm shrink-0" aria-label={`Añadir la escena ${scene.number} a esta jornada`}>
        + Día
      </button>
    </div>
  );
}

// "Por programar": todos los planos sin jornada (agrupados por escena), los
// que hay que repetir en rojo y las escenas sin lista de planos. Se arrastran
// a la jornada o se programan con su menú.
export function SchedulePool({
  api,
  pool,
  poolScenes,
  dayLocations,
  isDragging,
}: {
  api: EditorApi;
  pool: PoolShot[];
  poolScenes: string[];
  dayLocations: string[];
  isDragging: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: "pool:" });
  const here = new Set(dayLocations);
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const list = pool.filter((s) => {
      const scene = api.data.scenes[s.sceneId];
      if (filter === "retake" && !s.retake) return false;
      if (filter === "here" && !(scene?.location && here.has(scene.location))) return false;
      if (!q) return true;
      return [`${s.sceneNumber}.${s.number}`, s.description, scene?.location, ...s.characterIds.map((c) => api.data.characters[c]?.name)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    const order = Object.keys(api.data.scenes);
    const bySceneId = new Map<string, PoolShot[]>();
    for (const s of list) bySceneId.set(s.sceneId, [...(bySceneId.get(s.sceneId) ?? []), s]);
    return [...bySceneId.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, filter, q, api.data, dayLocations]);

  const retakes = pool.filter((s) => s.retake).length;
  const total = pool.length + poolScenes.length;
  const scenesShown = filter === "retake" ? [] : poolScenes.filter((id) => !q || api.data.scenes[id]?.location?.toLowerCase().includes(q) || api.data.scenes[id]?.number.includes(q));

  return (
    <aside
      ref={setNodeRef}
      aria-label="Por programar"
      className={`rounded-xl border transition-colors xl:sticky xl:top-36 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto ${
        isOver ? "border-accent bg-accent/5" : isDragging ? "border-dashed border-accent/50" : "border-line bg-bg-raised/30"
      }`}
    >
      <div className="border-b border-line px-3 py-3">
        <h2 className="flex items-baseline gap-2 text-sm font-bold">
          Por programar <span className={`font-normal ${total > 0 ? "text-warn" : "text-success"}`}>{total}</span>
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          {total > 0 ? "Arrástralos a la jornada o usa su menú ⋯" : "Todo tiene jornada de rodaje."}
          {isDragging && " · Suelta aquí para quitar de la jornada"}
        </p>
        {total > 0 && (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar plano, sitio o personaje…"
              aria-label="Buscar en por programar"
              className="mt-2.5 w-full rounded-md border border-line bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
            />
            <div role="group" aria-label="Filtrar" className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Todo"],
                  ["here", "Mismo sitio que esta jornada"],
                  ["retake", `A repetir${retakes ? ` (${retakes})` : ""}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    filter === key ? "border-accent bg-accent/10 text-accent" : "border-line text-fg/80 hover:border-accent/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="space-y-3 p-2.5">
        {groups.map(([sceneId, shots]) => {
          const scene = api.data.scenes[sceneId];
          const suggested = Boolean(scene?.location && here.has(scene.location));
          return (
            <div key={sceneId} className="border-l-4 pl-2" style={{ borderLeftColor: scene ? sceneStripColor(scene.intExt, scene.dayPart) : undefined }}>
              {scene && (
                <div className="flex flex-wrap items-center gap-1.5 px-0.5 pb-1">
                  <SceneChip sceneId={sceneId} number={scene.number}>
                    <span className="font-mono text-sm font-semibold underline decoration-line decoration-dotted underline-offset-4">{scene.number}</span>
                  </SceneChip>
                  <SceneTag intExt={scene.intExt} dayPart={scene.dayPart} />
                  <span className="truncate text-[13px] font-semibold">{scene.location}</span>
                  {suggested && <span className="text-xs text-accent">★ mismo sitio</span>}
                </div>
              )}
              <div className="space-y-1">
                {shots.map((shot) => (
                  <PoolShotItem key={shot.id} api={api} shot={shot} suggested={suggested} />
                ))}
              </div>
            </div>
          );
        })}
        {scenesShown.map((id) => (
          <PoolSceneItem key={id} api={api} sceneId={id} />
        ))}
        {total > 0 && groups.length === 0 && scenesShown.length === 0 && <p className="px-1 py-2 text-[13px] text-muted">Nada con este filtro.</p>}
      </div>
    </aside>
  );
}
