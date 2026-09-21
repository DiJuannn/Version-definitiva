"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type NodeChange,
} from "@xyflow/react";
import { findFreeSpot } from "@/components/canvas/free-spot";
import { BoardProvider, CardNodeView, type CardNode } from "@/components/moodboard/nodes";
import { MapProvider, ToolNodeView, type ToolNode } from "@/components/project-map/toolNode";
import { completeMapTask, saveProjectMap, setMapProjectStatus } from "@/lib/actions/project-map";
import {
  MAP_MAX_NOTES,
  MAP_TOOL_KEYS,
  NOTE_COLORS,
  defaultToolRect,
  type MapLayout,
  type MapRect,
  type MapToolCard,
  type MapToolKey,
} from "@/lib/project-map-types";

type AnyNode = ToolNode | CardNode;

const nodeTypes = { tool: ToolNodeView, card: CardNodeView };
const EMPTY_LOOKUP = { scenes: [], characters: [], locations: [] };

type Props = {
  projectId: string;
  tools: MapToolCard[];
  layout: MapLayout;
  updatedAt: string | null;
};

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

const toolNode = (key: MapToolKey, r: MapRect): ToolNode => ({
  id: `tool-${key}`,
  type: "tool",
  position: { x: r.x, y: r.y },
  width: r.w,
  height: r.h,
  data: { key },
});

const noteNode = (n: MapLayout["notes"][number]): CardNode => ({
  id: n.id,
  type: "card",
  position: { x: n.x, y: n.y },
  width: n.w,
  height: n.h,
  data: { card: { id: n.id, type: "note", x: n.x, y: n.y, w: n.w, h: n.h, text: n.text, color: n.color } },
});

const sizeOf = (n: AnyNode) => ({
  w: Math.round(n.width ?? n.measured?.width ?? 240),
  h: Math.round(n.height ?? n.measured?.height ?? 140),
});

function MapBoard(props: Props) {
  const { projectId, layout } = props;
  const router = useRouter();
  const { screenToFlowPosition, fitView } = useReactFlow<AnyNode>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const toolsByKey = useMemo(() => Object.fromEntries(props.tools.map((t) => [t.key, t])), [props.tools]);

  const [nodes, setNodes] = useState<AnyNode[]>(() => [
    ...MAP_TOOL_KEYS.filter((k) => !layout.hidden.includes(k)).map((k) => toolNode(k, layout.tools[k] ?? defaultToolRect(k))),
    ...layout.notes.map(noteNode),
  ]);
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const [hidden, setHidden] = useState<MapToolKey[]>(layout.hidden);
  const hiddenNow = useRef(hidden);
  useEffect(() => {
    hiddenNow.current = hidden;
  }, [hidden]);
  const hiddenRects = useRef<Partial<Record<MapToolKey, MapRect>>>(
    Object.fromEntries(layout.hidden.map((k) => [k, layout.tools[k] ?? defaultToolRect(k)])),
  );

  const updatedAtRef = useRef<string | null>(props.updatedAt);
  const versionRef = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error" | "conflict">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | "hidden">(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const markDirty = useCallback(() => {
    versionRef.current += 1;
    setDirty(true);
    setSaveState((s) => (s === "error" ? "idle" : s));
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange<AnyNode>[]) => {
      setNodes((ns) => applyNodeChanges(changes, ns));
      const meaningful = changes.some(
        (c) =>
          c.type === "position" ||
          c.type === "remove" ||
          c.type === "add" ||
          (c.type === "dimensions" && (c.resizing !== undefined || c.setAttributes)),
      );
      if (meaningful) markDirty();
    },
    [markDirty],
  );

  // ---- Notas (reutilizan las tarjetas de nota del Moodboard)
  const updateNote = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === id && n.type === "card" ? { ...n, data: { card: { ...n.data.card, ...patch } } } : n)),
      );
      markDirty();
    },
    [markDirty],
  );
  const removeNote = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      markDirty();
    },
    [markDirty],
  );

  const addNote = useCallback(() => {
    const notes = nodesRef.current.filter((n) => n.type === "card").length;
    if (notes >= MAP_MAX_NOTES) {
      setNotice(`Ya hay ${MAP_MAX_NOTES} notas en el mapa.`);
      return;
    }
    const b = wrapperRef.current?.getBoundingClientRect();
    const c = screenToFlowPosition({ x: (b?.left ?? 0) + (b?.width ?? 600) / 2, y: (b?.top ?? 0) + (b?.height ?? 400) / 2 });
    const spot = findFreeSpot(
      nodesRef.current.map((n) => ({ x: n.position.x, y: n.position.y, ...sizeOf(n) })),
      c.x,
      c.y,
      220,
      150,
    );
    const id = newId();
    const node = noteNode({ id, color: NOTE_COLORS[notes % NOTE_COLORS.length], x: Math.round(spot.x), y: Math.round(spot.y), w: 220, h: 150 });
    setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), { ...node, selected: true }]);
    markDirty();
    setNotice(null);
  }, [markDirty, screenToFlowPosition]);

  // ---- Ocultar / mostrar / reordenar tarjetas de herramienta
  const hide = useCallback(
    (key: MapToolKey) => {
      const node = nodesRef.current.find((n) => n.id === `tool-${key}`);
      if (node) hiddenRects.current[key] = { x: Math.round(node.position.x), y: Math.round(node.position.y), ...sizeOf(node) };
      setNodes((ns) => ns.filter((n) => n.id !== `tool-${key}`));
      setHidden((h) => (h.includes(key) ? h : [...h, key]));
      markDirty();
    },
    [markDirty],
  );

  const show = useCallback(
    (key: MapToolKey) => {
      const r = hiddenRects.current[key] ?? defaultToolRect(key);
      setNodes((ns) => [...ns, toolNode(key, r)]);
      setHidden((h) => h.filter((k) => k !== key));
      markDirty();
      setMenu(null);
    },
    [markDirty],
  );

  const resetLayout = useCallback(() => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.type !== "tool") return n;
        const r = defaultToolRect(n.data.key);
        return { ...n, position: { x: r.x, y: r.y }, width: r.w, height: r.h };
      }),
    );
    for (const k of hidden) hiddenRects.current[k] = defaultToolRect(k);
    setConfirmReset(false);
    markDirty();
    setTimeout(() => void fitView({ padding: 0.15, duration: 400 }), 80);
  }, [fitView, hidden, markDirty]);

  // ---- Acciones rápidas (cambian datos reales y refrescan las tarjetas)
  const refresh = useCallback(() => {
    setBusy(true);
    router.refresh();
    setTimeout(() => setBusy(false), 700);
  }, [router]);

  const completeTask = useCallback(
    async (taskId: string) => {
      setBusy(true);
      const r = await completeMapTask(projectId, taskId);
      if (!r.ok) setNotice("No se pudo completar la tarea.");
      router.refresh();
      setTimeout(() => setBusy(false), 700);
    },
    [projectId, router],
  );

  const changeStatus = useCallback(
    async (status: string) => {
      setBusy(true);
      const r = await setMapProjectStatus(projectId, status);
      if (!r.ok) setNotice("No se pudo cambiar el estado.");
      router.refresh();
      setTimeout(() => setBusy(false), 700);
    },
    [projectId, router],
  );

  // ---- Guardado automático de la disposición
  const save = useCallback(async () => {
    const version = versionRef.current;
    const tools: MapLayout["tools"] = { ...hiddenRects.current };
    const notes: MapLayout["notes"] = [];
    for (const n of nodesRef.current) {
      const s = sizeOf(n);
      const pos = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      if (n.type === "tool") tools[n.data.key] = { ...pos, ...s };
      else notes.push({ id: n.id, text: n.data.card.text, color: n.data.card.color ?? NOTE_COLORS[0], ...pos, ...s });
    }
    const payload: MapLayout = { v: 1, tools, hidden: [...new Set(hiddenNow.current)], notes };
    setSaveState("saving");
    try {
      const result = await saveProjectMap(projectId, payload, updatedAtRef.current);
      if (result.ok) {
        updatedAtRef.current = result.updatedAt;
        setSaveError(null);
        setSaveState("idle");
        if (versionRef.current === version) setDirty(false);
      } else {
        setSaveError(result.error);
        setSaveState(result.conflict ? "conflict" : "error");
      }
    } catch {
      setSaveError("No se pudo guardar. Comprueba tu conexión.");
      setSaveState("error");
    }
  }, [projectId]);

  useEffect(() => {
    // Nunca dos guardados a la vez: el segundo llevaría una versión vieja y daría un falso conflicto.
    if (!dirty || saveState === "conflict" || saveState === "saving" || saveState === "error") return;
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
  }, [dirty, nodes, hidden, saveState, save]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirty && saveState !== "conflict" && saveState !== "saving") void save();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty && saveState !== "conflict") e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty, saveState, save]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const mapCtx = useMemo(
    () => ({ projectId, tools: toolsByKey, hide, completeTask, changeStatus, busy }),
    [projectId, toolsByKey, hide, completeTask, changeStatus, busy],
  );
  const boardCtx = useMemo(
    () => ({ projectId, lookup: EMPTY_LOOKUP, update: updateNote, remove: removeNote }),
    [projectId, updateNote, removeNote],
  );

  const status =
    saveState === "conflict"
      ? { text: "Cambios de otra persona", tone: "text-danger" }
      : saveState === "error"
        ? { text: "Error al guardar", tone: "text-danger" }
        : saveState === "saving"
          ? { text: "Guardando…", tone: "text-muted" }
          : dirty
            ? { text: "Cambios sin guardar", tone: "text-muted" }
            : { text: "✓ Guardado", tone: "text-success" };

  const btn =
    "border border-line bg-bg-raised px-2.5 py-1.5 font-mono text-[11px] tracking-wider uppercase transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

  return (
    <MapProvider value={mapCtx}>
      <BoardProvider value={boardCtx}>
        <div ref={wrapperRef} className="relative h-[calc(100dvh-16rem)] min-h-[520px] border border-line">
          <ReactFlow<AnyNode>
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            colorMode="dark"
            minZoom={0.15}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            nodesConnectable={false}
            elementsSelectable
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={24} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="hidden! sm:block!" maskColor="rgba(0,0,0,0.6)" />

            <Panel position="top-left" className="m-2! max-w-[calc(100%-1rem)]">
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className={btn} onClick={addNote}>
                  + Nota
                </button>
                <div className="relative">
                  <button
                    type="button"
                    className={btn}
                    disabled={hidden.length === 0}
                    onClick={() => setMenu(menu === "hidden" ? null : "hidden")}
                    aria-expanded={menu === "hidden"}
                  >
                    Ocultas ({hidden.length})
                  </button>
                  {menu === "hidden" && (
                    <div className="absolute top-full left-0 z-20 mt-1 w-64 border border-line bg-bg-raised shadow-xl">
                      {hidden.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => show(k)}
                          className="flex w-full items-center justify-between border-b border-line px-3 py-2 text-left hover:bg-white/5"
                        >
                          <span className="font-display text-sm font-bold">{toolsByKey[k]?.title ?? k}</span>
                          <span className="font-mono text-[10px] tracking-wider text-accent uppercase">Mostrar</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {confirmReset ? (
                  <span className="flex items-center gap-1.5 border border-warn/60 bg-bg-raised px-2.5 py-1.5 font-mono text-[11px] uppercase">
                    ¿Recolocar todo?
                    <button type="button" onClick={resetLayout} className="text-accent underline">
                      Sí
                    </button>
                    <button type="button" onClick={() => setConfirmReset(false)} className="text-muted underline">
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" className={btn} onClick={() => setConfirmReset(true)}>
                    Reordenar
                  </button>
                )}
                <button type="button" className={btn} onClick={refresh} disabled={busy} title="Vuelve a calcular las tarjetas con los datos actuales">
                  {busy ? "Actualizando…" : "↻ Actualizar"}
                </button>
              </div>
              {menu && <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(null)} />}
            </Panel>

            <Panel position="top-right" className="m-2!">
              <div className="flex items-center gap-3 border border-line bg-bg-raised px-3 py-1.5 font-mono text-[11px]">
                <span className={status.tone} role="status">
                  {status.text}
                </span>
                {saveState === "error" && (
                  <button type="button" onClick={() => void save()} className="text-accent underline">
                    Reintentar
                  </button>
                )}
              </div>
            </Panel>
          </ReactFlow>

          {(notice || saveError) && (
            <div className="absolute bottom-3 left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 border border-warn/60 bg-bg-raised px-4 py-2 font-sans text-xs shadow-xl" role="alert">
              <span>{notice ?? saveError}</span>
              {saveState === "conflict" ? (
                <button type="button" onClick={() => window.location.reload()} className="font-mono text-[11px] tracking-wider text-accent uppercase underline">
                  Recargar
                </button>
              ) : (
                <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)} className="text-muted hover:text-fg">
                  ×
                </button>
              )}
            </div>
          )}
        </div>
      </BoardProvider>
    </MapProvider>
  );
}

export default function ProjectMapEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <MapBoard {...props} />
    </ReactFlowProvider>
  );
}
