"use client";

import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import type { Editor } from "@tiptap/core";
import type * as Y from "yjs";
import Link from "next/link";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import type { StoryMaps } from "@/lib/screenplay/story-doc";
import {
  REFERENCE_KINDS,
  isReferenceKind,
  referenceId,
  safeUrl,
  type Reference,
  type ReferenceAnchor,
  type SceneInfo,
  type SceneMeta,
  type Suggestion,
} from "@/lib/screenplay/story";

export type View = "page" | "board" | "time" | "characters" | "references" | "story";

export const VIEWS: { id: View; label: string }[] = [
  { id: "page", label: "Página" },
  { id: "board", label: "Corcho" },
  { id: "time", label: "Tiempo" },
  { id: "characters", label: "Personajes" },
  { id: "references", label: "Referencias" },
  { id: "story", label: "Historia" },
];

export type Workspace = {
  screenplayId: string;
  ydoc: Y.Doc;
  maps: StoryMaps;
  editor: Editor | null;
  blocks: ScreenplayBlock[];
  scenes: SceneInfo[];
  characters: { name: string; lines: number }[];
  currentSid: string | null;
  userName: string;
  goToScene: (sid: string) => void;
  moveScene: (sid: string, toIndex: number) => void;
  flushSave: () => Promise<boolean>;
  setView: (v: View) => void;
};

const Ctx = createContext<Workspace | null>(null);
export const WorkspaceProvider = Ctx.Provider;

export function useWorkspace(): Workspace {
  const w = useContext(Ctx);
  if (!w) throw new Error("useWorkspace fuera del espacio de trabajo del guion");
  return w;
}

// ------------------------------------------------------------------ escrituras en el documento

export function updateSceneMeta(maps: StoryMaps, sid: string, patch: Partial<SceneMeta>) {
  const prev = maps.scenes.get(sid) ?? {};
  maps.scenes.set(sid, { ...prev, ...patch });
}

export function addReference(maps: StoryMaps, ref: Reference) {
  maps.refs.set(ref.id, ref);
}

export function suggestionsOf(ai: Record<string, unknown>): Suggestion[] {
  return Array.isArray(ai.suggestions) ? (ai.suggestions as Suggestion[]) : [];
}

// Añade a la bandeja lo nuevo de la IA sin repetir obras que ya estén
// guardadas o pendientes de revisar (mismo título, sin mirar mayúsculas).
export function pushSuggestions(maps: StoryMaps, incoming: Suggestion[]) {
  const norm = (t: string) => t.trim().toLowerCase();
  const pending = suggestionsOf(maps.ai.toJSON());
  const known = new Set([...pending.map((x) => norm(x.title)), ...[...maps.refs.values()].map((r) => norm(r.title))]);
  const fresh = incoming.filter((x) => !known.has(norm(x.title)));
  maps.ai.set("suggestions", [...fresh, ...pending].slice(0, 60));
  return fresh.length;
}

export function anchorKey(a: ReferenceAnchor): string {
  return a.type === "scene" ? `scene:${a.sid}` : a.type === "character" ? `character:${a.name}` : "script";
}

export function anchorLabel(a: ReferenceAnchor, scenes: SceneInfo[]): string {
  if (a.type === "scene") {
    const s = scenes.find((x) => x.sid === a.sid);
    return s ? `Escena ${s.number}` : "Escena borrada";
  }
  if (a.type === "character") return a.name;
  return "Toda la historia";
}

// ------------------------------------------------------------------ piezas comunes

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
      <h3 className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">{children}</h3>
      {right}
    </div>
  );
}

// Botón de ayuda de IA: guarda primero (la IA lee lo último), enseña que
// está pensando y muestra el error en su sitio.
export function AiButton({
  label,
  pendingLabel = "Leyendo el guion…",
  run,
  className,
}: {
  label: string;
  pendingLabel?: string;
  run: () => Promise<{ ok: true } | { ok: false; error: string; upgrade?: boolean }>;
  className?: string;
}) {
  const { flushSave } = useWorkspace();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            await flushSave();
            const res = await run();
            if (!res.ok) setError({ text: res.error, upgrade: res.upgrade });
          })
        }
        className="sp-ai-btn"
      >
        <span aria-hidden className={`sp-ai-dot ${pending ? "animate-pulse" : ""}`} />
        {pending ? pendingLabel : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 font-mono text-[11px] text-danger">
          {error.text}{" "}
          {error.upgrade && (
            <Link href="/app/organizacion" className="underline">
              Ver planes
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

// Texto editable en el sitio que escribe en el documento al salir del campo.
export function InlineText({
  value,
  onSave,
  placeholder,
  rows = 2,
  className,
  label,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  rows?: number;
  className?: string;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = draft ?? value;
  // Crece con el texto: nada queda cortado ni con barra de desplazamiento.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={text}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onSave(draft.trim());
        setDraft(null);
      }}
      className={`block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted/60 focus:bg-white/[0.03] ${className ?? ""}`}
    />
  );
}

// ------------------------------------------------------------------ referencias

export function ReferenceRow({
  item,
  scenes,
  onDelete,
  onAccept,
  showAnchor,
}: {
  item: Reference | Suggestion;
  scenes: SceneInfo[];
  onDelete: () => void;
  onAccept?: () => void;
  showAnchor?: boolean;
}) {
  const suggestion = Boolean(onAccept);
  const url = safeUrl(item.url);
  return (
    <article className={`sp-ref ${suggestion ? "sp-ref-suggested" : ""}`}>
      <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
        {REFERENCE_KINDS[item.kind] ?? "Referencia"}
        {showAnchor && <span className="text-accent"> · {anchorLabel(item.anchor, scenes)}</span>}
        {suggestion && <span className="text-warn"> · Sugerida por la IA</span>}
        {!suggestion && item.source === "ai" && <span> · vía IA</span>}
      </p>
      <h4 className="mt-1.5 font-display text-[15px] leading-snug font-bold">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-4 hover:decoration-accent">
            {item.title}
          </a>
        ) : (
          item.title
        )}
        {(item.year || item.author) && (
          <span className="font-sans text-[13px] font-normal text-muted">
            {" "}
            {[item.author, item.year].filter(Boolean).join(", ")}
          </span>
        )}
      </h4>
      {item.detail && <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-fg/80">{item.detail}</p>}
      <div className="mt-3 flex gap-4 font-mono text-[10px] tracking-widest uppercase">
        {onAccept && (
          <button type="button" onClick={onAccept} className="text-accent hover:text-fg">
            Guardar
          </button>
        )}
        <button type="button" onClick={onDelete} className="text-muted hover:text-danger">
          {suggestion ? "Descartar" : "Quitar"}
        </button>
      </div>
    </article>
  );
}

export function ReferenceForm({
  defaultAnchor,
  onDone,
  compact,
}: {
  defaultAnchor: ReferenceAnchor;
  onDone?: () => void;
  compact?: boolean;
}) {
  const { maps, scenes, characters, userName } = useWorkspace();
  const id = useId();
  const [kind, setKind] = useState<string>("film");
  const [anchor, setAnchor] = useState(anchorKey(defaultAnchor));
  const field =
    "w-full border-b border-line bg-transparent py-1.5 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent";

  const submit = useCallback(
    (fd: FormData) => {
      const title = String(fd.get("title") ?? "").trim().slice(0, 160);
      if (!title) return;
      const a: ReferenceAnchor = anchor.startsWith("scene:")
        ? { type: "scene", sid: anchor.slice(6) }
        : anchor.startsWith("character:")
          ? { type: "character", name: anchor.slice(10) }
          : { type: "script" };
      addReference(maps, {
        id: referenceId(),
        kind: isReferenceKind(kind) ? kind : "other",
        title,
        year: String(fd.get("year") ?? "").trim().slice(0, 12) || undefined,
        author: String(fd.get("author") ?? "").trim().slice(0, 120) || undefined,
        url: safeUrl(fd.get("url")),
        detail: String(fd.get("detail") ?? "").trim().slice(0, 600) || undefined,
        anchor: a,
        source: "manual",
        by: userName,
        at: Date.now(),
      });
      onDone?.();
    },
    [anchor, kind, maps, onDone, userName],
  );

  return (
    <form action={submit} className="flex flex-col gap-3">
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Tipo</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${field} bg-bg`}>
            {Object.entries(REFERENCE_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Para</span>
          <select value={anchor} onChange={(e) => setAnchor(e.target.value)} className={`${field} bg-bg`}>
            <option value="script">Toda la historia</option>
            {scenes.map((s) => (
              <option key={s.sid} value={`scene:${s.sid}`}>
                Escena {s.number} · {s.heading.slice(0, 40)}
              </option>
            ))}
            {characters.map((c) => (
              <option key={c.name} value={`character:${c.name}`}>
                Personaje · {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input id={`${id}-t`} name="title" required maxLength={160} placeholder="Título (p. ej. Cinema Paradiso)" className={field} />
      <div className="grid grid-cols-2 gap-3">
        <input name="author" maxLength={120} placeholder="Director/a o autor/a" className={field} />
        <input name="year" maxLength={12} placeholder="Año" className={field} />
      </div>
      <input name="url" type="url" placeholder="Enlace (opcional)" className={field} />
      <textarea name="detail" rows={2} maxLength={600} placeholder="¿Qué tiene que te sirva? (la escena, el minuto, la luz…)" className={`${field} resize-none`} />
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary">
          Añadir referencia
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="link-action">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
