"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { findFreeSpot } from "@/components/canvas/free-spot";
import { RemoteCursors, type RemoteCursor } from "@/components/project-map/RemoteCursors";
import { createClient } from "@/lib/supabase/client";
import { applyOps, canonical, diffLayouts, isEmptyOps, rebase, subtractOps, type MapOps } from "@/lib/project-map-merge";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { buildFromLayout, itemNode, sizeOf, toRfEdge, toolNode, type AnyNode } from "@/components/project-map/board-utils";
import { loadImageSize, prepareImage } from "@/components/canvas/image-utils";
import { ItemNodeView, ItemProvider, type ItemNode } from "@/components/project-map/itemNodes";
import { MapProvider } from "@/components/project-map/mapContext";
import { ToolNodeView } from "@/components/project-map/toolNode";
import { completeMapTask, fetchMapBoard, mapBoardVersion, saveProjectMap, setMapProjectStatus, uploadMapImage } from "@/lib/actions/project-map";
import { MAP_MAX_EDGES } from "@/lib/project-map-types";
import {
  MAP_COLORS,
  MAP_ENTITY_KINDS,
  MAP_ENTITY_LABELS,
  MAP_ITEM_SIZE,
  NOTE_COLORS,
  defaultToolRect,
  type MapEdge,
  type MapEntities,
  type MapEntityKind,
  type MapEntityView,
  type MapItem,
  type MapItemType,
  type MapLayout,
  type MapRect,
  type MapShape,
  type MapTextSize,
  type MapToolCard,
  type MapToolKey,
} from "@/lib/project-map-types";
import type { MapProjectImage } from "@/lib/project-map";

const nodeTypes = { tool: ToolNodeView, item: ItemNodeView };

type Props = {
  projectId: string;
  boardId: string;
  boardName: string;
  // Quién soy (para que los demás me vean: nombre y color del cursor).
  userId: string;
  userName: string;
  entities: MapEntities;
  tools: MapToolCard[];
  layout: MapLayout;
  updatedAt: string | null;
  isPro: boolean;
  freeLimit: number;
  maxItems: number;
  images: MapProjectImage[];
};

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

// Estado → disposición que se guarda (y que se usa como "foto" para deshacer).
function serialize(
  nodes: AnyNode[],
  edges: MapEdge[],
  hidden: MapToolKey[],
  hiddenRects: Partial<Record<MapToolKey, MapRect>>,
): MapLayout {
  const tools: MapLayout["tools"] = { ...hiddenRects };
  const items: MapItem[] = [];
  for (const n of nodes) {
    const rect = { x: Math.round(n.position.x), y: Math.round(n.position.y), ...sizeOf(n) };
    if (n.type === "tool") tools[n.data.key] = rect;
    else items.push({ ...n.data.item, ...rect });
  }
  return { v: 2, tools, hidden: [...new Set(hidden)], items, edges };
}

const isEditable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

const HISTORY_MAX = 60;

// Color estable por persona para su cursor y su avatar.
function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h}, 75%, 62%)`;
}
// Lo que llega de otros navegadores no es de fiar: se limpia antes de pintarlo.
const cleanName = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 30) : "Alguien");
const cleanColor = (v: unknown) => (typeof v === "string" && /^hsl\(\d{1,3}, 75%, 62%\)$/.test(v) ? v : "hsl(0, 0%, 70%)");
const uniquePeers = <T extends { userId: string }>(list: T[]) => [...new Map(list.map((p) => [p.userId, p])).values()];

function MapBoard(props: Props) {
  const { projectId, boardId, boardName, userId, userName, entities, layout, isPro, freeLimit, maxItems, images } = props;
  const router = useRouter();
  const { screenToFlowPosition, fitView } = useReactFlow<AnyNode>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toolsByKey = useMemo(() => Object.fromEntries(props.tools.map((t) => [t.key, t])), [props.tools]);

  const initial = useMemo(() => buildFromLayout(layout), [layout]);
  const [nodes, setNodes] = useState<AnyNode[]>(initial.nodes);
  const [edges, setEdges] = useState<MapEdge[]>(layout.edges);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [hidden, setHidden] = useState<MapToolKey[]>(layout.hidden);
  const hiddenRects = useRef(initial.hiddenRects);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const hiddenRef = useRef(hidden);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    hiddenRef.current = hidden;
  }, [nodes, edges, hidden]);

  // Lo último que se sabe del servidor (base para calcular qué he cambiado yo) y su versión.
  const lastSaved = useRef<MapLayout>(layout);
  const knownVersion = useRef<string | null>(props.updatedAt);
  const savingRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | "image" | "shape" | "project" | "more">(null);
  const [projectTab, setProjectTab] = useState<MapEntityKind>("scene");
  const [projectQuery, setProjectQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const itemsCount = nodes.filter((n) => n.type === "item").length;
  const atFreeLimit = !isPro && itemsCount >= freeLimit;

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveState((s) => (s === "error" ? "idle" : s));
  }, []);

  // ---------------------------------------------------------------- Deshacer / rehacer
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const lastStable = useRef("");
  const restoring = useRef(false);
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const snapshot = useCallback(
    () => JSON.stringify(serialize(nodesRef.current, edgesRef.current, hiddenRef.current, hiddenRects.current)),
    [],
  );

  // "Foto" del estado tras una pausa de edición: cada foto es un paso de deshacer.
  useEffect(() => {
    const t = setTimeout(() => {
      const snap = snapshot();
      if (lastStable.current === "" || restoring.current) {
        lastStable.current = snap;
        restoring.current = false;
        return;
      }
      if (snap === lastStable.current) return;
      past.current.push(lastStable.current);
      if (past.current.length > HISTORY_MAX) past.current.shift();
      lastStable.current = snap;
      future.current = [];
      setHist({ undo: past.current.length, redo: 0 });
    }, 500);
    return () => clearTimeout(t);
  }, [nodes, edges, hidden, snapshot]);

  const applySnapshot = useCallback(
    (snap: string) => {
      const l = JSON.parse(snap) as MapLayout;
      const built = buildFromLayout(l);
      hiddenRects.current = built.hiddenRects;
      restoring.current = true;
      setNodes(built.nodes);
      setEdges(l.edges);
      setHidden(l.hidden);
      setSelectedEdges([]);
      markDirty();
    },
    [markDirty],
  );

  const undo = useCallback(() => {
    const cur = snapshot();
    if (cur !== lastStable.current && lastStable.current !== "") {
      past.current.push(lastStable.current);
      lastStable.current = cur;
    }
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(lastStable.current);
    lastStable.current = prev;
    applySnapshot(prev);
    setHist({ undo: past.current.length, redo: future.current.length });
  }, [applySnapshot, snapshot]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(lastStable.current);
    lastStable.current = next;
    applySnapshot(next);
    setHist({ undo: past.current.length, redo: future.current.length });
  }, [applySnapshot]);

  // ---------------------------------------------------------------- Trabajo en equipo
  const currentLayout = useCallback(
    () => serialize(nodesRef.current, edgesRef.current, hiddenRef.current, hiddenRects.current),
    [],
  );

  // Pone en pantalla una pizarra ya fusionada sin tocar lo que no ha cambiado (selección, foco al escribir…).
  const applyLayoutToState = useCallback((next: MapLayout) => {
    const built = buildFromLayout(next);
    hiddenRects.current = built.hiddenRects;
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]));
      return built.nodes.map((n) => {
        const p = old.get(n.id);
        if (!p) return n;
        const ps = sizeOf(p);
        const unchanged =
          JSON.stringify(p.data) === JSON.stringify(n.data) &&
          Math.round(p.position.x) === Math.round(n.position.x) &&
          Math.round(p.position.y) === Math.round(n.position.y) &&
          ps.w === Math.round(n.width ?? 0) &&
          ps.h === Math.round(n.height ?? 0);
        return unchanged ? p : ({ ...p, position: n.position, width: n.width, height: n.height, data: n.data } as AnyNode);
      });
    });
    setEdges(next.edges);
    setHidden(next.hidden);
  }, []);

  // Recibe la pizarra del servidor (tras guardar o al enterarse de que alguien cambió algo): se juntan
  // sus cambios con los míos sin guardar, y lo de los demás se aplica también al historial de deshacer
  // para que deshacer lo mío no borre lo suyo.
  const applyRemote = useCallback(
    (remote: MapLayout, version: string, sent?: MapOps) => {
      const base = sent ? applyOps(lastSaved.current, sent) : lastSaved.current;
      const local = currentLayout();
      const merged = rebase(local, base, remote);
      // Solo lo de los demás: lo que yo mismo acabo de mandar no se toca en el historial.
      const theirs = subtractOps(diffLayouts(base, remote), sent ?? {});
      lastSaved.current = remote;
      knownVersion.current = version;
      if (!isEmptyOps(theirs)) {
        const patch = (snap: string) => {
          try {
            return JSON.stringify(applyOps(JSON.parse(snap) as MapLayout, theirs));
          } catch {
            return snap;
          }
        };
        past.current = past.current.map(patch);
        future.current = future.current.map(patch);
        if (lastStable.current) lastStable.current = patch(lastStable.current);
      }
      if (canonical(merged) !== canonical(local)) applyLayoutToState(merged);
      setDirty(!isEmptyOps(diffLayouts(remote, merged)));
    },
    [applyLayoutToState, currentLayout],
  );

  const pulling = useRef(false);
  // Si llega un aviso mientras yo guardo o mientras ya estoy pidiendo la pizarra, no se pierde: se repite al terminar.
  const pullAgain = useRef(false);
  const pullRemote = useCallback(async () => {
    if (pulling.current || savingRef.current) {
      pullAgain.current = true;
      return;
    }
    pulling.current = true;
    try {
      do {
        pullAgain.current = false;
        const r = await fetchMapBoard(projectId, boardId);
        if (r.ok && r.updatedAt !== knownVersion.current) applyRemote(r.layout, r.updatedAt);
      } while (pullAgain.current && !savingRef.current);
    } catch {
      // Sin conexión: se reintenta en el siguiente aviso o sondeo.
    } finally {
      pulling.current = false;
    }
  }, [applyRemote, boardId, projectId]);

  // ---------------------------------------------------------------- Cambios del lienzo
  const onNodesChange = useCallback(
    (changes: NodeChange<AnyNode>[]) => {
      setNodes((ns) => applyNodeChanges(changes, ns));
      const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
      if (removed.length) setEdges((es) => es.filter((e) => !removed.includes(e.source) && !removed.includes(e.target)));
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

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      let removedAny = false;
      for (const c of changes) {
        if (c.type === "select") {
          setSelectedEdges((s) => (c.selected ? [...new Set([...s, c.id])] : s.filter((id) => id !== c.id)));
        } else if (c.type === "remove") {
          setEdges((es) => es.filter((e) => e.id !== c.id));
          setSelectedEdges((s) => s.filter((id) => id !== c.id));
          removedAny = true;
        }
      }
      if (removedAny) markDirty();
    },
    [markDirty],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      if (edgesRef.current.length >= MAP_MAX_EDGES) {
        setNotice(`Ya hay ${MAP_MAX_EDGES} flechas en el mapa.`);
        return;
      }
      const id = newId();
      setEdges((es) => [...es, { id, source: c.source!, target: c.target!, sh: c.sourceHandle ?? undefined, th: c.targetHandle ?? undefined }]);
      setSelectedEdges([id]);
      markDirty();
    },
    [markDirty],
  );

  const updateEdge = useCallback(
    (id: string, patch: Partial<MapEdge>) => {
      setEdges((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      markDirty();
    },
    [markDirty],
  );

  const removeEdges = useCallback(
    (ids: string[]) => {
      setEdges((es) => es.filter((e) => !ids.includes(e.id)));
      setSelectedEdges([]);
      markDirty();
    },
    [markDirty],
  );

  // ---------------------------------------------------------------- Elementos propios
  const updateItem = useCallback(
    (id: string, patch: Partial<MapItem>) => {
      setNodes((ns) => ns.map((n) => (n.id === id && n.type === "item" ? { ...n, data: { item: { ...n.data.item, ...patch } } } : n)));
      markDirty();
    },
    [markDirty],
  );

  const removeItem = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      markDirty();
    },
    [markDirty],
  );

  const canAdd = useCallback(
    (count = 1) => {
      const current = nodesRef.current.filter((n) => n.type === "item").length;
      if (current + count > maxItems) {
        setNotice(`La pizarra ya tiene el máximo de ${maxItems} elementos.`);
        return false;
      }
      if (!isPro && current + count > freeLimit) {
        setNotice(`El plan gratuito permite hasta ${freeLimit} elementos propios en el mapa.`);
        return false;
      }
      setNotice(null);
      return true;
    },
    [isPro, freeLimit, maxItems],
  );

  const centre = useCallback(() => {
    const b = wrapperRef.current?.getBoundingClientRect();
    return screenToFlowPosition({ x: (b?.left ?? 0) + (b?.width ?? 600) / 2, y: (b?.top ?? 0) + (b?.height ?? 400) / 2 });
  }, [screenToFlowPosition]);

  const addItem = useCallback(
    (type: MapItemType, extra: Partial<MapItem> = {}, at?: { x: number; y: number }) => {
      if (!canAdd()) return;
      const base = MAP_ITEM_SIZE[type];
      const w = extra.w ?? base.w;
      const h = extra.h ?? base.h;
      const spot = at
        ? { x: at.x - w / 2, y: at.y - h / 2 }
        : (() => {
            const c = centre();
            return findFreeSpot(
              nodesRef.current.filter((n) => !(n.type === "item" && n.data.item.type === "section")).map((n) => ({ x: n.position.x, y: n.position.y, ...sizeOf(n) })),
              c.x,
              c.y,
              w,
              h,
            );
          })();
      const notes = nodesRef.current.filter((n) => n.type === "item" && n.data.item.type === "note").length;
      const item: MapItem = {
        color: type === "note" ? NOTE_COLORS[notes % NOTE_COLORS.length] : type === "shape" ? MAP_COLORS[0] : type === "text" ? MAP_COLORS[6] : type === "section" ? MAP_COLORS[5] : undefined,
        size: type === "text" ? "m" : undefined,
        shape: type === "shape" ? "rect" : undefined,
        ...extra,
        id: newId(),
        type,
        x: Math.round(spot.x),
        y: Math.round(spot.y),
        w,
        h,
      };
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), { ...itemNode(item), selected: true }]);
      setSelectedEdges([]);
      markDirty();
      setMenu(null);
    },
    [canAdd, centre, markDirty],
  );

  // Cosas del proyecto (escenas, tareas, planos…) como tarjetas.
  const addEntity = useCallback(
    (kind: MapEntityKind, view: MapEntityView) => addItem("entity", { kind, refId: view.id, label: view.title }),
    [addItem],
  );

  // Varias a la vez, en una rejilla a la derecha de todo lo que ya hay.
  const addEntities = useCallback(
    (kind: MapEntityKind, views: MapEntityView[]) => {
      const chosen = views.slice(0, 30);
      if (chosen.length === 0 || !canAdd(chosen.length)) return;
      const existing = nodesRef.current;
      const cols = 3;
      const startX = existing.length ? Math.max(...existing.map((n) => n.position.x + sizeOf(n).w)) + 80 : centre().x - 400;
      const startY = existing.length ? Math.min(...existing.map((n) => n.position.y)) : centre().y - 200;
      const size = MAP_ITEM_SIZE.entity;
      const created = chosen.map((v, i) =>
        itemNode({
          id: newId(),
          type: "entity",
          kind,
          refId: v.id,
          label: v.title,
          x: Math.round(startX + (i % cols) * (size.w + 30)),
          y: Math.round(startY + Math.floor(i / cols) * (size.h + 30)),
          w: size.w,
          h: size.h,
        }),
      );
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), ...created]);
      markDirty();
      setMenu(null);
      setTimeout(() => void fitView({ nodes: created.map((n) => ({ id: n.id })), padding: 0.25, duration: 500 }), 80);
    },
    [canAdd, centre, fitView, markDirty],
  );

  // Copiar, pegar y duplicar (no incluye las tarjetas de herramienta: solo hay una de cada).
  const clip = useRef<{ items: MapItem[]; edges: MapEdge[] } | null>(null);

  const spawn = useCallback(
    (items: MapItem[], srcEdges: MapEdge[], offset: number) => {
      if (items.length === 0 || !canAdd(items.length)) return;
      const idMap = new Map(items.map((it) => [it.id, newId()]));
      const created = items.map((it) =>
        ({ ...itemNode({ ...it, id: idMap.get(it.id)!, x: it.x + offset, y: it.y + offset }), selected: true }) as ItemNode,
      );
      const created2 = srcEdges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({ ...e, id: newId(), source: idMap.get(e.source)!, target: idMap.get(e.target)! }));
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), ...created]);
      setEdges((es) => [...es, ...created2].slice(0, MAP_MAX_EDGES));
      markDirty();
    },
    [canAdd, markDirty],
  );

  const selectedItems = useCallback(
    () =>
      nodesRef.current
        .filter((n): n is ItemNode => n.type === "item" && !!n.selected)
        .map((n) => ({ ...n.data.item, x: Math.round(n.position.x), y: Math.round(n.position.y), ...sizeOf(n) })),
    [],
  );

  const copySelected = useCallback(() => {
    const items = selectedItems();
    if (items.length === 0) return;
    const ids = new Set(items.map((i) => i.id));
    clip.current = { items, edges: edgesRef.current.filter((e) => ids.has(e.source) && ids.has(e.target)) };
  }, [selectedItems]);

  const duplicateSelected = useCallback(() => {
    const items = selectedItems();
    const ids = new Set(items.map((i) => i.id));
    spawn(items, edgesRef.current.filter((e) => ids.has(e.source) && ids.has(e.target)), 30);
  }, [selectedItems, spawn]);

  // Aplica un cambio a todos los elementos seleccionados de ciertos tipos.
  const patchSelected = useCallback(
    (types: MapItemType[], patch: Partial<MapItem>) => {
      setNodes((ns) =>
        ns.map((n) => (n.type === "item" && n.selected && types.includes(n.data.item.type) ? { ...n, data: { item: { ...n.data.item, ...patch } } } : n)),
      );
      markDirty();
    },
    [markDirty],
  );

  const removeSelected = useCallback(() => {
    const ids = new Set(nodesRef.current.filter((n) => n.type === "item" && n.selected).map((n) => n.id));
    if (ids.size === 0) return;
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
    setEdges((es) => es.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    markDirty();
  }, [markDirty]);

  // ---------------------------------------------------------------- Imágenes
  const addImageBySize = useCallback(
    (url: string, size: { width: number; height: number }, at?: { x: number; y: number }) => {
      const w = 280;
      addItem("image", { url, w, h: Math.min(560, Math.round((w * size.height) / size.width) + 30) }, at);
    },
    [addItem],
  );

  const addImageFile = useCallback(
    async (file: File, at?: { x: number; y: number }) => {
      if (!file.type.startsWith("image/")) {
        setNotice("Solo se pueden añadir imágenes.");
        return;
      }
      if (!canAdd()) return;
      setUploading((n) => n + 1);
      try {
        const prepared = await prepareImage(file);
        const fd = new FormData();
        fd.set("file", prepared.file);
        const result = await uploadMapImage(projectId, fd);
        if ("error" in result) {
          setNotice(result.error);
          return;
        }
        addImageBySize(result.url, prepared, at);
      } catch (e) {
        setNotice(
          e instanceof Error && e.message === "too-big"
            ? "La imagen es demasiado grande incluso reducida."
            : "No se pudo leer la imagen. Prueba con JPG, PNG o WebP.",
        );
      } finally {
        setUploading((n) => n - 1);
      }
    },
    [addImageBySize, canAdd, projectId],
  );

  const addImageFromUrl = useCallback(
    async (url: string) => {
      if (!/^https:\/\//i.test(url)) {
        setNotice("El enlace de la imagen tiene que empezar por https://");
        return;
      }
      if (!canAdd()) return;
      try {
        addImageBySize(url, await loadImageSize(url));
        setImageUrl("");
      } catch {
        setNotice("No se pudo cargar esa imagen. Comprueba que el enlace lleva directo a una imagen.");
      }
    },
    [addImageBySize, canAdd],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      files.slice(0, 5).forEach((file, i) => void addImageFile(file, { x: at.x + i * 30, y: at.y + i * 30 }));
    },
    [addImageFile, screenToFlowPosition],
  );

  // Teclado y portapapeles: Ctrl+Z / Ctrl+Mayús+Z / Ctrl+Y, Ctrl+D, Ctrl+C, Ctrl+V (también imágenes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target) || !(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y") {
        e.preventDefault();
        redo();
      } else if (k === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (k === "c") {
        copySelected();
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) {
        e.preventDefault();
        files.slice(0, 5).forEach((f) => void addImageFile(f));
        return;
      }
      if (clip.current) {
        e.preventDefault();
        spawn(clip.current.items, clip.current.edges, 40);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [addImageFile, copySelected, duplicateSelected, redo, spawn, undo]);

  // ---------------------------------------------------------------- Secciones: arrastran lo que contienen
  const dragCtx = useRef<{ id: string; start: { x: number; y: number }; members: { id: string; x: number; y: number }[] } | null>(null);

  const onNodeDragStart = useCallback((_e: unknown, node: AnyNode) => {
    if (node.type !== "item" || node.data.item.type !== "section") return;
    const s = sizeOf(node);
    const members = nodesRef.current
      .filter((n) => n.id !== node.id && !(n.type === "item" && n.data.item.type === "section"))
      .filter((n) => {
        const nz = sizeOf(n);
        const cx = n.position.x + nz.w / 2;
        const cy = n.position.y + nz.h / 2;
        return cx >= node.position.x && cx <= node.position.x + s.w && cy >= node.position.y && cy <= node.position.y + s.h;
      })
      .map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));
    dragCtx.current = { id: node.id, start: { ...node.position }, members };
  }, []);

  const onNodeDrag = useCallback((_e: unknown, node: AnyNode) => {
    const ctx = dragCtx.current;
    if (!ctx || ctx.id !== node.id) return;
    const dx = node.position.x - ctx.start.x;
    const dy = node.position.y - ctx.start.y;
    const byId = new Map(ctx.members.map((m) => [m.id, m]));
    setNodes((ns) => ns.map((n) => (byId.has(n.id) ? { ...n, position: { x: byId.get(n.id)!.x + dx, y: byId.get(n.id)!.y + dy } } : n)));
  }, []);

  const onNodeDragStop = useCallback(() => {
    if (dragCtx.current) markDirty();
    dragCtx.current = null;
  }, [markDirty]);

  // ---------------------------------------------------------------- Tarjetas de herramienta
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
      delete hiddenRects.current[key];
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
    for (const k of hiddenRef.current) hiddenRects.current[k] = defaultToolRect(k);
    setConfirmReset(false);
    setMenu(null);
    markDirty();
    setTimeout(() => void fitView({ padding: 0.15, duration: 400 }), 80);
  }, [fitView, markDirty]);

  const refresh = useCallback(() => {
    setBusy(true);
    router.refresh();
    setMenu(null);
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

  // ---------------------------------------------------------------- Exportar a imagen o PDF
  const exportBoard = useCallback(
    async (format: "png" | "pdf") => {
      setMenu(null);
      const visible = nodesRef.current;
      if (visible.length === 0) {
        setNotice("No hay nada que exportar.");
        return;
      }
      setExporting(true);
      try {
        const bounds = getNodesBounds(visible);
        const pad = 60;
        const width = Math.min(4096, Math.max(600, Math.round(bounds.width + pad * 2)));
        const height = Math.min(4096, Math.max(400, Math.round(bounds.height + pad * 2)));
        const vp = getViewportForBounds(bounds, width, height, 0.05, 2, 0.05);
        const el = document.querySelector<HTMLElement>(".react-flow__viewport");
        if (!el) throw new Error("no-viewport");

        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(el, {
          backgroundColor: "#0a0a0a",
          width,
          height,
          pixelRatio: 1.5,
          style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
          filter: (n) => {
            const c = (n as HTMLElement).classList;
            return !(c && (c.contains("react-flow__handle") || c.contains("react-flow__resize-control") || c.contains("react-flow__nodesselection") || c.contains("map-cursor")));
          },
        });

        // Se pasa por un lienzo para poner la marca de agua del plan gratuito.
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("img"));
          img.src = dataUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const g = canvas.getContext("2d")!;
        g.drawImage(img, 0, 0);
        if (!isPro) {
          g.font = `${Math.round(canvas.width / 90) + 10}px monospace`;
          g.fillStyle = "rgba(255,255,255,0.45)";
          g.textAlign = "right";
          g.fillText("Hecho con Taller · Versión definitiva", canvas.width - 24, canvas.height - 20);
        }
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("blob");

        const base = (boardName || "pizarra").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "pizarra";
        let out = blob;
        let ext = "png";
        if (format === "pdf") {
          const { PDFDocument } = await import("pdf-lib");
          const pdf = await PDFDocument.create();
          const png = await pdf.embedPng(await blob.arrayBuffer());
          const w = canvas.width * 0.5;
          const h = canvas.height * 0.5;
          pdf.addPage([w, h]).drawImage(png, { x: 0, y: 0, width: w, height: h });
          out = new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
          ext = "pdf";
        }
        const url = URL.createObjectURL(out);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch {
        setNotice("No se pudo exportar. Si hay imágenes de otras webs, prueba a subirlas a la pizarra.");
      } finally {
        setExporting(false);
      }
    },
    [boardName, isPro],
  );

  // ---------------------------------------------------------------- Guardado automático (por cambios)
  const channelRef = useRef<RealtimeChannel | null>(null);
  // El editor solo se ejecuta en el navegador (carga sin servidor), así que crypto siempre existe.
  const clientId = useRef(crypto.randomUUID());

  const save = useCallback(async () => {
    const ops = diffLayouts(lastSaved.current, currentLayout());
    if (isEmptyOps(ops)) {
      setDirty(false);
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    try {
      const result = await saveProjectMap(projectId, boardId, ops);
      if (result.ok) {
        setSaveError(null);
        setSaveState("idle");
        applyRemote(result.layout, result.updatedAt, ops);
        // Aviso a los demás (sin datos: ellos piden la pizarra al servidor, que comprueba el acceso).
        void channelRef.current?.send({ type: "broadcast", event: "saved", payload: { v: result.updatedAt, from: clientId.current } });
      } else {
        setSaveError(result.error);
        setSaveState("error");
      }
    } catch {
      setSaveError("No se pudo guardar. Comprueba tu conexión.");
      setSaveState("error");
    } finally {
      savingRef.current = false;
      if (pullAgain.current) {
        pullAgain.current = false;
        void pullRemote();
      }
    }
  }, [applyRemote, boardId, currentLayout, projectId, pullRemote]);

  useEffect(() => {
    // Nunca dos guardados a la vez.
    if (!dirty || saveState === "saving" || saveState === "error") return;
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
  }, [dirty, nodes, edges, hidden, saveState, save]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirty && saveState !== "saving") void save();
      if (document.visibilityState === "visible") void pullRemote();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty, saveState, save, pullRemote]);

  // ---------------------------------------------------------------- En directo: avisos, presencia y cursores
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const [peers, setPeers] = useState<{ key: string; userId: string; name: string; color: string }[]>([]);
  const myColor = useMemo(() => colorFor(userId), [userId]);
  const lastCursorSent = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`map-board:${boardId}`, {
      config: { presence: { key: clientId.current }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "saved" }, ({ payload }) => {
        const v = typeof payload?.v === "string" ? payload.v : null;
        if (v && v !== knownVersion.current) void pullRemote();
      })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const id = typeof payload?.id === "string" ? payload.id : null;
        if (!id || id === clientId.current) return;
        if (payload.x === null) {
          setCursors((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== id)));
          return;
        }
        if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
        setCursors((c) => ({
          ...c,
          [id]: { x: payload.x, y: payload.y, name: cleanName(payload.name), color: cleanColor(payload.color), at: Date.now() },
        }));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ name: string; color: string; userId: string }>();
        const list: { key: string; userId: string; name: string; color: string }[] = [];
        for (const [key, entries] of Object.entries(state)) {
          const e = entries[0];
          if (key === clientId.current || !e) continue;
          list.push({ key, userId: String(e.userId ?? key), name: cleanName(e.name), color: cleanColor(e.color) });
        }
        setPeers(list);
        setCursors((c) => Object.fromEntries(Object.entries(c).filter(([id]) => list.some((p) => p.key === id))));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ name: userName, color: myColor, userId });
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [boardId, myColor, pullRemote, userId, userName]);

  // Sondeo de respaldo: si el canal en directo falla, cada 15 s se comprueba si alguien cambió algo.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible" || savingRef.current) return;
      const v = await mapBoardVersion(projectId, boardId).catch(() => null);
      if (v && v !== knownVersion.current) void pullRemote();
    }, 15_000);
    return () => clearInterval(t);
  }, [boardId, projectId, pullRemote]);

  // Los cursores que llevan tiempo quietos o de personas que se fueron, fuera.
  useEffect(() => {
    const t = setInterval(() => {
      setCursors((c) => {
        const fresh = Object.entries(c).filter(([, v]) => Date.now() - v.at < 8000);
        return fresh.length === Object.keys(c).length ? c : Object.fromEntries(fresh);
      });
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const now = Date.now();
      if (now - lastCursorSent.current < 60 || !channelRef.current) return;
      lastCursorSent.current = now;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      void channelRef.current.send({
        type: "broadcast",
        event: "cursor",
        payload: { id: clientId.current, name: userName, color: myColor, x: Math.round(p.x), y: Math.round(p.y) },
      });
    },
    [myColor, screenToFlowPosition, userName],
  );

  const onPointerLeave = useCallback(() => {
    void channelRef.current?.send({ type: "broadcast", event: "cursor", payload: { id: clientId.current, x: null } });
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  // ---------------------------------------------------------------- Render
  const mapCtx = useMemo(
    () => ({ projectId, tools: toolsByKey, entities, hide, completeTask, changeStatus, busy, readOnly: false }),
    [projectId, toolsByKey, entities, hide, completeTask, changeStatus, busy],
  );
  const itemCtx = useMemo(() => ({ update: updateItem, remove: removeItem, readOnly: false }), [updateItem, removeItem]);

  const visibleIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const rfEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)).map((e) => toRfEdge(e, selectedEdges.includes(e.id))),
    [edges, selectedEdges, visibleIds],
  );

  const selItems = nodes.filter((n): n is ItemNode => n.type === "item" && !!n.selected);
  const selTypes = new Set(selItems.map((n) => n.data.item.type));
  const selEdge = selectedEdges.length === 1 ? edges.find((e) => e.id === selectedEdges[0]) : undefined;
  const colorable = (["text", "shape", "section"] as MapItemType[]).filter((t) => selTypes.has(t));

  const status =
    saveState === "error"
      ? { text: "Error al guardar", tone: "text-danger" }
      : saveState === "saving"
        ? { text: "Guardando…", tone: "text-muted" }
        : dirty
          ? { text: "Cambios sin guardar", tone: "text-muted" }
          : { text: "✓ Guardado", tone: "text-success" };

  const btn =
    "border border-line bg-bg-raised px-2.5 py-1.5 font-mono text-[11px] tracking-wider uppercase transition-colors hover:border-accent hover:text-accent disabled:opacity-40";
  const chip = (on: boolean) =>
    `border px-2 py-1 font-mono text-[11px] uppercase ${on ? "border-accent text-accent" : "border-line text-muted hover:text-fg"}`;
  const popover = "absolute top-full left-0 z-20 mt-1 border border-line bg-bg-raised shadow-xl";

  return (
    <MapProvider value={mapCtx}>
      <ItemProvider value={itemCtx}>
        <div
          ref={wrapperRef}
          className="relative h-[calc(100dvh-16rem)] min-h-[560px] border border-line"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
          }}
          onDrop={onDrop}
        >
          <ReactFlow<AnyNode>
            nodes={nodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onBeforeDelete={async ({ nodes: ns, edges: es }) => ({ nodes: ns.filter((n) => n.type !== "tool"), edges: es })}
            connectionMode={ConnectionMode.Loose}
            connectionLineStyle={{ stroke: "#a08fd0", strokeWidth: 2 }}
            colorMode="dark"
            minZoom={0.1}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            deleteKeyCode={["Backspace", "Delete"]}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={24} size={1} />
            <RemoteCursors cursors={cursors} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="hidden! sm:block!" maskColor="rgba(0,0,0,0.6)" />

            <Panel position="top-left" className="m-2! max-w-[calc(100%-1rem)]">
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className={btn} onClick={() => addItem("note")}>
                  + Nota
                </button>
                <button type="button" className={btn} onClick={() => addItem("text")}>
                  + Texto
                </button>

                <div className="relative">
                  <button type="button" className={btn} onClick={() => setMenu(menu === "image" ? null : "image")} aria-expanded={menu === "image"}>
                    + Imagen{uploading > 0 ? " …" : ""}
                  </button>
                  {menu === "image" && (
                    <div className={`${popover} w-80 p-3`}>
                      <button
                        type="button"
                        className="w-full border border-line px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:border-accent hover:text-accent"
                        onClick={() => fileRef.current?.click()}
                      >
                        Subir desde el dispositivo
                      </button>
                      <p className="my-2 text-center font-mono text-[10px] text-muted uppercase">o pega un enlace</p>
                      <div className="flex gap-1.5">
                        <input
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && void addImageFromUrl(imageUrl.trim())}
                          placeholder="https://…/imagen.jpg"
                          aria-label="Enlace de la imagen"
                          className="min-w-0 flex-1 border border-line bg-transparent px-2 py-1.5 text-xs outline-none focus:border-accent"
                        />
                        <button type="button" className={btn} onClick={() => void addImageFromUrl(imageUrl.trim())}>
                          Añadir
                        </button>
                      </div>
                      {images.length > 0 && (
                        <>
                          <p className="mt-3 mb-1.5 font-mono text-[10px] text-muted uppercase">Del proyecto ({images.length})</p>
                          <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto">
                            {images.map((im, i) => (
                              <button
                                key={i}
                                type="button"
                                title={im.label}
                                aria-label={`Añadir ${im.label}`}
                                onClick={() => void addImageFromUrl(im.url)}
                                className="aspect-square overflow-hidden border border-line hover:border-accent"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={im.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <p className="mt-2 font-sans text-[11px] text-muted">También puedes pegar (Ctrl+V) o soltar imágenes sobre el tablero.</p>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button type="button" className={btn} onClick={() => setMenu(menu === "shape" ? null : "shape")} aria-expanded={menu === "shape"}>
                    + Forma
                  </button>
                  {menu === "shape" && (
                    <div className={`${popover} flex gap-1.5 p-2`}>
                      {(
                        [
                          ["rect", "Rectángulo"],
                          ["round", "Redondeado"],
                          ["ellipse", "Círculo"],
                        ] as [MapShape, string][]
                      ).map(([shape, label]) => (
                        <button key={shape} type="button" className={btn} onClick={() => addItem("shape", { shape })}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button" className={btn} onClick={() => addItem("section")} title="Un marco con título para agrupar tarjetas">
                  + Sección
                </button>

                <div className="relative">
                  <button type="button" className={btn} onClick={() => setMenu(menu === "project" ? null : "project")} aria-expanded={menu === "project"}>
                    + Del proyecto
                  </button>
                  {menu === "project" && (
                    <div className={`${popover} w-[22rem]`}>
                      <div className="flex overflow-x-auto border-b border-line [scrollbar-width:none]" role="tablist">
                        {MAP_ENTITY_KINDS.map((k) => (
                          <button
                            key={k}
                            type="button"
                            role="tab"
                            aria-selected={projectTab === k}
                            onClick={() => {
                              setProjectTab(k);
                              setProjectQuery("");
                            }}
                            className={`shrink-0 px-2.5 py-2 font-mono text-[10px] tracking-wider uppercase ${projectTab === k ? "text-accent" : "text-muted hover:text-fg"}`}
                          >
                            {MAP_ENTITY_LABELS[k].many} ({entities[k]?.length ?? 0})
                          </button>
                        ))}
                      </div>
                      {(() => {
                        const all = entities[projectTab] ?? [];
                        const q = projectQuery.trim().toLowerCase();
                        const filtered = q ? all.filter((e) => `${e.title} ${e.sub ?? ""}`.toLowerCase().includes(q)) : all;
                        return (
                          <>
                            <div className="flex items-center gap-2 border-b border-line p-2">
                              <input
                                value={projectQuery}
                                onChange={(e) => setProjectQuery(e.target.value)}
                                placeholder="Buscar…"
                                aria-label="Buscar en el proyecto"
                                className="min-w-0 flex-1 border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-accent"
                              />
                              <button
                                type="button"
                                disabled={filtered.length === 0}
                                onClick={() => addEntities(projectTab, filtered)}
                                className={btn}
                                title="Las añade todas de golpe (hasta 30)"
                              >
                                Todas ({Math.min(filtered.length, 30)})
                              </button>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                              {filtered.length === 0 ? (
                                <p className="p-3 font-sans text-xs text-muted">Todavía no hay nada de esto en el proyecto.</p>
                              ) : (
                                filtered.slice(0, 60).map((e) => (
                                  <button key={e.id} type="button" onClick={() => addEntity(projectTab, e)} className="block w-full border-b border-line px-3 py-2 text-left hover:bg-white/5">
                                    <span className="block font-display text-sm font-bold">{e.title}</span>
                                    {e.sub && <span className="block truncate font-mono text-[11px] text-muted">{e.sub}</span>}
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <button type="button" className={btn} onClick={undo} disabled={hist.undo === 0} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
                  ↶
                </button>
                <button type="button" className={btn} onClick={redo} disabled={hist.redo === 0} aria-label="Rehacer" title="Rehacer (Ctrl+Mayús+Z)">
                  ↷
                </button>

                <div className="relative">
                  <button type="button" className={btn} onClick={() => setMenu(menu === "more" ? null : "more")} aria-expanded={menu === "more"}>
                    Más ▾
                  </button>
                  {menu === "more" && (
                    <div className={`${popover} w-64`}>
                      <button type="button" onClick={refresh} disabled={busy} className="block w-full border-b border-line px-3 py-2 text-left font-mono text-[11px] tracking-wider uppercase hover:bg-white/5">
                        {busy ? "Actualizando…" : "↻ Actualizar tarjetas"}
                      </button>
                      <button type="button" onClick={() => void exportBoard("png")} disabled={exporting} className="block w-full border-b border-line px-3 py-2 text-left font-mono text-[11px] tracking-wider uppercase hover:bg-white/5">
                        {exporting ? "Exportando…" : "Descargar imagen (PNG)"}
                      </button>
                      <button type="button" onClick={() => void exportBoard("pdf")} disabled={exporting} className="block w-full border-b border-line px-3 py-2 text-left font-mono text-[11px] tracking-wider uppercase hover:bg-white/5">
                        Descargar PDF
                      </button>
                      {confirmReset ? (
                        <div className="flex items-center gap-3 border-b border-line px-3 py-2 font-mono text-[11px] uppercase">
                          ¿Recolocar las tarjetas?
                          <button type="button" onClick={resetLayout} className="text-accent underline">
                            Sí
                          </button>
                          <button type="button" onClick={() => setConfirmReset(false)} className="text-muted underline">
                            No
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmReset(true)} className="block w-full border-b border-line px-3 py-2 text-left font-mono text-[11px] tracking-wider uppercase hover:bg-white/5">
                          Reordenar tarjetas
                        </button>
                      )}
                      <p className="px-3 pt-2 font-mono text-[10px] tracking-wider text-muted uppercase">Tarjetas ocultas ({hidden.length})</p>
                      {hidden.length === 0 ? (
                        <p className="px-3 pt-1 pb-3 font-sans text-xs text-muted">Ninguna.</p>
                      ) : (
                        hidden.map((k) => (
                          <button key={k} type="button" onClick={() => show(k)} className="flex w-full items-center justify-between border-t border-line px-3 py-2 text-left hover:bg-white/5">
                            <span className="font-display text-sm font-bold">{toolsByKey[k]?.title ?? k}</span>
                            <span className="font-mono text-[10px] tracking-wider text-accent uppercase">Mostrar</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, 5);
                    e.target.value = "";
                    setMenu(null);
                    files.forEach((f) => void addImageFile(f));
                  }}
                />
              </div>
              {menu && <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(null)} />}
            </Panel>

            <Panel position="top-right" className="m-2!">
              <div className="flex items-center gap-3 border border-line bg-bg-raised px-3 py-1.5 font-mono text-[11px]">
                {uniquePeers(peers).length > 0 && (
                  <span className="flex items-center gap-1" aria-label={`${uniquePeers(peers).length} personas más en la pizarra`}>
                    {uniquePeers(peers).slice(0, 5).map((p) => (
                      <span
                        key={p.userId}
                        title={`${p.name} está en esta pizarra`}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-black"
                        style={{ background: p.color }}
                      >
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                    {uniquePeers(peers).length > 5 && <span className="text-muted">+{uniquePeers(peers).length - 5}</span>}
                  </span>
                )}
                {!isPro && (
                  <span className={atFreeLimit ? "text-warn" : "text-muted"} title="Elementos propios (las tarjetas de herramienta no cuentan)">
                    {itemsCount}/{freeLimit}
                  </span>
                )}
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

            <Panel position="bottom-center" className="mb-3!">
              {selEdge ? (
                <div className="flex flex-wrap items-center gap-2 border border-line bg-bg-raised p-2" role="toolbar" aria-label="Flecha seleccionada">
                  <input
                    value={selEdge.label ?? ""}
                    onChange={(e) => updateEdge(selEdge.id, { label: e.target.value || undefined })}
                    placeholder="Texto de la flecha"
                    maxLength={80}
                    aria-label="Texto de la flecha"
                    className="w-40 border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-accent"
                  />
                  <div className="flex gap-1" role="group" aria-label="Color de la flecha">
                    {MAP_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Color ${c}`}
                        aria-pressed={selEdge.color === c}
                        onClick={() => updateEdge(selEdge.id, { color: c })}
                        className={`h-5 w-5 rounded-full border-2 ${selEdge.color === c ? "border-white" : "border-transparent"}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <button type="button" className={chip(!!selEdge.dashed)} onClick={() => updateEdge(selEdge.id, { dashed: selEdge.dashed ? undefined : true })}>
                    Discontinua
                  </button>
                  <button type="button" className={chip(selEdge.arrow !== false)} onClick={() => updateEdge(selEdge.id, { arrow: selEdge.arrow === false ? undefined : false })}>
                    Flecha
                  </button>
                  <button type="button" className={chip(false)} onClick={() => removeEdges([selEdge.id])}>
                    Quitar
                  </button>
                </div>
              ) : selItems.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 border border-line bg-bg-raised p-2" role="toolbar" aria-label="Elementos seleccionados">
                  {selTypes.has("text") && (
                    <div className="flex gap-1" role="group" aria-label="Tamaño del texto">
                      {(["s", "m", "l"] as MapTextSize[]).map((s) => (
                        <button key={s} type="button" className={chip(selItems.every((n) => n.data.item.type !== "text" || n.data.item.size === s))} onClick={() => patchSelected(["text"], { size: s })}>
                          {s === "s" ? "Pequeño" : s === "m" ? "Título" : "Grande"}
                        </button>
                      ))}
                    </div>
                  )}
                  {selTypes.has("shape") && (
                    <div className="flex gap-1" role="group" aria-label="Tipo de forma">
                      {(
                        [
                          ["rect", "▭"],
                          ["round", "▢"],
                          ["ellipse", "◯"],
                        ] as [MapShape, string][]
                      ).map(([s, icon]) => (
                        <button key={s} type="button" aria-label={s} className={chip(false)} onClick={() => patchSelected(["shape"], { shape: s })}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  )}
                  {colorable.length > 0 && (
                    <div className="flex gap-1" role="group" aria-label="Color">
                      {MAP_COLORS.map((c) => (
                        <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => patchSelected(colorable, { color: c })} className="h-5 w-5 rounded-full border-2 border-transparent hover:border-white" style={{ background: c }} />
                      ))}
                    </div>
                  )}
                  <button type="button" className={chip(false)} onClick={duplicateSelected} title="Duplicar (Ctrl+D)">
                    Duplicar
                  </button>
                  <button type="button" className={chip(false)} onClick={removeSelected}>
                    Quitar
                  </button>
                </div>
              ) : (
                <p className="hidden max-w-xl border border-line bg-bg-raised/90 px-3 py-1.5 text-center font-sans text-[11px] text-muted sm:block">
                  Arrastra desde los puntos de una tarjeta para unirla con una flecha · Mayús + arrastrar selecciona varias · Ctrl+Z deshace · Ctrl+D duplica
                </p>
              )}
            </Panel>
          </ReactFlow>

          {(notice || saveError) && (
            <div className="absolute bottom-16 left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 border border-warn/60 bg-bg-raised px-4 py-2 font-sans text-xs shadow-xl" role="alert">
              <span>{notice ?? saveError}</span>
              <button type="button" aria-label="Cerrar aviso" onClick={() => { setNotice(null); setSaveError(null); }} className="text-muted hover:text-fg">
                ×
              </button>
            </div>
          )}
        </div>
      </ItemProvider>
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
