"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, Columns2, Download, FileText, Filter, Keyboard, Loader2, Lock, PanelRightClose,
  PanelRightOpen, Search, Share2,
} from "lucide-react";
import type { CorrectionCategory, CorrectionStatus } from "@prisma/client";
import { contentRect, type Shape } from "@/lib/domain/annotation";
import { CATEGORY_LABEL, CORRECTION_STATUS, VERSION_STATUS } from "@/lib/domain/labels";
import { formatClock, formatTimecode } from "@/lib/domain/timecode";
import { fmtDateTime } from "@/lib/format";
import { cx } from "@/components/ui/cx";
import { Tape } from "@/components/ui/chip";
import { DownloadButton } from "@/components/work/download-button";
import { DrawingSurface, ShapesSvg, type Tool } from "./annotation";
import { Composer, EMPTY_DRAFT, type Draft } from "./composer";
import { Controls, DrawToolbar } from "./controls";
import { DecisionDialog, NoteDialog, ShortcutsDialog } from "./dialogs";
import { Timeline, type Marker } from "./timeline";
import { STATUS_COLOR, Thread } from "./thread";
import { apiFetch, apiUrl, type Payload, type ReviewComment } from "./types";
import { useDraft } from "./use-draft";
import { usePlayer } from "./use-player";

type Sort = "time" | "oldest" | "activity";
type StatusFilter = "all" | "open" | "resolved" | "done" | "none";

export function ReviewRoom({
  initial,
  versionHrefBase,
  backHref,
  backLabel,
  initialCommentId,
  reportHref,
}: {
  initial: Payload;
  versionHrefBase: string;
  backHref: string;
  backLabel: string;
  initialCommentId?: string | null;
  reportHref: string;
}) {
  const [p, setP] = useState<Payload>(initial);
  const linkId = p.me.linkId;
  const versionId = p.version.id;
  const fps = p.version.fps;
  const frameApprox = !fps || !p.version.fpsVerified;
  const player = usePlayer(fps, p.version.durationMs);
  const [mediaUrl, setMediaUrl] = useState(p.media?.url ?? "");
  const restoreAt = useRef<number | null>(null);
  const mediaRetries = useRef(0);

  const [selectedId, setSelectedId] = useState<string | null>(initialCommentId ?? null);
  const [draft, setDraft, clearDraft] = useDraft<Draft>(`corte:draft:${versionId}`, EMPTY_DRAFT);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState("#FFD23F");
  const [redo, setRedo] = useState<Shape[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [toast, setToast] = useState("");

  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [catF, setCatF] = useState<CorrectionCategory | "all">("all");
  const [authorF, setAuthorF] = useState("all");
  const [visF, setVisF] = useState<"all" | "INTERNAL" | "CLIENT">("all");
  const [drawF, setDrawF] = useState(false);
  const [sort, setSort] = useState<Sort>("time");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [showFrames, setShowFrames] = useState(!!fps);
  const [loopOn, setLoopOn] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [focus, setFocus] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelW, setPanelW] = useState(384);
  const [mobileTab, setMobileTab] = useState<"comments" | "info">("comments");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "APPROVED" | "CHANGES_REQUESTED" | "publish" | "internal" | "shortcuts">(null);

  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const fmt = useCallback((ms: number) => (showFrames && fps ? formatTimecode(ms, fps) : formatClock(ms, true)), [showFrames, fps]);

  // ── Datos ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const next = await apiFetch<Payload>(`/api/review/${versionId}`, linkId, { method: "GET" });
      setP(next);
      return next;
    } catch (e) {
      setToast((e as Error).message);
      return null;
    }
  }, [versionId, linkId]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && !sending) void refresh();
    }, 15000);
    return () => clearInterval(id);
  }, [refresh, sending]);

  // Si la URL firmada caduca o falla, pedimos otra y volvemos al mismo punto.
  useEffect(() => {
    if (player.state.status !== "error" || mediaRetries.current >= 2) return;
    mediaRetries.current++;
    restoreAt.current = player.state.timeMs;
    void refresh().then((next) => next?.media?.url && setMediaUrl(next.media.url));
  }, [player.state.status, player.state.timeMs, refresh]);

  useEffect(() => {
    const v = player.ref.current;
    if (!v) return;
    const onMeta = () => {
      if (restoreAt.current != null) {
        v.currentTime = restoreAt.current / 1000;
        restoreAt.current = null;
      }
    };
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [player.ref, mediaUrl]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Tamaño del escenario y área real de la imagen ──────────────────────
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStageSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mediaW = player.state.videoWidth || p.version.width || 16;
  const mediaH = player.state.videoHeight || p.version.height || 9;
  const rect = contentRect(stageSize.w, stageSize.h, mediaW, mediaH);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    try {
      const w = Number(localStorage.getItem("corte:panelW"));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en el navegador
      if (w >= 300 && w <= 640) setPanelW(w);
    } catch {
      /* ignorar */
    }
  }, []);

  // ── Comentarios: numeración, filtros, orden ────────────────────────────
  const roots = useMemo(() => {
    const r = p.comments.filter((c) => !c.parentId);
    return [...r].sort((a, b) => (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) || a.createdAt.localeCompare(b.createdAt));
  }, [p.comments]);
  const number = useMemo(() => new Map(roots.map((c, i) => [c.id, i + 1])), [roots]);
  const repliesOf = useMemo(() => {
    const m = new Map<string, ReviewComment[]>();
    for (const c of p.comments) if (c.parentId) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c]);
    return m;
  }, [p.comments]);
  const authors = useMemo(() => [...new Set(p.comments.map((c) => c.author.name))].sort(), [p.comments]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const statusOk = (s: CorrectionStatus | undefined) => {
      if (statusF === "all") return true;
      if (statusF === "none") return !s;
      if (!s) return false;
      if (statusF === "open") return s === "PENDING" || s === "IN_PROGRESS";
      if (statusF === "resolved") return s === "RESOLVED";
      return s === "VERIFIED" || s === "DISMISSED";
    };
    const list = roots.filter((c) => {
      if (!statusOk(c.correction?.status)) return false;
      if (catF !== "all" && c.correction?.category !== catF) return false;
      if (authorF !== "all" && c.author.name !== authorF && !(repliesOf.get(c.id) ?? []).some((r) => r.author.name === authorF)) return false;
      if (visF !== "all" && c.visibility !== visF) return false;
      if (drawF && !c.annotation) return false;
      if (needle) {
        const hay = [c.body, c.author.name, ...(repliesOf.get(c.id) ?? []).flatMap((r) => [r.body, r.author.name])].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    if (sort === "oldest") return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (sort === "activity") return [...list].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return list;
  }, [roots, repliesOf, q, statusF, catF, authorF, visF, drawF, sort]);
  const activeFilters = [statusF !== "all", catF !== "all", authorF !== "all", visF !== "all", drawF].filter(Boolean).length;

  const selected = selectedId ? p.comments.find((c) => c.id === selectedId) ?? null : null;

  const select = useCallback(
    (c: ReviewComment, seek = true) => {
      setSelectedId(c.id);
      if (seek && c.timeMs != null) {
        player.pause();
        player.seek(c.timeMs);
        if (c.endMs != null) player.setLoop(loopOn ? { start: c.timeMs, end: c.endMs } : null);
      }
      const url = new URL(window.location.href);
      url.searchParams.set("c", c.id);
      window.history.replaceState(null, "", url);
      document.getElementById(`c-${c.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [player, loopOn],
  );

  // Deep link ?c=… : ir al comentario cuando el vídeo tenga metadatos.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !initialCommentId || player.state.status === "loading") return;
    const c = p.comments.find((x) => x.id === initialCommentId);
    if (!c) return;
    deepLinked.current = true;
    const root = c.parentId ? p.comments.find((x) => x.id === c.parentId) ?? c : c;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con el reproductor (sistema externo) cuando ya tiene metadatos
    select(root);
    document.getElementById(`c-${c.id}`)?.classList.add("flash-marker");
  }, [initialCommentId, p.comments, player.state.status, select]);

  // ── Marcadores ─────────────────────────────────────────────────────────
  const markers: Marker[] = useMemo(
    () =>
      roots
        .filter((c) => c.timeMs != null && !c.deleted)
        .map((c) => ({
          id: c.id,
          start: c.timeMs!,
          end: c.endMs,
          color: c.correction ? STATUS_COLOR[c.correction.status] : "#A6ADB8",
          internal: c.visibility === "INTERNAL",
          selected: c.id === selectedId,
          label: `#${number.get(c.id)} ${c.author.name}: ${c.body.slice(0, 60)}`,
        })),
    [roots, selectedId, number],
  );

  // ── Composición ────────────────────────────────────────────────────────
  const forcedInternal = p.me.internal && !p.version.publishedAt;
  const composerInternal = forcedInternal || draft.visibility === "INTERNAL";
  const mentionPeople = composerInternal ? p.internalParticipants : p.participants;
  const composerRange = draft.mode === "range" ? draft.range : null;

  const captureTime = () => {
    if (player.state.playing) player.pause();
    if (!draft.body && draft.mode === "instant") setDraft((d) => ({ ...d, timeMs: player.now() }));
  };

  const startDrawing = () => {
    player.pause();
    setDrawing(true);
    setSelectedId(null);
    const now = player.now();
    setDraft((d) => ({ ...d, mode: d.mode === "general" ? "instant" : d.mode, timeMs: d.shapes.length ? d.timeMs : now }));
  };

  const send = async () => {
    if (!draft.body.trim() || sending) return;
    setSending(true);
    setSendError("");
    const timeMs = draft.mode === "general" ? null : draft.mode === "range" ? (draft.range?.start ?? player.now()) : (draft.timeMs ?? player.now());
    const endMs = draft.mode === "range" ? (draft.range?.end ?? null) : null;
    const mentionIds = draft.mentionIds.filter((id) => {
      const person = mentionPeople.find((x) => x.id === id);
      return person && draft.body.includes(`@${person.name}`);
    });
    try {
      const res = await apiFetch<{ id: string }>(`/api/review/${versionId}/comments`, linkId, {
        method: "POST",
        body: JSON.stringify({
          body: draft.body,
          timeMs: timeMs != null ? Math.round(timeMs) : null,
          endMs: endMs != null ? Math.round(endMs) : null,
          visibility: composerInternal ? "INTERNAL" : "CLIENT",
          annotation: draft.shapes.length && draft.mode !== "general" ? { v: 1, shapes: draft.shapes } : null,
          isCorrection: draft.isCorrection,
          category: draft.category,
          mentionIds,
        }),
      });
      const keepVisibility = draft.visibility;
      clearDraft();
      setDraft({ ...EMPTY_DRAFT, visibility: keepVisibility });
      setDrawing(false);
      setRedo([]);
      setComposerOpen(false);
      setSelectedId(res.id);
      await refresh();
      setToast("Comentario enviado");
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const mutate = async (path: string, method: string, body?: unknown, ok?: string) => {
    await apiFetch(path, linkId, { method, body: body ? JSON.stringify(body) : undefined });
    await refresh();
    if (ok) setToast(ok);
  };

  // ── Teclado ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (dialog || t.closest("input, textarea, select, [contenteditable=true], dialog")) return;
      const k = e.key;
      if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === "z" && drawing) {
        e.preventDefault();
        if (e.shiftKey) {
          if (redo.length) {
            setDraft((d) => ({ ...d, shapes: [...d.shapes, redo[redo.length - 1]] }));
            setRedo((r) => r.slice(0, -1));
          }
        } else if (draft.shapes.length) {
          setRedo((r) => [...r, draft.shapes[draft.shapes.length - 1]]);
          setDraft((d) => ({ ...d, shapes: d.shapes.slice(0, -1) }));
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const step = e.shiftKey ? 10 : 1;
      switch (k) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          player.toggle();
          break;
        case "ArrowLeft":
          e.preventDefault();
          player.step(-step);
          break;
        case "ArrowRight":
          e.preventDefault();
          player.step(step);
          break;
        case "j":
        case "J":
          player.jump(-5000);
          break;
        case "l":
        case "L":
          player.jump(5000);
          break;
        case "i":
        case "I": {
          const now = player.now();
          setDraft((d) => ({ ...d, mode: "range", range: { start: now, end: Math.max(now + 500, d.range?.end ?? now + 3000) } }));
          break;
        }
        case "o":
        case "O": {
          const now = player.now();
          setDraft((d) => ({ ...d, mode: "range", range: { start: Math.min(d.range?.start ?? Math.max(0, now - 3000), now - 100), end: now } }));
          break;
        }
        case "r":
        case "R":
          toggleLoop();
          break;
        case "c":
        case "C":
          e.preventDefault();
          (document.querySelector("#composer textarea") as HTMLTextAreaElement | null)?.focus();
          break;
        case "d":
        case "D":
          if (p.perms.comment) {
            if (drawing) setDrawing(false);
            else startDrawing();
          }
          break;
        case "m":
        case "M":
          player.toggleMute();
          break;
        case "z":
        case "Z":
          setZoom((z) => (z === 1 ? 1.5 : z === 1.5 ? 2 : z === 2 ? 3 : 1));
          setPan({ x: 0, y: 0 });
          break;
        case "f":
          toggleFullscreen();
          break;
        case "F":
          setFocus((f) => !f);
          break;
        case "[":
        case "]": {
          const timed = roots.filter((c) => c.timeMs != null && !c.deleted);
          if (!timed.length) break;
          const now = player.now();
          const target = k === "]" ? timed.find((c) => c.timeMs! > now + 50) ?? timed[0] : [...timed].reverse().find((c) => c.timeMs! < now - 50) ?? timed[timed.length - 1];
          select(target);
          break;
        }
        case "?":
          setDialog("shortcuts");
          break;
        case "Escape":
          if (drawing) setDrawing(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function toggleLoop() {
    const r = composerRange ?? (selected?.endMs != null ? { start: selected.timeMs!, end: selected.endMs } : null);
    if (!r) {
      setToast("Marca un tramo (I / O) o elige un comentario de tramo para repetirlo");
      return;
    }
    const next = !loopOn;
    setLoopOn(next);
    player.setLoop(next ? r : null);
    if (next) {
      player.seek(r.start);
      player.play();
    }
  }

  useEffect(() => {
    if (loopOn && composerRange) player.setLoop(composerRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerRange?.start, composerRange?.end, loopOn]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.().catch(() => setToast("Tu navegador no permite pantalla completa aquí"));
  }

  // ── Anotación visible ──────────────────────────────────────────────────
  const near = (ms: number | null) => ms != null && Math.abs(player.state.timeMs - ms) < Math.max(120, 1000 / (fps ?? 30) + 20);
  const shownShapes: Shape[] = drawing
    ? []
    : !player.state.playing && selected?.annotation && near(selected.timeMs)
      ? selected.annotation.shapes
      : !player.state.playing && draft.shapes.length && near(draft.timeMs)
        ? draft.shapes
        : [];

  // ── Derivados de la versión ────────────────────────────────────────────
  const openCount =
    p.comments.filter((c) => c.correction && (c.correction.status === "PENDING" || c.correction.status === "IN_PROGRESS") && c.visibility === "CLIENT" && !c.deleted).length +
    p.priorCorrections.filter((c) => (c.status === "PENDING" || c.status === "IN_PROGRESS") && c.visibility === "CLIENT").length;
  const resolvedCount = p.comments.filter((c) => c.correction?.status === "RESOLVED" && !c.deleted).length;
  const vs = VERSION_STATUS[p.version.status];
  const locked = !!p.version.lockedAt;
  const kind = p.perms.team ? "team" : p.perms.reviewer ? "reviewer" : null;
  const isApproved = p.piece.approvedVersionId === versionId;
  const others = p.versions.filter((v) => v.id !== versionId);
  const disabledReason = !p.perms.comment
    ? locked
      ? "Esta versión está aprobada: su conversación queda cerrada."
      : p.me.kind === "guest"
        ? "Este enlace es solo de visualización."
        : "No puedes comentar en esta versión."
    : null;

  const verTag = (id: string) =>
    p.me.internal
      ? [id === p.piece.currentVersionId && "Actual", id === p.piece.clientVersionId && "Cliente", id === p.piece.approvedVersionId && "Aprobada"].filter(Boolean).join(" · ")
      : id === p.piece.approvedVersionId
        ? "Aprobada"
        : "";

  const panel = (
    <>
      <div className="flex items-center gap-1 border-b border-c-line px-2 lg:hidden" role="tablist">
        {(
          [
            ["comments", `Comentarios (${roots.filter((c) => !c.deleted).length})`],
            ["info", "Versión y decisiones"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={mobileTab === k} onClick={() => setMobileTab(k)} className={cx("h-10 px-3 text-[13px]", mobileTab === k ? "border-b-2 border-marker text-c-ink" : "text-c-ink-3")}>
            {label}
          </button>
        ))}
      </div>
      <div className={cx("min-h-0 flex-1 flex-col", mobileTab === "comments" ? "flex" : "hidden lg:flex")}>
        <div className="flex items-center gap-2 border-b border-c-line px-3 py-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-c-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar texto o persona"
              aria-label="Buscar en comentarios"
              className="h-8 w-full rounded-md border border-c-line bg-c-bg pr-2 pl-7 text-[13px] text-c-ink placeholder:text-c-ink-3 focus:border-marker/60 focus:outline-none"
            />
          </div>
          <button type="button" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} className={cx("inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px]", activeFilters ? "bg-marker/15 text-marker" : "text-c-ink-2 hover:bg-white/10")}>
            <Filter className="size-3.5" /> {activeFilters ? activeFilters : "Filtros"}
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar" className="h-8 rounded-md border border-c-line bg-c-bg px-1.5 text-[12px] text-c-ink-2">
            <option value="time">Por tiempo</option>
            <option value="oldest">Por antigüedad</option>
            <option value="activity">Por actividad</option>
          </select>
        </div>
        {filtersOpen && (
          <div className="grid grid-cols-2 gap-2 border-b border-c-line bg-c-panel-2 px-3 py-2 text-[12px]">
            <select value={statusF} onChange={(e) => setStatusF(e.target.value as StatusFilter)} aria-label="Estado" className="h-8 rounded border border-c-line bg-c-bg px-1.5 text-c-ink-2">
              <option value="all">Todos los estados</option>
              <option value="open">Abiertas</option>
              <option value="resolved">Resueltas por el equipo</option>
              <option value="done">Verificadas o descartadas</option>
              <option value="none">Sin corrección</option>
            </select>
            <select value={catF} onChange={(e) => setCatF(e.target.value as CorrectionCategory | "all")} aria-label="Categoría" className="h-8 rounded border border-c-line bg-c-bg px-1.5 text-c-ink-2">
              <option value="all">Todas las categorías</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select value={authorF} onChange={(e) => setAuthorF(e.target.value)} aria-label="Participante" className="h-8 rounded border border-c-line bg-c-bg px-1.5 text-c-ink-2">
              <option value="all">Todas las personas</option>
              {authors.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {p.me.internal ? (
              <select value={visF} onChange={(e) => setVisF(e.target.value as "all" | "INTERNAL" | "CLIENT")} aria-label="Visibilidad" className="h-8 rounded border border-c-line bg-c-bg px-1.5 text-c-ink-2">
                <option value="all">Internos y cliente</option>
                <option value="INTERNAL">Solo internos</option>
                <option value="CLIENT">Solo visibles al cliente</option>
              </select>
            ) : (
              <span />
            )}
            <label className="col-span-2 flex items-center gap-2 text-c-ink-2">
              <input type="checkbox" checked={drawF} onChange={(e) => setDrawF(e.target.checked)} className="accent-[var(--marker)]" /> Solo con dibujo
            </label>
            {activeFilters > 0 && (
              <button type="button" className="col-span-2 justify-self-start text-c-ink-3 underline" onClick={() => { setStatusF("all"); setCatF("all"); setAuthorF("all"); setVisF("all"); setDrawF(false); }}>
                Quitar filtros
              </button>
            )}
          </div>
        )}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          {visible.length ? (
            visible.map((c) => (
              <Thread
                key={c.id}
                c={c}
                n={number.get(c.id) ?? 0}
                replies={repliesOf.get(c.id) ?? []}
                selected={c.id === selectedId}
                onSelect={() => select(c)}
                fmt={fmt}
                kind={kind}
                canComment={p.perms.comment}
                locked={locked}
                team={p.perms.team}
                assignees={p.internalParticipants}
                people={c.visibility === "INTERNAL" ? p.internalParticipants : p.participants}
                versionId={versionId}
                canWithdrawOthers={p.perms.share}
                onReply={async (parentId, body, mentionIds) => {
                  await apiFetch(`/api/review/${versionId}/comments`, linkId, { method: "POST", body: JSON.stringify({ body, parentId, mentionIds }) });
                  await refresh();
                }}
                onEdit={(id, body) => mutate(`/api/review/comments/${id}`, "PATCH", { body }, "Comentario editado")}
                onWithdraw={(id) => mutate(`/api/review/comments/${id}`, "DELETE", undefined, "Comentario retirado")}
                onCorrection={(id, patch) => mutate(`/api/review/corrections/${id}`, "PATCH", patch)}
              />
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-c-ink-2">{roots.length ? "Ningún comentario coincide." : "Todavía no hay comentarios."}</p>
              {!roots.length && p.perms.comment && (
                <p className="mx-auto mt-2 max-w-64 text-[13px] text-c-ink-3">Pausa el vídeo en el momento que quieras cambiar, escribe abajo y, si ayuda, dibuja sobre la imagen.</p>
              )}
            </div>
          )}
        </div>
        {!composerOpen && !draft.body && !drawing && p.perms.comment && (
          <button
            type="button"
            onClick={() => {
              setComposerOpen(true);
              captureTime();
              requestAnimationFrame(() => (document.querySelector("#composer textarea") as HTMLTextAreaElement | null)?.focus());
            }}
            className="m-2 flex h-11 items-center gap-2 rounded-md border border-c-line bg-c-bg px-3 text-left text-sm text-c-ink-3 lg:hidden"
          >
            Escribe un comentario en {fmt(player.state.timeMs)}…
          </button>
        )}
        <div className={cx(!composerOpen && !draft.body && !drawing && p.perms.comment && "hidden lg:block")}>
        <Composer
          draft={draft}
          setDraft={setDraft}
          fmt={fmt}
          currentMs={player.state.timeMs}
          onFocusCapture={captureTime}
          onToggleDraw={() => (drawing ? setDrawing(false) : startDrawing())}
          drawing={drawing}
          canInternal={p.perms.internalComments}
          forcedInternal={forcedInternal}
          internal={p.me.internal}
          people={mentionPeople}
          onSend={send}
          sending={sending}
          error={sendError}
          disabledReason={disabledReason}
        />
        </div>
      </div>
      <div className={cx("scroll-thin min-h-0 flex-1 overflow-y-auto", mobileTab === "info" ? "block" : "hidden")}>
        <VersionInfo p={p} fmt={fmt} versionHrefBase={versionHrefBase} onRevoke={async (id) => {
          const reason = prompt("Motivo de la revocación (queda en el historial):");
          if (reason) await mutate(`/api/review/approvals/${id}/revoke`, "POST", { reason }, "Aprobación revocada");
        }} />
      </div>
    </>
  );

  return (
    <div ref={root} className="cine fixed inset-0 flex flex-col bg-c-bg text-c-ink">
      {/* Barra superior */}
      {!focus && (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-c-line px-2 sm:px-3">
          <Link href={backHref} className="inline-flex min-w-0 items-center gap-1 rounded-md py-1 pr-2 pl-1 text-c-ink-2 hover:bg-white/8 hover:text-c-ink" title={backLabel}>
            <ChevronLeft className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block max-w-[38vw] truncate text-[13px] font-semibold text-c-ink sm:max-w-64">{p.piece.title}</span>
              <span className="hidden truncate text-[11px] text-c-ink-3 sm:block">{p.piece.projectName}</span>
            </span>
          </Link>
          <div className="relative">
            <button type="button" onClick={() => setVersionsOpen((o) => !o)} aria-expanded={versionsOpen} aria-label="Cambiar de versión" className="inline-flex items-center gap-1 rounded-md p-1 hover:bg-white/8">
              <Tape variant={isApproved ? "marker" : "dark"}>V{p.version.number}</Tape>
              <ChevronDown className="size-3.5 text-c-ink-3" />
            </button>
            {versionsOpen && (
              <div className="absolute top-10 left-0 z-40 w-72 overflow-hidden rounded-lg border border-c-line bg-c-panel-2 py-1 shadow-2xl" onMouseLeave={() => setVersionsOpen(false)}>
                {p.versions.map((v) => (
                  <Link key={v.id} href={`${versionHrefBase}${v.id}`} className={cx("flex items-center gap-2 px-3 py-2 hover:bg-white/8", v.id === versionId && "bg-white/5")}>
                    <Tape variant={v.id === p.piece.approvedVersionId ? "marker" : "dark"}>V{v.number}</Tape>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] text-c-ink">{VERSION_STATUS[v.status].label}</span>
                      <span className="block truncate text-[11px] text-c-ink-3">{verTag(v.id) || fmtDateTime(v.createdAt)}</span>
                    </span>
                    {v.id === versionId && <Check className="size-4 text-marker" />}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-white/8 px-2 py-0.5 text-[12px] text-c-ink-2 md:inline-flex">
            {!p.version.publishedAt && <Lock className="size-3 text-marker" />}
            {vs.label}
          </span>
          {verTag(versionId) && <span className="hidden text-[12px] text-c-ink-3 lg:inline">{verTag(versionId)}</span>}

          <div className="ml-auto flex items-center gap-1">
            {others.length > 0 && (
              <Link href={`${versionHrefBase}${versionId}/comparar?con=${others[0].id}`} className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-c-ink-2 hover:bg-white/8 hover:text-c-ink sm:inline-flex">
                <Columns2 className="size-4" /> Comparar
              </Link>
            )}
            <div className="relative hidden sm:block">
              <button type="button" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-c-ink-2 hover:bg-white/8 hover:text-c-ink">
                <Download className="size-4" /> Exportar
              </button>
              {exportOpen && (
                <div className="absolute top-10 right-0 z-40 w-60 overflow-hidden rounded-lg border border-c-line bg-c-panel-2 py-1 text-[13px] shadow-2xl" onMouseLeave={() => setExportOpen(false)}>
                  <a className="flex items-center gap-2 px-3 py-2 text-c-ink-2 hover:bg-white/8 hover:text-c-ink" href={reportHref} target="_blank" rel="noopener">
                    <FileText className="size-4" /> Informe imprimible / PDF
                  </a>
                  {(["csv", "txt", "json"] as const).map((f) => (
                    <a key={f} className="block px-3 py-2 text-c-ink-2 hover:bg-white/8 hover:text-c-ink" href={apiUrl(`/api/review/${versionId}/export?format=${f}`, linkId)}>
                      Comentarios en {f.toUpperCase()}
                    </a>
                  ))}
                  <p className="border-t border-c-line px-3 py-2 text-[11px] text-c-ink-3">No son marcadores de Premiere: la integración está pendiente de validar.</p>
                </div>
              )}
            </div>
            {p.perms.share && (
              <Link href={`/proyectos/${p.piece.projectId}/compartir?pieza=${p.piece.id}&version=${versionId}`} className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-c-ink-2 hover:bg-white/8 hover:text-c-ink md:inline-flex">
                <Share2 className="size-4" /> Compartir
              </Link>
            )}
            <button type="button" onClick={() => setDialog("shortcuts")} className="hidden size-8 place-items-center rounded-md text-c-ink-2 hover:bg-white/8 sm:grid" aria-label="Atajos de teclado" title="Atajos (?)">
              <Keyboard className="size-4" />
            </button>
            {p.perms.internalChanges && (
              <button type="button" onClick={() => setDialog("internal")} className="h-8 rounded-md px-2.5 text-[13px] whitespace-nowrap text-c-ink-2 hover:bg-white/8 hover:text-c-ink">
                <span className="sm:hidden">Cambios</span>
                <span className="hidden sm:inline">Pedir cambios internos</span>
              </button>
            )}
            {p.perms.publish && (
              <button type="button" onClick={() => setDialog("publish")} className="h-8 rounded-md bg-marker px-3 text-[13px] font-semibold whitespace-nowrap text-ink">
                Publicar<span className="hidden sm:inline"> al cliente</span>
              </button>
            )}
            {p.perms.decide && (
              <>
                {p.version.status !== "CHANGES_REQUESTED" && (
                  <button type="button" onClick={() => setDialog("CHANGES_REQUESTED")} className="h-8 rounded-md border border-c-line px-2.5 text-[13px] whitespace-nowrap text-c-ink hover:bg-white/8">
                    <span className="sm:hidden">Cambios</span>
                    <span className="hidden sm:inline">Pedir cambios</span>
                  </button>
                )}
                <button type="button" onClick={() => setDialog("APPROVED")} className="h-8 rounded-md bg-[#3DDC97] px-3 text-[13px] font-semibold whitespace-nowrap text-ink">
                  Aprobar<span className="hidden sm:inline"> V{p.version.number}</span>
                </button>
              </>
            )}
            <button type="button" onClick={() => setFocus(true)} className="hidden size-8 place-items-center rounded-md text-c-ink-2 hover:bg-white/8 lg:grid" aria-label="Ocultar panel de comentarios">
              <PanelRightClose className="size-4" />
            </button>
          </div>
        </header>
      )}

      {!p.version.publishedAt && p.me.internal && !focus && (
        <div className="flex items-center gap-2 border-b border-marker/20 bg-marker/10 px-4 py-1.5 text-[12px] text-marker">
          <Lock className="size-3.5" /> Versión interna: el cliente no la ve y todos los comentarios quedan dentro de la agencia.
        </div>
      )}
      {isApproved && !focus && (
        <div className="flex items-center gap-2 border-b border-[#3DDC97]/20 bg-[#3DDC97]/10 px-4 py-1.5 text-[12px] text-[#3DDC97]">
          <Check className="size-3.5" /> Versión aprobada
          {p.approvals.find((a) => a.decision === "APPROVED" && !a.revokedAt) &&
            ` por ${p.approvals.find((a) => a.decision === "APPROVED" && !a.revokedAt)!.actorName} el ${fmtDateTime(p.approvals.find((a) => a.decision === "APPROVED" && !a.revokedAt)!.createdAt)}`}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Escenario */}
        <section className="flex min-h-0 shrink-0 flex-col lg:flex-1" aria-label="Reproductor">
          <div
            ref={stage}
            className={cx("relative h-[42vh] overflow-hidden bg-black sm:h-[50vh] lg:h-auto lg:min-h-0 lg:flex-1", zoom > 1 && !drawing && "cursor-grab active:cursor-grabbing")}
            onPointerDown={(e) => {
              if (zoom <= 1 || drawing) return;
              const start = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
              const move = (ev: PointerEvent) => setPan({ x: start.px + ev.clientX - start.x, y: start.py + ev.clientY - start.y });
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
            onDoubleClick={() => !drawing && player.toggle()}
          >
            <div className="absolute inset-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}>
              {p.media && p.media.status === "READY" && mediaUrl ? (
                <video
                  ref={player.ref}
                  src={mediaUrl}
                  className="absolute inset-0 size-full object-contain"
                  playsInline
                  preload="auto"
                  onClick={() => !drawing && zoom === 1 && player.toggle()}
                  aria-label={`Vídeo ${p.piece.title} V${p.version.number}`}
                />
              ) : null}
              <div className="absolute" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
                {shownShapes.length > 0 && <ShapesSvg shapes={shownShapes} width={rect.width} height={rect.height} className="pointer-events-none absolute inset-0" />}
                {drawing && (
                  <DrawingSurface
                    width={rect.width}
                    height={rect.height}
                    tool={tool}
                    color={color}
                    shapes={draft.shapes}
                    onAdd={(s) => {
                      setDraft((d) => ({ ...d, shapes: [...d.shapes, s] }));
                      setRedo([]);
                    }}
                  />
                )}
              </div>
            </div>
            {/* Estados */}
            {!p.media || p.media.status !== "READY" ? (
              <div className="absolute inset-0 grid place-items-center text-center text-sm text-c-ink-2">
                <p>{p.media?.status === "UPLOADING" ? "El archivo aún se está subiendo." : p.media?.status === "PROCESSING" ? "Procesando el vídeo…" : "Esta versión no tiene un archivo reproducible."}</p>
              </div>
            ) : player.state.status === "loading" || player.state.status === "stalled" ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <Loader2 className="size-8 animate-spin text-white/70" aria-label="Cargando vídeo" />
              </div>
            ) : player.state.status === "error" ? (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <div>
                  <AlertTriangle className="mx-auto mb-2 size-6 text-marker" />
                  <p className="text-sm text-c-ink">{player.state.error}</p>
                  <button type="button" className="mt-3 h-8 rounded-md bg-white/10 px-3 text-[13px]" onClick={() => { mediaRetries.current = 0; restoreAt.current = player.state.timeMs; void refresh().then((n) => n?.media?.url && setMediaUrl(n.media.url)); }}>
                    Reintentar
                  </button>
                </div>
              </div>
            ) : null}
            {drawing && (
              <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2">
                <DrawToolbar
                  tool={tool}
                  setTool={setTool}
                  color={color}
                  setColor={setColor}
                  canUndo={draft.shapes.length > 0}
                  canRedo={redo.length > 0}
                  onUndo={() => {
                    setRedo((r) => [...r, draft.shapes[draft.shapes.length - 1]]);
                    setDraft((d) => ({ ...d, shapes: d.shapes.slice(0, -1) }));
                  }}
                  onRedo={() => {
                    setDraft((d) => ({ ...d, shapes: [...d.shapes, redo[redo.length - 1]] }));
                    setRedo((r) => r.slice(0, -1));
                  }}
                  onClear={() => {
                    setRedo([]);
                    setDraft((d) => ({ ...d, shapes: [] }));
                  }}
                  onDone={() => {
                    setDrawing(false);
                    (document.querySelector("#composer textarea") as HTMLTextAreaElement | null)?.focus();
                  }}
                />
              </div>
            )}
            {focus && (
              <button type="button" onClick={() => setFocus(false)} className="absolute top-3 right-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-md bg-black/60 px-2.5 text-[12px] text-white backdrop-blur hover:bg-black/80">
                <PanelRightOpen className="size-4" /> Salir del modo enfoque
              </button>
            )}
          </div>
          <div className="shrink-0 border-t border-c-line bg-c-panel px-3 pt-1 pb-2">
            <Timeline
              durationMs={player.state.durationMs}
              timeMs={player.state.timeMs}
              bufferedMs={player.state.bufferedMs}
              markers={markers}
              range={composerRange}
              onRangeChange={(r) => setDraft((d) => ({ ...d, range: r }))}
              onSeek={player.seek}
              onMarker={(id) => {
                const c = p.comments.find((x) => x.id === id);
                if (c) {
                  select(c);
                  setMobileTab("comments");
                }
              }}
              previewSrc={mediaUrl || undefined}
              fps={showFrames ? fps : null}
            />
            <Controls
              player={player}
              fmt={fmt}
              showFrames={showFrames}
              setShowFrames={setShowFrames}
              frameApprox={frameApprox}
              loopOn={loopOn}
              onToggleLoop={toggleLoop}
              canLoop={!!composerRange || selected?.endMs != null}
              zoom={zoom}
              setZoom={(z) => {
                setZoom(z);
                setPan({ x: 0, y: 0 });
              }}
              fullscreen={fullscreen}
              onFullscreen={toggleFullscreen}
              focus={focus}
              onFocus={() => setFocus((f) => !f)}
            />
          </div>
        </section>

        {/* Panel lateral */}
        {!focus && (
          <aside className="relative flex min-h-0 flex-1 flex-col border-c-line bg-c-panel lg:flex-none lg:border-l" style={{ width: undefined }} aria-label="Comentarios">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar panel"
              tabIndex={0}
              className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize hover:bg-marker/30 lg:block"
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setPanelW((w) => Math.min(640, w + 24));
                if (e.key === "ArrowRight") setPanelW((w) => Math.max(300, w - 24));
              }}
              onPointerDown={(e) => {
                const startX = e.clientX;
                const startW = panelW;
                const move = (ev: PointerEvent) => setPanelW(Math.max(300, Math.min(640, startW - (ev.clientX - startX))));
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  try {
                    localStorage.setItem("corte:panelW", String(panelW));
                  } catch {
                    /* ignorar */
                  }
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            />
            <div className="hidden border-b border-c-line lg:flex" role="tablist">
              {(
                [
                  ["comments", `Comentarios · ${roots.filter((c) => !c.deleted).length}`],
                  ["info", "Versión y decisiones"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={mobileTab === k} onClick={() => setMobileTab(k)} className={cx("h-10 flex-1 text-[13px]", mobileTab === k ? "border-b-2 border-marker text-c-ink" : "text-c-ink-3 hover:text-c-ink")}>
                  {label}
                </button>
              ))}
            </div>
            <style>{`@media (min-width: 1024px){ aside[aria-label="Comentarios"]{ width:${panelW}px } }`}</style>
            {panel}
          </aside>
        )}
      </div>

      <DecisionDialog
        open={dialog === "APPROVED" || dialog === "CHANGES_REQUESTED"}
        onClose={() => setDialog(null)}
        decision={dialog === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : "APPROVED"}
        versionLabel={`V${p.version.number}`}
        openCount={openCount}
        resolvedCount={resolvedCount}
        policy={p.policy}
        onBehalf={p.perms.decideOnBehalf}
        onConfirm={async (note, ack) => {
          const decision = dialog === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : "APPROVED";
          await mutate(`/api/review/${versionId}/decision`, "POST", { decision, note, acknowledgeOpen: ack }, decision === "APPROVED" ? `V${p.version.number} aprobada` : "Cambios solicitados");
          setDialog(null);
        }}
      />
      <NoteDialog
        open={dialog === "publish"}
        onClose={() => setDialog(null)}
        title={`Publicar V${p.version.number} al cliente`}
        description={
          <>
            El cliente podrá verla y comentar. Los comentarios internos <strong className="text-c-ink">no</strong> se publican.
            {p.piece.clientVersionId && p.piece.clientVersionId !== versionId && " La versión que veía hasta ahora quedará como sustituida si no tenía decisión."}
          </>
        }
        label="Nota para el registro"
        confirmLabel="Publicar"
        onConfirm={async (note) => {
          await mutate(`/api/review/${versionId}/publish`, "POST", { note }, "Publicada al cliente");
          setDialog(null);
        }}
      />
      <NoteDialog
        open={dialog === "internal"}
        onClose={() => setDialog(null)}
        title="Pedir cambios internos"
        description="El editor recibirá aviso. El cliente no verá esta versión."
        label="Qué hay que cambiar"
        required
        confirmLabel="Enviar al editor"
        onConfirm={async (note) => {
          await mutate(`/api/review/${versionId}/internal-changes`, "POST", { note }, "Cambios internos enviados");
          setDialog(null);
        }}
      />
      <ShortcutsDialog open={dialog === "shortcuts"} onClose={() => setDialog(null)} frameApprox={frameApprox} />

      <div aria-live="polite" className="pointer-events-none fixed top-14 left-1/2 z-50 -translate-x-1/2">
        {toast && <div className="rounded-md bg-white px-3 py-2 text-[13px] font-medium text-ink shadow-xl">{toast}</div>}
      </div>
    </div>
  );
}

function VersionInfo({ p, fmt, versionHrefBase, onRevoke }: { p: Payload; fmt: (ms: number) => string; versionHrefBase: string; onRevoke: (id: string) => Promise<void> }) {
  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <section>
        <h3 className="mb-2 text-[12px] font-semibold tracking-wider text-c-ink-3 uppercase">Esta versión</h3>
        <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-c-ink-3">Estado</dt>
          <dd>{VERSION_STATUS[p.version.status].label}</dd>
          <dt className="text-c-ink-3">Subida por</dt>
          <dd>{p.version.uploadedBy || "—"} · {fmtDateTime(p.version.createdAt)}</dd>
          {p.version.publishedAt && (
            <>
              <dt className="text-c-ink-3">Publicada</dt>
              <dd>{fmtDateTime(p.version.publishedAt)}</dd>
            </>
          )}
          <dt className="text-c-ink-3">Formato</dt>
          <dd>
            {p.version.width && p.version.height ? `${p.version.width}×${p.version.height}` : "—"}
            {p.version.durationMs ? ` · ${formatClock(p.version.durationMs)}` : ""}
          </dd>
          <dt className="text-c-ink-3">Fotogramas</dt>
          <dd>{p.version.fps ? `${p.version.fps} fps ${p.version.fpsVerified ? "(verificados)" : "(declarados, sin verificar)"}` : "Desconocidos: paso aproximado"}</dd>
        </dl>
        {p.version.changeSummary && (
          <div className="mt-3 rounded-md bg-c-bg p-3 text-[13px] whitespace-pre-line text-c-ink-2">
            <p className="mb-1 font-medium text-c-ink">Cambios en esta versión</p>
            {p.version.changeSummary}
          </div>
        )}
        {p.media?.downloadable && p.media.status === "READY" && (
          <div className="mt-3">
            <FileDownload p={p} />
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-semibold tracking-wider text-c-ink-3 uppercase">Decisiones</h3>
        {p.approvals.length ? (
          <ul className="flex flex-col gap-2">
            {p.approvals.map((a) => (
              <li key={a.id} className={cx("rounded-md border border-c-line p-2.5 text-[13px]", a.revokedAt && "opacity-60")}>
                <p className="font-medium">
                  {a.decision === "APPROVED" ? "Aprobada" : "Cambios solicitados"} por {a.actorName}
                </p>
                <p className="text-[12px] text-c-ink-3">
                  {fmtDateTime(a.createdAt)}
                  {a.decision === "APPROVED" && a.openCorrections > 0 && ` · con ${a.openCorrections} correcciones abiertas${a.acknowledgedOpen ? " (confirmado)" : ""}`}
                </p>
                {a.note && <p className="mt-1 text-c-ink-2">{a.note}</p>}
                {a.revokedAt && <p className="mt-1 text-[12px] text-[#ff8a80]">Revocada {fmtDateTime(a.revokedAt)}: {a.revokeReason}</p>}
                {p.perms.revoke && a.decision === "APPROVED" && !a.revokedAt && (
                  <button type="button" onClick={() => void onRevoke(a.id)} className="mt-1 text-[12px] text-c-ink-3 underline hover:text-c-ink">
                    Revocar aprobación
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-c-ink-3">Sin decisiones sobre esta versión.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-semibold tracking-wider text-c-ink-3 uppercase">Pendientes de versiones anteriores</h3>
        {p.priorCorrections.length ? (
          <ul className="flex flex-col gap-1.5">
            {p.priorCorrections.map((c) => (
              <li key={c.id}>
                <Link href={`${versionHrefBase}${c.versionId}?c=${c.commentId}`} className="block rounded-md border border-c-line p-2.5 text-[13px] hover:bg-white/5">
                  <span className="flex items-center gap-2 text-[12px] text-c-ink-3">
                    <span className="font-mono">V{c.originNumber}</span>
                    {c.timeMs != null && <span className="font-mono text-marker">{fmt(c.timeMs)}</span>}
                    <span style={{ color: STATUS_COLOR[c.status] }}>{CORRECTION_STATUS[c.status].label}{c.addressedIn ? ` en V${c.addressedIn}` : ""}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-c-ink-2">{c.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-c-ink-3">Nada pendiente de versiones anteriores.</p>
        )}
        <p className="mt-2 text-[11px] text-c-ink-3">Los comentarios no se copian entre versiones: los tiempos pueden no coincidir tras un cambio de montaje.</p>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-semibold tracking-wider text-c-ink-3 uppercase">Historial de versiones</h3>
        <ul className="flex flex-col gap-1">
          {p.versions.map((v) => (
            <li key={v.id}>
              <Link href={`${versionHrefBase}${v.id}`} className={cx("flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-white/5", v.id === p.version.id && "bg-white/5")}>
                <Tape variant={v.id === p.piece.approvedVersionId ? "marker" : "dark"}>V{v.number}</Tape>
                <span className="flex-1 text-c-ink-2">{VERSION_STATUS[v.status].label}</span>
                <span className="text-[12px] text-c-ink-3">{fmtDateTime(v.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FileDownload({ p }: { p: Payload }) {
  if (!p.media) return null;
  return <DownloadButton assetId={p.media.assetId} linkId={p.me.linkId} label="Descargar esta versión" />;
}
