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
import { MOODBOARD_AI_EVENT } from "@/components/moodboard/MoodboardAiButton";
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

// El tablero es una mesa de luz: superficie clara (taller-paper) sobre la
// mesa oscura, porque ahí está el trabajo. React Flow toma sus colores de
// estas variables, que salen de los tokens del papel.
const FLOW_THEME = {
  "--xy-background-color": "transparent",
  "--xy-background-pattern-dots-color": "color-mix(in srgb, var(--fg) 18%, transparent)",
  "--xy-minimap-background-color": "var(--bg-raised)",
  "--xy-minimap-mask-background-color": "color-mix(in srgb, var(--fg) 8%, transparent)",
  "--xy-minimap-node-background-color": "color-mix(in srgb, var(--fg) 24%, transparent)",
  "--xy-attribution-background-color": "transparent",
} as React.CSSProperties;

// Los mandos que flotan sobre el tablero (barra, zoom, menús, avisos) son
// piezas del marco: oscuras (taller-ink), como los menús de arriba. Estas
// variables se declaran en el propio elemento de los mandos para que
// var(--bg-raised) etc. se resuelvan con los tokens oscuros.
const CONTROLS_THEME = {
  "--xy-controls-button-background-color": "var(--bg-raised)",
  "--xy-controls-button-background-color-hover": "color-mix(in srgb, var(--fg) 10%, var(--bg-raised))",
  "--xy-controls-button-color": "var(--fg)",
  "--xy-controls-button-color-hover": "var(--fg)",
  "--xy-controls-button-border-color": "color-mix(in srgb, var(--fg) 8%, transparent)",
  "--xy-controls-box-shadow": "0 10px 28px -12px rgb(0 0 0 / 0.55)",
} as React.CSSProperties;

// Sombra de lo que flota sobre el tablero claro (barra, menús, avisos).
const FLOAT_SHADOW = "0 0 0 1px rgb(255 255 255 / 0.06), 0 14px 34px -14px rgb(0 0 0 / 0.6)";

// Cómo se dice un tipo de tarjeta en el recuento de arriba.
const TYPE_LABELS: { types: MoodboardCard["type"][]; one: string; many: string }[] = [
  { types: ["image"], one: "imagen", many: "imágenes" },
  { types: ["reference"], one: "referencia", many: "referencias" },
  { types: ["palette"], one: "paleta", many: "paletas" },
  { types: ["note"], one: "nota", many: "notas" },
  { types: ["scene", "character", "location"], one: "del proyecto", many: "del proyecto" },
];

// «1, 2, 4 y 6»
function listEs(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

// Iconos de trazo (24×24) de la barra de herramientas.
const ICONS = {
  note: "M5 4h14v11l-5 5H5zM14 20v-5h5",
  image: "M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01",
  palette:
    "M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.3-1.8-1.3-3 0-.9.7-1.6 1.7-1.6H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01",
  reference: "M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4",
  project: "M4 7h6l2 2h8v10H4zM12 12v4M10 14h4",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
};

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

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

  // El botón principal de la cabecera (fuera del editor) abre el panel de IA.
  useEffect(() => {
    const open = () => setAiOpen(true);
    window.addEventListener(MOODBOARD_AI_EVENT, open);
    return () => window.removeEventListener(MOODBOARD_AI_EVENT, open);
  }, []);

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

  // ---- Cómo va el tablero (en directo, a partir de las tarjetas)
  const cards = nodes.map((n) => n.data.card);
  const breakdown = TYPE_LABELS.map((t) => {
    const n = cards.filter((c) => t.types.includes(c.type)).length;
    return n > 0 ? `${n} ${n === 1 ? t.one : t.many}` : null;
  }).filter((x): x is string => x !== null);

  // Escenas del guion que ya tienen su tarjeta en el tablero (por id o, si el
  // id cambió, por número, igual que las tarjetas vivas).
  const sceneCardBy = new Map<string, string>();
  for (const n of nodes) {
    const c = n.data.card;
    if (c.type !== "scene") continue;
    const s =
      lookup.scenes.find((x) => x.id === c.refId) ??
      lookup.scenes.find((x) => x.number.toLowerCase() === c.label?.toLowerCase());
    if (s && !sceneCardBy.has(s.id)) sceneCardBy.set(s.id, n.id);
  }
  const missingScenes = lookup.scenes.filter((s) => !sceneCardBy.has(s.id));

  // Tarjetas vivas que apuntan a algo que ya no está en el proyecto.
  const brokenLive = cards.filter((c) => {
    const label = c.label?.toLowerCase();
    if (c.type === "scene")
      return !lookup.scenes.some((s) => s.id === c.refId || s.number.toLowerCase() === label);
    if (c.type === "character")
      return !lookup.characters.some((x) => x.id === c.refId || x.name.toLowerCase() === label);
    if (c.type === "location")
      return !lookup.locations.some((x) => x.id === c.refId || x.name.toLowerCase() === label);
    return false;
  }).length;

  // Toque en un número de escena: si ya está en el tablero, se va a ella; si
  // no, se pone su tarjeta viva.
  function showScene(sceneId: string, number: string) {
    const nodeId = sceneCardBy.get(sceneId);
    if (nodeId) {
      setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === nodeId })));
      void fitView({ nodes: [{ id: nodeId }], padding: 0.8, maxZoom: 1, duration: 400 });
      return;
    }
    addCard({ type: "scene", w: 240, h: 130, refId: sceneId, label: number });
  }

  const status =
    saveState === "error"
      ? { text: "No se ha guardado", tone: "text-danger", dot: "bg-danger" }
      : saveState === "saving"
        ? { text: "Guardando…", tone: "text-muted", dot: "bg-muted motion-safe:animate-pulse" }
        : dirty
          ? { text: "Cambios sin guardar", tone: "text-muted", dot: "bg-warn" }
          : { text: "Guardado", tone: "text-muted", dot: "bg-success" };

  // Botones de la barra (oscura, del marco).
  const tool =
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-sans text-[13px] font-medium text-fg/75 transition-colors hover:bg-fg/[0.08] hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none aria-expanded:bg-fg/[0.08] aria-expanded:text-fg disabled:opacity-50";
  const toolLabel = "hidden md:inline";
  const popover = "menu-panel absolute top-full left-0 z-20 mt-2";
  const popRow =
    "flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-fg/[0.06] focus-visible:bg-fg/[0.06] focus-visible:outline-none";

  const projectItems =
    projectTab === "scenes"
      ? lookup.scenes.map((s) => ({
          key: s.id,
          title: `Escena ${s.number}`,
          sub: s.heading,
          type: "scene" as const,
          label: s.number,
          onBoard: sceneCardBy.has(s.id),
        }))
      : projectTab === "characters"
        ? lookup.characters.map((c) => ({
            key: c.id,
            title: c.name,
            sub: c.actor ?? "Sin actor",
            type: "character" as const,
            label: c.name,
            onBoard: cards.some((x) => x.type === "character" && x.refId === c.id),
          }))
        : lookup.locations.map((l) => ({
            key: l.id,
            title: l.name,
            sub: l.address ?? "",
            type: "location" as const,
            label: l.name,
            onBoard: cards.some((x) => x.type === "location" && x.refId === l.id),
          }));

  // Lo básico de un moodboard que aún no está en el tablero.
  const essentials = [
    { type: "palette", label: "una paleta de color" },
    { type: "image", label: "imágenes" },
    { type: "reference", label: "referencias" },
  ].filter((e) => !cards.some((c) => c.type === e.type));

  const others = uniquePeers(peers);
  const sceneCount = lookup.scenes.length;
  const covered = sceneCount - missingScenes.length;

  return (
    <BoardProvider value={ctx}>
      {/* ---- Cómo va: recuento, guardado y quién más está, sobre la mesa. */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <p className="font-sans text-sm text-muted">
          <span className="font-display text-xl font-bold text-fg tabular-nums">{nodes.length}</span>{" "}
          {nodes.length === 1 ? "tarjeta" : "tarjetas"}
          {!isPro && <span className={atFreeLimit ? "text-warn" : undefined}> de {freeLimit} en el plan gratuito</span>}
          {breakdown.length > 0 && <span className="hidden sm:inline"> · {breakdown.join(" · ")}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-xs">
          {others.length > 0 && (
            <span className="flex items-center gap-2 text-muted">
              <span className="flex -space-x-1.5" aria-hidden>
                {others.slice(0, 5).map((p) => (
                  <span
                    key={p.userId}
                    title={`${p.name} está en este moodboard`}
                    className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold text-[#17171b] ring-2 ring-bg"
                    style={{ background: p.color }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </span>
              {others.length === 1 ? `${others[0].name} está aquí` : `${others.length} personas más aquí`}
            </span>
          )}
          {!isPro && (
            <span className={aiLimit - aiUsed > 0 ? "text-muted" : "text-muted/70"}>
              {Math.max(0, aiLimit - aiUsed) === 1
                ? "1 sugerencia de IA gratis"
                : `${Math.max(0, aiLimit - aiUsed)} sugerencias de IA`}
            </span>
          )}
          <span className={`flex items-center gap-1.5 ${status.tone}`} role="status">
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
            {status.text}
          </span>
          {saveState === "error" && (
            <button type="button" onClick={() => void save()} className="link-action text-accent">
              Reintentar
            </button>
          )}
        </div>
      </div>

      {/* Qué escenas del guion ya tienen su tarjeta: se ve de un vistazo y un
          toque pone la que falta (o lleva a la que ya está). */}
      {sceneCount > 0 && (
        <div
          className={`mt-4 border-l-2 pl-3 ${missingScenes.length > 0 && nodes.length > 0 ? "border-warn" : "border-line"}`}
        >
          <p className="font-sans text-[13px] leading-relaxed text-fg">
            {missingScenes.length === 0 ? (
              <>Las {sceneCount} escenas del guion tienen su tarjeta en el tablero.</>
            ) : covered === 0 ? (
              <>
                Ninguna escena del guion está aún en el tablero.{" "}
                <span className="text-muted">Toca un número para traerla, con su encabezado y descripción.</span>
              </>
            ) : (
              <>
                {covered} de {sceneCount} escenas tienen tarjeta
                {missingScenes.length <= 8 && (
                  <>
                    {" "}
                    · {missingScenes.length === 1 ? "falta la escena" : "faltan las escenas"}{" "}
                    {listEs(missingScenes.map((s) => s.number))}
                  </>
                )}
                . <span className="text-muted">Toca un número para traerla o encontrarla.</span>
              </>
            )}
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Escenas del guion">
            {lookup.scenes.map((s) => {
              const on = sceneCardBy.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => showScene(s.id, s.number)}
                    title={`${on ? "Ver" : "Añadir al tablero"}: escena ${s.number} · ${s.heading}`}
                    aria-label={`Escena ${s.number}${on ? ", ya en el tablero: ver" : ": añadir al tablero"}`}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-mono text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                      on
                        ? "bg-accent text-bg hover:opacity-90"
                        : "text-muted ring-1 ring-line ring-inset hover:text-fg hover:ring-accent"
                    }`}
                  >
                    {s.number}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {nodes.length > 0 && essentials.length > 0 && (
        <p className="mt-3 border-l-2 border-line pl-3 font-sans text-[13px] text-muted">
          Aún no hay {listEs(essentials.map((e) => e.label))} en el tablero.
        </p>
      )}

      {brokenLive > 0 && (
        <p className="mt-3 border-l-2 border-warn pl-3 font-sans text-[13px] text-fg">
          {brokenLive === 1
            ? "1 tarjeta apunta a algo que ya no existe en el proyecto"
            : `${brokenLive} tarjetas apuntan a algo que ya no existe en el proyecto`}
          <span className="text-muted"> · está marcada en ámbar en el tablero; puedes quitarla.</span>
        </p>
      )}

      {/* ---- La mesa de luz: el tablero en claro (taller-paper) sobre la mesa
          oscura, con sombra profunda como una hoja; las tarjetas son papeles y
          fotos encima. Los mandos que flotan son del marco: oscuros. */}
      <div
        ref={wrapperRef}
        className="taller-paper relative mt-6 h-[calc(100dvh-18rem)] min-h-[520px] overflow-hidden rounded-xl"
        style={{
          background: "#e6e4df",
          boxShadow: "0 0 0 1px rgb(255 255 255 / 0.04), 0 30px 60px -30px rgb(0 0 0 / 0.9)",
        }}
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
          colorMode="light"
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
          style={FLOW_THEME}
        >
          <Background gap={24} size={1.3} />
          <Controls
            showInteractive={false}
            className="taller-ink overflow-hidden rounded-lg"
            style={CONTROLS_THEME}
            aria-label="Zoom del tablero"
          />
          {nodes.length > 0 && (
            <MiniMap
              pannable
              zoomable
              ariaLabel="Mapa del tablero"
              className="hidden! overflow-hidden rounded-lg shadow-[0_10px_28px_-14px_rgb(0_0_0/0.5)] sm:block!"
              style={{ width: 168, height: 112 }}
            />
          )}

          <RemoteCursors cursors={cursors} />
          <Panel position="top-left" className="m-3! max-w-[calc(100%-1.5rem)]">
            <div
              className="taller-ink flex flex-wrap items-center gap-0.5 rounded-xl bg-bg-raised p-1 text-fg"
              style={{ boxShadow: FLOAT_SHADOW }}
              role="toolbar"
              aria-label="Añadir al tablero"
            >
              <span className="eyebrow hidden px-2.5 lg:inline">Añadir</span>
              <button
                type="button"
                className={tool}
                title="Nota"
                onClick={() =>
                  addCard({
                    type: "note",
                    w: 220,
                    h: 150,
                    color: NOTE_COLORS[0],
                  })
                }
              >
                <Icon d={ICONS.note} />
                <span className={toolLabel}>Nota</span>
              </button>
              <div className="relative">
                <button
                  type="button"
                  className={tool}
                  title="Imagen"
                  onClick={() => setMenu(menu === "image" ? null : "image")}
                  aria-expanded={menu === "image"}
                  aria-haspopup="true"
                >
                  <Icon d={ICONS.image} />
                  <span className={toolLabel}>{uploading > 0 ? "Subiendo…" : "Imagen"}</span>
                </button>
                {menu === "image" && (
                  <div className={`${popover} w-[min(20rem,calc(100vw-3rem))]`}>
                    <button type="button" className={popRow} onClick={() => fileRef.current?.click()}>
                      <span className="mt-0.5 text-accent">
                        <Icon d={ICONS.upload} />
                      </span>
                      <span>
                        <span className="block font-sans text-sm font-medium text-fg">Subir desde el dispositivo</span>
                        <span className="block font-sans text-xs text-muted">JPG, PNG o WebP · hasta 5 a la vez</span>
                      </span>
                    </button>
                    <div className="mt-1 border-t border-line px-2.5 pt-3 pb-2">
                      <label htmlFor="mb-image-url" className="eyebrow">
                        O pega un enlace
                      </label>
                      <div className="mt-1.5 flex gap-1.5">
                        <input
                          id="mb-image-url"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && void addImageUrl()}
                          placeholder="https://…/imagen.jpg"
                          className="field min-w-0 flex-1 px-2.5 py-1.5 text-xs"
                        />
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => void addImageUrl()}>
                          Añadir
                        </button>
                      </div>
                      <p className="mt-2.5 font-sans text-xs text-muted">
                        También puedes arrastrar imágenes al tablero.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={tool}
                title="Paleta de color"
                onClick={() =>
                  addCard({
                    type: "palette",
                    w: 300,
                    h: 150,
                    title: "Paleta",
                    colors: ["#1f2a44", "#c8553d", "#f2d0a4", "#588b8b", "#ffffff"],
                  })
                }
              >
                <Icon d={ICONS.palette} />
                <span className={toolLabel}>Paleta</span>
              </button>
              <button
                type="button"
                className={tool}
                title="Referencia (película, foto, cuadro…)"
                onClick={() =>
                  addCard({
                    type: "reference",
                    w: 270,
                    h: 210,
                    kind: "Película",
                  })
                }
              >
                <Icon d={ICONS.reference} />
                <span className={toolLabel}>Referencia</span>
              </button>
              <span className="mx-1 h-5 w-px bg-fg/10" aria-hidden />
              <div className="relative">
                <button
                  type="button"
                  className={tool}
                  title="Escenas, personajes y lugares del proyecto"
                  onClick={() => setMenu(menu === "project" ? null : "project")}
                  aria-expanded={menu === "project"}
                  aria-haspopup="true"
                >
                  <Icon d={ICONS.project} />
                  <span className={toolLabel}>Del proyecto</span>
                </button>
                {menu === "project" && (
                  <div className={`${popover} w-[min(21rem,calc(100vw-3rem))] p-0!`}>
                    <p className="px-4 pt-3 font-sans text-xs leading-relaxed text-muted">
                      Tarjetas vivas: si cambias la escena o el personaje, la tarjeta se actualiza sola.
                    </p>
                    <div className="mt-2 flex gap-4 border-b border-line px-4" role="tablist">
                      {(
                        [
                          ["scenes", "Escenas", lookup.scenes.length],
                          ["characters", "Personajes", lookup.characters.length],
                          ["locations", "Lugares", lookup.locations.length],
                        ] as const
                      ).map(([id, label, count]) => (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={projectTab === id}
                          onClick={() => setProjectTab(id)}
                          className={`-mb-px border-b-2 py-2 font-sans text-[13px] font-medium transition-colors ${projectTab === id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
                        >
                          {label}
                          <span className="ml-1 font-mono text-[10px] text-muted">{count}</span>
                        </button>
                      ))}
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      {projectItems.length === 0 ? (
                        <p className="px-2.5 py-4 font-sans text-xs text-muted">
                          Todavía no hay nada de esto en el proyecto.
                        </p>
                      ) : (
                        projectItems.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              addCard({
                                type: item.type,
                                w: 240,
                                h: 130,
                                refId: item.key,
                                label: item.label,
                              })
                            }
                            className={popRow}
                          >
                            <span className="min-w-0">
                              <span className="block font-sans text-sm font-medium text-fg">{item.title}</span>
                              {item.sub && (
                                <span className="block truncate font-sans text-xs text-muted">{item.sub}</span>
                              )}
                            </span>
                            {item.onBoard ? (
                              <span className="ml-auto shrink-0 self-center font-mono text-[10px] tracking-wider text-accent uppercase">
                                En el tablero
                              </span>
                            ) : (
                              <span className="ml-auto self-center font-sans text-lg leading-none text-muted" aria-hidden>
                                +
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
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
            {menu && (
              <button
                type="button"
                aria-label="Cerrar menú"
                className="fixed inset-0 -z-10 cursor-default"
                onClick={() => setMenu(null)}
              />
            )}
          </Panel>
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 pt-24 text-center">
            <div className="max-w-md">
              <p className="eyebrow">Tablero vacío</p>
              <p className="mt-2 font-display text-2xl leading-tight font-bold text-fg">
                Empieza con la primera referencia
              </p>
              <p className="mx-auto mt-3 max-w-sm font-sans text-sm leading-relaxed text-muted">
                Arrastra fotos desde tu ordenador, usa la barra de arriba o pide a la IA una primera tanda de
                referencias a partir de tu sinopsis y tus escenas.
              </p>
              <div className="pointer-events-auto mt-6 flex flex-wrap items-center justify-center gap-2">
                <button type="button" className="btn btn-primary" onClick={() => setAiOpen(true)}>
                  ✦ Proponer referencias con IA
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    addCard({
                      type: "note",
                      w: 220,
                      h: 150,
                      color: NOTE_COLORS[0],
                    })
                  }
                >
                  Escribir una nota
                </button>
              </div>
            </div>
          </div>
        )}

        {(notice || saveError) && (
          <div
            className="taller-ink absolute bottom-4 left-1/2 z-20 flex w-max max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-r-lg border-l-2 border-warn bg-bg-raised py-2.5 pr-3 pl-4 font-sans text-[13px] text-fg"
            style={{ boxShadow: FLOAT_SHADOW }}
            role="alert"
          >
            <span>{notice ?? saveError}</span>
            {!isPro && (notice ?? saveError ?? "").includes("gratuito") && (
              <Link href="/app/organizacion" className="link-action shrink-0 text-accent">
                Ver PRO
              </Link>
            )}
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => {
                setNotice(null);
                setSaveError(null);
              }}
              className="shrink-0 rounded px-1 text-lg leading-none text-muted hover:text-fg"
            >
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
