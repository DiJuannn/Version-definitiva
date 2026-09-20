"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { BoardProvider, CardNodeView, type CardNode } from "@/components/moodboard/nodes";
import { MoodboardAiPanel } from "@/components/moodboard/MoodboardAiPanel";
import { saveMoodboard, uploadMoodboardImage } from "@/lib/actions/moodboard";
import { NOTE_COLORS, type MoodboardCard, type MoodboardLookup } from "@/lib/moodboard-types";
import type { MoodboardProposal } from "@/lib/moodboard-ai";

const nodeTypes = { card: CardNodeView };

type Props = {
  projectId: string;
  initialCards: MoodboardCard[];
  initialUpdatedAt: string | null;
  isPro: boolean;
  freeLimit: number;
  maxCards: number;
  aiLimit: number;
  aiUsed: number;
  lookup: MoodboardLookup;
};

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

function toNode(card: MoodboardCard): CardNode {
  return {
    id: card.id,
    type: "card",
    position: { x: card.x, y: card.y },
    width: card.w,
    height: card.h,
    data: { card },
  };
}

// Las fotos del móvil pesan varios MB: se reducen antes de subirlas (más rápido y
// dentro del límite de subida). Las pequeñas se suben tal cual.
async function prepareImage(file: File): Promise<{ file: File; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  if (file.size <= 900_000) {
    bitmap.close();
    return { file, width, height };
  }
  for (const [maxSide, quality] of [
    [1800, 0.85],
    [1600, 0.75],
    [1280, 0.7],
    [1000, 0.65],
  ] as const) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= 900_000) {
      bitmap.close();
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return { file: new File([blob], name, { type: "image/jpeg" }), width: canvas.width, height: canvas.height };
    }
  }
  bitmap.close();
  throw new Error("too-big");
}

function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("load"));
    img.src = url;
  });
}

// Busca un hueco libre lo más cerca posible del centro (en espiral) para que las
// tarjetas nuevas no se apilen encima de otras.
function findFreeSpot(nodes: CardNode[], cx: number, cy: number, w: number, h: number) {
  const gap = 24;
  const hits = (x: number, y: number) =>
    nodes.some((n) => {
      const nw = n.width ?? n.measured?.width ?? n.data.card.w;
      const nh = n.height ?? n.measured?.height ?? n.data.card.h;
      return x < n.position.x + nw + gap && x + w + gap > n.position.x && y < n.position.y + nh + gap && y + h + gap > n.position.y;
    });
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const stepX = w + gap;
  const stepY = h + gap;
  for (let ring = 0; ring <= 8; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const x = x0 + i * stepX;
        const y = y0 + j * stepY;
        if (!hits(x, y)) return { x, y };
      }
    }
  }
  return { x: x0 + 22 * (nodes.length % 6), y: y0 + 22 * (nodes.length % 6) };
}

function Board(props: Props) {
  const { projectId, initialCards, initialUpdatedAt, isPro, freeLimit, maxCards, aiLimit, lookup } = props;
  const { screenToFlowPosition, fitView } = useReactFlow<CardNode>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [nodes, setNodes] = useState<CardNode[]>(() => initialCards.map(toNode));
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const updatedAtRef = useRef<string | null>(initialUpdatedAt);
  const versionRef = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error" | "conflict">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [menu, setMenu] = useState<null | "image" | "project">(null);
  const [projectTab, setProjectTab] = useState<"scenes" | "characters" | "locations">("scenes");
  const [imageUrl, setImageUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiUsed, setAiUsed] = useState(props.aiUsed);

  const atFreeLimit = !isPro && nodes.length >= freeLimit;

  const markDirty = useCallback(() => {
    versionRef.current += 1;
    setDirty(true);
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<MoodboardCard>) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { card: { ...n.data.card, ...patch } } } : n)));
      markDirty();
    },
    [markDirty],
  );

  const remove = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      markDirty();
    },
    [markDirty],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<CardNode>[]) => {
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

  // ---- Guardado automático (con control de conflictos en el servidor)
  const save = useCallback(async () => {
    const version = versionRef.current;
    const cards: MoodboardCard[] = nodesRef.current.map((n) => ({
      ...n.data.card,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      w: Math.round(n.width ?? n.measured?.width ?? n.data.card.w),
      h: Math.round(n.height ?? n.measured?.height ?? n.data.card.h),
    }));
    setSaveState("saving");
    try {
      const result = await saveMoodboard(projectId, cards, updatedAtRef.current);
      if (result.ok) {
        updatedAtRef.current = result.updatedAt;
        setSaveError(null);
        setSaveState("idle");
        if (versionRef.current === version) setDirty(false);
      } else if (result.conflict) {
        setSaveError(result.error);
        setSaveState("conflict");
      } else {
        setSaveError(result.error);
        setSaveState("error");
      }
    } catch {
      setSaveError("No se pudo guardar. Comprueba tu conexión.");
      setSaveState("error");
    }
  }, [projectId]);

  useEffect(() => {
    if (!dirty || saveState === "conflict") return;
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
  }, [dirty, nodes, saveState, save]);

  // Al cerrar o cambiar de pestaña con cambios sin guardar: se intenta guardar y se avisa.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirty && saveState !== "conflict") void save();
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

  // Escape cierra el menú abierto.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  // ---- Añadir tarjetas
  const canAdd = useCallback(
    (count = 1) => {
      if (nodesRef.current.length + count > maxCards) {
        setNotice(`El tablero ya tiene el máximo de ${maxCards} tarjetas.`);
        return false;
      }
      if (!isPro && nodesRef.current.length + count > freeLimit) {
        setNotice(`El plan gratuito permite hasta ${freeLimit} tarjetas por tablero.`);
        return false;
      }
      setNotice(null);
      return true;
    },
    [isPro, freeLimit, maxCards],
  );

  const centerPoint = useCallback(() => {
    const b = wrapperRef.current?.getBoundingClientRect();
    return screenToFlowPosition({ x: (b?.left ?? 0) + (b?.width ?? 600) / 2, y: (b?.top ?? 0) + (b?.height ?? 400) / 2 });
  }, [screenToFlowPosition]);

  const addCard = useCallback(
    (partial: Omit<MoodboardCard, "id" | "x" | "y"> & { at?: { x: number; y: number } }) => {
      if (!canAdd()) return;
      const { at, ...rest } = partial;
      const spot = at
        ? { x: at.x - rest.w / 2, y: at.y - rest.h / 2 }
        : (() => {
            const c = centerPoint();
            return findFreeSpot(nodesRef.current, c.x, c.y, rest.w, rest.h);
          })();
      const card: MoodboardCard = { ...rest, id: newId(), x: Math.round(spot.x), y: Math.round(spot.y) };
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), { ...toNode(card), selected: true }]);
      markDirty();
      setMenu(null);
    },
    [canAdd, centerPoint, markDirty],
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
        const result = await uploadMoodboardImage(projectId, fd);
        if ("error" in result) {
          setNotice(result.error);
          return;
        }
        const w = 280;
        addCard({
          type: "image",
          url: result.url,
          w,
          h: Math.min(520, Math.round((w * prepared.height) / prepared.width) + 30),
          at,
        });
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
    [addCard, canAdd, projectId],
  );

  async function addImageUrl() {
    const url = imageUrl.trim();
    if (!/^https:\/\//i.test(url)) {
      setNotice("El enlace de la imagen tiene que empezar por https://");
      return;
    }
    if (!canAdd()) return;
    try {
      const size = await loadImageSize(url);
      const w = 280;
      addCard({ type: "image", url, w, h: Math.min(520, Math.round((w * size.height) / size.width) + 30) });
      setImageUrl("");
    } catch {
      setNotice("No se pudo cargar esa imagen. Comprueba que el enlace lleva directo a una imagen.");
    }
  }

  // Suelta de imágenes sobre el lienzo.
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

  // ---- Propuestas de la IA → tarjetas colocadas en rejilla
  const addProposal = useCallback(
    (proposal: MoodboardProposal, keys: Set<string>) => {
      const cards: Omit<MoodboardCard, "id" | "x" | "y">[] = [];
      if (keys.has("tone") && (proposal.palette.length > 0 || proposal.tone)) {
        cards.push({ type: "palette", w: 300, h: 150, title: proposal.tone.slice(0, 120) || "Paleta", colors: proposal.palette });
      }
      proposal.references.forEach((r, i) => {
        if (keys.has(`ref-${i}`)) cards.push({ type: "reference", w: 270, h: 210, title: r.title, year: r.year, kind: r.kind, why: r.why });
      });
      proposal.ideas.forEach((idea, i) => {
        if (keys.has(`idea-${i}`)) {
          cards.push({ type: "note", w: 250, h: 150, text: `${idea.topic}\n${idea.text}`, color: NOTE_COLORS[i % NOTE_COLORS.length] });
        }
      });
      if (cards.length === 0 || !canAdd(cards.length)) return;

      // Con el tablero vacío, en el centro; si ya hay tarjetas, a la derecha de todas ellas.
      const cols = 3;
      const existing = nodesRef.current;
      let startX: number;
      let startY: number;
      if (existing.length === 0) {
        const origin = centerPoint();
        startX = origin.x - (cols * 300) / 2;
        startY = origin.y - 200;
      } else {
        startX = Math.max(...existing.map((n) => n.position.x + (n.width ?? n.measured?.width ?? n.data.card.w))) + 80;
        startY = Math.min(...existing.map((n) => n.position.y));
      }
      const created: CardNode[] = cards.map((c, i) =>
        toNode({ ...c, id: newId(), x: Math.round(startX + (i % cols) * 300), y: Math.round(startY + Math.floor(i / cols) * 240) }),
      );
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), ...created]);
      markDirty();
      setTimeout(() => void fitView({ nodes: created.map((n) => ({ id: n.id })), padding: 0.25, duration: 500 }), 80);
    },
    [canAdd, centerPoint, fitView, markDirty],
  );

  const ctx = useMemo(() => ({ projectId, lookup, update, remove }), [projectId, lookup, update, remove]);

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

  const projectItems =
    projectTab === "scenes"
      ? lookup.scenes.map((s) => ({ key: s.id, title: `Escena ${s.number}`, sub: s.heading, type: "scene" as const, label: s.number }))
      : projectTab === "characters"
        ? lookup.characters.map((c) => ({ key: c.id, title: c.name, sub: c.actor ?? "Sin actor", type: "character" as const, label: c.name }))
        : lookup.locations.map((l) => ({ key: l.id, title: l.name, sub: l.address ?? "", type: "location" as const, label: l.name }));

  return (
    <BoardProvider value={ctx}>
      <div
        ref={wrapperRef}
        className="relative h-[calc(100dvh-16rem)] min-h-[520px] border border-line"
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
        }}
        onDrop={onDrop}
      >
        <ReactFlow<CardNode>
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          colorMode="dark"
          minZoom={0.1}
          maxZoom={2}
          fitView={initialCards.length > 0}
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          onlyRenderVisibleElements
          nodesConnectable={false}
          elementsSelectable
          deleteKeyCode={["Backspace", "Delete"]}
          panOnScroll={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="hidden! sm:block!" maskColor="rgba(0,0,0,0.6)" />

          <Panel position="top-left" className="m-2! max-w-[calc(100%-1rem)]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={btn} onClick={() => addCard({ type: "note", w: 220, h: 150, color: NOTE_COLORS[0] })}>
                + Nota
              </button>
              <div className="relative">
                <button type="button" className={btn} onClick={() => setMenu(menu === "image" ? null : "image")} aria-expanded={menu === "image"}>
                  + Imagen{uploading > 0 ? " …" : ""}
                </button>
                {menu === "image" && (
                  <div className="absolute top-full left-0 z-20 mt-1 w-72 border border-line bg-bg-raised p-3 shadow-xl">
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
                        onKeyDown={(e) => e.key === "Enter" && void addImageUrl()}
                        placeholder="https://…/imagen.jpg"
                        aria-label="Enlace de la imagen"
                        className="min-w-0 flex-1 border border-line bg-transparent px-2 py-1.5 text-xs outline-none focus:border-accent"
                      />
                      <button type="button" className={btn} onClick={() => void addImageUrl()}>
                        Añadir
                      </button>
                    </div>
                    <p className="mt-2 font-sans text-[11px] text-muted">También puedes soltar imágenes directamente sobre el tablero.</p>
                  </div>
                )}
              </div>
              <button type="button" className={btn} onClick={() => addCard({ type: "palette", w: 300, h: 150, title: "Paleta", colors: ["#1f2a44", "#c8553d", "#f2d0a4", "#588b8b", "#ffffff"] })}>
                + Paleta
              </button>
              <button type="button" className={btn} onClick={() => addCard({ type: "reference", w: 270, h: 210, kind: "Película" })}>
                + Referencia
              </button>
              <div className="relative">
                <button type="button" className={btn} onClick={() => setMenu(menu === "project" ? null : "project")} aria-expanded={menu === "project"}>
                  + Del proyecto
                </button>
                {menu === "project" && (
                  <div className="absolute top-full left-0 z-20 mt-1 w-72 border border-line bg-bg-raised shadow-xl">
                    <div className="flex border-b border-line" role="tablist">
                      {(
                        [
                          ["scenes", "Escenas"],
                          ["characters", "Personajes"],
                          ["locations", "Lugares"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={projectTab === id}
                          onClick={() => setProjectTab(id)}
                          className={`flex-1 px-2 py-2 font-mono text-[10px] tracking-wider uppercase ${projectTab === id ? "text-accent" : "text-muted hover:text-fg"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {projectItems.length === 0 ? (
                        <p className="p-3 font-sans text-xs text-muted">Todavía no hay nada de esto en el proyecto.</p>
                      ) : (
                        projectItems.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => addCard({ type: item.type, w: 240, h: 130, refId: item.key, label: item.label })}
                            className="block w-full border-b border-line px-3 py-2 text-left hover:bg-white/5"
                          >
                            <span className="block font-display text-sm font-bold">{item.title}</span>
                            {item.sub && <span className="block truncate font-mono text-[11px] text-muted">{item.sub}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button type="button" className={`${btn} border-accent/60 text-accent`} onClick={() => setAiOpen(true)}>
                ✦ Referencias con IA{isPro ? "" : ` · ${Math.max(0, aiLimit - aiUsed)} gratis`}
              </button>
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
              {!isPro && (
                <span className={atFreeLimit ? "text-warn" : "text-muted"}>
                  {nodes.length}/{freeLimit}
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
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="max-w-sm">
              <p className="font-display text-lg font-bold">Tu moodboard está vacío</p>
              <p className="mt-2 font-sans text-sm text-muted">
                Añade notas, imágenes, paletas y referencias, o suelta imágenes aquí. Con «+ Del proyecto» traes
                escenas, personajes y localizaciones que se actualizan solas.
              </p>
            </div>
          </div>
        )}

        {(notice || saveError) && (
          <div className="absolute bottom-3 left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 border border-warn/60 bg-bg-raised px-4 py-2 font-sans text-xs shadow-xl" role="alert">
            <span>{notice ?? saveError}</span>
            {saveState === "conflict" ? (
              <button type="button" onClick={() => window.location.reload()} className="font-mono text-[11px] tracking-wider text-accent uppercase underline">
                Recargar
              </button>
            ) : (
              <>
                {!isPro && (notice ?? "").includes("gratuito") && (
                  <Link href="/app/organizacion" className="font-mono text-[11px] tracking-wider text-accent uppercase underline">
                    Ver PRO
                  </Link>
                )}
                <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)} className="text-muted hover:text-fg">
                  ×
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <MoodboardAiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        projectId={projectId}
        isPro={isPro}
        usesLeft={Math.max(0, aiLimit - aiUsed)}
        aiLimit={aiLimit}
        onUsed={() => setAiUsed((n) => n + 1)}
        onBoardVersion={(v) => {
          if (updatedAtRef.current === null && v) updatedAtRef.current = v;
        }}
        onAdd={addProposal}
      />
    </BoardProvider>
  );
}

export default function MoodboardEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Board {...props} />
    </ReactFlowProvider>
  );
}
