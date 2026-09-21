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
import { findFreeSpot } from "@/components/canvas/free-spot";
import { loadImageSize, prepareImage } from "@/components/canvas/image-utils";
import { BoardProvider, CardNodeView, type CardNode } from "@/components/moodboard/nodes";
import { MoodboardAiPanel } from "@/components/moodboard/MoodboardAiPanel";
import { RemoteCursors, type RemoteCursor } from "@/components/project-map/RemoteCursors";
import { cleanColor, cleanName, colorFor, uniquePeers, type Peer } from "@/components/canvas/presence";
import { fetchMoodboard, moodboardVersion, saveMoodboard, uploadMoodboardImage } from "@/lib/actions/moodboard";
import { applyCardOps, diffCards, isEmptyCardOps, rebaseCards, type CardOps } from "@/lib/moodboard-merge";
import { canonical } from "@/lib/project-map-merge";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
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
  // Quién soy (para que los demás me vean: nombre y color del cursor).
  userId: string;
  userName: string;
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

function Board(props: Props) {
  const { projectId, initialCards, initialUpdatedAt, isPro, freeLimit, maxCards, aiLimit, lookup, userId, userName } = props;
  const { screenToFlowPosition, fitView } = useReactFlow<CardNode>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [nodes, setNodes] = useState<CardNode[]>(() => initialCards.map(toNode));
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Lo último que se sabe del servidor (base para calcular qué he cambiado yo) y su versión.
  const lastSaved = useRef<MoodboardCard[]>(initialCards);
  const knownVersion = useRef<string | null>(initialUpdatedAt);
  const savingRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
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
    setDirty(true);
    setSaveState((s) => (s === "error" ? "idle" : s));
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

  // ---- Trabajo en equipo: guardado por cambios, avisos en directo, presencia y cursores
  const currentCards = useCallback(
    (): MoodboardCard[] =>
      nodesRef.current.map((n) => ({
        ...n.data.card,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
        w: Math.round(n.width ?? n.measured?.width ?? n.data.card.w),
        h: Math.round(n.height ?? n.measured?.height ?? n.data.card.h),
      })),
    [],
  );

  // Recibe el tablero del servidor (tras guardar o al enterarse de que alguien cambió algo): se juntan
  // sus cambios con los míos sin guardar.
  const applyRemote = useCallback(
    (remote: MoodboardCard[], version: string | null, sent?: CardOps) => {
      const base = sent ? applyCardOps(lastSaved.current, sent) : lastSaved.current;
      const local = currentCards();
      const merged = rebaseCards(local, base, remote);
      lastSaved.current = remote;
      knownVersion.current = version;
      if (canonical(merged) !== canonical(local)) {
        setNodes((prev) => {
          const old = new Map(prev.map((n) => [n.id, n]));
          return merged.map((c) => {
            const p = old.get(c.id);
            if (!p) return toNode(c);
            const same =
              canonical(p.data.card) === canonical(c) &&
              Math.round(p.position.x) === c.x &&
              Math.round(p.position.y) === c.y &&
              Math.round(p.width ?? p.measured?.width ?? c.w) === c.w &&
              Math.round(p.height ?? p.measured?.height ?? c.h) === c.h;
            return same ? p : { ...p, position: { x: c.x, y: c.y }, width: c.w, height: c.h, data: { card: c } };
          });
        });
      }
      setDirty(!isEmptyCardOps(diffCards(remote, merged)));
    },
    [currentCards],
  );

  const pulling = useRef(false);
  // Si llega un aviso mientras yo guardo o ya estoy pidiendo el tablero, no se pierde: se repite al terminar.
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
        const r = await fetchMoodboard(projectId);
        if (r.ok && r.updatedAt !== knownVersion.current) applyRemote(r.cards, r.updatedAt);
      } while (pullAgain.current && !savingRef.current);
    } catch {
      // Sin conexión: se reintenta en el siguiente aviso o sondeo.
    } finally {
      pulling.current = false;
    }
  }, [applyRemote, projectId]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientId = useRef(crypto.randomUUID());

  const save = useCallback(async () => {
    const ops = diffCards(lastSaved.current, currentCards());
    if (isEmptyCardOps(ops)) {
      setDirty(false);
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    try {
      const result = await saveMoodboard(projectId, ops);
      if (result.ok) {
        setSaveError(null);
        setSaveState("idle");
        applyRemote(result.cards, result.updatedAt, ops);
        // Aviso a los demás (sin datos: ellos piden el tablero al servidor, que comprueba el acceso).
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
  }, [applyRemote, currentCards, projectId, pullRemote]);

  useEffect(() => {
    // Nunca dos guardados a la vez.
    if (!dirty || saveState === "saving" || saveState === "error") return;
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
  }, [dirty, nodes, saveState, save]);

  // Al cerrar o cambiar de pestaña con cambios sin guardar: se intenta guardar y se avisa.
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

  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const [peers, setPeers] = useState<Peer[]>([]);
  const myColor = useMemo(() => colorFor(userId), [userId]);
  const lastCursorSent = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`moodboard:${projectId}`, {
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
        const list: Peer[] = [];
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
  }, [myColor, projectId, pullRemote, userId, userName]);

  // Sondeo de respaldo: si el canal en directo falla, cada 15 s se comprueba si alguien cambió algo.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible" || savingRef.current) return;
      const v = await moodboardVersion(projectId).catch(() => null);
      if (v && v !== knownVersion.current) void pullRemote();
    }, 15_000);
    return () => clearInterval(t);
  }, [projectId, pullRemote]);

  // Los cursores que llevan tiempo quietos, fuera.
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
            return findFreeSpot(
              nodesRef.current.map((n) => ({
                x: n.position.x,
                y: n.position.y,
                w: n.width ?? n.measured?.width ?? n.data.card.w,
                h: n.height ?? n.measured?.height ?? n.data.card.h,
              })),
              c.x,
              c.y,
              rest.w,
              rest.h,
            );
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
    saveState === "error"
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
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
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

          <RemoteCursors cursors={cursors} />
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
              {uniquePeers(peers).length > 0 && (
                <span className="flex items-center gap-1" aria-label={`${uniquePeers(peers).length} personas más en el moodboard`}>
                  {uniquePeers(peers).slice(0, 5).map((p) => (
                    <span
                      key={p.userId}
                      title={`${p.name} está en este moodboard`}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-black"
                      style={{ background: p.color }}
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                </span>
              )}
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
            {!isPro && (notice ?? saveError ?? "").includes("gratuito") && (
              <Link href="/app/organizacion" className="font-mono text-[11px] tracking-wider text-accent uppercase underline">
                Ver PRO
              </Link>
            )}
            <button type="button" aria-label="Cerrar aviso" onClick={() => { setNotice(null); setSaveError(null); }} className="text-muted hover:text-fg">
              ×
            </button>
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
          if (knownVersion.current === null && v) knownVersion.current = v;
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
